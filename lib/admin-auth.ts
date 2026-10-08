import "server-only";

import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  createAdminLoginRateLimiter,
  handleAdminLoginRequest,
  handleProtectedAdminDataRequest,
  isAdminSessionTokenValid,
  serializeAdminLogoutCookie,
} from "@/lib/admin-auth-core";

const loginRateLimiter = createAdminLoginRateLimiter();

function adminPassword(): string | undefined {
  const password = process.env.ADMIN_PASSWORD?.trim();
  return password || undefined;
}

function shouldUseSecureCookie(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function isCurrentAdminAuthenticated(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionTokenValid(token, adminPassword());
}

export async function loginAdmin(request: Request): Promise<Response> {
  return handleAdminLoginRequest(request, {
    password: adminPassword(),
    rateLimiter: loginRateLimiter,
    secureCookie: shouldUseSecureCookie(),
  });
}

export function logoutAdmin(request: Request): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL("/admin", request.url).toString(),
      "Set-Cookie": serializeAdminLogoutCookie(shouldUseSecureCookie()),
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function protectAdminData<T>(
  request: Request,
  load: () => Promise<T>,
): Promise<Response> {
  return handleProtectedAdminDataRequest(request, adminPassword(), load);
}
