import Link from "next/link";
import { createPack, restorePack } from "../lib/actions";
import { blocking, checkPack } from "../lib/checks";
import { completion, completionText, MODEL_TYPES, NAMING_EXAMPLE, NAMING_PARTS, typeLabels } from "../lib/fields";
import { effectiveAnswers, revEffective } from "../lib/inherit";
import { requireName } from "../lib/session";
import { listArchived, listPacks, type Pack } from "../lib/store";
import Header, { ErrorNote, StatusPill } from "./Header";

// Blocking-issue counts for the draft and the latest published Rev.
function counts(p: Pack, factory: Pack["answers"]) {
  const draftAnswers = p.kind === "model" ? effectiveAnswers(p.answers, p.differs, factory) : p.answers;
  const draft = blocking(checkPack({ kind: p.kind, modelTypes: p.modelTypes, answers: draftAnswers, na: p.na, splitOverride: p.splitOverride, name: p.name })).length;
  const v = p.versions.find((x) => x.version === p.version);
  const pub = v
    ? blocking(
        checkPack({
          kind: p.kind,
          modelTypes: v.modelTypes,
          answers: p.kind === "model" ? revEffective(v, factory) : v.answers,
          na: v.na,
          splitOverride: v.splitOverride,
          name: v.name,
        }),
      ).length
    : null;
  return { draft, pub, version: v?.version };
}

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string; archived?: string }> }) {
  const { error, archived } = await searchParams;
  const name = await requireName();
  const packs = await listPacks();
  const archivedPacks = await listArchived();
  const factory = packs.find((p) => p.kind === "factory")?.answers ?? {};

  return (
    <div className="shell">
      <Header name={name} />
      <main className="page">
        <h1>Model Factory</h1>
        <p className="muted">
          The model team fills in a pack and publishes it. Product, Marketing, Security &amp; Legal and RevOps review and sign it
          off. A pack is <strong>Launch-ready</strong> when there are no blocking issues and all sign-offs are on the latest Rev.
        </p>
        <ErrorNote error={error} />
        {archived && <p className="ok-box">Pack archived. Restore it from the Archived list at the bottom of this page.</p>}

        <div className="pack-list">
          {packs.map((p) => {
            const c = completion(p.kind, p.modelTypes, p.kind === "model" ? effectiveAnswers(p.answers, p.differs, factory) : p.answers, p.na);
            const n = counts(p, factory);
            const pct = c.requiredTotal
              ? Math.round((c.requiredDone / c.requiredTotal) * 100)
              : Math.round((c.optionalDone / Math.max(c.optionalTotal, 1)) * 100);
            return (
              <Link key={p.id} href={`/packs/${p.id}`} className="pack-card">
                <div className="pack-card-top">
                  <span className="pack-kind">{p.kind === "factory" ? "Shared · Part A" : "Model"}</span>
                  <StatusPill status={p.status} />
                </div>
                {(p.reviewFields?.length ?? 0) > 0 ? (
                  <span className="pill s-changes_requested needs-review">{p.reviewFields!.length} field{p.reviewFields!.length === 1 ? "" : "s"} need review</span>
                ) : p.needsReview ? (
                  <span className="pill s-changes_requested needs-review">Needs review</span>
                ) : null}
                <div className="pack-name">{p.name}</div>
                {p.kind === "model" && (
                  <div className="muted small">
                    {typeLabels(p.modelTypes, p.otherType)}
                  </div>
                )}
                <div className="bar"><span style={{ width: `${pct}%` }} /></div>
                <div className="muted small">
                  {completionText(c)} · {p.version ? `Rev ${p.version} published` : "never published"}
                </div>
                <div className="small issue-counts">
                  <span className={n.draft ? "count-bad" : "count-ok"}>Draft: {n.draft ? `${n.draft} blocking` : "no blocking issues"}</span>
                  {n.pub !== null && (
                    <span className={n.pub ? "count-bad" : "count-ok"}>
                      Published Rev {n.version}: {n.pub ? `${n.pub} blocking` : "no blocking issues"}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <form action={createPack} className="new-pack">
          <h2>Custom Model</h2>
          <label htmlFor="name">Model ID</label>
          <input id="name" name="name" placeholder={`e.g. ${NAMING_EXAMPLE}`} required />
          <p className="help">
            Naming convention: {NAMING_PARTS.map((p) => p.part).join(" - ")}.{" "}
            {NAMING_PARTS.map((p) => `${p.example} (${p.rule.toLowerCase()})`).join(" · ")}
          </p>
          <fieldset>
            <legend>Model type (pick all that apply)</legend>
            {MODEL_TYPES.map((m) => (
              <div key={m.id}>
                <label className={`check${m.id === "other" ? " check-other" : ""}`}>
                  <input type="checkbox" name="types" value={m.id} /> {m.label}
                </label>
                <p className="type-adds">{m.adds}</p>
              </div>
            ))}
            <input className="other-text" name="otherType" placeholder="What kind of model is it?" aria-label="Other model type" maxLength={120} />
          </fieldset>
          <button type="submit">Create custom model</button>
        </form>

        {archivedPacks.length > 0 && (
          <details className="archived-list">
            <summary>Archived ({archivedPacks.length})</summary>
            <ul>
              {archivedPacks.map((p) => (
                <li key={p.id}>
                  <form action={restorePack} className="inline-form">
                    <input type="hidden" name="id" value={p.id} />
                    <Link href={`/packs/${p.id}`}>{p.name}</Link>
                    <span className="muted small">archived by {p.archived!.by}</span>
                    <button type="submit" className="secondary small-button">Restore</button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </div>
  );
}
