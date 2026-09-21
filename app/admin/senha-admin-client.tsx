"use client";
import { useState } from "react";

export default function SenhaAdmin() {
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setEnviando(true); setMensagem("");
    const response = await fetch("/api/admin/senha", { method: "POST", body: new FormData(event.currentTarget) });
    const body = await response.json().catch(() => ({}));
    setMensagem(body.message || "Não foi possível alterar a senha."); setEnviando(false);
    if (response.ok && body.redirect) setTimeout(() => { location.href = body.redirect; }, 1200);
  }
  const campo = "mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3";
  return <section className="mt-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Senha administrativa</h2><p className="text-sm text-slate-600">Somente o administrador principal pode criar ou alterar esta senha de acesso total.</p><form onSubmit={salvar} className="mt-4 grid gap-4 md:grid-cols-3"><label className="text-sm font-bold">Senha atual<input name="senhaAtual" type="password" required autoComplete="current-password" className={campo}/></label><label className="text-sm font-bold">Nova senha<input name="novaSenha" type="password" required minLength={8} autoComplete="new-password" className={campo}/></label><label className="text-sm font-bold">Confirmar nova senha<input name="confirmarSenha" type="password" required minLength={8} autoComplete="new-password" className={campo}/></label><div className="md:col-span-3 flex flex-wrap items-center gap-3"><button disabled={enviando} className="rounded-lg bg-blue-800 px-5 py-3 font-bold text-white disabled:opacity-50">{enviando?"Salvando...":"Criar/alterar senha administrativa"}</button>{mensagem&&<p className="text-sm font-semibold">{mensagem}</p>}</div></form></section>;
}
