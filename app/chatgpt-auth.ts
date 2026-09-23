import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and,eq,gt } from "drizzle-orm";
import { getDb } from "@/db";
import { sessoesAcesso,usuariosAcesso } from "@/db/schema";

export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null;role:string;associacao:string|null};
const COOKIE="ap_session";
const bytes=(n:number)=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return a;};
const hex=(a:ArrayBuffer|Uint8Array)=>[...new Uint8Array(a instanceof Uint8Array?a.buffer:a)].map(x=>x.toString(16).padStart(2,"0")).join("");
const hash=async(v:string)=>hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));
export async function criarSenha(senha:string,salt=hex(bytes(16))){const chave=await crypto.subtle.importKey("raw",new TextEncoder().encode(senha),"PBKDF2",false,["deriveBits"]);const resultado=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode(salt),iterations:100000,hash:"SHA-256"},chave,256);return{salt,hash:hex(resultado)};}
export async function verificarSenha(senha:string,salt:string,esperado:string){return (await criarSenha(senha,salt)).hash===esperado;}
export async function criarSessao(usuarioId:string){const token=hex(bytes(32));await getDb().insert(sessoesAcesso).values({tokenHash:await hash(token),usuarioId,expiraEm:new Date(Date.now()+30*86400000).toISOString()});const jar=await cookies();jar.set(COOKIE,token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:30*86400});}
export async function encerrarSessao(){const jar=await cookies();const token=jar.get(COOKIE)?.value;if(token)await getDb().delete(sessoesAcesso).where(eq(sessoesAcesso.tokenHash,await hash(token)));jar.delete(COOKIE);}
export async function getChatGPTUser():Promise<ChatGPTUser|null>{const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;const rows=await getDb().select({id:usuariosAcesso.id,email:usuariosAcesso.email,funcao:usuariosAcesso.funcao,associacao:usuariosAcesso.associacao,ativo:usuariosAcesso.ativo}).from(sessoesAcesso).innerJoin(usuariosAcesso,eq(sessoesAcesso.usuarioId,usuariosAcesso.id)).where(and(eq(sessoesAcesso.tokenHash,await hash(token)),gt(sessoesAcesso.expiraEm,new Date().toISOString()))).limit(1);const u=rows[0];if(!u?.ativo)return null;return{userId:u.id,email:u.email,displayName:u.email,fullName:null,role:u.funcao,associacao:u.associacao};}
export async function requireChatGPTUser(returnTo:string){const u=await getChatGPTUser();if(u)return u;redirect(chatGPTSignInPath(returnTo));}
export function chatGPTSignInPath(returnTo:string){return `/entrar?return_to=${encodeURIComponent(returnTo.startsWith("/")?returnTo:"/")}`;}
export function chatGPTSignOutPath(returnTo="/"){return `/api/auth/logout?return_to=${encodeURIComponent(returnTo.startsWith("/")?returnTo:"/")}`;}
export async function sha256(v:string){return hash(v);}
