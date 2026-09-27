import Link from "next/link";
import { createPack } from "../lib/actions";
import { completion, MODEL_TYPES, typeLabels } from "../lib/fields";
import { requireName } from "../lib/session";
import { listPacks } from "../lib/store";
import Header, { ErrorNote, StatusPill } from "./Header";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const name = await requireName();
  const packs = await listPacks();

  return (
    <div className="shell">
      <Header name={name} />
      <main className="page">
        <h1>Model Factory</h1>
        <p className="muted">
          The model team fills in a pack and publishes it. Product, Marketing, Security &amp; Legal and
          RevOps review it. It becomes <strong>Launch-ready</strong> when all four sign-offs are on the
          latest version.
        </p>
        <ErrorNote error={error} />

        <div className="pack-list">
          {packs.map((p) => {
            const c = completion(p.kind, p.modelTypes, p.answers);
            const pct = Math.round((c.done / c.total) * 100);
            return (
              <Link key={p.id} href={`/packs/${p.id}`} className="pack-card">
                <div className="pack-card-top">
                  <span className="pack-kind">{p.kind === "factory" ? "Shared · Part A" : "Model"}</span>
                  <StatusPill status={p.status} />
                </div>
                <div className="pack-name">{p.name}</div>
                {p.kind === "model" && (
                  <div className="muted small">
                    {typeLabels(p.modelTypes, p.otherType)}
                  </div>
                )}
                <div className="bar"><span style={{ width: `${pct}%` }} /></div>
                <div className="muted small">
                  {c.done} of {c.total} answered · {p.version ? `v${p.version} published` : "never published"}
                </div>
              </Link>
            );
          })}
        </div>

        <form action={createPack} className="new-pack">
          <h2>Custom Model</h2>
          <label htmlFor="name">Model name</label>
          <input id="name" name="name" placeholder="e.g. Legal EN→DE engine v2" required />
          <fieldset>
            <legend>Model type (pick all that apply)</legend>
            {MODEL_TYPES.map((m) => (
              <label key={m.id} className={`check${m.id === "other" ? " check-other" : ""}`}>
                <input type="checkbox" name="types" value={m.id} /> {m.label}
              </label>
            ))}
            <input className="other-text" name="otherType" placeholder="What kind of model is it?" aria-label="Other model type" maxLength={120} />
          </fieldset>
          <button type="submit">Create custom model</button>
        </form>
      </main>
    </div>
  );
}
