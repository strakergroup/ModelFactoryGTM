import Link from "next/link";

export default function Header({ name }: { name: string }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        arbitr <span>Model Factory</span>
      </Link>
      <nav className="nav">
        <span className="stamp">Signed in as {name}</span>
        <Link href="/name">Change name</Link>
        <form action="/signout" method="POST">
          <button className="link-button" type="submit">Sign out</button>
        </form>
      </nav>
    </header>
  );
}

export function StatusPill({ status }: { status: string }) {
  const label: Record<string, string> = {
    draft: "Draft",
    in_review: "In review",
    changes_requested: "Changes requested",
    launch_ready: "Launch-ready",
  };
  return <span className={`pill s-${status}`}>{label[status] ?? status}</span>;
}

export function TagPill({ tag }: { tag: "P" | "N" | "I" }) {
  const text = { P: "P · Public", N: "N · Under NDA", I: "I · Internal" }[tag];
  return <span className={`tag t${tag.toLowerCase()}`}>{text}</span>;
}

export function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="error-box">{error}</p>;
}
