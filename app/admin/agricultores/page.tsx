import { redirect } from "next/navigation";
import { gruposAgricultores, listarAgricultores } from "@/db/agricultores";
import { getAdminUser } from "@/lib/admin";
import { chaveMunicipio } from "@/lib/associacoes-municipios";
import { normalizarNomeAssociacao } from "@/lib/nome-associacao";
import { CadastroAgricultores, FiltrosAgricultores } from "./cadastro";

export const dynamic = "force-dynamic";
const compararNomes = new Intl.Collator("pt-BR").compare;

export default async function Page({ searchParams }: {
  searchParams: Promise<{ associacao?: string; municipio?: string; pagina?: string }>;
}) {
  if (!await getAdminUser()) redirect("/");

  const params = await searchParams;
  const associacao = typeof params.associacao === "string" && params.associacao
    ? normalizarNomeAssociacao(params.associacao) : "";
  const municipio = typeof params.municipio === "string" ? chaveMunicipio(params.municipio) : "";
  const registros = await listarAgricultores();
  const grupos = await gruposAgricultores(registros);
  const filtrados = registros.filter(r =>
    (!associacao || r.associacao === associacao) &&
    (!municipio || chaveMunicipio(r.municipio) === municipio),
  ).sort((a, b) => compararNomes(a.nome, b.nome) || a.id.localeCompare(b.id));

  const tamanhoPagina = 50;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanhoPagina));
  const solicitada = Number(params.pagina);
  const pagina = Number.isSafeInteger(solicitada) ? Math.max(1, Math.min(totalPaginas, solicitada)) : 1;
  const inicio = (pagina - 1) * tamanhoPagina;
  const lista = filtrados.slice(inicio, inicio + tamanhoPagina);

  function linkPagina(numero: number) {
    const busca = new URLSearchParams({ pagina: String(numero) });
    if (associacao) busca.set("associacao", associacao);
    if (municipio) busca.set("municipio", municipio);
    return `/admin/agricultores?${busca}`;
  }

  return <main className="min-h-screen bg-slate-100 p-4 text-slate-950 sm:p-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <a href="/admin" className="text-sm font-bold text-emerald-900">← VOLTAR AO PAINEL</a>
      <h1 className="text-3xl font-black">CADASTRO DE AGRICULTORES</h1>
      <FiltrosAgricultores key={JSON.stringify([associacao, municipio])} grupos={grupos} associacao={associacao} municipio={municipio} />
      <CadastroAgricultores grupos={grupos} registros={lista} associacaoInicial={associacao} municipioInicial={municipio} />
      {totalPaginas > 1 && <nav aria-label="Paginação de agricultores" className="flex flex-wrap items-center gap-4 text-sm font-bold">
        <span>Exibindo {inicio + 1}–{inicio + lista.length} de {filtrados.length} agricultores</span>
        <span>Página {pagina} de {totalPaginas}</span>
        {pagina > 1 && <a className="text-emerald-800 underline" href={linkPagina(pagina - 1)}>Anterior</a>}
        {pagina < totalPaginas && <a className="text-emerald-800 underline" href={linkPagina(pagina + 1)}>Próxima</a>}
      </nav>}
    </div>
  </main>;
}
