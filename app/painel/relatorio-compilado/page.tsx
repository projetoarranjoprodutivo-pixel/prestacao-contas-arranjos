import { redirect } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { dadosRelatorioCompilado, horas, caminhoAnexo } from "./dados";

export const dynamic = "force-dynamic";

export default async function RelatorioCompilado({ searchParams }: {
  searchParams: Promise<{ competencia?: string }>;
}) {
  const user = await requireChatGPTUser("/painel/relatorio-compilado");
  const params = await searchParams;
  const dados = await dadosRelatorioCompilado(user, params.competencia);
  if (!dados) redirect("/painel");
  const { associacao, competencia, competenciaValida, gerar, relatorios, atividades, minutos, minutosAtividades } = dados;

  return <main className="mx-auto max-w-5xl space-y-6 px-5 py-8 text-slate-900">
    <a href="/painel" className="font-bold text-emerald-800 print:hidden">Voltar à área do colaborador</a>
    <h1 className="text-3xl font-black">Relatório compilado dos técnicos</h1>
    <form action="/painel/relatorio-compilado" className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 print:hidden">
      <p className="self-center font-semibold">{associacao}</p>
      <label className="grid gap-1 text-sm font-bold">Competência
        <input name="competencia" type="month" required defaultValue={competencia} className="rounded-lg border px-3 py-2"/>
      </label>
      <button className="rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white">Gerar relatório compilado</button>
    </form>
    {params.competencia !== undefined && !competenciaValida && <p role="alert">Informe uma competência válida.</p>}
    {gerar && <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <h2 className="text-xl font-bold">{associacao} · {competencia.split("-").reverse().join("/")}</h2>
        {relatorios.length > 0 && <div className="print:hidden"><a href={`/painel/relatorio-compilado/pdf?competencia=${encodeURIComponent(competencia)}`} className="inline-flex rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white">Baixar PDF</a></div>}
      </div>
      {relatorios.length === 0 ? <p>Nenhuma prestação de contas dos técnicos registrada para a competência selecionada.</p> : <>
        <p className="rounded-xl bg-emerald-50 p-4 font-semibold">
          Relatórios consolidados {relatorios.length} · Atividades realizadas {atividades} · Carga horária consolidada {horas(minutos)} · Durações detalhadas {horas(minutosAtividades)} h
        </p>
        {relatorios.map(relatorio => <section key={relatorio.id} className="space-y-2">
          <h3 className="text-lg font-bold">{relatorio.tecnico}</h3>
          <p className="text-sm">Carga horária da prestação {horas(relatorio.minutos)} · Durações detalhadas {horas(relatorio.minutosAtividades)}</p>
          {relatorio.grupos.length === 0 ? <p>Nenhuma atividade realizada informada.</p> :
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100"><tr><th className="p-2">Município</th><th className="p-2">Atividade</th><th className="p-2 text-right">Quantidade</th><th className="p-2 text-right">Horas (H:MM)</th></tr></thead>
              <tbody>{relatorio.grupos.map(grupo => <tr className="border-b" key={JSON.stringify([grupo.municipio, grupo.tipo])}>
                <td className="p-2">{grupo.municipio}</td><td className="p-2">{grupo.tipo}</td><td className="p-2 text-right">{grupo.quantidade}</td><td className="p-2 text-right">{horas(grupo.minutos)}</td>
              </tr>)}</tbody>
            </table>}
          {relatorio.observacoes && <p className="whitespace-pre-line text-sm">{relatorio.observacoes}</p>}
          {relatorio.anexos.length > 0 && <ul className="space-y-1 text-sm">{relatorio.anexos.map((anexo, indice) => <li key={indice}><a className="font-semibold text-emerald-800 underline" href={caminhoAnexo(competencia, relatorio.id, indice)}>{anexo.nome || `Anexo ${indice + 1}`}</a></li>)}</ul>}
        </section>)}
      </>}
    </>}
  </main>;
}
