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
function dadosDeterministicos(conteudo:string,nome:string,lista:Array<{nome:string|null;razaoSocial:string|null;cnpj:string|null}>){
 const fonte=`${nome}\n${conteudo}`;const fonteNormalizada=normalizar(fonte);
 const dataBr=fonte.match(/\b([0-3]?\d)[\/.\-]([01]?\d)[\/.\-](20\d{2})\b/);
 const dataIso=fonte.match(/\b(20\d{2})-([01]\d)-([0-3]\d)\b/);
 const dataEmissao=dataIso?.[0]||(dataBr?`${dataBr[3]}-${dataBr[2].padStart(2,"0")}-${dataBr[1].padStart(2,"0")}`:"");
 const valores=[...conteudo.matchAll(/(?:R\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})\b/g)].map(item=>({original:item[1],numero:Number(numeroDecimal(item[1]))})).filter(item=>Number.isFinite(item.numero));
 const valor=valores.sort((a,b)=>b.numero-a.numero)[0]?.numero.toFixed(2)||"";
 const linhas=conteudo.split(/\r?\n/).map(item=>item.replace(/\s+/g," ").trim()).filter(Boolean);
 const indiceDescricao=linhas.findIndex(item=>/DESCRI[CÇ][AÃ]O|DISCRIMINA[CÇ][AÃ]O|SERVI[CÇ]OS? PRESTADOS?|PRODUTO.*SERVI[CÇ]O/i.test(item));
 const candidatas=indiceDescricao>=0?linhas.slice(indiceDescricao+1,indiceDescricao+6):linhas;
 const descricao=candidatas.find(item=>item.length>=12&&!/^(QUANTIDADE|VALOR|TOTAL|DATA|CNPJ|CPF|NFS|NOTA FISCAL)/i.test(item))||"";
 const quantidade=(conteudo.match(/(?:QUANTIDADE|QTD\.?)[\s:;-]*(\d+(?:[.,]\d+)?)/i)?.[1]||"").replace(",",".");
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
  const dataEmissao=String(dados.dataEmissao||fallback.dataEmissao||"");
  const competencia=String(dados.competencia||fallback.competencia||"")||competenciaFallback(arquivo.name,dataEmissao);
  const descricao=String(dados.descricao||fallback.descricao||"");const quantidade=String(dados.quantidade||fallback.quantidade||"");const valor=numeroDecimal(String(dados.valor||fallback.valor||""));
  if(!descricao&&!quantidade&&!valor&&!dataEmissao)throw new Error("O DOCUMENTO FOI LIDO, MAS OS DADOS DA NOTA NÃO FORAM IDENTIFICADOS. CONFIRA SE O ARQUIVO ESTÁ LEGÍVEL.");
  return Response.json({
   descricao,quantidade,valor,dataEmissao,associacao:String(dados.associacao||fallback.associacao||""),competencia
  });
 }catch(error){return Response.json({message:error instanceof Error?error.message:"NÃO FOI POSSÍVEL LER O DOCUMENTO."},{status:500})}
}
