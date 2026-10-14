import {env} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {getDb} from "@/db";
import {garantirBanco} from "@/db/bootstrap";
import {associacoes} from "@/db/schema";
import {isAdminEmail} from "@/lib/admin";

export const runtime="edge";

type AiBinding={
 toMarkdown:(arquivo:{name:string;blob:Blob},opcoes?:unknown)=>Promise<{data?:string;format?:string;error?:string}|Array<{data?:string;format?:string;error?:string}>>;
 run:(modelo:string,entrada:unknown)=>Promise<unknown>;
};

function jsonResposta(valor:unknown){
 const objeto=valor as {response?:string;result?:{response?:string};choices?:Array<{message?:{content?:string};text?:string}>};
 const texto=objeto?.response||objeto?.result?.response||objeto?.choices?.[0]?.message?.content||objeto?.choices?.[0]?.text||JSON.stringify(valor);
 const trecho=texto.match(/\{[\s\S]*\}/)?.[0]||"{}";
 try{return JSON.parse(trecho) as Record<string,unknown>}catch{return {}}
}

const meses:Record<string,string>={JANEIRO:"01",FEVEREIRO:"02",MARCO:"03",ABRIL:"04",MAIO:"05",JUNHO:"06",JULHO:"07",AGOSTO:"08",SETEMBRO:"09",OUTUBRO:"10",NOVEMBRO:"11",DEZEMBRO:"12"};
function competenciaFallback(nome:string,data:string){
 if(/^20\d{2}-(0[1-9]|1[0-2])-[0-3]\d$/.test(data))return data.slice(0,7);
 const texto=nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
 let achado=texto.match(/\b(0?[1-9]|1[0-2])[-_ ]+(20\d{2})\b/);if(achado)return `${achado[2]}-${achado[1].padStart(2,"0")}`;
 achado=texto.match(/\b(20\d{2})[-_ ]+(0?[1-9]|1[0-2])\b/);if(achado)return `${achado[1]}-${achado[2].padStart(2,"0")}`;
 for(const [mes,numero] of Object.entries(meses)){const ano=texto.match(new RegExp(`${mes}[^0-9]*(20\\d{2})`));if(ano)return `${ano[1]}-${numero}`;}
 return "";
}

function textoResultado(valor:Awaited<ReturnType<AiBinding["toMarkdown"]>>){
 const item=Array.isArray(valor)?valor[0]:valor;
 if(!item||item.format==="error"||item.error)throw new Error(item?.error||"NÃO FOI POSSÍVEL LER O DOCUMENTO.");
 return item.data||"";
}

