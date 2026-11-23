"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Agricultor, GrupoAgricultores } from "@/db/agricultores";
import { chaveMunicipio } from "@/lib/associacoes-municipios";

const campo = "min-w-0 rounded-lg border bg-white px-3 py-2";
const botao = "rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-60";

function municipiosDoFiltro(grupos: GrupoAgricultores[], associacao: string) {
  if (associacao) return grupos.find(g => g.associacao === associacao)?.municipios ?? [];
  const municipios = new Map<string, string>();
  for (const grupo of grupos) {
    for (const municipio of grupo.municipios) municipios.set(chaveMunicipio(municipio), municipio);
  }
  return [...municipios.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function FiltrosAgricultores({ grupos, associacao, municipio }: {
  grupos: GrupoAgricultores[]; associacao: string; municipio: string;
}) {
  const [grupo, setGrupo] = useState(associacao);
  const [local, setLocal] = useState(municipio);
  return <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4" action="/admin/agricultores">
    <label className="grid gap-1 text-sm font-bold">Associação
      <select name="associacao" className={campo} value={grupo} onChange={e => { setGrupo(e.target.value); setLocal(""); }}>
        <option value="">Todas as associações</option>
        {grupos.map(g => <option key={g.associacao}>{g.associacao}</option>)}
      </select>
    </label>
    <label className="grid gap-1 text-sm font-bold">Município
      <select name="municipio" className={campo} value={local} onChange={e => setLocal(e.target.value)}>
        <option value="">Todos os municípios</option>
        {municipiosDoFiltro(grupos, grupo).map(m => <option value={chaveMunicipio(m)} key={chaveMunicipio(m)}>{m}</option>)}
      </select>
    </label>
    <button className={botao}>Consultar</button>
    {(associacao || municipio) && <a className="px-2 py-2 text-sm font-bold text-emerald-800 underline" href="/admin/agricultores">Limpar filtros</a>}
  </form>;
}

export function CadastroAgricultores({ grupos, registros, associacaoInicial, municipioInicial }: {
  grupos: GrupoAgricultores[]; registros: Agricultor[]; associacaoInicial: string; municipioInicial: string;
}) {
  const router = useRouter();
  const [formulario, setFormulario] = useState<(Agricultor & { editar: boolean }) | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  function abrir(agricultor: Agricultor, editar = true) {
    setErro("");
    setMensagem("");
    const municipios = municipiosDoFiltro(grupos, agricultor.associacao);
    setFormulario({ ...agricultor, editar, municipio: municipios.find(m => chaveMunicipio(m) === chaveMunicipio(agricultor.municipio)) ?? "" });
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!formulario || salvando) return;
    setSalvando(true);
    setErro("");
    try {
      const resposta = await fetch("/api/admin/agricultores", {
        method: formulario.editar ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formulario),
      });
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null);
        const detalhe = dados && typeof dados === "object" && "message" in dados ? dados.message : null;
        setErro(typeof detalhe === "string" ? detalhe : "Não foi possível salvar o cadastro.");
        return;
      }
      setMensagem(formulario.editar ? "Cadastro atualizado." : "Agricultor cadastrado.");
      setFormulario(null);
      router.refresh();
    } catch {
      setErro("Não foi possível salvar o cadastro. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return <section className="space-y-4 rounded-xl border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-bold">Agricultores cadastrados</h2>
      <button type="button" disabled={salvando} className={botao} onClick={() => abrir({
        id: crypto.randomUUID(), revisao: 0, nome: "", associacao: associacaoInicial, municipio: municipioInicial,
      }, false)}>Incluir agricultor</button>
    </div>
    {mensagem && <p role="status" className="text-sm font-bold text-emerald-800">{mensagem}</p>}
    {formulario && <form id="editar-agricultor" onSubmit={salvar} className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="font-bold">{formulario.editar ? "Editar agricultor" : "Novo agricultor"}</h3>
      <fieldset disabled={salvando} className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-bold">Nome do agricultor
          <input autoFocus className={campo} required maxLength={200} value={formulario.nome} onChange={e => setFormulario({ ...formulario, nome: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm font-bold">Associação
          <select className={campo} required value={formulario.associacao} onChange={e => setFormulario({ ...formulario, associacao: e.target.value, municipio: "" })}>
            <option value="">Selecione</option>
            {grupos.map(g => <option key={g.associacao}>{g.associacao}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-bold">Município
          <select className={campo} required disabled={!formulario.associacao} value={formulario.municipio} onChange={e => setFormulario({ ...formulario, municipio: e.target.value })}>
            <option value="">Selecione</option>
            {municipiosDoFiltro(grupos, formulario.associacao).map(m => <option key={m}>{m}</option>)}
          </select>
        </label>
      </fieldset>
      {erro && <p role="alert" className="text-sm font-bold text-red-800">{erro}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={salvando || !formulario.municipio} className={botao}>{salvando ? "Salvando…" : "Salvar cadastro"}</button>
        <button type="button" disabled={salvando} className="px-3 py-2 text-sm font-bold" onClick={() => setFormulario(null)}>Cancelar</button>
      </div>
    </form>}
    {registros.length === 0 ? <p className="text-sm text-slate-600">Nenhum agricultor encontrado para os filtros selecionados.</p>
      : <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100">
            <tr><th className="p-3" scope="col">Nome</th><th className="p-3" scope="col">Associação</th><th className="p-3" scope="col">Município</th><th className="p-3" scope="col">Ações</th></tr>
          </thead>
          <tbody>
            {registros.map(agricultor => <tr key={agricultor.id} className="border-b">
              <td className="p-3 font-bold">{agricultor.nome}</td>
              <td className="p-3">{agricultor.associacao}</td>
              <td className="p-3">{agricultor.municipio}</td>
              <td className="p-3"><button type="button" disabled={salvando} className="font-bold text-emerald-800 underline" aria-label={`Editar ${agricultor.nome}`} onClick={() => abrir(agricultor)}>Editar</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>}
  </section>;
}
