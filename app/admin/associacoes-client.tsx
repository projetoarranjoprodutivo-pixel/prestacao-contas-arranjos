"use client";

import { useState } from "react";
import { Download, FileText, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { MUNICIPIOS_ES } from "@/lib/municipios-es";

type Documento = { key: string; nome: string; tipo: string; tamanho?: number };
type Associacao = {
  id: number; nome: string; razaoSocial: string | null; cnpj: string | null; cep: string | null;
  endereco: string | null; bairro: string | null; numero: string | null; municipio: string | null;
  uf: string | null; email: string | null; telefone: string | null; celular: string | null;
  presidenteNome: string | null; presidenteCpf: string | null; presidenteCep: string | null;
  presidenteEndereco: string | null; presidenteBairro: string | null; presidenteNumero: string | null;
  presidenteMunicipio: string | null; presidenteUf: string | null; presidenteEmail: string | null;
  documentosJson: string; municipiosJson: string;
};
type Formulario = {
  id?: number; nome: string; razaoSocial: string; cnpj: string; cep: string; endereco: string;
  bairro: string; numero: string; municipio: string; uf: string; email: string; telefone: string;
  celular: string; presidenteNome: string; presidenteCpf: string; presidenteCep: string;
  presidenteEndereco: string; presidenteBairro: string; presidenteNumero: string;
  presidenteMunicipio: string; presidenteUf: string; presidenteEmail: string;
  documentos: Documento[]; municipios: string[];
};

const vazio: Formulario = {
  nome: "", razaoSocial: "", cnpj: "", cep: "", endereco: "", bairro: "", numero: "",
  municipio: "", uf: "ES", email: "", telefone: "", celular: "", presidenteNome: "",
  presidenteCpf: "", presidenteCep: "", presidenteEndereco: "", presidenteBairro: "",
  presidenteNumero: "", presidenteMunicipio: "", presidenteUf: "ES", presidenteEmail: "",
  documentos: [], municipios: [],
};
const lerLista = <T,>(json: string, fallback: T[] = []) => { try { const valor = JSON.parse(json); return Array.isArray(valor) ? valor as T[] : fallback; } catch { return fallback; } };

export default function AssociacoesClient({ itens }: { itens: Associacao[] }) {
  const [form, setForm] = useState<Formulario>(vazio);
  const [municipioAtendido, setMunicipioAtendido] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState<"associacao" | "presidente" | null>(null);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const campo = "mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm";

  function editar(a: Associacao) {
    setForm({
      id: a.id, nome: a.nome, razaoSocial: a.razaoSocial || "", cnpj: a.cnpj || "", cep: a.cep || "",
      endereco: a.endereco || "", bairro: a.bairro || "", numero: a.numero || "", municipio: a.municipio || "",
      uf: a.uf || "ES", email: a.email || "", telefone: a.telefone || "", celular: a.celular || "",
      presidenteNome: a.presidenteNome || "", presidenteCpf: a.presidenteCpf || "", presidenteCep: a.presidenteCep || "",
      presidenteEndereco: a.presidenteEndereco || "", presidenteBairro: a.presidenteBairro || "",
      presidenteNumero: a.presidenteNumero || "", presidenteMunicipio: a.presidenteMunicipio || "",
      presidenteUf: a.presidenteUf || "ES", presidenteEmail: a.presidenteEmail || "",
      documentos: lerLista<Documento>(a.documentosJson), municipios: lerLista<string>(a.municipiosJson),
    });
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function buscarCep(tipo: "associacao" | "presidente", valorInformado?: string) {
    const cep = (valorInformado ?? (tipo === "associacao" ? form.cep : form.presidenteCep)).replace(/\D/g, "");
    if (cep.length !== 8) { setMsg("Informe um CEP com 8 dígitos para fazer a busca."); return; }
    setBuscandoCep(tipo); setMsg("");
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const dados = await resposta.json();
      if (!resposta.ok || dados.erro) throw new Error("CEP não encontrado.");
      const municipio = MUNICIPIOS_ES.includes(dados.localidade) ? dados.localidade : "";
      setForm(atual => {
        if (tipo === "associacao") return { ...atual, endereco: dados.logradouro || atual.endereco, bairro: dados.bairro || atual.bairro, municipio, uf: dados.uf || atual.uf };
        return { ...atual, presidenteEndereco: dados.logradouro || atual.presidenteEndereco, presidenteBairro: dados.bairro || atual.presidenteBairro, presidenteMunicipio: municipio, presidenteUf: dados.uf || atual.presidenteUf };
      });
      if (!municipio) setMsg("O CEP foi localizado, mas o município não pertence à lista do Espírito Santo.");
    } catch (error) { setMsg(error instanceof Error ? error.message : "Não foi possível consultar o CEP."); }
    finally { setBuscandoCep(null); }
  }

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setMsg("");
    const fd = new FormData(e.currentTarget);
    if (form.id) fd.set("id", String(form.id));
    fd.set("municipios", JSON.stringify(form.municipios));
    try {
      const resposta = await fetch("/api/admin/associacoes", { method: form.id ? "PUT" : "POST", body: fd });
      const resultado = await resposta.json(); setMsg(resultado.message);
      if (resposta.ok) location.reload();
    } catch { setMsg("Não foi possível salvar. Verifique a conexão e tente novamente."); }
    finally { setLoading(false); }
  }

  async function remover(id: number) {
    if (!confirm("Desativar esta associação?")) return;
    const resposta = await fetch(`/api/admin/associacoes?id=${id}`, { method: "DELETE" });
    if (resposta.ok) location.reload();
  }

  function incluirMunicipio() {
    if (municipioAtendido && !form.municipios.includes(municipioAtendido)) {
      setForm(atual => ({ ...atual, municipios: [...atual.municipios, municipioAtendido].sort() }));
      setMunicipioAtendido("");
    }
  }

  function alternarSelecao(id: number) {
    setSelecionadas(atuais => atuais.includes(id) ? atuais.filter(item => item !== id) : [...atuais, id]);
  }

  function emitirPdf(todas = false) {
    if (!todas && !selecionadas.length) { setMsg("Selecione ao menos uma associação para gerar o PDF."); return; }
    const parametros = todas ? "todas=1" : `ids=${selecionadas.join(",")}`;
    window.open(`/api/admin/associacoes/pdf?${parametros}`, "_blank", "noopener,noreferrer");
  }

  return <section className="rounded-2xl border bg-white p-5 shadow-sm lg:col-span-2">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold">Cadastro de associações</h2><p className="text-sm text-slate-600">Dados da entidade, do presidente e documentos.</p></div>
      {form.id && <button type="button" onClick={() => { setForm(vazio); setMsg(""); }} className="text-sm font-bold text-slate-600">Cancelar edição</button>}
    </div>

    <form onSubmit={salvar} className="mt-5 space-y-6">
      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-3 flex items-center gap-2 text-base font-bold text-emerald-900"><MapPin className="h-4 w-4"/>Dados da associação</legend>
        <label className="text-sm font-semibold">Nome abreviado *<input name="nome" required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={campo}/></label>
        <label className="text-sm font-semibold sm:col-span-2">Razão social *<input name="razaoSocial" required value={form.razaoSocial} onChange={e => setForm(f => ({ ...f, razaoSocial: e.target.value }))} className={campo}/></label>
        <label className="text-sm font-semibold">CNPJ *<input name="cnpj" required value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} className={campo} placeholder="00.000.000/0000-00"/></label>
        <label className="text-sm font-semibold">CEP *<span className="mt-1 flex gap-2"><input name="cep" required value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void buscarCep("associacao", e.currentTarget.value); } }} className={`${campo} mt-0`}/><button type="button" onClick={() => buscarCep("associacao")} disabled={buscandoCep === "associacao"} className="rounded-lg border px-3" aria-label="Buscar CEP da associação"><Search className="h-4 w-4"/></button></span></label>
        <label className="text-sm font-semibold sm:col-span-2">Endereço *<input name="endereco" required value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} className={campo}/></label>
        <label className="text-sm font-semibold">Bairro<input name="bairro" value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} className={campo}/></label>
        <label className="text-sm font-semibold">Número<input name="numero" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} className={campo}/></label>
        <label className="text-sm font-semibold">Município da sede<select name="municipio" value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} className={campo}><option value="">Selecione</option>{MUNICIPIOS_ES.map(m => <option key={m}>{m}</option>)}</select></label>
        <label className="text-sm font-semibold">UF<select name="uf" value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value }))} className={campo}><option value="">Selecione</option><option value="ES">ES</option></select></label>
        <label className="text-sm font-semibold">E-mail<input name="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={campo}/></label>
        <label className="text-sm font-semibold">Telefone<input name="telefone" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} className={campo}/></label>
        <label className="text-sm font-semibold">Celular *<input name="celular" required value={form.celular} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} className={campo}/></label>
      </fieldset>

      <fieldset className="grid gap-3 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-3 text-base font-bold text-emerald-900">Dados do presidente <span className="font-normal text-slate-500">(opcional)</span></legend>
        <label className="text-sm font-semibold sm:col-span-2">Nome do presidente<input name="presidenteNome" value={form.presidenteNome} onChange={e => setForm(f => ({ ...f, presidenteNome: e.target.value }))} className={campo}/></label>
        <label className="text-sm font-semibold">CPF<input name="presidenteCpf" value={form.presidenteCpf} onChange={e => setForm(f => ({ ...f, presidenteCpf: e.target.value }))} className={campo} placeholder="000.000.000-00"/></label>
        <label className="text-sm font-semibold">E-mail<input name="presidenteEmail" type="email" value={form.presidenteEmail} onChange={e => setForm(f => ({ ...f, presidenteEmail: e.target.value }))} className={campo}/></label>
        <label className="text-sm font-semibold">CEP<span className="mt-1 flex gap-2"><input name="presidenteCep" value={form.presidenteCep} onChange={e => setForm(f => ({ ...f, presidenteCep: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void buscarCep("presidente", e.currentTarget.value); } }} className={`${campo} mt-0`}/><button type="button" onClick={() => buscarCep("presidente")} disabled={buscandoCep === "presidente"} className="rounded-lg border px-3" aria-label="Buscar CEP do presidente"><Search className="h-4 w-4"/></button></span></label>
        <label className="text-sm font-semibold sm:col-span-2">Endereço<input name="presidenteEndereco" value={form.presidenteEndereco} onChange={e => setForm(f => ({ ...f, presidenteEndereco: e.target.value }))} className={campo}/></label>
        <label className="text-sm font-semibold">Bairro<input name="presidenteBairro" value={form.presidenteBairro} onChange={e => setForm(f => ({ ...f, presidenteBairro: e.target.value }))} className={campo}/></label>
        <label className="text-sm font-semibold">Número<input name="presidenteNumero" value={form.presidenteNumero} onChange={e => setForm(f => ({ ...f, presidenteNumero: e.target.value }))} className={campo}/></label>
        <label className="text-sm font-semibold">Município<select name="presidenteMunicipio" value={form.presidenteMunicipio} onChange={e => setForm(f => ({ ...f, presidenteMunicipio: e.target.value }))} className={campo}><option value="">Selecione</option>{MUNICIPIOS_ES.map(m => <option key={m}>{m}</option>)}</select></label>
        <label className="text-sm font-semibold">UF<select name="presidenteUf" value={form.presidenteUf} onChange={e => setForm(f => ({ ...f, presidenteUf: e.target.value }))} className={campo}><option value="">Selecione</option><option value="ES">ES</option></select></label>
      </fieldset>

      <fieldset className="border-t pt-5">
        <legend className="mb-3 text-base font-bold text-emerald-900">Municípios atendidos *</legend>
        <div className="flex flex-col gap-2 sm:flex-row"><select value={municipioAtendido} onChange={e => setMunicipioAtendido(e.target.value)} className={`${campo} mt-0 flex-1`}><option value="">Selecione entre os 78 municípios</option>{MUNICIPIOS_ES.filter(m => !form.municipios.includes(m)).map(m => <option key={m}>{m}</option>)}</select><button type="button" onClick={incluirMunicipio} className="h-11 rounded-lg border border-emerald-700 px-4 font-bold text-emerald-800">Incluir</button></div>
        <div className="mt-2 flex flex-wrap gap-2">{form.municipios.map(m => <span key={m} className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-900">{m}<button type="button" onClick={() => setForm(f => ({ ...f, municipios: f.municipios.filter(x => x !== m) }))} aria-label={`Remover ${m}`}><X className="h-3.5 w-3.5"/></button></span>)}</div>
      </fieldset>

      <fieldset className="border-t pt-5">
        <legend className="mb-3 text-base font-bold text-emerald-900">Documentos <span className="font-normal text-slate-500">(opcional)</span></legend>
        <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold">Incluir documentos
          <input name="documentos" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="mt-2 block w-full text-sm font-normal"/>
          <span className="mt-1 block text-xs font-normal text-slate-500">PDF, JPG ou PNG, até 10 MB por arquivo. Você pode selecionar vários arquivos.</span>
        </label>
        {form.documentos.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{form.documentos.map(documento => <span key={documento.key} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm"><FileText className="h-4 w-4"/>{documento.nome}</span>)}</div>}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3"><button disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-700 px-5 font-bold text-white disabled:opacity-60"><Plus className="h-4 w-4"/>{loading ? "Salvando..." : form.id ? "Salvar alterações" : "Cadastrar associação"}</button>{msg && <p className="text-sm text-slate-700">{msg}</p>}</div>
    </form>

    <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-emerald-50 p-4">
      <div><p className="font-bold text-emerald-950">Relatório cadastral em PDF</p><p className="text-sm text-emerald-900">Marque as associações desejadas ou emita todas de uma vez.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSelecionadas(selecionadas.length === itens.length ? [] : itens.map(item => item.id))} className="h-10 rounded-lg border border-emerald-800 px-4 text-sm font-bold text-emerald-900">{selecionadas.length === itens.length && itens.length ? "Desmarcar todas" : "Selecionar todas"}</button><button type="button" onClick={() => emitirPdf(false)} disabled={!selecionadas.length} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-bold text-white disabled:opacity-50"><Download className="h-4 w-4"/>PDF selecionadas ({selecionadas.length})</button><button type="button" onClick={() => emitirPdf(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-bold text-white"><Download className="h-4 w-4"/>PDF de todas</button></div>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">{itens.map(a => <article key={a.id} className={`rounded-xl border p-4 ${selecionadas.includes(a.id) ? "border-emerald-600 bg-emerald-50" : "bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><input type="checkbox" checked={selecionadas.includes(a.id)} onChange={() => alternarSelecao(a.id)} aria-label={`Selecionar ${a.nome}`} className="mt-1 h-5 w-5 accent-emerald-700"/><div><p className="font-bold">{a.nome}</p><p className="text-sm text-slate-600">{a.razaoSocial || "Cadastro a completar"}</p><p className="mt-1 text-xs text-slate-500">CNPJ: {a.cnpj || "não informado"} · {lerLista<string>(a.municipiosJson).length} município(s) · {lerLista<Documento>(a.documentosJson).length} documento(s)</p>{a.presidenteNome && <p className="mt-1 text-xs text-slate-500">Presidente: {a.presidenteNome}</p>}</div></div><div className="flex gap-2"><button type="button" onClick={() => editar(a)} aria-label={`Editar ${a.nome}`} className="text-blue-800"><Pencil className="h-4 w-4"/></button><button type="button" onClick={() => remover(a.id)} aria-label={`Desativar ${a.nome}`} className="text-red-700"><Trash2 className="h-4 w-4"/></button></div></div></article>)}</div>
  </section>;
}
