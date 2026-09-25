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

async function adicionarAtividadeComAssinaturas(pdf:PDFDocument,atividade:Atividade,indice:number){
  const pagina=pdf.addPage([W,H]);const regular=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  pagina.drawRectangle({x:0,y:H-92,width:W,height:92,color:VERDE});pagina.drawText("ARRANJOS PRODUTIVOS",{x:M,y:H-30,size:8,font:bold,color:rgb(0.69,0.9,0.79)});pagina.drawText(`ATIVIDADE EXECUTADA ${indice+1}`,{x:M,y:H-58,size:14,font:bold,color:rgb(1,1,1)});
  const informacoes=[`${atividade.executada===false?"NÃO EXECUTADA":"EXECUTADA"} | DATA: ${atividade.data||"SEM DATA"} | HORA: ${atividade.inicio||"SEM HORÁRIO"}`,`TIPO DE ATIVIDADE: ${atividade.tipoAtividade||"VISITA TÉCNICA"}`,`MUNICÍPIO: ${atividade.municipio||"NÃO INFORMADO"} | COMUNIDADE: ${atividade.comunidade||"NÃO INFORMADA"}`];
  if(atividade.tipoAtividade==="Entrega de mudas")informacoes.push(`TIPO DE MUDAS: ${atividade.tipoMuda||"NÃO INFORMADO"} | QUANTIDADE: ${atividade.quantidadeMudas||"0"}`);else informacoes.push(`AGRICULTOR: ${atividade.agricultor||atividade.beneficiario||"NÃO INFORMADO"}`,`PROPRIEDADE: ${atividade.propriedade||"NÃO INFORMADA"} | TELEFONE: ${atividade.telefone||"NÃO INFORMADO"}`);
  informacoes.push(`${atividade.executada===false?"MOTIVO":"DURAÇÃO: "+(atividade.duracao||"0")+" MINUTOS | RESUMO"}: ${atividade.resumo||"NÃO INFORMADO"}`);
  let y=720;for(const texto of informacoes){const linhas=dividir(texto,regular,8.5,W-M*2-24);const altura=18+linhas.length*10;pagina.drawRectangle({x:M,y:y-altura+7,width:W-M*2,height:altura,color:rgb(0.96,0.97,0.98),borderColor:CINZA,borderWidth:0.5});linhas.forEach((linha,i)=>pagina.drawText(linha,{x:M+12,y:y-8-i*10,size:8.5,font:regular,color:PRETO}));y-=altura+5;}
  pagina.drawText("ASSINATURAS DA ATIVIDADE",{x:M,y:365,size:10,font:bold,color:VERDE});
  const itens=[{titulo:"ASSINATURA DO PRODUTOR/REPRESENTANTE",valor:atividade.assinaturaProdutor},{titulo:"ASSINATURA DO TÉCNICO",valor:atividade.assinaturaTecnico}];
  for(const [pos,item] of itens.entries()){
    const largura=(W-M*2-12)/2,x=M+pos*(largura+12),base=92,altura=255;pagina.drawRectangle({x,y:base,width:largura,height:altura,color:rgb(0.97,0.98,0.97),borderColor:CINZA,borderWidth:0.8});pagina.drawText(item.titulo,{x:x+10,y:base+altura-20,size:7.7,font:bold,color:VERDE});
    const bytes=assinaturaBytes(item.valor);if(bytes){try{const imagem=item.valor?.startsWith("data:image/png")?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const escala=Math.min((largura-20)/imagem.width,175/imagem.height,1);pagina.drawImage(imagem,{x:x+(largura-imagem.width*escala)/2,y:base+38,width:imagem.width*escala,height:imagem.height*escala});}catch{pagina.drawText("ASSINATURA INDISPONÍVEL",{x:x+10,y:base+120,size:8,font:regular});}}else pagina.drawText("NÃO ASSINADA",{x:x+10,y:base+120,size:8,font:regular});
    pagina.drawLine({start:{x:x+10,y:base+27},end:{x:x+largura-10,y:base+27},thickness:0.7,color:rgb(0.3,0.3,0.3)});
  }
}

