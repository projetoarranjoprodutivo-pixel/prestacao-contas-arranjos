import { redirect } from "next/navigation";
import { Pencil, Plus, ReceiptText, Sprout } from "lucide-react";
import { getGestorMudasUser } from "@/lib/admin";
import { getDb } from "@/db";
import { colaboradores, prestacoes } from "@/db/schema";
import { ehEntregaMudas, quantidadeEntregue, tipoMudaEntregue } from "@/lib/entregas-mudas";
import ExcluirEntregaButton from "@/app/admin/entrega-mudas/excluir-button";

export const dynamic = "force-dynamic";

export default async function GestaoMudasPage() {
  const gestor = await getGestorMudasUser();
  if (!gestor) redirect("/");
  const db = getDb();
  const [registros, pessoas] = await Promise.all([db.select().from(prestacoes), db.select().from(colaboradores)]);
  const nomes = new Map(pessoas.map(item => [item.authUserId, item.nomeCompleto]));
  const entregas = registros.flatMap(registro => {
    let atividades: Array<Record<string, unknown>> = [];
    try { atividades = JSON.parse(registro.atividadesJson || "[]"); } catch {}
    return atividades.map((atividade, indice) => ({ registro, atividade, indice })).filter(item => ehEntregaMudas(item.atividade));
  }).sort((a, b) => String(b.atividade.data || "").localeCompare(String(a.atividade.data || "")));

  return <main className="min-h-screen bg-slate-100 text-slate-950">
    <header className="bg-[#123b2a] text-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-black">GESTÃO DE MUDAS</p><p className="text-sm text-emerald-100">COORDENAÇÃO GERAL · ARRANJOS PRODUTIVOS</p></div><a href="/painel" className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold">VOLTAR AO PAINEL</a></div></header>
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-black text-emerald-700">CONTROLE OPERACIONAL</p><h1 className="mt-1 text-3xl font-black">ENTREGAS E COMPRAS DE MUDAS</h1><p className="mt-2 text-slate-600">INCLUA E EDITE ENTREGAS OU ENVIE NOTAS FISCAIS DE COMPRA.</p></div><div className="flex flex-wrap gap-2"><a href="/admin/entrega-mudas" className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 font-black text-white"><Plus className="h-4 w-4"/>NOVA ENTREGA</a><a href="/enviar-nota-fiscal" className="inline-flex items-center gap-2 rounded-xl bg-violet-800 px-5 py-3 font-black text-white"><ReceiptText className="h-4 w-4"/>ENVIAR NOTA DE COMPRA</a></div></div>
      <section className="mt-7 rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Sprout className="h-6 w-6 text-emerald-700"/><div><h2 className="text-xl font-black">ENTREGAS CADASTRADAS</h2><p className="text-sm text-slate-600">{entregas.length.toLocaleString("pt-BR")} REGISTRO(S)</p></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-3">DATA</th><th>ASSOCIAÇÃO</th><th>COLABORADOR</th><th>MUNICÍPIO</th><th>TIPO</th><th>QUANTIDADE</th><th>AÇÃO</th></tr></thead><tbody>{entregas.map(({registro,atividade,indice})=><tr key={`${registro.id}-${indice}`} className="border-b"><td className="py-3 font-bold">{String(atividade.data||"").split("-").reverse().join("/")||"NÃO INFORMADA"}</td><td>{registro.associacao}</td><td>{nomes.get(registro.authUserId)||"NÃO INFORMADO"}</td><td>{String(atividade.municipio||"NÃO INFORMADO")}</td><td>{tipoMudaEntregue(atividade)}</td><td className="font-black text-emerald-800">{quantidadeEntregue(atividade).toLocaleString("pt-BR")}</td><td><div className="flex items-center gap-2"><a href={`/admin/entrega-mudas?editar=${registro.id}&atividade=${indice}`} className="inline-flex items-center gap-1 font-black text-blue-800"><Pencil className="h-4 w-4"/>EDITAR</a><ExcluirEntregaButton prestacaoId={registro.id} atividadeIndex={indice} retorno="/coordenacao/mudas" compacto/></div></td></tr>)}{!entregas.length&&<tr><td colSpan={7} className="py-10 text-center text-slate-500">NENHUMA ENTREGA CADASTRADA.</td></tr>}</tbody></table></div></section>
    </div>
  </main>;
}
