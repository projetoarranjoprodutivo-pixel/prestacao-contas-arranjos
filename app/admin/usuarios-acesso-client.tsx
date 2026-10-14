"use client";

import { useMemo, useState } from "react";

type Usuario = {
  id: string;
  email: string;
  nomeCompleto?: string;
  funcao: string;
  associacao: string | null;
  ativo: boolean;
};

function normalizar(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR");
}

export default function UsuariosAcesso({
  usuarios,
  associacoes,
  podeEditarSenhas,
}: {
  usuarios: Usuario[];
  associacoes: string[];
  podeEditarSenhas: boolean;
}) {
  const [mensagem, setMensagem] = useState("");
  const [pesquisa, setPesquisa] = useState("");
  const [usuarioSenha, setUsuarioSenha] = useState<Usuario | null>(null);
  const [usuarioEdicao, setUsuarioEdicao] = useState<Usuario | null>(null);
  const [enviando, setEnviando] = useState(false);
  const usuariosFiltrados = useMemo(() => {
    const termo = normalizar(pesquisa.trim());
    if (!termo) return usuarios;
    return usuarios.filter(usuario =>
      [usuario.nomeCompleto, usuario.email, usuario.funcao, usuario.associacao]
        .some(valor => normalizar(String(valor || "")).includes(termo))
    );
  }, [pesquisa, usuarios]);

  async function criarAcessosPendentes() {
    setEnviando(true);
    setMensagem("");
    const response = await fetch("/api/admin/usuarios/sincronizar", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setMensagem(body.message || "NÃO FOI POSSÍVEL CRIAR OS ACESSOS PENDENTES.");
    setEnviando(false);
    if (response.ok) location.reload();
  }

  async function alterarStatus(usuario: Usuario) {
    const form = new FormData();
    form.set("id", usuario.id);
    form.set("ativo", String(!usuario.ativo));
    const response = await fetch("/api/admin/usuarios/status", { method: "POST", body: form });
    const body = await response.json();
    setMensagem(body.message);
    if (response.ok) location.reload();
  }

  async function alterarSenha(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!usuarioSenha) return;
    setEnviando(true);
    setMensagem("");
    const form = new FormData(event.currentTarget);
    form.set("id", usuarioSenha.id);
    const response = await fetch("/api/admin/usuarios/senha", { method: "POST", body: form });
    const body = await response.json().catch(() => ({}));
    setMensagem(body.message || "NÃO FOI POSSÍVEL ALTERAR A SENHA.");
    setEnviando(false);
    if (response.ok) {
      event.currentTarget.reset();
      setUsuarioSenha(null);
    }
  }

  async function editarUsuario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!usuarioEdicao) return;
    setEnviando(true);
    setMensagem("");
    const form = new FormData(event.currentTarget);
    form.set("id", usuarioEdicao.id);
    const response = await fetch("/api/admin/usuarios/editar", { method: "POST", body: form });
    const body = await response.json().catch(() => ({}));
    setMensagem(body.message || "NÃO FOI POSSÍVEL EDITAR O USUÁRIO.");
    setEnviando(false);
    if (response.ok) {
      setUsuarioEdicao(null);
      location.reload();
    }
  }

  return <section id="lista-acessos" className="scroll-mt-5 mt-6 rounded-2xl border bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold">Acesso dos usuários</h2>
        <p className="text-sm text-slate-600">Pesquise, edite, libere, bloqueie ou altere a senha dos usuários.</p>
      </div>
      {podeEditarSenhas && <button type="button" onClick={criarAcessosPendentes} disabled={enviando} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        {enviando ? "CRIANDO ACESSOS..." : "CRIAR ACESSOS PENDENTES"}
      </button>}
    </div>

    <label className="mt-4 block max-w-xl text-sm font-bold">
      Pesquisar usuário
      <input
        value={pesquisa}
        onChange={event => setPesquisa(event.target.value)}
        placeholder="NOME, E-MAIL, PERFIL OU ASSOCIAÇÃO"
        className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3"
      />
    </label>

    {mensagem && <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm font-bold">{mensagem}</p>}
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b text-slate-500"><th className="py-2">Nome do colaborador</th><th>E-mail</th><th>Perfil</th><th>Associação</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>{usuariosFiltrados.map(usuario => {
          const principal = usuario.email.trim().toLowerCase() === "rafaeldalla@hotmail.com";
          return <tr key={usuario.id} className="border-b">
            <td className="py-3 font-semibold">{usuario.nomeCompleto || usuario.email}</td>
            <td>{usuario.email}</td>
            <td>{usuario.funcao}</td>
            <td>{usuario.associacao || "-"}</td>
            <td>{usuario.ativo ? "Liberado" : "Bloqueado"}</td>
            <td><div className="flex flex-wrap justify-end gap-2">
              {podeEditarSenhas && !principal && <button onClick={() => { setUsuarioEdicao(usuario); setUsuarioSenha(null); setMensagem(""); }} className="rounded-lg bg-amber-600 px-3 py-2 font-bold text-white">Editar</button>}
              <button onClick={() => alterarStatus(usuario)} disabled={usuario.funcao === "admin"} className={`rounded-lg px-3 py-2 font-bold text-white disabled:opacity-40 ${usuario.ativo ? "bg-red-700" : "bg-emerald-700"}`}>{usuario.ativo ? "Bloquear" : "Liberar"}</button>
              {podeEditarSenhas && !principal && <button onClick={() => { setUsuarioSenha(usuario); setUsuarioEdicao(null); setMensagem(""); }} className="rounded-lg bg-blue-800 px-3 py-2 font-bold text-white">Alterar senha</button>}
            </div></td>
          </tr>;
        })}
        {!usuariosFiltrados.length && <tr><td colSpan={6} className="py-8 text-center font-bold text-slate-500">NENHUM USUÁRIO ENCONTRADO.</td></tr>}
        </tbody>
      </table>
    </div>

    {podeEditarSenhas && usuarioEdicao && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-bold">Editar usuário</h3><p className="text-sm text-slate-600">Altere os dados do acesso selecionado.</p></div>
        <button type="button" onClick={() => setUsuarioEdicao(null)} className="rounded-lg border bg-white px-3 py-2 text-sm font-bold">Cancelar</button>
      </div>
      <form onSubmit={editarUsuario} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-bold">Nome<input name="nomeCompleto" defaultValue={usuarioEdicao.nomeCompleto || ""} required className="mt-1.5 h-11 w-full rounded-lg border bg-white px-3"/></label>
        <label className="text-sm font-bold">E-mail<input name="email" type="email" defaultValue={usuarioEdicao.email} required className="mt-1.5 h-11 w-full rounded-lg border bg-white px-3"/></label>
        <label className="text-sm font-bold">Perfil<select name="funcao" defaultValue={usuarioEdicao.funcao} className="mt-1.5 h-11 w-full rounded-lg border bg-white px-3"><option value="colaborador">Colaborador</option><option value="associacao">Associação</option><option value="aderes">ADERES</option><option value="admin">Administrador</option></select></label>
        <label className="text-sm font-bold">Associação<select name="associacao" defaultValue={usuarioEdicao.associacao || ""} className="mt-1.5 h-11 w-full rounded-lg border bg-white px-3"><option value="">Sem associação</option>{associacoes.map(nome => <option key={nome} value={nome}>{nome}</option>)}</select></label>
        <button disabled={enviando} className="h-11 rounded-lg bg-amber-600 px-5 font-bold text-white disabled:opacity-50 md:col-span-2">{enviando ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}</button>
      </form>
    </div>}

    {podeEditarSenhas && usuarioSenha && <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-bold">Alterar senha do usuário</h3><p className="text-sm text-slate-600">{usuarioSenha.email}</p></div>
        <button type="button" onClick={() => setUsuarioSenha(null)} className="rounded-lg border bg-white px-3 py-2 text-sm font-bold">Cancelar</button>
      </div>
      <form onSubmit={alterarSenha} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-bold">Nova senha<input name="novaSenha" type="password" minLength={8} required autoComplete="new-password" className="mt-1.5 h-11 w-full rounded-lg border bg-white px-3"/></label>
        <label className="text-sm font-bold">Confirmar nova senha<input name="confirmarSenha" type="password" minLength={8} required autoComplete="new-password" className="mt-1.5 h-11 w-full rounded-lg border bg-white px-3"/></label>
        <button disabled={enviando} className="h-11 rounded-lg bg-blue-800 px-5 font-bold text-white disabled:opacity-50">{enviando ? "Salvando..." : "Salvar nova senha"}</button>
      </form>
      <p className="mt-2 text-xs text-slate-600">Após a alteração, as sessões abertas deste usuário serão encerradas.</p>
    </div>}
  </section>;
}
