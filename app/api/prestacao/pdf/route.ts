import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { associacoes, colaboradores, prestacoes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createPdf } from "@/lib/pdf";
import { isAdminEmail } from "@/lib/admin";
import { ADERES_LOGO_BASE64, PARCEIROS_LOGO_BASE64, PROJETO_LOGO_BASE64, RODAPE_LOGO_BASE64 } from "@/lib/pdf-assets";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export const runtime = "edge";

type Atividade = {
  executada?: boolean; municipio?: string; comunidade?: string; propriedade?: string;
  agricultor?: string; beneficiario?: string; telefone?: string; tipoAtividade?: string;
  tipoMuda?: string; quantidadeMudas?: string; data?: string; inicio?: string;
  duracao?: string; resumo?: string; assinaturaProdutor?: string; assinaturaTecnico?: string;
};

const W=595.28,H=841.89,M=42,VERDE=rgb(0.02,0.28,0.19),CINZA=rgb(0.88,0.9,0.9),PRETO=rgb(0.08,0.11,0.13);
function bytesBase64(valor:string){return Uint8Array.from(atob(valor),c=>c.charCodeAt(0));}
function assinaturaBytes(valor?:string){if(!valor?.startsWith("data:image/"))return null;try{return bytesBase64(valor.split(",")[1]||"");}catch{return null;}}
function mesCompetencia(valor:string){const [ano,mes]=valor.split("-");const nomes=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];return `${nomes[Number(mes)-1]||mes} DE ${ano}`;}
function dividir(texto:string,fonte:PDFFont,tamanho:number,largura:number){const palavras=String(texto||"NÃO INFORMADO").toUpperCase().split(/\s+/);const linhas:string[]=[];let atual="";for(const palavra of palavras){const teste=atual?`${atual} ${palavra}`:palavra;if(fonte.widthOfTextAtSize(teste,tamanho)<=largura)atual=teste;else{if(atual)linhas.push(atual);atual=palavra;}}if(atual)linhas.push(atual);return linhas;}
function centralizar(pagina:PDFPage,texto:string,y:number,fonte:PDFFont,tamanho:number,largura=W-M*2){const linhas=dividir(texto,fonte,tamanho,largura);linhas.forEach((linha,i)=>pagina.drawText(linha,{x:(W-fonte.widthOfTextAtSize(linha,tamanho))/2,y:y-i*(tamanho+3),size:tamanho,font:fonte,color:PRETO}));return y-linhas.length*(tamanho+3);}

async function adicionarCapa(pdf:PDFDocument,registro:typeof prestacoes.$inferSelect,colaborador:typeof colaboradores.$inferSelect|null,associacao:typeof associacoes.$inferSelect|null){
  const pagina=pdf.addPage([W,H]);const regular=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const [aderes,parceiros,projeto,rodape]=await Promise.all([pdf.embedJpg(bytesBase64(ADERES_LOGO_BASE64)),pdf.embedJpg(bytesBase64(PARCEIROS_LOGO_BASE64)),pdf.embedJpg(bytesBase64(PROJETO_LOGO_BASE64)),pdf.embedJpg(bytesBase64(RODAPE_LOGO_BASE64))]);
  pagina.drawImage(aderes,{x:42,y:752,width:122,height:61});pagina.drawImage(parceiros,{x:445,y:752,width:108,height:66});pagina.drawImage(projeto,{x:145,y:618,width:306,height:99});
  pagina.drawRectangle({x:70,y:522,width:455,height:86,color:rgb(0.85,0.88,0.89)});
  centralizar(pagina,"REALIZAÇÃO DE ASSISTÊNCIA TÉCNICA PARA",575,bold,10,400);centralizar(pagina,"AGRICULTORES E EMPREENDEDORES FAMILIARES",540,bold,10,400);
  pagina.drawRectangle({x:78,y:350,width:440,height:135,color:rgb(0.92,0.92,0.92)});
  const contratante=associacao?.razaoSocial||associacao?.nome||registro.associacao;
  const executor=colaborador?.nomeEmpresarial||colaborador?.nomeCompleto||"NÃO INFORMADO";
  const endereco=[colaborador?.endereco,colaborador?.numero,colaborador?.bairro,colaborador?.cidade,colaborador?.uf].filter(Boolean).join(", ");
  const esquerda=dividir(`CONTRATANTE: ${contratante}`,regular,8.5,200);esquerda.forEach((linha,i)=>pagina.drawText(linha,{x:92,y:460-i*11,size:8.5,font:regular,color:PRETO}));
  const dados=[`EXECUTORA: ${executor}`,`MEI/CNPJ: ${colaborador?.mei||"NÃO INFORMADO"}`,`ENDEREÇO: ${endereco||"NÃO INFORMADO"}`,`CONTATO: ${colaborador?.celular||"NÃO INFORMADO"}`,`E-MAIL: ${colaborador?.email||"NÃO INFORMADO"}`];
  let y=460;for(const dado of dados){for(const linha of dividir(dado,regular,8.5,205)){pagina.drawText(linha,{x:305,y,size:8.5,font:regular,color:PRETO});y-=11;}y-=5;}
  y=285;y=centralizar(pagina,"RELATÓRIO DAS ATIVIDADES",y,bold,15);y=centralizar(pagina,"RELACIONADAS AO PROJETO ARRANJOS PRODUTIVOS",y-11,bold,13);y=centralizar(pagina,"NO ESTADO DO ESPÍRITO SANTO",y-7,bold,13);centralizar(pagina,mesCompetencia(registro.competencia),y-16,bold,14);
  pagina.drawImage(rodape,{x:92,y:24,width:411,height:41});
}