async function adicionarTabelaAssociacoes(pdf:PDFDocument){
  const dados:Array<[string,string[]]>=[["MUNIZ CAF",["MUNIZ FREIRE","IÚNA","IBITIRAMA","DIVINO DE SÃO LOURENÇO"]],["AAFARSCRUZ",["GUAÇUÍ","ALEGRE","JERÔNIMO MONTEIRO"]],["APRVG",["BREJETUBA","CONCEIÇÃO DO CASTELO","IBATIBA"]],["APEAGRI",["ITAPEMIRIM","PIÚMA","RIO NOVO DO SUL","ICONHA"]],["APRUVAB",["ANCHIETA","GUARAPARI","ALFREDO CHAVES"]],["NEEMIAS",["ATÍLIO VIVÁCQUA"]],["AAFATRIM",["PEDRO CANÁRIO","MONTANHA"]],["ARQSCD",["CONCEIÇÃO DA BARRA","BOA ESPERANÇA","JAGUARÉ"]],["CAF COLATINA",["VILA VALÉRIO","SÃO DOMINGOS DO NORTE","COLATINA","MARILÂNDIA"]],["APPROVIPA",["VILA PAVÃO","ECOPORANGA","NOVA VENÉCIA"]],["AAFAMA",["PANCAS","ÁGUIA BRANCA"]],["AAFAIAR",["ALTO RIO NOVO","MANTENÓPOLIS"]],["APROFASAUNA",["IBIRAÇU","JOÃO NEIVA"]]];
  const pagina=pdf.addPage([W,H]);const regular=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);const [aderes,parceiros,rodape]=await Promise.all([pdf.embedJpg(bytesBase64(ADERES_LOGO_BASE64)),pdf.embedJpg(bytesBase64(PARCEIROS_LOGO_BASE64)),pdf.embedJpg(bytesBase64(RODAPE_LOGO_BASE64))]);
  pagina.drawImage(aderes,{x:42,y:765,width:80,height:40});pagina.drawImage(parceiros,{x:478,y:763,width:72,height:44});pagina.drawText("TABELA 1 - MUNICÍPIOS PARTICIPANTES DO PROJETO ARRANJOS PRODUTIVOS",{x:94,y:735,size:8.5,font:bold,color:VERDE});
  const x=108,w1=142,w2=238,row=15;let y=710;pagina.drawRectangle({x,y:y-row,width:w1+w2,height:row,color:rgb(0.86,0.87,0.87),borderColor:PRETO,borderWidth:0.8});pagina.drawText("ASSOCIAÇÃO",{x:x+39,y:y-11,size:8,font:bold});pagina.drawText("MUNICÍPIOS",{x:x+w1+80,y:y-11,size:8,font:bold});y-=row;
  for(const [nome,municipios] of dados){const altura=row*municipios.length;pagina.drawRectangle({x,y:y-altura,width:w1,height:altura,color:rgb(0.95,0.95,0.95),borderColor:PRETO,borderWidth:0.6});pagina.drawText(nome,{x:x+8,y:y-altura/2-3,size:7.5,font:bold,color:PRETO});municipios.forEach((municipio,i)=>{pagina.drawRectangle({x:x+w1,y:y-row*(i+1),width:w2,height:row,color:i%2?rgb(0.97,0.97,0.97):rgb(0.91,0.91,0.91),borderColor:PRETO,borderWidth:0.5});pagina.drawText(municipio,{x:x+w1+6,y:y-row*i-11,size:7.4,font:regular,color:PRETO});});y-=altura;}
  pagina.drawText("PÚBLICO-ALVO",{x:M,y:120,size:9,font:bold,color:VERDE});for(const [i,linha] of dividir("Agricultores e/ou empreendedores familiares rurais participantes do Projeto, registrados na ficha cadastral dos municípios acima citados.",regular,8.4,W-M*2).entries())pagina.drawText(linha,{x:M,y:103-i*11,size:8.4,font:regular,color:PRETO});pagina.drawImage(rodape,{x:92,y:23,width:411,height:41});
}

