import MapaProjeto from "./mapa-projeto";
import { ArrowRight, Building2, ClipboardCheck, Landmark, LockKeyhole, ShieldCheck, UserPlus } from "lucide-react";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const entrar = user ? "/painel" : chatGPTSignInPath("/painel");
  const cadastrar = user ? "/cadastro" : "/criar-conta";
  const administrar = "/entrar-administracao";
  const portalAssociacao = "/entrar-associacao";
  const portalAderes = "/entrar-aderes";
  const acessos=[
    {titulo:"Entrar no portal",descricao:"Colaboradores",href:entrar,icon:LockKeyhole,cor:"bg-emerald-800",top:!user},
    {titulo:"Criar cadastro",descricao:"Primeiro acesso",href:cadastrar,icon:UserPlus,cor:"bg-amber-700",top:!user},
    {titulo:"Administração",descricao:"Gestão do projeto",href:administrar,icon:ShieldCheck,cor:"bg-blue-800",top:true},
    {titulo:"Associações",descricao:"Documentos financeiros",href:portalAssociacao,icon:Building2,cor:"bg-violet-800",top:true},
    {titulo:"ADERES",descricao:"Análise e prestação",href:portalAderes,icon:Landmark,cor:"bg-teal-800",top:true},
  ];
  return <main className="min-h-screen bg-[#f2f6f1] text-slate-900 lg:grid lg:h-dvh lg:min-h-0 lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:overflow-hidden">
    <header className="bg-[#123b2a] text-white"><div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-3 lg:px-7"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6b44a] text-lg font-black text-[#123b2a]">AP</span><div><h1 className="text-sm font-bold tracking-wide">ARRANJOS PRODUTIVOS</h1><p className="text-xs text-emerald-100">Portal de Prestação de Contas</p></div></div><a href="https://guia-culturas-arranjos.arranjosprodutivoses.workers.dev/" target="_blank" rel="noreferrer" className="rounded-xl bg-[#e6b44a] px-3 py-2 text-center text-xs font-bold text-[#123b2a]">GUIA DE MANEJO DE CULTURAS</a></div></header>
    <nav aria-label="Acessos do portal" className="mx-auto grid w-full max-w-[1600px] grid-cols-2 gap-2 px-5 py-3 sm:grid-cols-5 lg:px-7">{acessos.map(a=><a key={a.titulo} href={a.href} target={a.top?"_top":undefined} className="flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:border-emerald-600 hover:shadow-md"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white ${a.cor}`}><a.icon className="h-4 w-4"/></span><span className="min-w-0"><span className="block text-xs font-bold sm:text-sm">{a.titulo}</span><span className="hidden text-[10px] text-slate-500 xl:block">{a.descricao}</span></span><ArrowRight className="ml-auto hidden h-4 w-4 shrink-0 text-slate-400 xl:block"/></a>)}</nav>
    <MapaProjeto/>
  </main>;
}
