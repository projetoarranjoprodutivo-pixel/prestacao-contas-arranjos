import { inArray, or } from "drizzle-orm";
import { getDb } from "@/db";
import { documentosAssociacao } from "@/db/schema";
import { vinculoNotaNasCompetencias } from "@/db/vinculo-nota";
import { categoriaDaNota, type NotaClassificavel } from "@/lib/classificacao-notas";
import { competenciaDaNota, type VinculoNotaServico } from "@/lib/notas-servico";
import ModuloRecolhivel from "./modulo-recolhivel";

const tipos = {
  servico: "NOTA FISCAL DE SERVIÇO",
  mudas: "NOTA FISCAL DE COMPRA DE MUDAS",
  outras: "OUTRAS NOTAS / NÃO IDENTIFICADAS",
};
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

type Nota = NotaClassificavel & {
  key?: string;
  numeroNota?: string;
  prestador?: string;
  fornecedor?: string;
  cnpjPrestador?: string;
  competencia?: string;
  origemLeitura?: string;
  vinculoPrestacao?: VinculoNotaServico;
};

export default async function PesquisaNotasPdf({ competencias, pesquisa, tipo, nomes }: {
  competencias: string[];
  pesquisa?: string;
  tipo?: string;
  nomes: Map<number, string>;
}) {
  const pesquisou = pesquisa !== undefined || tipo !== undefined;
  const termo = typeof pesquisa === "string" ? pesquisa.trim() : "";
  const categoria = tipo === "servico" || tipo === "mudas" || tipo === "outras" ? tipo : "";
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  const documentos = pesquisou ? await getDb().select({
    id: documentosAssociacao.id,
    associacao: documentosAssociacao.associacao,
    competencia: documentosAssociacao.competencia,
    notas: documentosAssociacao.notasFiscaisJson,
  }).from(documentosAssociacao).where(or(
    inArray(documentosAssociacao.competencia, competencias),
    vinculoNotaNasCompetencias(competencias),
  )) : [];

  const resultados = documentos.flatMap(documento => {
    let notas: Nota[];
    try {
      const dados = JSON.parse(documento.notas);
      if (!Array.isArray(dados)) return [];
      notas = dados.filter(nota => nota && typeof nota === "object");
    } catch {
      return [];
    }
    return notas.flatMap((nota, indice) => {
      const tipoNota = categoriaDaNota(nota);
      if (categoria && categoria !== tipoNota) return [];
      const competencia = nota.vinculoPrestacao?.competencia || competenciaDaNota(nota, documento.competencia);
      if (!competencias.includes(nota.vinculoPrestacao?.competencia || documento.competencia)) return [];
      const vinculado = nota.vinculoPrestacao && nomes.get(nota.vinculoPrestacao.colaboradorId);
      const prestador = vinculado || nota.prestador || nota.fornecedor;
      const texto = normalizar([
        nota.nome, nota.numeroNota, nota.descricao, prestador, nota.prestador, nota.fornecedor,
        nota.cnpjPrestador, documento.associacao, competencia, tipos[tipoNota],
      ].join(" "));
      if (!palavras.every(palavra => texto.includes(palavra))) return [];
      return [{ id: `${documento.id}-${indice}`, nota, tipoNota, competencia, prestador, associacao: documento.associacao }];
    });
  }).sort((a, b) => b.competencia.localeCompare(a.competencia) || a.associacao.localeCompare(b.associacao, "pt-BR"));

  const limpar = new URLSearchParams({ aba: "pdfs" });
  for (const competencia of competencias) limpar.append("competencias", competencia);

  return <ModuloRecolhivel id="pdfs-notas" memoria="pdfs-notas" titulo="PESQUISA DE NOTAS FISCAIS"
    className="scroll-mt-5 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
    <form action="/admin#pdfs-notas" method="get" className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3">
      <input type="hidden" name="aba" value="pdfs"/>
      {competencias.map(competencia => <input key={competencia} type="hidden" name="competencias" value={competencia}/>)}
      <label className="grid min-w-56 flex-1 gap-1 text-xs font-bold">
        PESQUISAR NOTA
        <input name="pesquisaNota" defaultValue={termo} placeholder="Número, prestador, associação ou arquivo"
          className="h-11 rounded-lg border bg-white px-3 text-sm font-normal"/>
      </label>
      <label className="grid gap-1 text-xs font-bold">
        TIPO DE NOTA
        <select name="tipoNota" defaultValue={categoria} className="h-11 rounded-lg border bg-white px-3 text-sm">
          <option value="">TODOS OS TIPOS</option>
          {Object.entries(tipos).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select>
      </label>
      <button className="h-11 rounded-lg bg-emerald-800 px-5 text-sm font-black text-white">PESQUISAR</button>
      {pesquisou && <a href={`/admin?${limpar}#pdfs-notas`} className="inline-flex h-11 items-center rounded-lg border px-4 text-sm font-bold">LIMPAR</a>}
    </form>
    {pesquisou && <>
      <p className="mt-3 text-sm font-bold text-emerald-800">
        {resultados.length === 0 ? "NENHUMA NOTA ENCONTRADA NAS COMPETÊNCIAS SELECIONADAS." :
          `${resultados.length} ${resultados.length === 1 ? "NOTA ENCONTRADA" : "NOTAS ENCONTRADAS"}`}
      </p>
      {resultados.length > 0 && <ul className="mt-3 max-h-[32rem] space-y-2 overflow-auto">
        {resultados.map(({ id, nota, tipoNota, competencia, prestador, associacao }) => <li key={id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <div className="min-w-0 break-words">
            <strong>{nota.numeroNota ? `NOTA Nº ${nota.numeroNota}` : nota.nome || "NOTA FISCAL"}</strong>
            <p className="text-sm">{prestador || "PRESTADOR OU FORNECEDOR NÃO INFORMADO"}</p>
            <p className="text-xs font-bold text-slate-600">{associacao} · {competencia} · {tipos[tipoNota]}</p>
          </div>
          {nota.key ? <a target="_blank" rel="noreferrer"
            href={`/api/admin/documentos-associacao/arquivo?key=${encodeURIComponent(nota.key)}`}
            className="rounded-lg border px-3 py-2 text-xs font-bold text-emerald-800">ABRIR NOTA</a> :
            <span className="text-xs text-slate-600">ARQUIVO INDISPONÍVEL</span>}
        </li>)}
      </ul>}
    </>}
  </ModuloRecolhivel>;
}
