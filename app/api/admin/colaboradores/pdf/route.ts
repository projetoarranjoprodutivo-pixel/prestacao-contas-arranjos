import { getDb } from "@/db";
import { colaboradores } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { createPdf } from "@/lib/pdf";

export const runtime="edge";

function lista(valor:string|null){try{return (JSON.parse(valor||"[]") as string[]).join(", ")||"NÃO INFORMADO";}catch{return "NÃO INFORMADO";}}

const normalizar=(valor:unknown)=>String(valor||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleUpperCase("pt-BR");
const dataBr=(valor:string|null)=>valor&&/^\d{4}-\d{2}-\d{2}$/.test(valor)?valor.split("-").reverse().join("/"):"NÃO INFORMADA";

export async function GET(request:Request){
  if(!await getAdminUser())return new Response("ACESSO RESTRITO",{status:403});
  const url=new URL(request.url);
  const basico=url.searchParams.get("basico")==="1";
  const id=url.searchParams.get("id");
  if(id&&(!/^\d+$/.test(id)||Number(id)<1))return new Response("CADASTRO INVÁLIDO",{status:400});
  const pesquisa=normalizar(url.searchParams.get("pesquisa"));
  const registros=(await getDb().select().from(colaboradores)).filter(u=>(!id||u.id===Number(id))&&(!pesquisa||[u.nomeCompleto,u.email,u.cargo,u.associacao,u.associacoesJson,u.municipiosAtendidosJson,u.mei,u.nomeEmpresarial,u.cftaCrea].some(valor=>normalizar(valor).includes(pesquisa)))).sort((a,b)=>a.cargo.localeCompare(b.cargo)||a.nomeCompleto.localeCompare(b.nomeCompleto));
  if(!registros.length)return new Response("NENHUM CADASTRO ENCONTRADO",{status:404});
  const secoes=registros.map((u,i)=>({heading:`${i+1}. ${u.nomeCompleto}`,lines:basico?[
    `E-MAIL: ${u.email} | CELULAR: ${u.celular||"NÃO INFORMADO"}`,
    `CARGO: ${u.cargo}`,`ASSOCIAÇÕES: ${lista(u.associacoesJson)==="NÃO INFORMADO"?u.associacao||"NÃO INFORMADA":lista(u.associacoesJson)}`,
    `MUNICÍPIOS ATENDIDOS: ${lista(u.municipiosAtendidosJson)}`,
    `MEI/CNPJ: ${u.mei||"NÃO INFORMADO"}`,`NOME EMPRESARIAL: ${u.nomeEmpresarial||"NÃO INFORMADO"}`,
    `CFTA/CREA: ${u.cftaCrea||"NÃO INFORMADO"}`,
    `ADMISSÃO: ${dataBr(u.dataAdmissao||null)} | SAÍDA: ${u.dataSaida?dataBr(u.dataSaida):"NÃO INFORMADA"}`
  ]:[
    `E-MAIL: ${u.email}`,`CARGO: ${u.cargo}`,`ASSOCIAÇÃO PRINCIPAL: ${u.associacao||"NÃO INFORMADA"}`,
    `ASSOCIAÇÕES: ${lista(u.associacoesJson)}`,`MUNICÍPIOS ATENDIDOS: ${lista(u.municipiosAtendidosJson)}`,
    `CELULAR: ${u.celular||"NÃO INFORMADO"}`,`CPF: ${u.cpf||"NÃO INFORMADO"}`,`MEI/CNPJ: ${u.mei||"NÃO INFORMADO"}`,
    `NOME EMPRESARIAL: ${u.nomeEmpresarial||"NÃO INFORMADO"}`,`CFTA/CREA: ${u.cftaCrea||"NÃO INFORMADO"}`,
    `ENDEREÇO: ${[u.endereco,u.numero,u.bairro,u.cidade,u.uf,u.cep].filter(Boolean).join(" · ")||"NÃO INFORMADO"}`,
    `VALIDADE DOS DOCUMENTOS: ${u.documentoValidade||"NÃO INFORMADA"}`
  ]}));
  const pdf=await createPdf("CADASTRO DE COLABORADORES",secoes);
  return new Response(pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength),{headers:{"content-type":"application/pdf","content-disposition":`${basico?"inline":"attachment"}; filename=colaboradores.pdf`,"cache-control":"private, no-store"}});
}
