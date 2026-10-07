import { eq, inArray } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { getDb } from "@/db";
import { associacoes, documentosAssociacao, prestacoes } from "@/db/schema";
import { chaveMunicipio, mapaAssociacoesPorMunicipio } from "@/lib/associacoes-municipios";
import { ehEntregaMudas, quantidadeEntregue, tipoMudaEntregue } from "@/lib/entregas-mudas";
import { TIPOS_MUDAS } from "@/lib/opcoes-atividades";
import { createPdf } from "@/lib/pdf";

export const runtime="edge";

type Arquivo={nome?:string;descricao?:string;quantidade?:string};
type Atividade={executada?:boolean;municipio?:string;tipoAtividade?:string;tipoMuda?:string;quantidadeMudas?:string;resumo?:string;observacao?:string};
type Totais={compradas:Map<string,number>;entregues:Map<string,number>;comprasSemQuantidade:Set<string>};

function lista<T>(json:string|null|undefined):T[]{try{const valor=JSON.parse(json||"[]");return Array.isArray(valor)?valor:[]}catch{return[]}}
function normalizar(valor:unknown){return String(valor??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleUpperCase("pt-BR");}
function numero(valor:unknown){const texto=String(valor??"").replace(/[^\d,.-]/g,"");if(!texto)return 0;const convertido=texto.includes(",")?texto.replaceAll(".","").replace(",","."):/^\d{1,3}(\.\d{3})+$/.test(texto)?texto.replaceAll(".",""):texto;const resultado=Number(convertido);return Number.isFinite(resultado)?resultado:0;}
function tipoComprado(arquivo:Arquivo){const texto=normalizar(`${arquivo.descricao||""} ${arquivo.nome||""}`);return [...TIPOS_MUDAS].sort((a,b)=>b.length-a.length).find(tipo=>texto.includes(normalizar(tipo)))||"TIPO NÃO IDENTIFICADO";}
function ehCompraMudas(arquivo:Arquivo){return /MUDA|SEMENTE|PLANTULA/.test(normalizar(`${arquivo.descricao||""} ${arquivo.nome||""}`));}
function somar(mapa:Map<string,number>,tipo:string,quantidade:number){mapa.set(tipo,(mapa.get(tipo)||0)+quantidade);}
function formatar(valor:number){return valor.toLocaleString("pt-BR",{maximumFractionDigits:2});}

export async function GET(request:Request){
  if(!await getAdminUser())return new Response("ACESSO RESTRITO",{status:403});
  const url=new URL(request.url);const competencias=[...new Set(url.searchParams.getAll("competencias"))].filter(valor=>/^\d{4}-\d{2}$/.test(valor)).sort();
  if(!competencias.length)return new Response("INFORME AO MENOS UMA COMPETÊNCIA",{status:400});
  const db=getDb();
  const [listaAssociacoes,registrosEntregas,documentos]=await Promise.all([
    db.select().from(associacoes).where(eq(associacoes.ativo,true)),
    db.select().from(prestacoes).where(inArray(prestacoes.competencia,competencias)),
    db.select().from(documentosAssociacao).where(inArray(documentosAssociacao.competencia,competencias)),
  ]);
  const porMunicipio=mapaAssociacoesPorMunicipio(listaAssociacoes);
  const totais=new Map<string,Totais>();
  const obter=(associacao:string)=>{const atual=totais.get(associacao)||{compradas:new Map<string,number>(),entregues:new Map<string,number>(),comprasSemQuantidade:new Set<string>()};totais.set(associacao,atual);return atual;};

  for(const registro of registrosEntregas){
    if(registro.authUserId!=="admin-importacao-mudas-2026")continue;
    for(const atividade of lista<Atividade>(registro.atividadesJson)){
      if(atividade.executada===false||!ehEntregaMudas(atividade))continue;
      const associacao=porMunicipio.get(chaveMunicipio(atividade.municipio))||"ASSOCIAÇÃO NÃO IDENTIFICADA";
      somar(obter(associacao).entregues,tipoMudaEntregue(atividade),quantidadeEntregue(atividade));
    }
  }
  for(const documento of documentos){
    const dados=obter(documento.associacao);
    for(const arquivo of lista<Arquivo>(documento.notasFiscaisJson)){
      if(!ehCompraMudas(arquivo))continue;
      const tipo=tipoComprado(arquivo),quantidade=numero(arquivo.quantidade);
      if(quantidade>0)somar(dados.compradas,tipo,quantidade);else dados.comprasSemQuantidade.add(tipo);
    }
  }

  const nomes=[...new Set([...listaAssociacoes.map(item=>item.nome),...totais.keys()])].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const secoes=[{heading:"RESUMO DO PERÍODO",lines:[`COMPETÊNCIAS: ${competencias.join(" · ")}`,"COMPARATIVO ENTRE AS MUDAS IDENTIFICADAS NAS NOTAS FISCAIS E AS MUDAS REGISTRADAS COMO ENTREGUES."]},...nomes.map(nome=>{
    const dados=obter(nome);const totalComprado=[...dados.compradas.values()].reduce((soma,item)=>soma+item,0);const totalEntregue=[...dados.entregues.values()].reduce((soma,item)=>soma+item,0);const saldo=totalComprado-totalEntregue;
    const compradas=[...dados.compradas.entries()].sort((a,b)=>a[0].localeCompare(b[0],"pt-BR")).map(([tipo,quantidade])=>`${tipo}: ${formatar(quantidade)}`);
    const entregues=[...dados.entregues.entries()].sort((a,b)=>a[0].localeCompare(b[0],"pt-BR")).map(([tipo,quantidade])=>`${tipo}: ${formatar(quantidade)}`);
    return{heading:nome,lines:[`TOTAL COMPRADO: ${formatar(totalComprado)} MUDAS`,`TOTAL ENTREGUE: ${formatar(totalEntregue)} MUDAS`,`SALDO (COMPRADO - ENTREGUE): ${formatar(saldo)} MUDAS`,`MUDAS COMPRADAS POR TIPO: ${compradas.join(" · ")||"NENHUMA QUANTIDADE IDENTIFICADA"}`,`MUDAS ENTREGUES POR TIPO: ${entregues.join(" · ")||"NENHUMA ENTREGA REGISTRADA"}`,...(dados.comprasSemQuantidade.size?[`COMPRAS SEM QUANTIDADE IDENTIFICADA: ${[...dados.comprasSemQuantidade].join(" · ")}`]:[])]};
  })];
  const pdf=await createPdf("COMPARATIVO DE MUDAS COMPRADAS E ENTREGUES",secoes);
  return new Response(pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="comparativo-mudas-${competencias.join("-")}.pdf"`}});
}
