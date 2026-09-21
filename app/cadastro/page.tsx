import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import { getDb } from "@/db";
import { garantirNomeEmpresarial } from "@/db/bootstrap";
import { associacoes, colaboradores } from "@/db/schema";
import { eq } from "drizzle-orm";
import CadastroForm from "../cadastro-form";

export const dynamic = "force-dynamic";

export default async function CadastroPage() {
  const user = await requireChatGPTUser("/cadastro");
  await garantirNomeEmpresarial();
  let cadastro = null;
  let listaAssociacoes:Array<{nome:string;municipios:string[]}>=[];
  try { cadastro = await getDb().query.colaboradores.findFirst({ where: eq(colaboradores.authUserId, user.userId) }); } catch { cadastro = null; }
  try { listaAssociacoes=(await getDb().select().from(associacoes)).filter(a=>a.ativo).map(a=>{let municipios:string[]=[];try{municipios=JSON.parse(a.municipiosJson);}catch{}return{nome:a.nome,municipios};}); } catch { listaAssociacoes=[]; }
  return <main className="min-h-screen bg-[#f4f7f3] text-slate-900">
    <header className="border-b border-emerald-950/10 bg-[#123b2a] text-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8"><a href="/" className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e6b44a] text-lg font-black text-[#123b2a]">AP</span><span><span className="block text-sm font-semibold tracking-wide">ARRANJOS PRODUTIVOS</span><span className="block text-xs text-emerald-100">Prestação de contas 2026</span></span></a><div className="flex items-center gap-4"><span className="hidden text-sm text-emerald-100 sm:block">{user.email}</span><a className="rounded-lg border border-white/25 px-3 py-2 text-sm font-semibold hover:bg-white/10" href={chatGPTSignOutPath("/")}>Sair</a></div></div></header>
    <div className="mx-auto grid max-w-7xl gap-7 px-5 py-7 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8"><aside className="h-fit rounded-2xl bg-[#173f30] p-5 text-white shadow-sm lg:sticky lg:top-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#e6b44a]">Início do acesso</p><h1 className="mt-2 text-2xl font-bold leading-tight">Cadastro do colaborador</h1><p className="mt-3 text-sm leading-6 text-emerald-100">Complete seus dados uma única vez. Eles identificarão seus planos mensais, atividades, horas e anexos.</p><ol className="mt-7 space-y-4 text-sm">{["Dados pessoais", "Função e contato", "Documentos", "Revisão"].map((item,index)=><li key={item} className="flex items-center gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-bold ${index===0?"bg-[#e6b44a] text-[#173f30]":"bg-white/10 text-emerald-100"}`}>{index+1}</span><span className={index===0?"font-semibold":"text-emerald-100"}>{item}</span></li>)}</ol><div className="mt-7 rounded-xl border border-white/10 bg-white/5 p-4 text-sm"><p className="font-semibold">E-mail de acesso</p><p className="mt-1 break-all text-emerald-100">{user.email}</p></div></aside><section className="min-w-0"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-800">ETAPA 1 DE 4</p><h2 className="mt-1 text-3xl font-bold tracking-tight">Seus dados cadastrais</h2><p className="mt-2 max-w-2xl text-slate-600">Campos marcados com * são obrigatórios. Seus documentos serão conferidos a cada acesso.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800">{cadastro?"Cadastro localizado":"Novo cadastro"}</span></div><CadastroForm userEmail={user.email} initialData={cadastro} associacoes={listaAssociacoes}/></section></div>
  </main>;
}
