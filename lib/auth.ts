import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "admin_session";
const SESSION_TOKEN = "authenticated";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme";

export async function verifyAdminSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (session?.value !== ADMIN_PASSWORD) {
    redirect("/admin/login");
  }
}

export function checkPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

export { SESSION_COOKIE, SESSION_TOKEN };
