import NotaAcoes from "./nota-acoes";
import { redirect } from "next/navigation";
import { Pencil, Plus, ReceiptText, Sprout } from "lucide-react";
import { getGestorMudasUser } from "@/lib/admin";
import { getDb } from "@/db";
import { colaboradores, documentosAssociacao, prestacoes } from "@/db/schema";
import { ehEntregaMudas, quantidadeEntregue, tipoMudaEntregue } from "@/lib/entregas-mudas";
import ExcluirEntregaButton from "@/app/admin/entrega-mudas/excluir-button";
import { chaveMunicipio, mapaAssociacoesPorMunicipio } from "@/lib/associacoes-municipios";

export const dynamic = "force-dynamic";

export default async function GestaoMudasPage({ searchParams }: { searchParams: Promise<{ notas?: string; associacao?: string; competencia?: string }> }) {
  const filtros = await searchParams;
  const gestor = await getGestorMudasUser();
  if (!gestor) redirect("/");
  const db = getDb();
  const [registros, pessoas] = await Promise.all([db.select().from(prestacoes), db.select().from(colaboradores)]);
  const documentos = filtros.notas === "1" ? await db.select().from(documentosAssociacao) : [];
  type Nota = { numeroNota?: string; key?: string; nome?: string; descricao?: string; quantidade?: string; valor?: string; dataEmissao?: string };
  const notas = documentos.flatMap(documento => {
    let arquivos: Nota[] = [];
    try { const dados = JSON.parse(documento.notasFiscaisJson || "[]"); if (Array.isArray(dados)) arquivos = dados; } catch {}
    return arquivos.filter(arquivo => /MUDA|SEMENTE|PLANTULA/.test(`${arquivo.nome || ""} ${arquivo.descricao || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase())).map(arquivo => ({ documento, arquivo }));
  }).sort((a, b) => a.documento.associacao.localeCompare(b.documento.associacao, "pt-BR") || b.documento.competencia.localeCompare(a.documento.competencia));
  const notasFiltradas = notas.filter(({ documento }) => (!filtros.associacao || documento.associacao === filtros.associacao) && (!filtros.competencia || documento.competencia === filtros.competencia));
  const nomes = new Map(pessoas.map(item => [item.authUserId, item.nomeCompleto]));
  const associacaoPorMunicipio = mapaAssociacoesPorMunicipio();
  const entregas = registros.flatMap(registro => {
    let atividades: Array<Record<string, unknown>> = [];
    try { atividades = JSON.parse(registro.atividadesJson || "[]"); } catch {}
    return atividades.map((atividade, indice) => ({ registro, atividade, indice, associacao: associacaoPorMunicipio.get(chaveMunicipio(atividade.municipio)) || registro.associacao || "ASSOCIAÇÃO NÃO IDENTIFICADA" })).filter(item => ehEntregaMudas(item.atividade));
  }).sort((a, b) => a.associacao.localeCompare(b.associacao, "pt-BR") || String(a.atividade.municipio || "").localeCompare(String(b.atividade.municipio || ""), "pt-BR") || String(b.atividade.data || "").localeCompare(String(a.atividade.data || "")));

  const totalMudasEntregues = entregas.reduce((total, { atividade }) => total + quantidadeEntregue(atividade), 0);

  return <main className="min-h-screen bg-slate-100 text-slate-950">
    <header className="bg-[#123b2a] text-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-black">GESTÃO DE MUDAS</p><p className="text-sm text-emerald-100">COORDENAÇÃO GERAL · ARRANJOS PRODUTIVOS</p></div><a href="/painel" className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold">VOLTAR AO PAINEL</a></div></header>
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-black text-emerald-700">CONTROLE OPERACIONAL</p><h1 className="mt-1 text-3xl font-black">ENTREGAS E COMPRAS DE MUDAS</h1><p className="mt-2 text-slate-600">INCLUA E EDITE ENTREGAS OU ENVIE NOTAS FISCAIS DE COMPRA.</p></div><div className="flex flex-wrap gap-2"><a href="/admin/entrega-mudas" className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 font-black text-white"><Plus className="h-4 w-4"/>NOVA ENTREGA</a><a href="/enviar-nota-fiscal" className="inline-flex items-center gap-2 rounded-xl bg-violet-800 px-5 py-3 font-black text-white"><ReceiptText className="h-4 w-4"/>ENVIAR NOTA DE COMPRA</a><a href="/coordenacao/mudas?notas=1#notas-compra" className="inline-flex items-center gap-2 rounded-xl border-2 border-violet-800 bg-white px-5 py-3 font-black text-violet-800"><ReceiptText className="h-4 w-4"/>VERIFICAR NOTAS DE COMPRA</a></div></div>
      <section aria-label="Total de mudas entregues" className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-900 p-5 text-white shadow-sm"><div className="flex items-center gap-3"><Sprout className="h-8 w-8 text-emerald-200"/><div><h2 className="text-sm font-black">TOTAL DE MUDAS ENTREGUES</h2><p className="mt-1 text-4xl font-black">{totalMudasEntregues.toLocaleString("pt-BR")}</p><p className="mt-1 text-sm text-emerald-100">SOMA DAS QUANTIDADES DAS {entregas.length.toLocaleString("pt-BR")} ENTREGAS CADASTRADAS</p></div></div></section>
      {filtros.notas === "1" && <section id="notas-compra" className="mt-7 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">NOTAS DE COMPRA DE MUDAS LANÇADAS</h2>
        <form className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="notas" value="1"/>
          <label className="text-sm font-bold">ASSOCIAÇÃO<select name="associacao" defaultValue={filtros.associacao || ""} className="mt-1 block h-11 rounded-lg border px-3"><option value="">TODAS AS ASSOCIAÇÕES</option>{[...new Set(notas.map(item => item.documento.associacao))].map(nome => <option key={nome} value={nome}>{nome}</option>)}</select></label>
          <label className="text-sm font-bold">COMPETÊNCIA<input type="month" name="competencia" defaultValue={filtros.competencia || ""} className="mt-1 block h-11 rounded-lg border px-3"/></label>
          <button className="h-11 rounded-lg bg-violet-800 px-5 font-bold text-white">PESQUISAR</button><a href="/coordenacao/mudas?notas=1#notas-compra" className="p-3 font-bold text-violet-800">LIMPAR FILTROS</a>
        </form>
        <p className="mt-4 text-sm text-slate-600">{notasFiltradas.length} NOTA(S) ENCONTRADA(S)</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-3">ASSOCIAÇÃO</th><th>COMPETÊNCIA</th><th>EMISSÃO</th><th>NÚMERO DA NOTA</th><th>DESCRIÇÃO / ARQUIVO</th><th>QUANTIDADE</th><th>VALOR (R$)</th><th>AÇÃO</th></tr></thead><tbody>
          {notasFiltradas.map(({ documento, arquivo }, indice) => <tr key={`${documento.id}-${indice}`} className="border-b"><td className="py-3 font-bold text-emerald-900">{documento.associacao}</td><td>{documento.competencia}</td><td>{arquivo.dataEmissao?.split("-").reverse().join("/") || "NÃO INFORMADA"}</td><td className="p-3 font-bold">{arquivo.numeroNota || "NÃO INFORMADO"}</td><td className="max-w-sm break-words p-3">{arquivo.descricao || "SEM DESCRIÇÃO"}<p className="text-xs text-slate-500">{arquivo.nome}</p></td><td>{arquivo.quantidade || "NÃO INFORMADA"}</td><td>{arquivo.valor || "NÃO INFORMADO"}</td><td>{arquivo.key ? <a href={`/api/coordenacao/mudas/nota?key=${encodeURIComponent(arquivo.key)}`} target="_blank" rel="noopener noreferrer" className="font-black text-violet-800 underline">VISUALIZAR NOTA</a> : "SEM ARQUIVO"}{arquivo.key&&<NotaAcoes documentoId={documento.id} nota={arquivo}/>}</td></tr>)}
          {!notasFiltradas.length && <tr><td colSpan={8} className="py-10 text-center text-slate-500">NENHUMA NOTA DE COMPRA DE MUDAS ENCONTRADA PARA OS FILTROS SELECIONADOS.</td></tr>}
        </tbody></table></div>
      </section>}
      <section className="mt-7 rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Sprout className="h-6 w-6 text-emerald-700"/><div><h2 className="text-xl font-black">ENTREGAS CADASTRADAS</h2><p className="text-sm text-slate-600">{entregas.length.toLocaleString("pt-BR")} REGISTRO(S) · ORDENADOS POR ASSOCIAÇÃO</p></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-3">DATA</th><th>ASSOCIAÇÃO</th><th>COLABORADOR</th><th>MUNICÍPIO</th><th>TIPO</th><th>QUANTIDADE</th><th>AÇÃO</th></tr></thead><tbody>{entregas.map(({registro,atividade,indice,associacao})=><tr key={`${registro.id}-${indice}`} className="border-b"><td className="py-3 font-bold">{String(atividade.data||"").split("-").reverse().join("/")||"NÃO INFORMADA"}</td><td className="font-black text-emerald-900">{associacao}</td><td>{nomes.get(registro.authUserId)||"NÃO INFORMADO"}</td><td>{String(atividade.municipio||"NÃO INFORMADO")}</td><td>{tipoMudaEntregue(atividade)}</td><td className="font-black text-emerald-800">{quantidadeEntregue(atividade).toLocaleString("pt-BR")}</td><td><div className="flex items-center gap-2"><a href={`/admin/entrega-mudas?editar=${registro.id}&atividade=${indice}`} className="inline-flex items-center gap-1 font-black text-blue-800"><Pencil className="h-4 w-4"/>EDITAR</a><ExcluirEntregaButton prestacaoId={registro.id} atividadeIndex={indice} retorno="/coordenacao/mudas" compacto/></div></td></tr>)}{!entregas.length&&<tr><td colSpan={7} className="py-10 text-center text-slate-500">NENHUMA ENTREGA CADASTRADA.</td></tr>}</tbody></table></div></section>
    </div>
  </main>;
}
