import { getChatGPTUser } from "@/app/chatgpt-auth";

const ADMIN_EMAILS = new Set(["rafaeldalla@hotmail.com"]);

export function isAdminEmail(email: string) {
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

export async function getAdminUser() {
  const user = await getChatGPTUser();
  return user && isAdminEmail(user.email) ? user : null;
}
