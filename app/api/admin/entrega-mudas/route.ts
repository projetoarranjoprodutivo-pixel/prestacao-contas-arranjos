import { lerQuantidadeInteira } from "@/lib/quantidade";
import { sql } from "drizzle-orm";
import { getGestorMudasUser } from "@/lib/admin";
import { getDb } from "@/db";
import { prestacoes } from "@/db/schema";
import { RESPONSAVEL_ENTREGAS_OFICIAIS } from "@/lib/entregas-mudas";
import { MUNICIPIOS_ES } from "@/lib/municipios-es";
import { TIPOS_MUDAS } from "@/lib/opcoes-atividades";

export const runtime = "edge";

export async function POST(request: Request) {
  if (!await getGestorMudasUser()) return Response.json({message:"ACESSO RESTRITO."},{status:403});
  try {
    const form = await request.formData();
    const data = String(form.get("data") || "");
    const municipio = String(form.get("municipio") || "");
    const tipoMuda = String(form.get("tipoMuda") || "");
    const quantidade = lerQuantidadeInteira(form.get("quantidade"));
    const observacao = String(form.get("observacao") || "").trim();
    const dia = new Date(data + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(dia.getTime()) || dia.toISOString().slice(0,10) !== data ||
        !MUNICIPIOS_ES.includes(municipio as typeof MUNICIPIOS_ES[number]) ||
        !TIPOS_MUDAS.includes(tipoMuda as typeof TIPOS_MUDAS[number]) ||
        !Number.isSafeInteger(quantidade) || quantidade < 1) {
      return Response.json({message:"CONFIRA A DATA, O MUNICÍPIO, O TIPO E A QUANTIDADE DA ENTREGA."},{status:400});
    }

    const atividade = {
      executada:true, municipio, comunidade:"", propriedade:"", agricultor:"", telefone:"",
      tipoAtividade:"Entrega de mudas", tipoMuda, quantidadeMudas:String(quantidade),
      data, inicio:"00:00", duracao:"0", unidadeDuracao:"horas", observacao,
      resumo:observacao || `ENTREGA DE ${quantidade.toLocaleString("pt-BR")} MUDA(S) DE ${tipoMuda.toLocaleUpperCase("pt-BR")}.`,
      assinaturaProdutor:"", assinaturaTecnico:"",
    };
    const atualizadoEm = new Date().toISOString();
    await getDb().insert(prestacoes).values({
      authUserId:RESPONSAVEL_ENTREGAS_OFICIAIS, competencia:data.slice(0,7),
      municipio:"Consolidado", associacao:"CONSOLIDADO ADMINISTRATIVO",
      atividadesJson:JSON.stringify([atividade]), totalMinutos:0, anexosJson:"[]",
      status:"enviado", atualizadoEm,
    }).onConflictDoUpdate({
      target:[prestacoes.authUserId,prestacoes.competencia],
      set:{
        atividadesJson:sql`json_insert(${prestacoes.atividadesJson}, '$[#]', json(${JSON.stringify(atividade)}))`,
        atualizadoEm,
      },
    });
    return Response.json({message:"ENTREGA DE MUDAS SALVA COM SUCESSO."});
  } catch (error) {
    console.error("admin_entrega_mudas_error",error);
    return Response.json({message:"NÃO FOI POSSÍVEL SALVAR A ENTREGA DE MUDAS."},{status:500});
  }
}
