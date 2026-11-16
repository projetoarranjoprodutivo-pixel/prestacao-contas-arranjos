"use client";

import { useMemo, useState } from "react";
import { conciliarSaidas, lerSaidas, type NotaConciliacao, type Saida } from "@/lib/conferencia-extratos";

type Documento = {key: string; nome: string};
type Nota = NotaConciliacao & {numero: string};
type Vinculo = {extrato: string; lancamento: string; nota: string; centavos: number};
const endpoint = "/api/admin/conferencia-extratos/vinculos";

function identificarLancamentos(saidas: Saida[]) {
  const ocorrencias = new Map<string, number>();
  return saidas.map(saida => {
    const base = JSON.stringify([saida.data, saida.descricao, saida.centavos]);
    const numero = (ocorrencias.get(base) ?? 0) + 1;
    ocorrencias.set(base, numero);
    return `${base}:${numero}`;
  });
}

const moeda = new Intl.NumberFormat("pt-BR", {style: "currency", currency: "BRL"});
const reais = (centavos: number) => moeda.format(centavos / 100);
const href = (key: string) => "/api/admin/documentos-associacao/arquivo?key=" + encodeURIComponent(key);

export default function Conferencia({associacao, inicio, fim, extratos, notas}: {associacao: string; inicio: string; fim: string; extratos: Documento[]; notas: Nota[]}) {
  const [extrato, escolher] = useState(extratos[0]?.key || "");
  const [saidas, setSaidas] = useState<Saida[] | null>(null);
  const [mensagem, avisar] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [lido, setLido] = useState(false);

  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [editar, setEditar] = useState<number | null>(null);
  const [notaEscolhida, setNotaEscolhida] = useState("");
  const [gravando, setGravando] = useState(false);
  const [mensagemVinculo, setMensagemVinculo] = useState("");

  async function carregarVinculos(signal?: AbortSignal): Promise<Vinculo[]> {
    const resposta = await fetch(endpoint + "?associacao=" + encodeURIComponent(associacao), {signal});
    if (!resposta.ok) throw new Error("Não foi possível carregar os vínculos manuais.");
    return resposta.json();
  }

  async function gravarVinculo(nota: string | null) {
    if (editar === null) return;
    const lancamento = ids[editar];
    const centavos = debitos[editar].centavos;
    setGravando(true);
    setMensagemVinculo("");
    try {
      const resposta = await fetch(endpoint, {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({associacao, extrato, lancamento, nota, centavos}),
      });
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null);
        throw new Error(dados?.message || "Não foi possível salvar o vínculo.");
      }
      setVinculos(await carregarVinculos());
      setEditar(null);
      setMensagemVinculo(nota ? "Vínculo salvo." : "Vínculo removido.");
    } catch (erro) {
      setMensagemVinculo(erro instanceof Error ? erro.message : "Falha ao salvar o vínculo.");
    } finally {
      setGravando(false);
    }
  }

  async function ler() {
    setOcupado(true);
    setEditar(null);
    setMensagemVinculo("");
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
      setVinculos(await carregarVinculos(controller.signal));
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
  const ids = useMemo(() => identificarLancamentos(saidas ?? []), [saidas]);
  const vinculosDoExtrato = useMemo(() => new Map(vinculos.filter(v => v.extrato === extrato).map(v => [v.lancamento, v])), [vinculos, extrato]);
  const valoresVinculados = useMemo(() => {
    const valores = new Map<string, number>();
    for (const vinculo of vinculos) valores.set(vinculo.nota, (valores.get(vinculo.nota) ?? 0) + vinculo.centavos);
    return valores;
  }, [vinculos]);
  const conciliacao = useMemo(() => conciliarSaidas(
    (saidas ?? []).map((saida, i) => vinculosDoExtrato.has(ids[i]) ? {...saida, centavos: 0} : saida),
    notas.filter(nota => !valoresVinculados.has(nota.key)),
  ), [saidas, notas, ids, vinculosDoExtrato, valoresVinculados]);
  const notaPorChave = useMemo(() => new Map(notas.map(nota => [nota.key, nota])), [notas]);
  const emEdicao = editar === null ? undefined : vinculosDoExtrato.get(ids[editar]);
  const valorEdicao = editar === null ? 0 : debitos[editar].centavos;
  const saldoDisponivel = (nota: Nota) => (nota.centavos ?? 0) - (valoresVinculados.get(nota.key) ?? 0)
    + (emEdicao?.nota === nota.key ? emEdicao.centavos : 0);
  const totalDebitos = debitos.reduce((total, saida) => total + saida.centavos, 0);
  const totalNotas = notas.reduce((total, nota) => total + (nota.centavos ?? 0), 0);
  const cabecalho = "bg-slate-100 text-left";
  return <section className="space-y-5 rounded-xl border bg-white p-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm font-bold">EXTRATO BANCÁRIO<select value={extrato} disabled={ocupado || gravando} onChange={evento => {escolher(evento.target.value); setEditar(null); setMensagemVinculo(""); setSaidas(null); setLido(false); avisar("");}} className="max-w-full rounded-lg border bg-white p-2">
        {!extratos.length && <option value="">Nenhum extrato cadastrado</option>}
        {extratos.map(item => <option key={item.key} value={item.key}>{item.nome}</option>)}
      </select></label>
      <button type="button" disabled={!extrato || ocupado || gravando} onClick={() => void ler()} className="rounded-lg bg-emerald-800 px-4 py-2 font-bold text-white disabled:opacity-50">{ocupado ? "LENDO EXTRATO…" : "CONFERIR EXTRATO"}</button>
      {extrato && <a href={href(extrato)} target="_blank" rel="noreferrer" className="py-2 text-sm font-bold text-emerald-900 underline">ABRIR EXTRATO</a>}
    </div>
    {mensagem && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">{mensagem}</p>}
    <dl className="grid gap-3 sm:grid-cols-3">
      {[["Saídas identificadas", debitos.length ? reais(totalDebitos) : "—"], ["Valor das notas cadastradas", reais(totalNotas)], ["Diferença (saídas − notas)", debitos.length ? reais(totalDebitos - totalNotas) : "—"]].map(([titulo, valor]) => <div key={titulo} className="rounded-lg bg-emerald-50 p-3"><dt className="text-sm">{titulo}</dt><dd className="text-xl font-black">{valor}</dd></div>)}
    </dl>
    <p className="text-sm text-slate-700">A conferência cruza favorecido, valor e competência. Pagamentos em outro mês e casos com mais de uma correspondência ficam para revisão.</p>
    {mensagemVinculo && <p role="status" className="text-sm font-semibold">{mensagemVinculo}</p>}
    <div id="vincular-lancamento" />
    {editar !== null && <form onSubmit={evento => {evento.preventDefault(); void gravarVinculo(notaEscolhida);}} className="flex flex-wrap items-end gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <label className="grid gap-1 text-sm font-semibold">Nota para o lançamento de {reais(valorEdicao)} em {debitos[editar].data.split("-").reverse().join("/")}
        <select required disabled={gravando} value={notaEscolhida} onChange={evento => setNotaEscolhida(evento.target.value)} className="max-w-full rounded border bg-white p-2">
          <option value="">Selecione a nota</option>
          {notas.filter(nota => nota.centavos !== null).map(nota => <option key={nota.key} value={nota.key} disabled={saldoDisponivel(nota) < valorEdicao}>
            {nota.numero || nota.nome} · {nota.prestador || nota.nome} · {nota.competencia} · saldo {reais(saldoDisponivel(nota))}
          </option>)}
        </select>
      </label>
      <button disabled={!notaEscolhida || gravando} className="rounded bg-emerald-800 px-3 py-2 font-semibold text-white disabled:opacity-50">Salvar vínculo</button>
      {emEdicao && <button type="button" disabled={gravando} onClick={() => void gravarVinculo(null)} className="rounded border px-3 py-2">Desvincular</button>}
      <button type="button" disabled={gravando} onClick={() => setEditar(null)} className="rounded border px-3 py-2">Cancelar</button>
    </form>}
    {lido && debitos.length > 0 && <div className="overflow-x-auto"><h2 className="mb-2 font-bold">SAÍDAS DO EXTRATO</h2><table className="w-full text-sm"><thead className={cabecalho}><tr><th className="p-2">Data</th><th className="p-2">Lançamento</th><th className="p-2">Valor</th><th className="p-2">Nota correspondente</th></tr></thead><tbody>
      {debitos.map((saida, indice) => {
        const manual = vinculosDoExtrato.get(ids[indice]);
        const notaManual = manual ? notaPorChave.get(manual.nota) : undefined;
        const {situacao, candidatas, mesmoMes} = conciliacao.lancamentos[indice];
        const rotulo = manual ? "Vínculo manual" : situacao === "vinculada" ? "Favorecido, valor e competência conferem"
          : situacao === "revisar" ? mesmoMes ? "Mais de uma correspondência possível" : "Competência diferente. Conferir"
          : situacao === "sem-identificacao" ? "Mesmo valor, favorecido sem correspondência"
          : "Nenhuma nota com esse valor";
        return <tr key={indice} className="border-b"><td className="whitespace-nowrap p-2">{saida.data.split("-").reverse().join("/")}</td><td className="p-2">{saida.descricao || "—"}</td><td className="whitespace-nowrap p-2">{reais(saida.centavos)}</td><td className="p-2"><span className="block font-semibold">{rotulo}</span>{manual && !notaManual && <span className="block">Nota fora do período selecionado</span>}{(manual ? notaManual ? [notaManual] : [] : candidatas).map(nota => <a key={nota.key} href={href(nota.key)} target="_blank" rel="noreferrer" className="block text-emerald-900 underline">{nota.numero || nota.nome} {nota.prestador} · {nota.competencia}</a>)}<button type="button" disabled={gravando} onClick={() => {setEditar(indice); setNotaEscolhida(manual?.nota || ""); setMensagemVinculo(""); document.getElementById("vincular-lancamento")?.scrollIntoView({block:"nearest"});}} className="mt-1 text-sm font-semibold text-emerald-800 underline">{manual ? "Editar vínculo" : "Vincular nota"}</button></td></tr>;
      })}
    </tbody></table></div>}
    <div className="overflow-x-auto"><h2 className="mb-2 font-bold">NOTAS FISCAIS DO PERÍODO</h2>{notas.length ? <table className="w-full text-sm"><thead className={cabecalho}><tr><th className="p-2">Nota</th><th className="p-2">Prestador</th><th className="p-2">Valor registrado</th><th className="p-2">Conferência</th></tr></thead><tbody>{notas.map(nota => <tr className="border-b" key={nota.key}><td className="p-2"><a className="text-emerald-900 underline" href={href(nota.key)} target="_blank" rel="noreferrer">{nota.numero || nota.nome}</a></td><td className="p-2">{nota.prestador || "—"}</td><td className="p-2">{nota.centavos === null ? "Não informado" : reais(nota.centavos)}</td><td className="p-2">{!lido ? "Aguardando leitura" : valoresVinculados.has(nota.key) && nota.centavos !== null ? `Vinculado: ${reais(valoresVinculados.get(nota.key) ?? 0)} · Falta: ${reais(nota.centavos - (valoresVinculados.get(nota.key) ?? 0))}` : nota.centavos === null ? "Conferir valor da nota" : conciliacao.vinculadas.has(nota.key) ? "Vinculada ao extrato" : conciliacao.paraRevisar.has(nota.key) ? "Revisar correspondência" : "Sem lançamento identificado"}</td></tr>)}</tbody></table> : <p className="text-sm">Nenhuma nota cadastrada neste período.</p>}</div>
  </section>;
}
