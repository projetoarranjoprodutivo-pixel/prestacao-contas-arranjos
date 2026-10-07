import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { associacoes, colaboradores, prestacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { chaveMunicipio, mapaAssociacoesPorMunicipio } from "@/lib/associacoes-municipios";
import { ehEntregaMudas, quantidadeEntregue, tipoMudaEntregue } from "@/lib/entregas-mudas";
import { createPdf } from "@/lib/pdf";

export const runtime="edge";

function dataBr(valor:string){
  const partes=valor.split("-");
  return partes.length===3?`${partes[2]}/${partes[1]}/${partes[0]}`:"DATA NÃO INFORMADA";
}

export async function GET(request:Request){
  if(!await getAdminUser())return new Response("ACESSO RESTRITO",{status:403});
  const url=new URL(request.url);
  const competencias=[...new Set(url.searchParams.getAll("competencias"))].filter(valor=>/^\d{4}-\d{2}$/.test(valor)).sort();
  if(!competencias.length)return new Response("INFORME AO MENOS UMA COMPETÊNCIA",{status:400});

  const db=getDb();
  const [registros,usuarios,listaAssociacoes]=await Promise.all([
    db.select().from(prestacoes).where(inArray(prestacoes.competencia,competencias)),
    db.select().from(colaboradores),
    db.select().from(associacoes),
  ]);
  const nomes=new Map(usuarios.map(usuario=>[usuario.authUserId,usuario.nomeCompleto]));
  const associacoesPorMunicipio=mapaAssociacoesPorMunicipio(listaAssociacoes.filter(item=>item.ativo));
  const entregas:Array<{associacao:string;municipio:string;data:string;tipo:string;quantidade:number;competencia:string;responsavel:string}>=[];

  for(const registro of registros){
    if(registro.authUserId!=="admin-importacao-mudas-2026")continue;
    let atividades:Array<Record<string,unknown>>=[];
    try{atividades=JSON.parse(registro.atividadesJson||"[]");}catch{}
    for(const atividade of atividades){
      if(!ehEntregaMudas(atividade)||atividade.executada===false)continue;
      const municipio=String(atividade.municipio||"NÃO INFORMADO").trim()||"NÃO INFORMADO";
      entregas.push({
        associacao:associacoesPorMunicipio.get(chaveMunicipio(municipio))||"ASSOCIAÇÃO NÃO IDENTIFICADA",
        municipio,
        data:String(atividade.data||""),
        tipo:tipoMudaEntregue(atividade),
        quantidade:quantidadeEntregue(atividade),
        competencia:registro.competencia,
        responsavel:"LANÇAMENTO ADMINISTRATIVO",
      });
    }
  }

  entregas.sort((a,b)=>a.associacao.localeCompare(b.associacao,"pt-BR")||a.municipio.localeCompare(b.municipio,"pt-BR")||a.data.localeCompare(b.data));
  const total=entregas.reduce((soma,item)=>soma+item.quantidade,0);
  const nomesAssociacoes=[...new Set(entregas.map(item=>item.associacao))];
  const secoes=[
    {heading:"RESUMO DO PERÍODO",lines:[`COMPETÊNCIAS: ${competencias.join(" · ")}`,`TOTAL COM QUANTIDADE INFORMADA: ${total.toLocaleString("pt-BR")} MUDAS`,`TOTAL DE REGISTROS DE ENTREGA: ${entregas.length}`]},
    ...nomesAssociacoes.map(associacao=>({heading:associacao,lines:entregas.filter(item=>item.associacao===associacao).map(item=>`MUNICÍPIO: ${item.municipio} | DATA: ${dataBr(item.data)} | COMPETÊNCIA: ${item.competencia} | TIPO: ${item.tipo} | QUANTIDADE: ${item.quantidade>0?item.quantidade.toLocaleString("pt-BR"):"NÃO INFORMADA"} | RESPONSÁVEL: ${item.responsavel}`)})),
  ];
  if(!entregas.length)secoes.push({heading:"RESULTADO",lines:["NENHUMA ENTREGA DE MUDAS FOI ENCONTRADA NAS COMPETÊNCIAS SELECIONADAS."]});
  const pdf=await createPdf("RELATÓRIO CONSOLIDADO DE ENTREGAS DE MUDAS",secoes);
  return new Response(pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="entregas-mudas-${competencias.join("-")}.pdf"`}});
}
