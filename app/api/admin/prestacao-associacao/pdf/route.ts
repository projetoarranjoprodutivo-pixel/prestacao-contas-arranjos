import { env } from "cloudflare:workers";
import { and, eq, inArray } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getAdminUser } from "@/lib/admin";
import { getDb } from "@/db";
import { associacoes, colaboradores, documentosAssociacao, prestacoes } from "@/db/schema";
import { createPdf, PdfSection } from "@/lib/pdf";

export const runtime="edge";
type Atividade={executada?:boolean;municipio?:string;comunidade?:string;propriedade?:string;agricultor?:string;beneficiario?:string;telefone?:string;tipoAtividade?:string;tipoMuda?:string;quantidadeMudas?:string;data?:string;inicio?:string;duracao?:string;resumo?:string;assinaturaProdutor?:string;assinaturaTecnico?:string};
type Arquivo={key:string;nome:string;tipo:string};
const informado=(v:unknown)=>String(v??"").trim()||"NÃO INFORMADO";
const dataBr=(v:unknown)=>{const s=String(v||"");const p=s.split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:informado(v)};
const lista=<T,>(json:string|null|undefined):T[]=>{try{const v=JSON.parse(json||"[]");return Array.isArray(v)?v:[]}catch{return[]}};
const mesReferencia=(competencia:string)=>new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${competencia}-02T12:00:00Z`));

export async function GET(request:Request){
  if(!await getAdminUser())return new Response("Acesso restrito",{status:403});
  const url=new URL(request.url);const competenciaUnica=url.searchParams.get("competencia")||"";const nomeAssociacao=url.searchParams.get("associacao")||"";
  const competencias=[...new Set([...url.searchParams.getAll("competencias"),...(competenciaUnica?[competenciaUnica]:[])])].filter(valor=>/^\d{4}-\d{2}$/.test(valor)).sort();
  if(!competencias.length)return new Response("Selecione ao menos uma competência válida",{status:400});
  const db=getDb();
  const associacao=await db.query.associacoes.findFirst({where:and(eq(associacoes.nome,nomeAssociacao),eq(associacoes.ativo,true))});
  if(!associacao)return new Response("Associação não encontrada",{status:404});
  const [relatorios,usuarios,financeiro]=await Promise.all([
    db.select().from(prestacoes).where(and(eq(prestacoes.associacao,associacao.nome),inArray(prestacoes.competencia,competencias))),
    db.select().from(colaboradores),
    db.select().from(documentosAssociacao).where(and(eq(documentosAssociacao.associacao,associacao.nome),inArray(documentosAssociacao.competencia,competencias))),
  ]);
  const nomes=new Map(usuarios.map(u=>[u.authUserId,u]));
  const atividades=relatorios.flatMap(r=>lista<Atividade>(r.atividadesJson).filter(a=>a.executada!==false).map(a=>({a,r,u:nomes.get(r.authUserId)})));
  const visitas=atividades.filter(x=>informado(x.a.tipoAtividade).toLocaleLowerCase("pt-BR")==="visita técnica");
  const eventos=atividades.filter(x=>!["visita técnica","entrega de mudas"].includes(informado(x.a.tipoAtividade).toLocaleLowerCase("pt-BR")));
  const entregas=atividades.filter(x=>informado(x.a.tipoAtividade).toLocaleLowerCase("pt-BR")==="entrega de mudas");
  const agricultoresMap=new Map<string,{nome:string;municipio:string;beneficios:string[];quantidade:number;observacoes:string[]}>();
  for(const {a} of atividades){const nome=informado(a.agricultor||a.beneficiario);if(nome==="NÃO INFORMADO")continue;const atual=agricultoresMap.get(nome)||{nome,municipio:informado(a.municipio),beneficios:[],quantidade:0,observacoes:[]};if(a.tipoAtividade)atual.beneficios.push(informado(a.tipoAtividade));if(a.tipoMuda)atual.beneficios.push(`MUDAS DE ${informado(a.tipoMuda)}`);atual.quantidade+=Number(a.quantidadeMudas)||0;if(a.resumo)atual.observacoes.push(a.resumo);agricultoresMap.set(nome,atual);}
  const agricultores=[...agricultoresMap.values()];
  const extratos=financeiro.flatMap(item=>lista<Arquivo>(item.extratosJson)),notas=financeiro.flatMap(item=>lista<Arquivo>(item.notasFiscaisJson)),anexos=relatorios.flatMap(r=>lista<Arquivo>(r.anexosJson));
  const referencias=competencias.map(mesReferencia).join("; ");
  const identificadorCompetencias=competencias.join("_");
  const tecnicos=[...new Set(relatorios.map(r=>nomes.get(r.authUserId)?.nomeCompleto).filter(Boolean))] as string[];
  const endereco=[associacao.endereco,associacao.numero,associacao.bairro,associacao.municipio,associacao.uf,associacao.cep].filter(Boolean).join(" - ");
  const enderecoPresidente=[associacao.presidenteEndereco,associacao.presidenteNumero,associacao.presidenteBairro,associacao.presidenteMunicipio,associacao.presidenteUf,associacao.presidenteCep].filter(Boolean).join(" - ");
  const sections:PdfSection[]=[
    {heading:"CABEÇALHO - DADOS COMPLETOS DA ASSOCIAÇÃO",lines:[`RAZÃO SOCIAL: ${informado(associacao.razaoSocial)}`,`NOME ABREVIADO: ${informado(associacao.nome)} | CNPJ: ${informado(associacao.cnpj)}`,`ENDEREÇO: ${informado(endereco)}`,`TELEFONE: ${informado(associacao.telefone)} | CELULAR: ${informado(associacao.celular)} | E-MAIL: ${informado(associacao.email)}`,`MUNICÍPIOS ATENDIDOS: ${lista<string>(associacao.municipiosJson).join(", ")||"NÃO INFORMADO"}`,`PRESIDENTE: ${informado(associacao.presidenteNome)} | CPF: ${informado(associacao.presidenteCpf)} | E-MAIL: ${informado(associacao.presidenteEmail)}`,`ENDEREÇO DO PRESIDENTE: ${informado(enderecoPresidente)}`]},
    {heading:"IDENTIFICAÇÃO",lines:[`ASSOCIAÇÃO: ${informado(associacao.razaoSocial||associacao.nome)}`,`CNPJ: ${informado(associacao.cnpj)}`,`MUNICÍPIO: ${informado(associacao.municipio)} / ${informado(associacao.uf)}`,`MESES DE REFERÊNCIA: ${referencias}`,`RESPONSÁVEL PELO PREENCHIMENTO: ${informado(associacao.presidenteNome)}`,`TÉCNICO(S) RESPONSÁVEL(IS): ${tecnicos.join("; ")||"NÃO INFORMADO"}`]},
    {heading:"AGRICULTORES",lines:agricultores.length?agricultores.map((a,i)=>`${i+1}. NOME DO AGRICULTOR: ${a.nome} | MUNICÍPIO: ${a.municipio} | TIPO DE BENEFÍCIO RECEBIDO: ${[...new Set(a.beneficios)].join(", ")||"ASSISTÊNCIA TÉCNICA"} | QUANTIDADE: ${a.quantidade||"NÃO INFORMADO"} | OBSERVAÇÕES: ${a.observacoes.join("; ")||"NÃO INFORMADO"}`):["NENHUM AGRICULTOR REGISTRADO NAS COMPETÊNCIAS SELECIONADAS."]},
    {heading:"VISITAS TÉCNICAS",lines:visitas.length?visitas.map((x,i)=>`${i+1}. DATA: ${dataBr(x.a.data)} | TÉCNICO RESPONSÁVEL: ${informado(x.u?.nomeCompleto)} | NOME DO AGRICULTOR: ${informado(x.a.agricultor||x.a.beneficiario)} | MUNICÍPIO: ${informado(x.a.municipio)} | ATIVIDADE PRODUTIVA: ${informado(x.a.tipoMuda||x.a.tipoAtividade)} | ENTREGAS: ${x.a.quantidadeMudas?`${x.a.quantidadeMudas} ${informado(x.a.tipoMuda)}`:"NÃO INFORMADO"} | OBSERVAÇÕES: ${informado(x.a.resumo)}`):["NENHUMA VISITA TÉCNICA REGISTRADA NAS COMPETÊNCIAS SELECIONADAS."]},
    {heading:"EVENTOS",lines:eventos.length?eventos.map((x,i)=>`${i+1}. DATA: ${dataBr(x.a.data)} | TIPO DE EVENTO / AÇÃO: ${informado(x.a.tipoAtividade)} | TEMA: ${informado(x.a.resumo)} | LOCAL: ${informado([x.a.comunidade,x.a.municipio].filter(Boolean).join(" - "))} | TÉCNICO / RESPONSÁVEL: ${informado(x.u?.nomeCompleto)} | Nº DE AGRICULTORES PARTICIPANTES: ${x.a.agricultor?1:"NÃO INFORMADO"} | RESULTADOS / ENCAMINHAMENTOS: ${informado(x.a.resumo)} | OBSERVAÇÕES: ${informado(x.r.observacoes)}`):["NENHUM EVENTO OU AÇÃO COLETIVA REGISTRADO NAS COMPETÊNCIAS SELECIONADAS."]},
    {heading:"ENTREGAS DE MUDAS",lines:entregas.length?entregas.map((x,i)=>`${i+1}. DATA: ${dataBr(x.a.data)} | MUNICÍPIO: ${informado(x.a.municipio)} | TIPO DE MUDAS: ${informado(x.a.tipoMuda)} | QUANTIDADE: ${informado(x.a.quantidadeMudas)} | RESPONSÁVEL: ${informado(x.u?.nomeCompleto)} | RESULTADO: ${informado(x.a.resumo)}`):["NENHUMA ENTREGA DE MUDAS REGISTRADA NAS COMPETÊNCIAS SELECIONADAS."]},
    {heading:"AQUISIÇÕES E DOCUMENTOS FISCAIS",lines:notas.length?notas.map((a,i)=>`${i+1}. DATA DA COMPRA: NÃO INFORMADO | INSUMO: NÃO INFORMADO | ITEM ADQUIRIDO: NÃO INFORMADO | QUANTIDADE: NÃO INFORMADO | VALOR UNITÁRIO: NÃO INFORMADO | VALOR TOTAL: NÃO INFORMADO | FORNECEDOR: NÃO INFORMADO | DOCUMENTO FISCAL: ${a.nome} | BENEFICIÁRIOS: NÃO INFORMADO | OBSERVAÇÕES: ARQUIVO INTEGRAL ANEXADO AO FINAL`):["NENHUMA NOTA FISCAL ENVIADA NAS COMPETÊNCIAS SELECIONADAS."]},
    {heading:"CONTROLE DE HORAS - FOMENTO",lines:relatorios.length?relatorios.map((r,i)=>{const u=nomes.get(r.authUserId);return `${i+1}. NOME DO PROFISSIONAL: ${informado(u?.nomeCompleto)} | CARGO / FUNÇÃO: ${informado(u?.cargo)} | PERÍODO DE REFERÊNCIA: ${mesReferencia(r.competencia)} | HORAS PREVISTAS: NÃO INFORMADO | HORAS TRABALHADAS: ${(r.totalMinutos/60).toLocaleString("pt-BR",{maximumFractionDigits:2})} | VALOR DA HORA: NÃO INFORMADO | VALOR CORRESPONDENTE: NÃO INFORMADO | OBSERVAÇÕES: ${informado(r.observacoes)}`;}):["NENHUM CONTROLE DE HORAS REGISTRADO NAS COMPETÊNCIAS SELECIONADAS."]},
    {heading:"RESUMO GERAL DA EXECUÇÃO DO FOMENTO",lines:[`AGRICULTORES CADASTRADOS: ${agricultores.length}`,`VISITAS TÉCNICAS REGISTRADAS: ${visitas.length}`,`EVENTOS / AÇÕES REGISTRADOS: ${eventos.length}`,`PARTICIPAÇÕES EM EVENTOS: ${eventos.filter(x=>x.a.agricultor).length||"NÃO INFORMADO"}`,`TOTAL DE MUDAS ENTREGUES: ${entregas.reduce((s,x)=>s+(Number(x.a.quantidadeMudas)||0),0).toLocaleString("pt-BR")}`,`TOTAL GASTO COM MUDAS: NÃO INFORMADO`, `TOTAL GASTO COM SEMENTES: NÃO INFORMADO`,`TOTAL GASTO COM ADUBO / FERTILIZANTE: NÃO INFORMADO`,`TOTAL GASTO COM OUTROS ITENS: NÃO INFORMADO`,`VALOR TOTAL DAS AQUISIÇÕES: NÃO INFORMADO`,`EXTRATOS BANCÁRIOS ANEXADOS: ${extratos.length}`,`NOTAS FISCAIS ANEXADAS: ${notas.length}`,`ANEXOS DOS RELATÓRIOS TÉCNICOS: ${anexos.length}`]},
  ];
  const base=await createPdf(`PRESTAÇÃO DE CONTAS À ADERES - ${associacao.nome} - ${referencias}`,sections);const pdf=await PDFDocument.load(base);const fonte=await pdf.embedFont(StandardFonts.HelveticaBold);
  const arquivos=[...extratos.map(a=>({...a,grupo:"EXTRATO BANCÁRIO"})),...notas.map(a=>({...a,grupo:"NOTA FISCAL"})),...anexos.map(a=>({...a,grupo:"ANEXO TÉCNICO"}))];
  for(const [indice,arquivo] of arquivos.entries()){const objeto=await env.BUCKET.get(arquivo.key,"arrayBuffer");if(!objeto)continue;const bytes=new Uint8Array(objeto);try{if(arquivo.tipo==="application/pdf"){const anexo=await PDFDocument.load(bytes);const paginas=await pdf.copyPages(anexo,anexo.getPageIndices());paginas.forEach(p=>pdf.addPage(p));}else if(arquivo.tipo==="image/jpeg"||arquivo.tipo==="image/png"){const imagem=arquivo.tipo==="image/png"?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const pagina=pdf.addPage([595.28,841.89]);pagina.drawRectangle({x:0,y:749.89,width:595.28,height:92,color:rgb(0.02,0.28,0.19)});pagina.drawText(`${arquivo.grupo} ${indice+1}: ${arquivo.nome}`.toLocaleUpperCase("pt-BR"),{x:42,y:790,size:9,font:fonte,color:rgb(1,1,1)});const escala=Math.min(511/imagem.width,650/imagem.height,1);pagina.drawImage(imagem,{x:(595.28-imagem.width*escala)/2,y:60+(650-imagem.height*escala)/2,width:imagem.width*escala,height:imagem.height*escala});}else await pdf.attach(bytes,arquivo.nome,{mimeType:arquivo.tipo||"application/octet-stream"});}catch{await pdf.attach(bytes,arquivo.nome,{mimeType:arquivo.tipo||"application/octet-stream"});}}
  const resultado=await pdf.save();return new Response(resultado.buffer.slice(resultado.byteOffset,resultado.byteOffset+resultado.byteLength),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="prestacao-aderes-${associacao.nome.replace(/[^a-zA-Z0-9_-]/g,"-")}-${identificadorCompetencias}.pdf"`}});
}
