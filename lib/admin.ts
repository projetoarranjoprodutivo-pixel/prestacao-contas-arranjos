import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { colaboradores } from "@/db/schema";
import { eq, or } from "drizzle-orm";

const ADMIN_EMAIL = "rafaeldalla@hotmail.com";

export function isAdminEmail(email: string) {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

export async function getAdminUser() {
  const user = await getChatGPTUser();
  return user && (isAdminEmail(user.email) || user.role === "admin") ? user : null;
}

export async function getAderesOrAdminUser() {
  const user = await getChatGPTUser();
  return user && (isAdminEmail(user.email) || user.role === "admin" || user.role === "aderes") ? user : null;
}

function cargoNormalizado(cargo: string) {
  return cargo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export async function getGestorMudasUser() {
  const user = await getChatGPTUser();
  if (!user) return null;
  if (isAdminEmail(user.email) || user.role === "admin") return { user, coordenador: false as const, cadastro: null };
  const funcao = cargoNormalizado(user.role || "");
  const cadastro = await getDb().query.colaboradores.findFirst({ where: or(eq(colaboradores.authUserId, user.userId), eq(colaboradores.email, user.email.trim().toLowerCase())) });
  if (!cadastro && (funcao === "coordenador geral" || funcao === "coordenador")) return { user, coordenador: true as const, cadastro: null };
  if (!cadastro || cargoNormalizado(cadastro.cargo) !== "coordenador geral") return null;
  return { user, coordenador: true as const, cadastro };
}

// Acesso à agenda: administração e o colaborador Douglas Gasparetto.
export async function getAgendaEntregasUser(){
 const user=await getChatGPTUser();if(!user)return null;
 if(isAdminEmail(user.email)||user.role==='admin')return user;
 const cadastro=await getDb().query.colaboradores.findFirst({where:eq(colaboradores.authUserId,user.userId)});
 return cadastro&&cadastro.id===40?user:null;
}