async function copiarRelatorio(destino:PDFDocument,titulo:string,sections:Array<{heading?:string;lines:string[]}>){const origem=await PDFDocument.load(await createPdf(titulo,sections));const paginas=await destino.copyPages(origem,origem.getPageIndices());paginas.forEach(p=>destino.addPage(p));}

async function adicionarAssinaturas(pdf:PDFDocument,atividade:Atividade,indice:number){
  const pagina=pdf.addPage([W,H]);const regular=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  pagina.drawRectangle({x:0,y:H-92,width:W,height:92,color:VERDE});pagina.drawText("ARRANJOS PRODUTIVOS",{x:M,y:H-30,size:8,font:bold,color:rgb(0.69,0.9,0.79)});pagina.drawText(`ASSINATURAS - ATIVIDADE ${indice+1}`,{x:M,y:H-58,size:14,font:bold,color:rgb(1,1,1)});
  pagina.drawText(`${atividade.data||"SEM DATA"} | ${atividade.tipoAtividade||"ATIVIDADE"} | ${atividade.municipio||""}`.toUpperCase(),{x:M,y:720,size:9,font:regular,color:PRETO});
  const itens=[{titulo:"ASSINATURA DO PRODUTOR/REPRESENTANTE",valor:atividade.assinaturaProdutor},{titulo:"ASSINATURA DO TÉCNICO",valor:atividade.assinaturaTecnico}];
  for(const [pos,item] of itens.entries()){
    const topo=pos===0?655:370;pagina.drawRectangle({x:M,y:topo-215,width:W-M*2,height:225,color:rgb(0.97,0.98,0.97),borderColor:CINZA,borderWidth:0.8});pagina.drawText(item.titulo,{x:M+14,y:topo-18,size:10,font:bold,color:VERDE});
    const bytes=assinaturaBytes(item.valor);if(bytes){try{const imagem=item.valor?.startsWith("data:image/png")?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const escala=Math.min(455/imagem.width,150/imagem.height,1);pagina.drawImage(imagem,{x:(W-imagem.width*escala)/2,y:topo-188,width:imagem.width*escala,height:imagem.height*escala});}catch{pagina.drawText("ASSINATURA INDISPONÍVEL",{x:M+14,y:topo-110,size:9,font:regular});}}else pagina.drawText("NÃO ASSINADA",{x:M+14,y:topo-110,size:9,font:regular});
    pagina.drawLine({start:{x:M+14,y:topo-195},end:{x:W-M-14,y:topo-195},thickness:0.7,color:rgb(0.3,0.3,0.3)});
  }
}

