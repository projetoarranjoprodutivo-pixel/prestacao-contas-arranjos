import { getDb } from "@/db";
import { colaboradores } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { createPdf } from "@/lib/pdf";

export const runtime="edge";

function lista(valor:string|null){try{return (JSON.parse(valor||"[]") as string[]).join(", ")||"NÃO INFORMADO";}catch{return "NÃO INFORMADO";}}

export async function GET(){
  if(!await getAdminUser())return new Response("ACESSO RESTRITO",{status:403});
  const registros=(await getDb().select().from(colaboradores)).sort((a,b)=>a.nomeCompleto.localeCompare(b.nomeCompleto));
  const secoes=registros.map((u,i)=>({heading:`${i+1}. ${u.nomeCompleto}`,lines:[
    `E-MAIL: ${u.email}`,`CARGO: ${u.cargo}`,`ASSOCIAÇÃO PRINCIPAL: ${u.associacao||"NÃO INFORMADA"}`,
    `ASSOCIAÇÕES: ${lista(u.associacoesJson)}`,`MUNICÍPIOS ATENDIDOS: ${lista(u.municipiosAtendidosJson)}`,
    `CELULAR: ${u.celular||"NÃO INFORMADO"}`,`CPF: ${u.cpf||"NÃO INFORMADO"}`,`MEI/CNPJ: ${u.mei||"NÃO INFORMADO"}`,
    `NOME EMPRESARIAL: ${u.nomeEmpresarial||"NÃO INFORMADO"}`,`CFTA/CREA: ${u.cftaCrea||"NÃO INFORMADO"}`,
    `ENDEREÇO: ${[u.endereco,u.numero,u.bairro,u.cidade,u.uf,u.cep].filter(Boolean).join(" · ")||"NÃO INFORMADO"}`,
    `VALIDADE DOS DOCUMENTOS: ${u.documentoValidade||"NÃO INFORMADA"}`
  ]}));
  const pdf=await createPdf("CADASTRO DE COLABORADORES",secoes);
  return new Response(pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength),{headers:{"content-type":"application/pdf","content-disposition":"attachment; filename=colaboradores.pdf"}});
}
