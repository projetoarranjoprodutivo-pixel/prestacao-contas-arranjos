import { lerQuantidadeInteira } from "@/lib/quantidade";
import {eq} from "drizzle-orm";
import {getDb} from "@/db";
import {prestacoes} from "@/db/schema";
import {getGestorMudasUser} from "@/lib/admin";
import {MUNICIPIOS_ES} from "@/lib/municipios-es";
import {TIPOS_MUDAS} from "@/lib/opcoes-atividades";
import {ehEntregaMudas} from "@/lib/entregas-mudas";

export const runtime="edge";
export async function POST(request:Request){
 if(!await getGestorMudasUser())return Response.json({message:"ACESSO RESTRITO."},{status:403});
 const f=await request.formData();const acao=String(f.get("acao")||"editar");const prestacaoId=Number(f.get("prestacaoId"));const atividadeIndex=Number(f.get("atividadeIndex"));const data=String(f.get("data")||"");const municipio=String(f.get("municipio")||"");const tipoMuda=String(f.get("tipoMuda")||"");const quantidadeTexto=String(f.get("quantidade")||"").trim();const observacao=String(f.get("observacao")||"").trim();
 const quantidade = lerQuantidadeInteira(quantidadeTexto);
 if(!Number.isInteger(prestacaoId)||!Number.isInteger(atividadeIndex)||(data&&!/^\d{4}-\d{2}-\d{2}$/.test(data))||(municipio&&!MUNICIPIOS_ES.includes(municipio as typeof MUNICIPIOS_ES[number]))||(tipoMuda&&!TIPOS_MUDAS.includes(tipoMuda as typeof TIPOS_MUDAS[number]))||(quantidadeTexto&&!Number.isFinite(quantidade)))return Response.json({message:"CONFIRA OS DADOS INFORMADOS."},{status:400});
 const db=getDb();const registro=await db.query.prestacoes.findFirst({where:eq(prestacoes.id,prestacaoId)});if(!registro)return Response.json({message:"PRESTAÇÃO NÃO ENCONTRADA."},{status:404});let atividades:Array<Record<string,unknown>>=[];try{atividades=JSON.parse(registro.atividadesJson);}catch{}const atividade=atividades[atividadeIndex];if(!atividade||!ehEntregaMudas(atividade))return Response.json({message:"ENTREGA DE MUDAS NÃO ENCONTRADA."},{status:404});
 if(acao==="excluir"){atividades.splice(atividadeIndex,1);await db.update(prestacoes).set({atividadesJson:JSON.stringify(atividades),atualizadoEm:new Date().toISOString()}).where(eq(prestacoes.id,prestacaoId));return Response.json({message:"ENTREGA EXCLUÍDA COM SUCESSO."});}
 atividades[atividadeIndex]={...atividade,data,municipio,tipoAtividade:"Entrega de mudas",tipoMuda,quantidadeMudas:quantidadeTexto ? String(quantidade) : "",resumo:observacao||atividade.resumo||"",observacao};await db.update(prestacoes).set({atividadesJson:JSON.stringify(atividades),atualizadoEm:new Date().toISOString()}).where(eq(prestacoes.id,prestacaoId));return Response.json({message:"ENTREGA ATUALIZADA COM SUCESSO."});
}
