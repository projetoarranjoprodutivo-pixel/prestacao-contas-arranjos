import { strFromU8, unzipSync } from "fflate";
import { getAdminUser } from "@/lib/admin";
import { POST as importarRelatorio } from "@/app/api/admin/importar-relatorios-historicos/route";

export const runtime = "edge";

type DadosPacote = { tecnico?: { nomeCompleto?: string }; relatorios?: Array<{ competencia?: string; arquivo?: string }> };
const nomeBase = (caminho: string) => caminho.split("/").pop() || caminho;

export async function POST(request: Request) {
  if (!await getAdminUser()) return Response.json({ message: "ACESSO RESTRITO." }, { status: 403 });
  try {
    const form = await request.formData();
    const pacote = form.get("pacote");
    if (!(pacote instanceof File) || !pacote.size) return Response.json({ message: "SELECIONE O ARQUIVO ZIP." }, { status: 400 });
    const entradas = Object.entries(unzipSync(new Uint8Array(await pacote.arrayBuffer())))
      .filter(([caminho]) => !caminho.endsWith("/") && !caminho.startsWith("__MACOSX/"));
    const jsons = entradas.filter(([caminho]) => caminho.toLowerCase().endsWith(".json"));
    const pdfs = new Map(entradas.filter(([caminho]) => caminho.toLowerCase().endsWith(".pdf")).map(([caminho, bytes]) => [nomeBase(caminho), bytes]));
    if (!jsons.length || !pdfs.size) return Response.json({ message: "O ZIP PRECISA CONTER ARQUIVOS JSON E PDF." }, { status: 400 });
    const resultados: string[] = [];
    for (const [caminho, bytes] of jsons) {
      const texto = strFromU8(bytes);
      const dados = JSON.parse(texto) as DadosPacote;
      if (!dados.relatorios?.length) { resultados.push(`✗ ${nomeBase(caminho)} · JSON SEM RELATÓRIOS`); continue; }
      const envio = new FormData();
      envio.set("dados", texto);
      let completo = true;
      for (const relatorio of dados.relatorios) {
        const pdf = relatorio.arquivo ? pdfs.get(relatorio.arquivo) : undefined;
        if (!relatorio.competencia || !relatorio.arquivo || !pdf) { completo = false; break; }
        envio.set(`relatorio-${relatorio.competencia}`, new File([pdf.slice().buffer], relatorio.arquivo, { type: "application/pdf" }));
      }
      if (!completo) { resultados.push(`✗ ${nomeBase(caminho)} · PDF NÃO ENCONTRADO`); continue; }
      const resposta = await importarRelatorio(new Request(request.url, { method: "POST", body: envio }));
      const corpo = await resposta.json().catch(() => ({})) as { message?: string; tecnico?: string; competencias?: string[]; atividades?: number };
      resultados.push(resposta.ok
        ? `✓ ${corpo.tecnico || dados.tecnico?.nomeCompleto || nomeBase(caminho)} · ${corpo.competencias?.join(", ") || "COMPETÊNCIA IMPORTADA"} · ${corpo.atividades || 0} ATIVIDADES`
        : `✗ ${dados.tecnico?.nomeCompleto || nomeBase(caminho)} · ${corpo.message || "FALHA NA IMPORTAÇÃO"}`);
    }
    return Response.json({ message: "IMPORTAÇÃO DO PACOTE CONCLUÍDA.", resultados });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "NÃO FOI POSSÍVEL LER O PACOTE." }, { status: 400 });
  }
}
