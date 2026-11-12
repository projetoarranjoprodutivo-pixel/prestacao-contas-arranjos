import { getDb } from "@/db";
import { colaboradores } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { createPdf } from "@/lib/pdf";
import { normalizarNomeAssociacao } from "@/lib/nome-associacao";
import { associacoesDoColaborador } from "@/lib/notas-servico";

export const runtime="edge";

function lista(valor:string|null){try{return (JSON.parse(valor||"[]") as string[]).join(", ")||"NÃO INFORMADO";}catch{return "NÃO INFORMADO";}}

const normalizar=(valor:unknown)=>String(valor||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleUpperCase("pt-BR");
const dataBr=(valor:string|null)=>valor&&/^\d{4}-\d{2}-\d{2}$/.test(valor)?valor.split("-").reverse().join("/"):"NÃO INFORMADA";

type ColaboradorRelacao = {
  nomeCompleto: string;
  cargo: string;
  associacao: string | null;
  associacoesJson: string;
};

function agruparColaboradores(registros: ColaboradorRelacao[], filtro: string) {
  const comparar = new Intl.Collator("pt-BR", { sensitivity: "base" }).compare;
  const grupos = new Map<string, Map<string, string[]>>();
  for (const usuario of registros) {
    const vinculadas = associacoesDoColaborador(usuario);
    const associacoes = new Set(vinculadas.length ? vinculadas.map(normalizarNomeAssociacao) : ["SEM ASSOCIAÇÃO"]);
    const cargo = usuario.cargo.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR") || "CARGO NÃO INFORMADO";
    for (const associacao of associacoes) {
      if (filtro && associacao !== filtro) continue;
      let cargos = grupos.get(associacao);
      if (!cargos) {
        cargos = new Map();
        grupos.set(associacao, cargos);
      }
      const nomes = cargos.get(cargo);
      if (nomes) nomes.push(usuario.nomeCompleto);
      else cargos.set(cargo, [usuario.nomeCompleto]);
    }
  }
  return [...grupos].sort(([a], [b]) => comparar(a, b)).flatMap(([associacao, cargos]) =>
    [...cargos].sort(([a], [b]) => comparar(a, b)).map(([cargo, nomes]) => ({
      heading: `${associacao} · ${cargo}`,
      lines: nomes.sort(comparar),
    })),
  );
}

export async function GET(request:Request){
  if(!await getAdminUser())return new Response("ACESSO RESTRITO",{status:403});
  const url=new URL(request.url);
  if (url.searchParams.get("agrupado") === "1") {
    const associacao = url.searchParams.get("associacao")?.trim();
    const registros = await getDb().select({
      nomeCompleto: colaboradores.nomeCompleto,
      cargo: colaboradores.cargo,
      associacao: colaboradores.associacao,
      associacoesJson: colaboradores.associacoesJson,
    }).from(colaboradores);
    const secoes = agruparColaboradores(registros, associacao ? normalizarNomeAssociacao(associacao) : "");
    const pdf = await createPdf("COLABORADORES POR ASSOCIAÇÃO E CARGO", secoes.length ? secoes : [
      { heading: "RESULTADO", lines: ["NENHUM COLABORADOR ENCONTRADO."] },
    ]);
    return new Response(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength), { headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="colaboradores-por-associacao-e-cargo.pdf"',
      "cache-control": "private, no-store",
    } });
  }
  const simplificado=url.searchParams.get("simplificado")==="1";
  const basico=url.searchParams.get("basico")==="1";
  const id=url.searchParams.get("id");
  if(id&&(!/^\d+$/.test(id)||Number(id)<1))return new Response("CADASTRO INVÁLIDO",{status:400});
  const pesquisa=normalizar(url.searchParams.get("pesquisa"));
  const registros=(await getDb().select().from(colaboradores)).filter(u=>(!id||u.id===Number(id))&&(!pesquisa||[u.nomeCompleto,u.email,u.cargo,u.associacao,u.associacoesJson,u.municipiosAtendidosJson,u.mei,u.nomeEmpresarial,u.cftaCrea].some(valor=>normalizar(valor).includes(pesquisa)))).sort((a,b)=>(simplificado?0:a.cargo.localeCompare(b.cargo))||a.nomeCompleto.localeCompare(b.nomeCompleto));
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
  const resumo=[{heading:"NOME / ASSOCIAÇÃO",lines:registros.map(u=>`${u.nomeCompleto} | ${lista(u.associacoesJson)==="NÃO INFORMADO"?u.associacao||"NÃO INFORMADA":lista(u.associacoesJson)}`)}];
  const pdf=await createPdf(simplificado?"CADASTRO SIMPLIFICADO DE COLABORADORES":"CADASTRO DE COLABORADORES",simplificado?resumo:secoes);
  return new Response(pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength),{headers:{"content-type":"application/pdf","content-disposition":`${basico||simplificado?"inline":"attachment"}; filename=colaboradores.pdf`,"cache-control":"private, no-store"}});
}
