import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { getDb } from "@/db";
import { garantirUsuariosDosColaboradores } from "@/db/bootstrap";
import { colaboradores, planosTrabalho, prestacoes } from "@/db/schema";

export const runtime = "edge";

type Atividade = {
  data: string; hora: string; inicio: string; duracao: string; municipio: string; comunidade: string;
  propriedade: string; agricultor: string; telefone: string; tipoAtividade: string; tipoMuda: string;
  quantidadeMudas: string; observacao: string; resumo: string; executada: boolean;
  assinaturaProdutor: string; assinaturaTecnico: string;
};
type DadosImportacao = {
  tecnico: {
    nomeCompleto: string; email: string; cargo: string; associacao: string; municipiosAtendidos: string[];
    mei: string; nomeEmpresarial: string; celular: string; endereco: string;
  };
  relatorios: Array<{
    competencia: string; arquivo: string; descricao: string; atividades: Atividade[]; totalMinutos: number;
  }>;
};

const agora = () => new Date().toISOString();
const identificadorHistorico = (email: string) => `historico-${email.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

function agricultoresDasAtividades(dados: DadosImportacao) {
  const encontrados = new Map<string, { municipio: string; comunidade: string; propriedade: string; agricultor: string; telefone: string }>();
  for (const relatorio of dados.relatorios) for (const atividade of relatorio.atividades) {
    if (!atividade.agricultor) continue;
    const chave = `${atividade.agricultor.trim().toLocaleUpperCase("pt-BR")}|${atividade.municipio.trim().toLocaleUpperCase("pt-BR")}`;
    if (!encontrados.has(chave)) encontrados.set(chave, {
      municipio: atividade.municipio,
      comunidade: atividade.comunidade,
      propriedade: atividade.propriedade,
      agricultor: atividade.agricultor,
      telefone: atividade.telefone,
    });
  }
  return [...encontrados.values()];
}

function agenda(atividades: Atividade[]) {
  return atividades.map((atividade) => ({
    data: atividade.data,
    hora: atividade.hora,
    municipio: atividade.municipio,
    comunidade: atividade.comunidade,
    propriedade: atividade.propriedade,
    agricultor: atividade.agricultor,
    telefone: atividade.telefone,
    tipoAtividade: atividade.tipoAtividade,
    tipoMuda: atividade.tipoMuda,
    quantidadeMudas: atividade.quantidadeMudas,
    observacao: atividade.observacao,
  }));
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ message: "ACESSO RESTRITO." }, { status: 403 });
  if (!env.BUCKET) return Response.json({ message: "ARMAZENAMENTO DE ANEXOS INDISPONÍVEL." }, { status: 503 });

  try {
    const form = await request.formData();
    let dados: DadosImportacao;
    const entradaDados = form.get("dados");
    try { dados = JSON.parse(entradaDados instanceof File ? await entradaDados.text() : String(entradaDados || "")) as DadosImportacao; }
    catch { return Response.json({ message: "OS DADOS EXTRAÍDOS DOS RELATÓRIOS SÃO INVÁLIDOS." }, { status: 400 }); }
    if (!dados.tecnico?.nomeCompleto || !dados.tecnico?.email || !dados.tecnico.associacao || !dados.relatorios.length) {
      return Response.json({ message: "CONFIRA O TÉCNICO, A ASSOCIAÇÃO E OS RELATÓRIOS DA IMPORTAÇÃO." }, { status: 400 });
    }
    if (dados.relatorios.some((item) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(item.competencia) || !item.atividades.length)) {
      return Response.json({ message: "AS COMPETÊNCIAS OU ATIVIDADES EXTRAÍDAS SÃO INVÁLIDAS." }, { status: 400 });
    }
    const db = getDb();
    const authIdHistorico = identificadorHistorico(dados.tecnico.email);
    const anexos = new Map<string, { key: string; nome: string; tipo: string }>();

    for (const relatorio of dados.relatorios) {
      const entrada = form.get(`relatorio-${relatorio.competencia}`);
      if (!(entrada instanceof File) || !entrada.size) {
        return Response.json({ message: `ENVIE O PDF ORIGINAL DA COMPETÊNCIA ${relatorio.competencia}.` }, { status: 400 });
      }
      if (entrada.type !== "application/pdf") {
        return Response.json({ message: `O ARQUIVO ${entrada.name} PRECISA ESTAR EM PDF.` }, { status: 400 });
      }
      if (entrada.size > 20 * 1024 * 1024) {
        return Response.json({ message: `O ARQUIVO ${entrada.name} ULTRAPASSA 20 MB.` }, { status: 400 });
      }
      const key = `prestacoes/${authIdHistorico}/${relatorio.competencia}/relatorio-historico-original.pdf`;
      await env.BUCKET.put(key, await entrada.arrayBuffer(), { metadata: { contentType: "application/pdf" } });
      anexos.set(relatorio.competencia, { key, nome: relatorio.arquivo, tipo: "application/pdf" });
    }

    const tecnico = dados.tecnico;
    const existente = await db.query.colaboradores.findFirst({ where: eq(colaboradores.email, tecnico.email) });
    const cadastro = {
      authUserId: existente?.authUserId || authIdHistorico,
      email: tecnico.email,
      nomeCompleto: tecnico.nomeCompleto,
      dataNascimento: existente?.dataNascimento || "",
      cpf: existente?.cpf || `HISTORICO-${authIdHistorico.slice(-12)}`,
      sexo: existente?.sexo || "",
      cargo: tecnico.cargo,
      associacao: tecnico.associacao,
      associacoesJson: JSON.stringify([tecnico.associacao]),
      municipiosAtendidosJson: JSON.stringify(tecnico.municipiosAtendidos),
      mei: tecnico.mei,
      nomeEmpresarial: tecnico.nomeEmpresarial,
      cftaCrea: existente?.cftaCrea || null,
      cep: existente?.cep || "",
      endereco: tecnico.endereco,
      numero: existente?.numero || "",
      complemento: existente?.complemento || null,
      bairro: existente?.bairro || "",
      cidade: existente?.cidade || tecnico.municipiosAtendidos[0] || "",
      uf: existente?.uf || "ES",
      celular: tecnico.celular,
      atendimentosJson: JSON.stringify(agricultoresDasAtividades(dados)),
      superioresJson: existente?.superioresJson || "{}",
      documentoKey: existente?.documentoKey || null,
      documentoNome: existente?.documentoNome || null,
      documentoTipo: existente?.documentoTipo || null,
      documentosJson: existente?.documentosJson || "[]",
      documentoValidade: existente?.documentoValidade || "",
      atualizadoEm: agora(),
    };
    if (existente) await db.update(colaboradores).set(cadastro).where(eq(colaboradores.id, existente.id));
    else await db.insert(colaboradores).values(cadastro);
    await garantirUsuariosDosColaboradores();

    const authUserId = cadastro.authUserId;
    for (const relatorio of dados.relatorios) {
      const plano = {
        authUserId,
        competencia: relatorio.competencia,
        associacao: tecnico.associacao,
        agendaJson: JSON.stringify(agenda(relatorio.atividades)),
        status: "importado",
        atualizadoEm: agora(),
      };
      await db.insert(planosTrabalho).values(plano).onConflictDoUpdate({
        target: [planosTrabalho.authUserId, planosTrabalho.competencia],
        set: plano,
      });
      const prestacao = {
        authUserId,
        competencia: relatorio.competencia,
        municipio: tecnico.municipiosAtendidos[0] || "",
        associacao: tecnico.associacao,
        atividadesJson: JSON.stringify(relatorio.atividades),
        totalMinutos: relatorio.totalMinutos,
        anexosJson: JSON.stringify([anexos.get(relatorio.competencia)]),
        observacoes: relatorio.descricao,
        status: "importado",
        atualizadoEm: agora(),
      };
      await db.insert(prestacoes).values(prestacao).onConflictDoUpdate({
        target: [prestacoes.authUserId, prestacoes.competencia],
        set: prestacao,
      });
    }

    return Response.json({
      message: "RELATÓRIOS HISTÓRICOS IMPORTADOS COM SUCESSO.",
      tecnico: tecnico.nomeCompleto,
      associacao: tecnico.associacao,
      competencias: dados.relatorios.map((item) => item.competencia),
      atividades: dados.relatorios.reduce((total, item) => total + item.atividades.length, 0),
      anexos: anexos.size,
      cadastroIncompletoPermitido: true,
    });
  } catch (error) {
    console.error("importacao_historica_error", error);
    return Response.json({ message: "NÃO FOI POSSÍVEL IMPORTAR OS RELATÓRIOS HISTÓRICOS." }, { status: 500 });
  }
}
