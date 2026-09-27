import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MAX_AGE, NAME_COOKIE, requireName } from "../../lib/session";
import Header from "../Header";

// Already signed in with the shared password; this only changes the name
// recorded on edits, comments and sign-offs (e.g. on a shared computer).
async function changeName(formData: FormData) {
  "use server";
  await requireName();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) redirect("/name?error=1");
  const store = await cookies();
  store.set(NAME_COOKIE, name, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: MAX_AGE });
  redirect("/");
}

export default async function NamePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const name = await requireName();
  return (
    <div className="shell">
      <Header name={name} />
      <main className="page">
        <form action={changeName} className="new-pack">
          <h2>Change your name</h2>
          <p className="help">Your name is recorded on everything you edit, comment on or sign off.</p>
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" defaultValue={name} required autoFocus />
          {error && <p className="error">Enter a name.</p>}
          <button type="submit">Save name</button>
        </form>
      </main>
    </div>
  );
}
