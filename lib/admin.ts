import { getChatGPTUser } from "@/app/chatgpt-auth";

const ADMIN_EMAIL = "rafaeldalla@hotmail.com";

export function isAdminEmail(email: string) {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

export async function getAdminUser() {
  const user = await getChatGPTUser();
  return user && isAdminEmail(user.email) ? user : null;
}
