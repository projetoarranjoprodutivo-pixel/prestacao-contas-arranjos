import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import { isAdminEmail } from "@/lib/admin";

export const dynamic="force-dynamic";

export default async function AderesPage(){
  const user=await getChatGPTUser();
  if(!user)redirect("/entrar-aderes");
  if(user.role!=="aderes"&&user.role!=="admin"&&!isAdminEmail(user.email))redirect("/");
  redirect("/admin?aba=documentos-associacoes");
}