function normalizar(texto:string){return texto.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase()}
function numeroDecimal(valor:string){
 const limpo=valor.replace(/[^0-9,.-]/g,"");
 if(limpo.includes(","))return limpo.replace(/\./g,"").replace(",",".");
 return limpo;
}
function normalizarDataEmissao(valor:unknown){
 const texto=String(valor||"").trim();
 let partes=texto.match(/\b(20\d{2})[-\/.]([01]?\d)[-\/.]([0-3]?\d)\b/);
 if(partes)return dataIsoValida(partes[1],partes[2],partes[3]);
 partes=texto.match(/\b([0-3]?\d)[-\/.]([01]?\d)[-\/.](20\d{2}|\d{2})\b/);
 if(partes)return dataIsoValida(partes[3].length===2?`20${partes[3]}`:partes[3],partes[2],partes[1]);
 const compacta=texto.replace(/\D/g,"");
 if(/^20\d{6}$/.test(compacta))return dataIsoValida(compacta.slice(0,4),compacta.slice(4,6),compacta.slice(6,8));
 if(/^\d{8}$/.test(compacta))return dataIsoValida(compacta.slice(4,8),compacta.slice(2,4),compacta.slice(0,2));
 return "";
}
function dataIsoValida(ano:string,mes:string,dia:string){
 const resultado=`${ano}-${mes.padStart(2,"0")}-${dia.padStart(2,"0")}`;
 const data=new Date(`${resultado}T00:00:00Z`);
 return data.getUTCFullYear()===Number(ano)&&data.getUTCMonth()+1===Number(mes)&&data.getUTCDate()===Number(dia)?resultado:"";
}
function extrairDataEmissao(conteudo:string){
 const texto=conteudo.replace(/\u00a0/g," ");
 // A DANFSe nacional apresenta, no mesmo cabeçalho, a competência e duas
 // ocorrências da emissão (NFS-e e DPS). A conversão para texto pode perder
 // as colunas; nesse caso a data de emissão é a data válida mais repetida.
 if(/DANFSE|DOCUMENTO\s+AUXILIAR\s+DA\s+NFS-?E/i.test(texto)){
  const cabecalho=texto.slice(0,5000);
  const datas=[...cabecalho.matchAll(/\b([0-3]?\d)\s*[\/.\-]\s*([01]?\d)\s*[\/.\-]\s*(20\d{2}|\d{2})\b/g)]
   .map(item=>dataIsoValida(item[3].length===2?`20${item[3]}`:item[3],item[2],item[1])).filter(Boolean);
  const contagem=new Map<string,number>();for(const data of datas)contagem.set(data,(contagem.get(data)||0)+1);
  const repetida=[...contagem.entries()].sort((a,b)=>b[1]-a[1])[0];
  if(repetida&&repetida[1]>1)return repetida[0];
  if(datas.length>1)return datas[1];
 }
 const rotulos=[...texto.matchAll(/(?:DATA(?:\s+E\s+HORA)?\s+(?:DA\s+)?EMISS[AÃ]O|EMITID[AO]\s+EM|DATA\s+DE\s+GERA[CÇ][AÃ]O)/gi)];
 const trechos=[...rotulos.map(item=>texto.slice(item.index||0,(item.index||0)+180)),texto];
 const mesesTexto:Record<string,string>={JANEIRO:"01",FEVEREIRO:"02",MARCO:"03",ABRIL:"04",MAIO:"05",JUNHO:"06",JULHO:"07",AGOSTO:"08",SETEMBRO:"09",OUTUBRO:"10",NOVEMBRO:"11",DEZEMBRO:"12",JAN:"01",FEV:"02",MAR:"03",ABR:"04",MAI:"05",JUN:"06",JUL:"07",AGO:"08",SET:"09",OUT:"10",NOV:"11",DEZ:"12"};
 for(const trechoOriginal of trechos){
  const trecho=normalizar(trechoOriginal);
  let partes=trecho.match(/\b([0-3]?\d)\s*[\/.\-]\s*([01]?\d)\s*[\/.\-]\s*(20\d{2}|\d{2})\b/);
  if(partes){const data=dataIsoValida(partes[3].length===2?`20${partes[3]}`:partes[3],partes[2],partes[1]);if(data)return data;}
  partes=trecho.match(/\b(20\d{2})\s*[\/.\-]\s*([01]?\d)\s*[\/.\-]\s*([0-3]?\d)\b/);
  if(partes){const data=dataIsoValida(partes[1],partes[2],partes[3]);if(data)return data;}
  partes=trecho.match(/\b([0-3]?\d)\s+(?:DE\s+)?(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO|JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(?:DE\s+)?(20\d{2})\b/);
  if(partes){const data=dataIsoValida(partes[3],mesesTexto[partes[2]],partes[1]);if(data)return data;}
  const compacta=trecho.match(/\b([0-3]\d)([01]\d)(20\d{2})\b/);
  if(compacta){const data=dataIsoValida(compacta[3],compacta[2],compacta[1]);if(data)return data;}
 }
 return "";
}
function dadosDeterministicos(conteudo:string,nome:string,lista:Array<{nome:string|null;razaoSocial:string|null;cnpj:string|null}>){
 const fonte=`${nome}\n${conteudo}`;const fonteNormalizada=normalizar(fonte);
 const dataBr=fonte.match(/\b([0-3]?\d)[\/.\-]([01]?\d)[\/.\-](20\d{2}|\d{2})\b/);
 const dataIso=fonte.match(/\b(20\d{2})-([01]\d)-([0-3]\d)\b/);
 const mesesTexto:Record<string,string>={JANEIRO:"01",FEVEREIRO:"02",MARCO:"03",ABRIL:"04",MAIO:"05",JUNHO:"06",JULHO:"07",AGOSTO:"08",SETEMBRO:"09",OUTUBRO:"10",NOVEMBRO:"11",DEZEMBRO:"12"};
 const dataExtenso=fonteNormalizada.match(/\b([0-3]?\d)\s+DE\s+(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+DE\s+(20\d{2})\b/);
 const anoData=dataBr?.[3]?(dataBr[3].length===2?`20${dataBr[3]}`:dataBr[3]):"";
 const dataEmissao=extrairDataEmissao(conteudo)||dataIso?.[0]||(dataBr?`${anoData}-${dataBr[2].padStart(2,"0")}-${dataBr[1].padStart(2,"0")}`:(dataExtenso?`${dataExtenso[3]}-${mesesTexto[dataExtenso[2]]}-${dataExtenso[1].padStart(2,"0")}`:""));
 const valores=[...conteudo.matchAll(/(?:R\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})\b/g)].map(item=>({original:item[1],numero:Number(numeroDecimal(item[1]))})).filter(item=>Number.isFinite(item.numero));
 const valorTotalRotulado=conteudo.match(/(?:VALOR\s+(?:TOTAL|L[IÍ]QUIDO)(?:\s+DA\s+NOTA)?|TOTAL\s+(?:DA\s+NOTA|DOS\s+SERVI[CÇ]OS|A\s+PAGAR))[^0-9]{0,40}(?:R\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})/i)?.[1];
 const valor=valorTotalRotulado?Number(numeroDecimal(valorTotalRotulado)).toFixed(2):(valores.sort((a,b)=>b.numero-a.numero)[0]?.numero.toFixed(2)||"");
 const linhas=conteudo.split(/\r?\n/).map(item=>item.replace(/\s+/g," ").trim()).filter(Boolean);
 const indiceDescricao=linhas.findIndex(item=>/DESCRI[CÇ][AÃ]O|DISCRIMINA[CÇ][AÃ]O|SERVI[CÇ]OS? PRESTADOS?|PRODUTO.*SERVI[CÇ]O/i.test(item));
 const candidatas=indiceDescricao>=0?linhas.slice(indiceDescricao+1,indiceDescricao+6):linhas;
 const descricao=candidatas.find(item=>item.length>=12&&!/^(QUANTIDADE|VALOR|TOTAL|DATA|CNPJ|CPF|NFS|NOTA FISCAL)/i.test(item))||"";
 const quantidadeInformada=(conteudo.match(/(?:QUANTIDADE|QTD\.?|HORAS?)[\s:;-]*(\d+(?:[.,]\d+)?)/i)?.[1]||"").replace(",",".");
 const valorUnitarioTexto=conteudo.match(/(?:VALOR\s+UNIT[AÁ]RIO|VALOR\s+DA\s+HORA|VLR\.?\s*UNIT\.?)[^0-9]{0,30}(?:R\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})/i)?.[1];
 const valorUnitario=Number(numeroDecimal(valorUnitarioTexto||""));const valorNumerico=Number(valor);
 const quantidadeCalculada=!quantidadeInformada&&valorUnitario>0&&valorNumerico>0&&Number.isInteger(valorNumerico/valorUnitario)?String(valorNumerico/valorUnitario):"";
 const quantidade=quantidadeInformada||quantidadeCalculada;
 const associacao=lista.find(item=>[item.nome,item.razaoSocial,item.cnpj].filter(Boolean).some(valorItem=>fonteNormalizada.includes(normalizar(String(valorItem)))))?.nome||"";
 return {descricao,quantidade,valor,dataEmissao,associacao:String(associacao||""),competencia:competenciaFallback(nome,dataEmissao)};
}

