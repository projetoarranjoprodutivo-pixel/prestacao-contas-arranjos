"use client";

import { useState } from "react";

type Usuario = {
  id: string;
  email: string;
  funcao: string;
  associacao: string | null;
  ativo: boolean;
};

export default function UsuariosAcesso({
  usuarios,
  podeEditarSenhas,
}: {
  usuarios: Usuario[];
  podeEditarSenhas: boolean;
}) {
  const [mensagem, setMensagem] = useState("");
  const [usuarioSenha, setUsuarioSenha] = useState<Usuario | null>(null);
  const [enviando, setEnviando] = useState(false);

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

  return <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
    <h2 className="text-lg font-bold">Acesso dos usuários</h2>
    <p className="text-sm text-slate-600">Libere, bloqueie ou altere a senha dos usuários.</p>
    {mensagem && <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm font-bold">{mensagem}</p>}
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b text-slate-500"><th className="py-2">E-mail</th><th>Perfil</th><th>Associação</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>{usuarios.map(usuario => {
          const principal = usuario.email.trim().toLowerCase() === "rafaeldalla@hotmail.com";
          return <tr key={usuario.id} className="border-b">
            <td className="py-3 font-semibold">{usuario.email}</td>
            <td>{usuario.funcao}</td>
            <td>{usuario.associacao || "-"}</td>
            <td>{usuario.ativo ? "Liberado" : "Bloqueado"}</td>
            <td><div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => alterarStatus(usuario)} disabled={usuario.funcao === "admin"} className={`rounded-lg px-3 py-2 font-bold text-white disabled:opacity-40 ${usuario.ativo ? "bg-red-700" : "bg-emerald-700"}`}>{usuario.ativo ? "Bloquear" : "Liberar"}</button>
              {podeEditarSenhas && !principal && <button onClick={() => { setUsuarioSenha(usuario); setMensagem(""); }} className="rounded-lg bg-blue-800 px-3 py-2 font-bold text-white">Alterar senha</button>}
            </div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>

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
