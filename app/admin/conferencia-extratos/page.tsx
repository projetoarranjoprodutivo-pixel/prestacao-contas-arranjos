import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { getDb } from "@/db";
import { associacoes, documentosAssociacao } from "@/db/schema";
import { competenciaDaNota } from "@/lib/notas-servico";
import { numeroMonetario } from "@/lib/moeda";
import Conferencia from "./conferencia";

type Arquivo = NonNullable<Parameters<typeof competenciaDaNota>[0]> & {
  numeroNota?: string; valor?: string; competenciaInicio?: string; competenciaFim?: string;
};

function arquivos(json: string) {
  try {
    const dados: unknown = JSON.parse(json);
    return Array.isArray(dados) ? dados.filter((item): item is Arquivo => !!item && typeof item.key === "string") : [];
  } catch { return []; }
}

export default async function Page({searchParams}: {searchParams: Promise<{associacao?: string; competencia?: string}>}) {
  if (!await getAdminUser()) redirect("/");
  const params = await searchParams;
  const competencia = /^20\d{2}-(0[1-9]|1[0-2])$/.test(params.competencia ?? "") ? params.competencia! : new Date().toISOString().slice(0, 7);
  const db = getDb();
  const grupos = await db.select({nome: associacoes.nome}).from(associacoes).where(eq(associacoes.ativo, true)).orderBy(associacoes.nome);
  const nome = grupos.find(grupo => grupo.nome === params.associacao)?.nome;
  const registros = nome ? await db.select().from(documentosAssociacao).where(eq(documentosAssociacao.associacao, nome)) : [];
  const extratos = new Map<string, {key: string; nome: string}>();
  const notas = new Map<string, {key: string; nome: string; numero: string; prestador: string; centavos: number | null}>();
  for (const registro of registros) {
    for (const extrato of arquivos(registro.extratosJson)) {
      const inicio = extrato.competenciaInicio || registro.competencia;
      const fim = extrato.competenciaFim || registro.competencia;
      if (extrato.key && inicio <= competencia && fim >= competencia) extratos.set(extrato.key, {key: extrato.key, nome: extrato.nome || "Extrato bancário"});
    }
    for (const nota of arquivos(registro.notasFiscaisJson)) {
      if (!nota.key || competenciaDaNota(nota, registro.competencia) !== competencia) continue;
      const valor = numeroMonetario(nota.valor);
      notas.set(nota.key, {key: nota.key, nome: nota.nome || "Nota fiscal", numero: nota.numeroNota || "", prestador: nota.prestador || nota.fornecedor || "", centavos: valor > 0 ? Math.round(valor * 100) : null});
    }
  }
  return <main className="min-h-screen bg-slate-100 p-4 text-slate-950 sm:p-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <a href="/admin" className="text-sm font-bold text-emerald-900">← VOLTAR AO PAINEL</a>
      <h1 className="text-3xl font-black">CONFERÊNCIA EXTRATO / NOTAS</h1>
      <form className="flex flex-wrap items-end gap-4 rounded-xl border bg-white p-4">
        <label className="grid gap-1 text-sm font-bold">ASSOCIAÇÃO<select name="associacao" required defaultValue={nome || ""} className="rounded-lg border bg-white p-2"><option value="">Selecione</option>{grupos.map(grupo => <option key={grupo.nome}>{grupo.nome}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-bold">COMPETÊNCIA<input name="competencia" type="month" required defaultValue={competencia} className="rounded-lg border p-2"/></label>
        <button className="rounded-lg bg-emerald-800 px-4 py-2 font-bold text-white">CONSULTAR</button>
      </form>
      {nome && <Conferencia key={nome + competencia} competencia={competencia} extratos={[...extratos.values()]} notas={[...notas.values()]}/>}
    </div>
  </main>;
}
