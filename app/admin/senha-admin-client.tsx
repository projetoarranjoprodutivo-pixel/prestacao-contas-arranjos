"use client";
import { useState } from "react";

export default function SenhaAdmin() {
  const [mensagemSenha, setMensagemSenha] = useState("");
  const [mensagemUsuario, setMensagemUsuario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const campo = "mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3";

  async function enviar(event: React.FormEvent<HTMLFormElement>, rota: string, setMensagem: (valor:string)=>void) {
    event.preventDefault(); setEnviando(true); setMensagem("");
    const response = await fetch(rota, { method: "POST", body: new FormData(event.currentTarget) });
    const body = await response.json().catch(() => ({}));
    setMensagem(body.message || "Não foi possível concluir."); setEnviando(false);
    if (response.ok) event.currentTarget.reset();
    if (response.ok && body.redirect) setTimeout(() => { location.href = body.redirect; }, 1200);
  }

  return <div className="mt-6 grid gap-6 xl:grid-cols-2">
    <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Senha administrativa</h2><p className="text-sm text-slate-600">Altere a senha da conta administrativa atualmente conectada.</p><form onSubmit={e=>enviar(e,"/api/admin/senha",setMensagemSenha)} className="mt-4 grid gap-4"><label className="text-sm font-bold">Senha atual<input name="senhaAtual" type="password" required autoComplete="current-password" className={campo}/></label><label className="text-sm font-bold">Nova senha<input name="novaSenha" type="password" required minLength={8} autoComplete="new-password" className={campo}/></label><label className="text-sm font-bold">Confirmar nova senha<input name="confirmarSenha" type="password" required minLength={8} autoComplete="new-password" className={campo}/></label><button disabled={enviando} className="rounded-lg bg-blue-800 px-5 py-3 font-bold text-white disabled:opacity-50">Alterar senha administrativa</button>{mensagemSenha&&<p className="rounded-lg bg-slate-100 p-3 text-sm font-semibold">{mensagemSenha}</p>}</form></section>
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Criar novo usuário e senha</h2><p className="text-sm text-slate-600">Usuários administrativos terão acesso total. Colaboradores acessarão somente a área operacional.</p><form onSubmit={e=>enviar(e,"/api/admin/usuarios/criar",setMensagemUsuario)} className="mt-4 grid gap-4"><label className="text-sm font-bold">E-mail do novo usuário<input name="email" type="email" required autoComplete="off" className={campo}/></label><label className="text-sm font-bold">Tipo de acesso<select name="funcao" required className={campo}><option value="colaborador">Colaborador</option><option value="admin">Administrador — acesso total</option></select></label><label className="text-sm font-bold">Senha inicial<input name="senha" type="password" required minLength={8} autoComplete="new-password" className={campo}/></label><label className="text-sm font-bold">Confirmar senha<input name="confirmarSenha" type="password" required minLength={8} autoComplete="new-password" className={campo}/></label><button disabled={enviando} className="rounded-lg bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">Criar usuário</button>{mensagemUsuario&&<p className="rounded-lg bg-slate-100 p-3 text-sm font-semibold">{mensagemUsuario}</p>}</form></section>
  </div>;
}
