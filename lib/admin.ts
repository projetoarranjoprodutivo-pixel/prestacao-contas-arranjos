import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminPrincipal } from "@/lib/admin-principal";

export function isAdminEmail(email: string) {
  return isAdminPrincipal(email);
}

export async function getAdminUser() {
  const user = await getChatGPTUser();
  return user && isAdminEmail(user.email) ? user : null;
}
