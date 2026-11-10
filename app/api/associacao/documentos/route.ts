import {competenciasDoExtrato} from "@/lib/competencias-extrato";
import {categoriaDaNota} from "@/lib/classificacao-notas";
import {valorMonetarioDecimal} from "@/lib/moeda";
import {env} from "cloudflare:workers";
import {and,eq} from "drizzle-orm";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {getDb} from "@/db";
import {garantirBanco} from "@/db/bootstrap";
import {associacoes,colaboradores,documentosAssociacao} from "@/db/schema";
import {isAdminEmail} from "@/lib/admin";
export const runtime="edge";
type Arquivo={key:string;nome:string;tipo:string;descricao?:string;quantidade?:string;valor?:string;numeroNota?:string;dataEmissao?:string;categoriaNota?:string;prestador?:string;cnpjPrestador?:string;competencia?:string;competenciaInicio?:string;competenciaFim?:string;competenciaDocumento?:string;competenciaDescricao?:string;origemLeitura?:string};
type DadosNota=Pick<Arquivo,"numeroNota"|"descricao"|"quantidade"|"valor"|"dataEmissao"|"prestador"|"cnpjPrestador"|"competenciaDocumento"|"competenciaDescricao"|"origemLeitura">&{associacao?:string;competencia?:string};
type DocumentoRecebido={file:File;grupo:"extrato"|"nota";dados?:DadosNota & {competenciaInicio?:string;competenciaFim?:string}};
const meses:Record<string,string>={JANEIRO:"01",FEVEREIRO:"02",MARCO:"03",ABRIL:"04",MAIO:"05",JUNHO:"06",JULHO:"07",AGOSTO:"08",SETEMBRO:"09",OUTUBRO:"10",NOVEMBRO:"11",DEZEMBRO:"12"};
function normalizar(valor:string){return valor.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim()}
function competenciaDoArquivo(nome:string,dataEmissao?:string){
 const texto=normalizar(nome);let achado=texto.match(/\b(20\d{2})\s+(0?[1-9]|1[0-2])\b/);if(achado)return `${achado[1]}-${achado[2].padStart(2,"0")}`;
 achado=texto.match(/\b(0?[1-9]|1[0-2])\s+(20\d{2})\b/);if(achado)return `${achado[2]}-${achado[1].padStart(2,"0")}`;
 achado=texto.match(/\b([0-3]?\d)\s+(0?[1-9]|1[0-2])\s+(20\d{2})\b/);if(achado)return `${achado[3]}-${achado[2].padStart(2,"0")}`;
 achado=texto.match(/\b([0-3]\d)(0[1-9]|1[0-2])(20\d{2})\b/);if(achado)return `${achado[3]}-${achado[2]}`;
 for(const [mes,numero] of Object.entries(meses)){const ano=texto.match(new RegExp(`\\b${mes}\\s+(20\\d{2})\\b`));if(ano)return `${ano[1]}-${numero}`;}
 for(const [mes,numero] of Object.entries(meses)){if(texto.includes(mes)){const hoje=new Date();const mesAtual=hoje.getUTCMonth()+1;const ano=hoje.getUTCFullYear()-(Number(numero)>mesAtual?1:0);return `${ano}-${numero}`;}}
 return /^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(dataEmissao||"")?dataEmissao!.slice(0,7):"";
}
function associacaoDoArquivo(nome:string,lista:Array<typeof associacoes.$inferSelect>){const texto=normalizar(nome).replace(/\s/g,"");return [...lista].sort((a,b)=>normalizar(b.nome).replace(/\s/g,"").length-normalizar(a.nome).replace(/\s/g,"").length).find(item=>{const sigla=normalizar(item.nome).replace(/\s/g,"");const razao=normalizar(item.razaoSocial||"").replace(/\s/g,"");const cnpj=(item.cnpj||"").replace(/\D/g,"");return texto.includes(sigla)||(razao.length>=6&&texto.includes(razao))||(cnpj.length===14&&texto.includes(cnpj));})?.nome||""}
async function salvar(files:File[],pasta:string,userId:string,dados:Array<DadosNota & {competenciaInicio?:string;competenciaFim?:string}>=[]){const itens:Arquivo[]=[];for(const [indice,file] of files.entries()){if(file.size>10*1024*1024)throw new Error(`O ARQUIVO ${file.name} DEVE TER NO MÁXIMO 10 MB.`);if(!["application/pdf","image/jpeg","image/png"].includes(file.type))throw new Error(`FORMATO NÃO PERMITIDO: ${file.name}.`);const key=`associacoes-financeiro/${userId}/${pasta}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;await env.BUCKET.put(key,await file.arrayBuffer(),{metadata:{contentType:file.type}});const nota={key,nome:file.name,tipo:file.type,...dados[indice]};itens.push({...nota,...(pasta.startsWith("notas/")?{categoriaNota:categoriaDaNota(nota)}:{})});}return itens;}
export async function POST(request:Request){await garantirBanco();const user=await getChatGPTUser();const acessoGeral=!!user&&(isAdminEmail(user.email)||user.role==="admin"||user.role==="aderes");if(!user||(!["associacao","colaborador"].includes(user.role)&&!acessoGeral))return Response.json({message:"ACESSO NÃO AUTORIZADO."},{status:403});try{const form=await request.formData();const associacaoInformada=String(form.get("associacao")||"").trim();const db=getDb();const cadastroColaborador=!acessoGeral&&user.role==="colaborador"?await db.query.colaboradores.findFirst({where:eq(colaboradores.authUserId,user.userId)}):null;const coordenadorGeral=cadastroColaborador?.cargo.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase()==="coordenador geral";let associacoesPermitidas:string[]=[];try{associacoesPermitidas=JSON.parse(cadastroColaborador?.associacoesJson||"[]");}catch{}if(cadastroColaborador?.associacao&&!associacoesPermitidas.includes(cadastroColaborador.associacao))associacoesPermitidas.unshift(cadastroColaborador.associacao);const associacaoVinculada=acessoGeral?"":user.role==="associacao"?user.associacao||"":user.role==="colaborador"?(coordenadorGeral&&associacoesPermitidas.includes(associacaoInformada)?associacaoInformada:cadastroColaborador?.associacao||""):"";if(!acessoGeral&&["associacao","colaborador"].includes(user.role)&&!associacaoVinculada)return Response.json({message:"NENHUMA ASSOCIAÇÃO ESTÁ VINCULADA AO USUÁRIO."},{status:403});const listaAssociacoes=await db.select().from(associacoes).where(eq(associacoes.ativo,true));const extratos=form.getAll("extratos").filter((x):x is File=>x instanceof File&&x.size>0);const notas=form.getAll("notasFiscais").filter((x):x is File=>x instanceof File&&x.size>0);let dadosNotas:DadosNota[]=[];try{const dados=JSON.parse(String(form.get("dadosNotas")||"[]"));if(Array.isArray(dados))dadosNotas=dados;}catch{}dadosNotas=dadosNotas.map(nota=>({...nota,valor:valorMonetarioDecimal(nota.valor)}));if(notas.some((_,i)=>!dadosNotas[i]?.descricao||!dadosNotas[i]?.valor))return Response.json({message:"INFORME DESCRIÇÃO E VALOR DE CADA NOTA FISCAL."},{status:400});if(!extratos.length&&!notas.length)return Response.json({message:"INCLUA PELO MENOS UM EXTRATO BANCÁRIO OU UMA NOTA FISCAL."},{status:400});
 let dadosExtratos:Array<{competenciaInicio?:string;competenciaFim?:string;associacao?:string}>=[];
 try{const lidos=JSON.parse(String(form.get("dadosExtratos")||"[]"));if(!Array.isArray(lidos))throw new Error();dadosExtratos=lidos;}catch{return Response.json({message:"OS INTERVALOS DOS EXTRATOS SÃO INVÁLIDOS."},{status:400});}
 const recebidos:DocumentoRecebido[]=[...extratos.map((file,i)=>({file,grupo:"extrato" as const,dados:dadosExtratos[i]})),...notas.map((file,i)=>({file,grupo:"nota" as const,dados:dadosNotas[i]}))];
 const nomesValidos=new Set(listaAssociacoes.map(item=>item.nome));
 const identificados=recebidos.map(item=>{
  const periodo=item.grupo==="extrato"&&(item.dados?.competenciaInicio||item.dados?.competenciaFim)?competenciasDoExtrato(String(item.dados?.competenciaInicio||""),String(item.dados?.competenciaFim||"")):null;
  const competencia=/^20\d{2}-(0[1-9]|1[0-2])$/.test(item.dados?.competencia||"")?item.dados!.competencia!:item.grupo==="extrato"&&!dadosExtratos.length?competenciaDoArquivo(item.file.name):"";
  return {...item,associacao:associacaoVinculada||(nomesValidos.has(item.dados?.associacao||"")?item.dados!.associacao!:(associacaoDoArquivo(item.file.name,listaAssociacoes)||(nomesValidos.has(associacaoInformada)?associacaoInformada:""))),competencias:periodo||(competencia?[competencia]:[])};
 });
 const associacoesIdentificadas=[...new Set(identificados.map(item=>item.associacao).filter(Boolean))];
 if(associacoesIdentificadas.length===1)for(const item of identificados)if(!item.associacao)item.associacao=associacoesIdentificadas[0];
 const invalidos=identificados.filter(item=>!item.associacao||!item.competencias.length);
 if(invalidos.length)return Response.json({message:`NÃO FOI POSSÍVEL IDENTIFICAR ${invalidos.map(item=>`${item.file.name} (${!item.associacao?"ASSOCIAÇÃO":""}${!item.associacao&&!item.competencias.length?" E ":""}${!item.competencias.length?item.grupo==="extrato"?"INTERVALO DE COMPETÊNCIAS":"COMPETÊNCIA":""})`).join("; ")}. CONFIRA A ASSOCIAÇÃO E O PERÍODO DE CADA ARQUIVO.`},{status:400});
 // Validar o lote inteiro antes de gravar qualquer arquivo.
 for(const item of identificados){if(item.file.size>10*1024*1024)return Response.json({message:`O ARQUIVO ${item.file.name} DEVE TER NO MÁXIMO 10 MB.`},{status:400});if(!["application/pdf","image/jpeg","image/png"].includes(item.file.type))return Response.json({message:`FORMATO NÃO PERMITIDO: ${item.file.name}.`},{status:400});}
 const comArquivos:Array<typeof identificados[number]&{arquivoSalvo:Arquivo}>=[];
 for(const item of identificados){
  const primeira=item.competencias[0],ultima=item.competencias.at(-1)!;
  const metadados=item.grupo==="extrato"?{competenciaInicio:primeira,competenciaFim:ultima}:item.dados||{};
  const [arquivoSalvo]=await salvar([item.file],`${item.grupo==="extrato"?"extratos":"notas"}/${primeira}`,user.userId,[metadados]);
  comArquivos.push({...item,arquivoSalvo});
 }
 const grupos=new Map<string,Array<typeof comArquivos[number]&{competencia:string}>>();
 for(const item of comArquivos)for(const competencia of item.competencias){const chave=`${item.associacao}|${competencia}`;grupos.set(chave,[...(grupos.get(chave)||[]),{...item,competencia}]);}
 for(const itens of grupos.values()){
  const {associacao,competencia}=itens[0];
  const existente=await db.query.documentosAssociacao.findFirst({where:and(eq(documentosAssociacao.associacao,associacao),eq(documentosAssociacao.competencia,competencia))});
  let extratosAtuais:Arquivo[]=[],notasAtuais:Arquivo[]=[];try{extratosAtuais=JSON.parse(existente?.extratosJson||"[]");}catch{}try{notasAtuais=JSON.parse(existente?.notasFiscaisJson||"[]");}catch{}
  // Uma única gravação do arquivo, com referência em cada mês coberto.
  const novosExtratos=itens.filter(i=>i.grupo==="extrato").map(i=>i.arquivoSalvo),novasNotas=itens.filter(i=>i.grupo==="nota").map(i=>i.arquivoSalvo);
  const values={authUserId:user.userId,associacao,competencia,extratosJson:JSON.stringify([...extratosAtuais,...novosExtratos]),notasFiscaisJson:JSON.stringify([...notasAtuais,...novasNotas]),atualizadoEm:new Date().toISOString()};
  if(existente)await db.update(documentosAssociacao).set(values).where(eq(documentosAssociacao.id,existente.id));else await db.insert(documentosAssociacao).values(values);
 }
 return Response.json({message:`${recebidos.length} DOCUMENTO(S) SALVO(S). EXTRATOS VINCULADOS A TODAS AS COMPETÊNCIAS DOS INTERVALOS INFORMADOS.`});
 }catch(error){return Response.json({message:error instanceof Error?error.message:"NÃO FOI POSSÍVEL SALVAR OS DOCUMENTOS."},{status:400});}
}
