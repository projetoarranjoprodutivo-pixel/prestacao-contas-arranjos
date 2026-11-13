"use client";

import { useState } from "react";
import { lerSaidas, type Saida } from "@/lib/conferencia-extratos";

type Documento = {key: string; nome: string};
type Nota = Documento & {numero: string; prestador: string; centavos: number | null};
const moeda = new Intl.NumberFormat("pt-BR", {style: "currency", currency: "BRL"});
const reais = (centavos: number) => moeda.format(centavos / 100);
const href = (key: string) => "/api/admin/documentos-associacao/arquivo?key=" + encodeURIComponent(key);

export default function Conferencia({inicio, fim, extratos, notas}: {inicio: string; fim: string; extratos: Documento[]; notas: Nota[]}) {
  const [extrato, escolher] = useState(extratos[0]?.key || "");
  const [saidas, setSaidas] = useState<Saida[] | null>(null);
  const [mensagem, avisar] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [lido, setLido] = useState(false);

  async function ler() {
    setOcupado(true);
    setSaidas(null);
    setLido(false);
    avisar("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    try {
      const resposta = await fetch(href(extrato), {signal: controller.signal});
      if (!resposta.ok) throw new Error("O extrato selecionado está indisponível.");
      const blob = await resposta.blob();
      if (blob.type !== "application/pdf") throw new Error("Selecione um extrato em PDF com texto pesquisável.");
      const {lerTextoRelatorioPdf} = await import("@/lib/leitura-pdf-browser");
      const texto = await lerTextoRelatorioPdf(new File([blob], "extrato.pdf"), controller.signal, () => {});
      const leitura = lerSaidas(texto, inicio, fim);
      setSaidas(leitura.saidas);
      setLido(true);
      if (!leitura.saidas.length) avisar("Nenhum débito foi identificado. Confira o PDF original para verificar se há lançamentos em formato diferente.");
      else if (leitura.linhasSemIndicador) avisar(`${leitura.linhasSemIndicador} linha(s) com valores não puderam ser classificadas. Confira o PDF antes de usar os totais.`);
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Não foi possível ler o extrato.");
    } finally {
      window.clearTimeout(timeout);
      setOcupado(false);
    }
  }

  const debitos = saidas || [];
  const totalDebitos = debitos.reduce((total, saida) => total + saida.centavos, 0);
  const totalNotas = notas.reduce((total, nota) => total + (nota.centavos ?? 0), 0);
  const cabecalho = "bg-slate-100 text-left";
  return <section className="space-y-5 rounded-xl border bg-white p-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm font-bold">EXTRATO BANCÁRIO<select value={extrato} disabled={ocupado} onChange={evento => {escolher(evento.target.value); setSaidas(null); setLido(false); avisar("");}} className="max-w-full rounded-lg border bg-white p-2">
        {!extratos.length && <option value="">Nenhum extrato cadastrado</option>}
        {extratos.map(item => <option key={item.key} value={item.key}>{item.nome}</option>)}
      </select></label>
      <button type="button" disabled={!extrato || ocupado} onClick={() => void ler()} className="rounded-lg bg-emerald-800 px-4 py-2 font-bold text-white disabled:opacity-50">{ocupado ? "LENDO EXTRATO…" : "CONFERIR EXTRATO"}</button>
      {extrato && <a href={href(extrato)} target="_blank" rel="noreferrer" className="py-2 text-sm font-bold text-emerald-900 underline">ABRIR EXTRATO</a>}
    </div>
    {mensagem && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">{mensagem}</p>}
    <dl className="grid gap-3 sm:grid-cols-3">
      {[["Saídas identificadas", debitos.length ? reais(totalDebitos) : "—"], ["Valor das notas cadastradas", reais(totalNotas)], ["Diferença (saídas − notas)", debitos.length ? reais(totalDebitos - totalNotas) : "—"]].map(([titulo, valor]) => <div key={titulo} className="rounded-lg bg-emerald-50 p-3"><dt className="text-sm">{titulo}</dt><dd className="text-xl font-black">{valor}</dd></div>)}
    </dl>
    <p className="text-sm text-slate-700">A comparação usa os valores do extrato selecionado e das notas do período. Valores iguais são sugestões para conferência. Tarifas, transferências e pagamentos agrupados podem exigir revisão.</p>
    {lido && debitos.length > 0 && <div className="overflow-x-auto"><h2 className="mb-2 font-bold">SAÍDAS DO EXTRATO</h2><table className="w-full text-sm"><thead className={cabecalho}><tr><th className="p-2">Data</th><th className="p-2">Lançamento</th><th className="p-2">Valor</th><th className="p-2">Notas com o mesmo valor</th></tr></thead><tbody>
      {debitos.map((saida, indice) => {
        const iguais = notas.filter(nota => nota.centavos === saida.centavos);
        const ambigua = iguais.length > 1 || debitos.filter(item => item.centavos === saida.centavos).length > 1;
        return <tr key={indice} className="border-b"><td className="whitespace-nowrap p-2">{saida.data.split("-").reverse().join("/")}</td><td className="p-2">{saida.descricao || "—"}</td><td className="whitespace-nowrap p-2">{reais(saida.centavos)}</td><td className="p-2">{iguais.length ? <>{ambigua && <span className="block font-bold">Mais de um lançamento ou nota com esse valor</span>}{iguais.map(nota => <a key={nota.key} href={href(nota.key)} target="_blank" rel="noreferrer" className="block text-emerald-900 underline">{nota.numero || nota.nome} {nota.prestador}</a>)}</> : "Nenhuma nota com esse valor"}</td></tr>;
      })}
    </tbody></table></div>}
    <div className="overflow-x-auto"><h2 className="mb-2 font-bold">NOTAS FISCAIS DO PERÍODO</h2>{notas.length ? <table className="w-full text-sm"><thead className={cabecalho}><tr><th className="p-2">Nota</th><th className="p-2">Prestador</th><th className="p-2">Valor registrado</th><th className="p-2">Conferência</th></tr></thead><tbody>{notas.map(nota => <tr className="border-b" key={nota.key}><td className="p-2"><a className="text-emerald-900 underline" href={href(nota.key)} target="_blank" rel="noreferrer">{nota.numero || nota.nome}</a></td><td className="p-2">{nota.prestador || "—"}</td><td className="p-2">{nota.centavos === null ? "Não informado" : reais(nota.centavos)}</td><td className="p-2">{!lido ? "Aguardando leitura" : nota.centavos === null ? "Conferir valor da nota" : debitos.some(saida => saida.centavos === nota.centavos) ? "Valor localizado" : "Valor não localizado"}</td></tr>)}</tbody></table> : <p className="text-sm">Nenhuma nota cadastrada neste período.</p>}</div>
  </section>;
}
