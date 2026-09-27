import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// One shared password (FACT_PACK_PASSWORD in Vercel) plus a name each person
// types at sign-in. The name is self-reported: it labels edits, comments and
// sign-offs, but it is not a verified identity.
export const SESSION_COOKIE = "fp_session";
export const NAME_COOKIE = "fp_name";
export const MAX_AGE = 60 * 60 * 24 * 30;

export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("arbitr-fact-pack-v1"));
  return Buffer.from(sig).toString("hex");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isSignedIn(cookieValue: string | undefined): Promise<boolean> {
  const password = process.env.FACT_PACK_PASSWORD;
  return Boolean(password && cookieValue && safeEqual(cookieValue, await sessionToken(password)));
}

// The signed-in person's name, or a redirect to /login.
export async function requireName(): Promise<string> {
  const store = await cookies();
  if (!(await isSignedIn(store.get(SESSION_COOKIE)?.value))) redirect("/login");
  const name = store.get(NAME_COOKIE)?.value?.trim();
  if (!name) redirect("/login");
  return name;
}
