import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getDb } from "@/db";
import { colaboradores, prestacoes } from "@/db/schema";
import { eq } from "drizzle-orm";
import EntregaMudasForm from "./form";
import EditarEntregaForm from "./editar-form";
import { ehEntregaMudas, quantidadeEntregue, tipoMudaEntregue } from "@/lib/entregas-mudas";

export const dynamic = "force-dynamic";

export default async function EntregaMudasPage({searchParams}:{searchParams:Promise<{competencia?:string;competencias?:string|string[];editar?:string;atividade?:string}>}){
  const admin=await getAdminUser();if(!admin)redirect("/");
  const params=await searchParams;
  const editar=Number(params.editar),atividadeIndex=Number(params.atividade);if(Number.isInteger(editar)&&editar>0&&Number.isInteger(atividadeIndex)&&atividadeIndex>=0){const registro=await getDb().query.prestacoes.findFirst({where:eq(prestacoes.id,editar)});let atividades:Array<Record<string,unknown>>=[];try{atividades=JSON.parse(registro?.atividadesJson||"[]");}catch{}const atividade=atividades[atividadeIndex];if(registro&&atividade&&ehEntregaMudas(atividade)){const selecionadas=(Array.isArray(params.competencias)?params.competencias:params.competencias?[params.competencias]:[registro.competencia]).filter(c=>/^\d{4}-\d{2}$/.test(c));const retorno=`/admin?aba=resumo&${selecionadas.map(c=>`competencias=${encodeURIComponent(c)}`).join("&")}`;return <main className="min-h-screen bg-slate-100 p-5 text-slate-950"><section className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm font-black text-emerald-800">ADMINISTRAÇÃO · ARRANJOS PRODUTIVOS</p><h1 className="mt-2 text-3xl font-black">EDITAR ENTREGA DE MUDAS</h1><p className="mt-2 text-sm text-slate-600">COMPETÊNCIA {registro.competencia}. O TOTAL INFORMADO SERÁ RECALCULADO PELA QUANTIDADE.</p><EditarEntregaForm dados={{prestacaoId:registro.id,atividadeIndex,data:String(atividade.data||""),municipio:String(atividade.municipio||""),tipoMuda:tipoMudaEntregue(atividade),quantidadeMudas:quantidadeEntregue(atividade)>0?String(quantidadeEntregue(atividade)):"",observacao:String(atividade.observacao||atividade.resumo||""),retorno}}/><a href={retorno} className="mt-6 inline-block font-bold text-emerald-800">CANCELAR E VOLTAR</a></section></main>;}}
  const competencia=/^\d{4}-\d{2}$/.test(params.competencia||"")?params.competencia!:new Date().toISOString().slice(0,7);
  const tecnicos=(await getDb().select().from(colaboradores)).sort((a,b)=>a.nomeCompleto.localeCompare(b.nomeCompleto));
  return <main className="min-h-screen bg-slate-100 p-5 text-slate-950"><section className="mx-auto max-w-4xl rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm font-black text-emerald-800">ADMINISTRAÇÃO · ARRANJOS PRODUTIVOS</p><h1 className="mt-2 text-3xl font-black">INCLUIR ENTREGA DE MUDAS</h1><p className="mt-2 text-sm text-slate-600">A ENTREGA SERÁ INCLUÍDA NA PRESTAÇÃO DE CONTAS DO COLABORADOR E NO RESUMO ADMINISTRATIVO.</p><EntregaMudasForm competenciaInicial={competencia} colaboradores={tecnicos.map(item=>({id:item.authUserId,nome:item.nomeCompleto,associacao:item.associacao||""}))}/><a href={`/admin?aba=resumo&competencias=${competencia}`} className="mt-6 inline-block font-bold text-emerald-800">VOLTAR AO RESUMO E MUDAS</a></section></main>;
}
