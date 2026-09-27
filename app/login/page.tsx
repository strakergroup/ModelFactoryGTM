import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MAX_AGE, NAME_COOKIE, SESSION_COOKIE, safeEqual, sessionToken } from "../../lib/session";

async function signIn(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const attempt = String(formData.get("password") ?? "");
  const password = process.env.FACT_PACK_PASSWORD;
  if (!name) redirect("/login?error=name");
  if (!password || !safeEqual(await sessionToken(attempt), await sessionToken(password))) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    redirect("/login?error=password");
  }
  const store = await cookies();
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: MAX_AGE };
  store.set(SESSION_COOKIE, await sessionToken(password), opts);
  store.set(NAME_COOKIE, name, opts);
  redirect("/");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error === "name" ? "Add your name so reviewers know who did what." : error === "password" ? "That password didn't work." : null;
  return (
    <div className="login">
      <form action={signIn} className="login-card">
        <div className="brand">
          arbitr <span>Model Factory</span>
        </div>
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" autoComplete="name" placeholder="First and last name" required autoFocus />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        {message && <p className="error">{message}</p>}
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}