export async function GET(request:Request){
  const user=await getChatGPTUser();if(!user)return new Response("Não autorizado",{status:401});
  const url=new URL(request.url);const id=Number(url.searchParams.get("id"));const competencia=url.searchParams.get("competencia")||"";if(id&&!isAdminEmail(user.email))return new Response("Acesso restrito",{status:403});
  const db=getDb();const registro=await db.query.prestacoes.findFirst({where:id?eq(prestacoes.id,id):and(eq(prestacoes.authUserId,user.userId),eq(prestacoes.competencia,competencia))});if(!registro)return new Response("Prestação não encontrada",{status:404});
  const [colaborador,associacao]=await Promise.all([db.query.colaboradores.findFirst({where:eq(colaboradores.authUserId,registro.authUserId)}),db.query.associacoes.findFirst({where:eq(associacoes.nome,registro.associacao)})]);
  const atividades=JSON.parse(registro.atividadesJson) as Atividade[];const pdf=await PDFDocument.create();await adicionarCapa(pdf,registro,colaborador||null,associacao||null);
  const executor=colaborador?.nomeEmpresarial||colaborador?.nomeCompleto||"NÃO INFORMADO",cnpj=colaborador?.mei||"NÃO INFORMADO",municipiosAtendidos=(()=>{try{return (JSON.parse(colaborador?.municipiosAtendidosJson||"[]") as string[]).join(", ")||registro.municipio;}catch{return registro.municipio;}})();
  await copiarRelatorio(pdf,"APRESENTAÇÃO DO PROJETO ARRANJOS PRODUTIVOS",[
    {heading:"APRESENTAÇÃO DO PROJETO ARRANJOS PRODUTIVOS",lines:["O Projeto Arranjos Produtivos ‘Somar Conhecimento, Semear Desenvolvimento com Sustentabilidade’, promovido pela Casa dos Municípios da Assembleia Legislativa (ALES), é realizado em parceria com o Governo do Estado e com o apoio direto das prefeituras. O projeto constitui um compromisso com o desenvolvimento sustentável e a promoção econômica, incentivando a formação do agricultor, a assistência técnica, a aquisição de insumos agrícolas, a regularização e formalização das agroindústrias, associações e cooperativas, além do desenvolvimento local e da geração de renda para as famílias em seus empreendimentos rurais. A diversificação de culturas na agricultura familiar amplia a oferta de alimentos e contribui para a segurança alimentar local e regional."]},
    {heading:"1. OBJETO DA CONTRATAÇÃO",lines:[`Prestação de serviços de assistência técnica para agricultores e empreendedores familiares rurais pela empresa ${executor}, MEI/CNPJ ${cnpj}, compreendendo planejamento, organização, capacitação, orientação, controle, manutenção e apoio técnico aos agricultores e empreendedores familiares rurais. Inclui acompanhamento das etapas da cadeia produtiva, desde preparação e adubação do solo, definição do espaçamento, plantio, calagem, irrigação e poda até manutenção, colheita, armazenamento e comercialização.`]},
    {heading:"2. OBJETIVO",lines:["Fortalecer a agricultura capixaba e criar novas opções para os produtores rurais, impulsionando a agricultura familiar por meio de uma rede de cooperação com foco na capacitação, diversificação e desenvolvimento das cadeias produtivas, gerando renda e melhorando a qualidade de vida no campo."]},
    {heading:"3. ÁREA DE ABRANGÊNCIA",lines:[`A tabela seguinte apresenta os 36 municípios participantes e suas respectivas associações. O atendimento do colaborador ${colaborador?.nomeCompleto||executor} abrange: ${municipiosAtendidos||"NÃO INFORMADO"}.`]},
  ]);
  await adicionarTabelaAssociacoes(pdf);
  await copiarRelatorio(pdf,"ATIVIDADES DE ASSISTÊNCIA TÉCNICA",[{heading:"4. PÚBLICO-ALVO",lines:["Agricultores e/ou empreendedores familiares rurais participantes do Projeto, registrados na ficha cadastral dos municípios atendidos."]},{heading:"5. ATIVIDADES DE ASSISTÊNCIA TÉCNICA",lines:[`As atividades de assistência técnica para agricultores e empreendedores familiares rurais descritas neste relatório correspondem à competência ${mesCompetencia(registro.competencia)}.`]}]);
  await copiarRelatorio(pdf,"DADOS DA PRESTAÇÃO DE CONTAS",[{heading:"IDENTIFICAÇÃO",lines:[`Colaborador: ${colaborador?.nomeCompleto||"Não informado"}`,`Cargo: ${colaborador?.cargo||"Não informado"}`,`Competência: ${mesCompetencia(registro.competencia)}`,`Associação: ${associacao?.razaoSocial||registro.associacao}`,`Carga horária executada: ${registro.totalMinutos} minutos`,`Quantidade de atividades: ${atividades.length}`]}]);
  for(const [i,a] of atividades.entries()){
    await adicionarAtividadeComAssinaturas(pdf,a,i);
  }
  await copiarRelatorio(pdf,"OBSERVAÇÕES DA PRESTAÇÃO",[{heading:"OBSERVAÇÕES GERAIS",lines:[registro.observacoes||"Sem observações."]}]);
  const anexos=JSON.parse(registro.anexosJson||"[]") as Array<{key:string;nome:string;tipo:string}>;const fonte=await pdf.embedFont(StandardFonts.Helvetica);
  for(const [indice,anexo] of anexos.entries()){
    const objeto=await env.BUCKET.get(anexo.key,"arrayBuffer");if(!objeto)continue;const bytes=new Uint8Array(objeto);
    try{if(anexo.tipo==="application/pdf"){const documento=await PDFDocument.load(bytes);const paginas=await pdf.copyPages(documento,documento.getPageIndices());paginas.forEach(p=>pdf.addPage(p));}else if(anexo.tipo==="image/jpeg"||anexo.tipo==="image/png"){const imagem=anexo.tipo==="image/png"?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const pagina=pdf.addPage([W,H]);pagina.drawText(`ANEXO ${indice+1}: ${anexo.nome}`,{x:40,y:806,size:11,font:fonte,color:VERDE});const escala=Math.min(515/imagem.width,730/imagem.height,1);pagina.drawImage(imagem,{x:(W-imagem.width*escala)/2,y:45+(730-imagem.height*escala)/2,width:imagem.width*escala,height:imagem.height*escala});}else await pdf.attach(bytes,anexo.nome,{mimeType:anexo.tipo||"application/octet-stream",description:`Anexo da prestação ${registro.competencia}`});}catch{await pdf.attach(bytes,anexo.nome,{mimeType:anexo.tipo||"application/octet-stream",description:`Anexo da prestação ${registro.competencia}`});}
  }
  const resultado=await pdf.save();return new Response(resultado.buffer.slice(resultado.byteOffset,resultado.byteOffset+resultado.byteLength),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="prestacao-contas-${registro.competencia}.pdf"`}});
}
