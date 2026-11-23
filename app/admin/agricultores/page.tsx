import { redirect } from "next/navigation";
import { filtrarAgricultores, filtrosCadastroAgricultores, gruposAgricultores, listarAgricultores } from "@/db/agricultores";
import { getAdminUser } from "@/lib/admin";
import { CadastroAgricultores, FiltrosAgricultores } from "./cadastro";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ associacao?: string; municipio?: string; pagina?: string }>;
}) {
  if (!await getAdminUser()) redirect("/");

  const params = await searchParams;
  const filtros = filtrosCadastroAgricultores(params.associacao, params.municipio);
  const { associacao, municipio } = filtros;
  const registros = await listarAgricultores();
  const grupos = await gruposAgricultores(registros);
  const filtrados = filtrarAgricultores(registros, filtros);

  const tamanhoPagina = 50;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanhoPagina));
  const solicitada = Number(params.pagina);
  const pagina = Number.isSafeInteger(solicitada) ? Math.max(1, Math.min(totalPaginas, solicitada)) : 1;
  const inicio = (pagina - 1) * tamanhoPagina;
  const lista = filtrados.slice(inicio, inicio + tamanhoPagina);

  const busca = new URLSearchParams();
  if (associacao) busca.set("associacao", associacao);
  if (municipio) busca.set("municipio", municipio);

  function linkPagina(numero: number) {
    const consulta = new URLSearchParams(busca);
    consulta.set("pagina", String(numero));
    return `/admin/agricultores?${consulta}`;
  }

  return <main className="min-h-screen bg-slate-100 p-4 text-slate-950 sm:p-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <a href="/admin" className="text-sm font-bold text-emerald-900">← VOLTAR AO PAINEL</a>
      <h1 className="text-3xl font-black">CADASTRO DE AGRICULTORES</h1>
      <FiltrosAgricultores key={JSON.stringify([associacao, municipio])} grupos={grupos} associacao={associacao} municipio={municipio} />
      {lista.length > 0 && <div className="flex flex-wrap justify-end gap-2">
        <a href={`/api/admin/agricultores/pdf?${new URLSearchParams([...busca, ["visualizar", "1"]])}`}
          target="_blank" rel="noopener" className="rounded-lg border border-emerald-800 bg-white px-4 py-2 text-sm font-bold text-emerald-800">
          Imprimir PDF
        </a>
        <a href={`/api/admin/agricultores/excel?${busca}`}
          className="rounded-lg border border-emerald-800 bg-white px-4 py-2 text-sm font-bold text-emerald-800">
          Baixar Excel
        </a>
      </div>}
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