export async function GET(request:Request){
  const user=await getChatGPTUser();if(!user)return new Response("Não autorizado",{status:401});
  const url=new URL(request.url);const id=Number(url.searchParams.get("id"));const competencia=url.searchParams.get("competencia")||"";if(id&&!isAdminEmail(user.email))return new Response("Acesso restrito",{status:403});
  const db=getDb();const registro=await db.query.prestacoes.findFirst({where:id?eq(prestacoes.id,id):and(eq(prestacoes.authUserId,user.userId),eq(prestacoes.competencia,competencia))});if(!registro)return new Response("Prestação não encontrada",{status:404});
  const [colaborador,associacao]=await Promise.all([db.query.colaboradores.findFirst({where:eq(colaboradores.authUserId,registro.authUserId)}),db.query.associacoes.findFirst({where:eq(associacoes.nome,registro.associacao)})]);
  const atividades=JSON.parse(registro.atividadesJson) as Atividade[];const pdf=await PDFDocument.create();await adicionarCapa(pdf,registro,colaborador||null,associacao||null);
  await copiarRelatorio(pdf,"DADOS DA PRESTAÇÃO DE CONTAS",[{heading:"IDENTIFICAÇÃO",lines:[`Colaborador: ${colaborador?.nomeCompleto||"Não informado"}`,`Cargo: ${colaborador?.cargo||"Não informado"}`,`Competência: ${mesCompetencia(registro.competencia)}`,`Associação: ${associacao?.razaoSocial||registro.associacao}`,`Carga horária executada: ${registro.totalMinutos} minutos`,`Quantidade de atividades: ${atividades.length}`]}]);
  for(const [i,a] of atividades.entries()){
    const linhas=[`${a.executada===false?"NÃO EXECUTADA":"EXECUTADA"} | Data: ${a.data||"Sem data"} | Hora: ${a.inicio||"Sem horário"}`,`Tipo de atividade: ${a.tipoAtividade||"Visita Técnica"}`,`Município: ${a.municipio||"Não informado"} | Comunidade: ${a.comunidade||"Não informada"}`];
    if(a.tipoAtividade==="Entrega de mudas")linhas.push(`Tipo de mudas: ${a.tipoMuda||"Não informado"} | Quantidade: ${a.quantidadeMudas||"0"}`);else linhas.push(`Agricultor: ${a.agricultor||a.beneficiario||"Não informado"}`,`Propriedade: ${a.propriedade||"Não informada"} | Telefone: ${a.telefone||"Não informado"}`);
    linhas.push(`${a.executada===false?"Motivo":"Duração: "+(a.duracao||"0")+" minutos | Resumo"}: ${a.resumo||"Não informado"}`);
    await copiarRelatorio(pdf,`ATIVIDADE ${i+1}`,[{heading:`ATIVIDADE EXECUTADA ${i+1}`,lines:linhas}]);await adicionarAssinaturas(pdf,a,i);
  }
  await copiarRelatorio(pdf,"OBSERVAÇÕES DA PRESTAÇÃO",[{heading:"OBSERVAÇÕES GERAIS",lines:[registro.observacoes||"Sem observações."]}]);
  const anexos=JSON.parse(registro.anexosJson||"[]") as Array<{key:string;nome:string;tipo:string}>;const fonte=await pdf.embedFont(StandardFonts.Helvetica);
  for(const [indice,anexo] of anexos.entries()){
    const objeto=await env.BUCKET.get(anexo.key,"arrayBuffer");if(!objeto)continue;const bytes=new Uint8Array(objeto);
    try{if(anexo.tipo==="application/pdf"){const documento=await PDFDocument.load(bytes);const paginas=await pdf.copyPages(documento,documento.getPageIndices());paginas.forEach(p=>pdf.addPage(p));}else if(anexo.tipo==="image/jpeg"||anexo.tipo==="image/png"){const imagem=anexo.tipo==="image/png"?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const pagina=pdf.addPage([W,H]);pagina.drawText(`ANEXO ${indice+1}: ${anexo.nome}`,{x:40,y:806,size:11,font:fonte,color:VERDE});const escala=Math.min(515/imagem.width,730/imagem.height,1);pagina.drawImage(imagem,{x:(W-imagem.width*escala)/2,y:45+(730-imagem.height*escala)/2,width:imagem.width*escala,height:imagem.height*escala});}else await pdf.attach(bytes,anexo.nome,{mimeType:anexo.tipo||"application/octet-stream",description:`Anexo da prestação ${registro.competencia}`});}catch{await pdf.attach(bytes,anexo.nome,{mimeType:anexo.tipo||"application/octet-stream",description:`Anexo da prestação ${registro.competencia}`});}
  }
  const resultado=await pdf.save();return new Response(resultado.buffer.slice(resultado.byteOffset,resultado.byteOffset+resultado.byteLength),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="prestacao-contas-${registro.competencia}.pdf"`}});
}
