import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { colaboradores, prestacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { atividadeExecutada, formatarDuracao, lerDuracaoHorasMinutos, type DuracaoAtividade } from "@/lib/duracao-relatorios";

export const runtime = "edge";

export async function POST(request: Request) {
  if (!await getAdminUser()) return Response.json({ message: "Acesso restrito." }, { status: 403 });
  const form = await request.formData();
  const colaboradorId = Number(form.get("colaboradorId"));
  const competencia = String(form.get("competencia") || "");
  const texto = String(form.get("duracoes") || "").trim();
  if (!Number.isSafeInteger(colaboradorId) || colaboradorId < 1 ||
      !/^20\d{2}-(0[1-9]|1[0-2])$/.test(competencia) || !texto || texto.length > 12000) {
    return Response.json({ message: "Confira o colaborador, a competência e as durações." }, { status: 400 });
  }
  const duracoes = new Map<string, number>();
  for (const linha of texto.split(/\r?\n/).filter(linha => linha.trim())) {
    const partes = linha.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:[0-5]\d)$/);
    const minutos = partes ? lerDuracaoHorasMinutos(partes[2]) : null;
    if (!partes || minutos === null || minutos === 0 || duracoes.has(partes[1])) {
      return Response.json({ message: `Confira a linha "${linha}". Use uma data única e uma duração positiva em H:MM.` }, { status: 400 });
    }
    duracoes.set(partes[1], minutos);
  }
  const db = getDb();
  const [registro] = await db.select({
    id: prestacoes.id, nome: colaboradores.nomeCompleto, atividadesJson: prestacoes.atividadesJson,
    atualizadoEm: prestacoes.atualizadoEm, totalMinutos: prestacoes.totalMinutos,
  }).from(prestacoes).innerJoin(colaboradores, eq(colaboradores.authUserId, prestacoes.authUserId))
    .where(and(eq(colaboradores.id, colaboradorId), eq(prestacoes.competencia, competencia))).limit(1);
  if (!registro) return Response.json({ message: "Prestação não encontrada." }, { status: 404 });
  const atividades = JSON.parse(registro.atividadesJson) as DuracaoAtividade[];
  const datas = atividades.filter(atividadeExecutada).map(atividade => atividade.data || "");
  if (datas.length !== duracoes.size || new Set(datas).size !== datas.length || datas.some(data => !duracoes.has(data))) {
    return Response.json({ message: "As datas informadas devem corresponder a todas as atividades executadas da prestação, com uma atividade por data." }, { status: 409 });
  }
  const corrigidas = atividades.map(atividade => atividadeExecutada(atividade)
    ? { ...atividade, duracao: String(duracoes.get(atividade.data!)! / 60), unidadeDuracao: "horas" }
    : atividade);
  const totalMinutos = [...duracoes.values()].reduce((soma, minutos) => soma + minutos, 0);
  const atividadesJson = JSON.stringify(corrigidas);
  if (atividadesJson !== registro.atividadesJson || totalMinutos !== registro.totalMinutos) {
    const [salvo] = await db.update(prestacoes).set({ atividadesJson, totalMinutos, atualizadoEm: new Date().toISOString() })
      .where(and(eq(prestacoes.id, registro.id), eq(prestacoes.atualizadoEm, registro.atualizadoEm),
        eq(prestacoes.atividadesJson, registro.atividadesJson), eq(prestacoes.totalMinutos, registro.totalMinutos)))
      .returning({ id: prestacoes.id });
    if (!salvo) return Response.json({ message: "A prestação foi alterada durante a correção. Confira os dados e tente novamente." }, { status: 409 });
  }
  return Response.json({ message: `${registro.nome} · ${competencia} · ${datas.length} atividades conferidas · Total ${formatarDuracao(totalMinutos)}.` });
}
