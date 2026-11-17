import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./api";

/**
 * Keeps the API's login token in an httpOnly cookie so page code and the browser never see it.
 * No expiry on the cookie, so closing the browser signs you out. The token itself still runs out
 * after JWT_MINUTES (8 hours by default), so a browser left open all day asks again too.
 */
export async function setSession(token: string, _expiresAt?: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