export async function POST(request:Request){
 await garantirBanco();
 const user=await getChatGPTUser();
 const permitido=!!user&&(user.role==="associacao"||user.role==="admin"||user.role==="aderes"||isAdminEmail(user.email));
 if(!permitido)return Response.json({message:"ACESSO NÃO AUTORIZADO."},{status:403});
 try{
  const form=await request.formData();
  const arquivo=form.get("arquivo");
  if(!(arquivo instanceof File)||!arquivo.size)return Response.json({message:"ARQUIVO NÃO INFORMADO."},{status:400});
  if(arquivo.size>10*1024*1024)return Response.json({message:"O ARQUIVO DEVE TER NO MÁXIMO 10 MB."},{status:400});
  if(!["application/pdf","image/jpeg","image/png"].includes(arquivo.type))return Response.json({message:"FORMATO NÃO PERMITIDO."},{status:400});
  const ai=(env as unknown as {AI:AiBinding}).AI;
  if(!ai)throw new Error("A LEITURA AUTOMÁTICA AINDA NÃO ESTÁ HABILITADA.");
  const conversao=await ai.toMarkdown({name:arquivo.name,blob:new Blob([await arquivo.arrayBuffer()],{type:arquivo.type})},{conversionOptions:{image:{descriptionLanguage:"pt"},pdf:{metadata:false},output:{format:"text"}}});
  const conteudo=textoResultado(conversao).slice(0,60000);
  if(!conteudo.trim())throw new Error("NÃO FOI POSSÍVEL ENCONTRAR TEXTO NO DOCUMENTO.");
  const db=getDb();
  const lista=await db.select({nome:associacoes.nome,razaoSocial:associacoes.razaoSocial,cnpj:associacoes.cnpj}).from(associacoes).where(eq(associacoes.ativo,true));
  const resposta=await ai.run("@cf/zai-org/glm-4.7-flash",{messages:[
   {role:"system",content:"Extraia dados de uma nota fiscal brasileira. Responda SOMENTE JSON válido, sem markdown. Não invente. Campos: descricao (descrição principal dos produtos ou serviços, texto curto), quantidade (soma ou quantidade principal como texto), valor (valor total da nota apenas em número decimal com ponto), dataEmissao (AAAA-MM-DD), associacao (nome exato de uma associação da lista, somente se houver evidência), competencia (AAAA-MM, normalmente o mês da emissão)."},
   {role:"user",content:`NOME DO ARQUIVO: ${arquivo.name}\nASSOCIAÇÕES POSSÍVEIS: ${JSON.stringify(lista)}\nCONTEÚDO EXTRAÍDO:\n${conteudo}`}
  ],max_completion_tokens:700,temperature:0,response_format:{type:"json_object"}});
  const dados=jsonResposta(resposta);
  const fallback=dadosDeterministicos(conteudo,arquivo.name,lista);
  // O modelo pode devolver a data brasileira (DD/MM/AAAA), que um input
  // type="date" ignora silenciosamente. Sempre convertemos para AAAA-MM-DD.
  const dataEmissao=normalizarDataEmissao(dados.dataEmissao)||normalizarDataEmissao(fallback.dataEmissao);
  const competencia=String(dados.competencia||fallback.competencia||"")||competenciaFallback(arquivo.name,dataEmissao);
  const descricao=String(dados.descricao||fallback.descricao||"");
  const valorAi=Number(numeroDecimal(String(dados.valor||"")));const valorFallback=Number(fallback.valor||0);
  const valor=String(valorFallback>valorAi?fallback.valor:(numeroDecimal(String(dados.valor||fallback.valor||""))));
  const valorNumerico=Number(valor);const quantidadeAi=String(dados.quantidade||"").replace(",",".");
  const quantidadePadrao=!fallback.quantidade&&!quantidadeAi&&valorNumerico>0&&Number.isInteger(valorNumerico/32.5)?String(valorNumerico/32.5):"";
  const quantidade=String(fallback.quantidade||quantidadeAi||quantidadePadrao);
  if(!descricao&&!quantidade&&!valor&&!dataEmissao)throw new Error("O DOCUMENTO FOI LIDO, MAS OS DADOS DA NOTA NÃO FORAM IDENTIFICADOS. CONFIRA SE O ARQUIVO ESTÁ LEGÍVEL.");
  return Response.json({
   descricao,quantidade,valor,dataEmissao,associacao:String(dados.associacao||fallback.associacao||""),competencia
  });
 }catch(error){return Response.json({message:error instanceof Error?error.message:"NÃO FOI POSSÍVEL LER O DOCUMENTO."},{status:500})}
}
