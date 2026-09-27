import Link from "next/link";
import { notFound } from "next/navigation";
import { addComment, requestChanges, resolveComment, signOff } from "../../../lib/actions";
import { completion, isAnswered, partsFor, typeLabels, SIGNOFF_ROLES, type Answers, type Field } from "../../../lib/fields";
import { requireName } from "../../../lib/session";
import { currentSignoffs, getPackAtLeast, listPacks, type Comment } from "../../../lib/store";
import Header, { ErrorNote, StatusPill, TagPill } from "../../Header";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Dublin" });

export default async function PackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; published?: string; rev?: string }>;
}) {
  const { id } = await params;
  const { error, published, rev } = await searchParams;
  const name = await requireName();
  const found = await getPackAtLeast(id, Number(rev) || undefined);
  if (!found) notFound();
  const { pack } = found;

  const v = pack.version;
  const current = pack.versions.find((x) => x.version === v);
  const previous = pack.versions.find((x) => x.version === v - 1);
  // Reviewers see the published version; a never-published pack shows the live draft.
  const shown: Answers = current?.answers ?? pack.answers;
  const types = current?.modelTypes ?? pack.modelTypes;
  const prevAnswers = previous?.answers ?? null;
  const changed = (f: Field) => prevAnswers !== null && JSON.stringify(prevAnswers[f.key] ?? null) !== JSON.stringify(shown[f.key] ?? null);

  const parts = partsFor(pack.kind, types);
  const c = completion(pack.kind, types, shown);
  const byField = (key: string) => pack.comments.filter((x) => x.field === key);
  const changedCount = prevAnswers ? parts.flatMap((p) => p.sections.flatMap((s) => s.fields)).filter(changed).length : 0;
  const signed = new Map(currentSignoffs(pack).map((s) => [s.role, s]));
  const inReview = pack.status === "in_review";
  const reviewable = inReview || pack.status === "launch_ready";
  const models = pack.kind === "factory" ? (await listPacks()).filter((p) => p.kind === "model") : [];

  return (
    <div className="shell">
      <Header name={name} />
      <main className="page">
        <p className="crumb"><Link href="/">← All packs</Link></p>
        <h1>{pack.name} <StatusPill status={pack.status} /></h1>
        <p className="muted">
          {pack.kind === "model" && <>{typeLabels(types, current ? current.otherType : pack.otherType)} · </>}
          {c.done} of {c.total} answered ·{" "}
          {current ? <>v{v} published {when(current.publishedAt)} by {current.publishedBy}</> : "Not published yet"}
        </p>
        <ErrorNote error={error} />
        {published && <p className="ok-box">Published v{published}. Share this page&apos;s link with reviewers.</p>}
        {pack.status === "draft" && v > 0 && (
          <p className="warn-box">A new draft is being edited. This page shows v{v}, the last published version.</p>
        )}
        {v === 0 && <p className="warn-box">Draft: not published yet. Reviewers can read and comment, but can&apos;t sign off until it&apos;s published.</p>}

        <div className="actions">
          <Link className="button" href={`/packs/${id}/edit`}>Edit</Link>
          <Link className="button secondary" href={`/packs/${id}/public`}>Public-only view</Link>
          {prevAnswers && <span className="muted small">{changedCount} field{changedCount === 1 ? "" : "s"} changed since v{v - 1} (marked <span className="changed-dot">changed</span>)</span>}
        </div>

        <section className="signoff">
          <h2>Sign-off {v > 0 && <span className="muted small">on v{v}</span>}</h2>
          <p className="help">Sign off only for a role you hold. Your name ({name}) is recorded with it.</p>
          <div className="signoff-grid">
            {SIGNOFF_ROLES.map((r) => {
              const s = signed.get(r.role);
              return (
                <div key={r.role} className={`signoff-card ${s ? "signed" : ""}`}>
                  <div className="signoff-role">{r.label}</div>
                  <div className="muted small">{r.scope}</div>
                  {s ? (
                    <div className="small">✓ {s.by} · {when(s.at)}{s.note ? <div className="muted">“{s.note}”</div> : null}</div>
                  ) : inReview ? (
                    <form action={signOff} className="signoff-form">
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="role" value={r.role} />
                      <input name="note" placeholder="Note (optional)" aria-label={`${r.label} note`} />
                      <button type="submit">Sign off v{v} as {r.label}</button>
                    </form>
                  ) : (
                    <div className="muted small">Waiting</div>
                  )}
                </div>
              );
            })}
          </div>
          {reviewable && (
            <form action={requestChanges} className="request-changes">
              <input type="hidden" name="id" value={id} />
              <label htmlFor="note" className="field-label">Send back to the model team</label>
              <textarea id="note" name="note" rows={2} placeholder="What needs to change before you can sign off?" required />
              <button type="submit" className="danger">Request changes</button>
            </form>
          )}
        </section>

        {byField("_general").length > 0 && (
          <section>
            <h2>General comments</h2>
            <Thread packId={id} field="_general" comments={byField("_general")} />
          </section>
        )}

        {pack.kind === "factory" && (
          <section>
            <h2>A2. Model portfolio</h2>
            <p className="help">Filled in automatically from the model packs.</p>
            <ul>
              {models.map((m) => (
                <li key={m.id}><Link href={`/packs/${m.id}`}>{m.name}</Link> <StatusPill status={m.status} /></li>
              ))}
              {!models.length && <li className="gap">No model packs yet</li>}
            </ul>
          </section>
        )}

        {parts.map((part) => (
          <section key={part.id}>
            <h2>{part.title}</h2>
          {part.draft && <p className="warn-box small">Draft questions, awaiting model team confirmation. Flag any question that is wrong or missing in a comment.</p>}
            {part.sections.map((s) => (
              <div key={s.id} className="section">
                <h3>{s.title}</h3>
                {s.fields.map((f) => {
                  const thread = byField(f.key);
                  const open = thread.filter((x) => !x.resolved).length;
                  return (
                    <div key={f.key} id={`f-${f.key}`} className="review-field">
                      <div className="field-head">
                        <span className="field-label">{f.label}{changed(f) && <span className="changed-dot">changed</span>}</span>
                        <TagPill tag={f.tag} />
                      </div>
                      <p className="help">{f.help}</p>
                      <Value field={f} answers={shown} />
                      <details className="comments" open={open > 0}>
                        <summary>{thread.length ? `${thread.length} comment${thread.length > 1 ? "s" : ""}${open ? ` · ${open} open` : ""}` : "Comment"}</summary>
                        <Thread packId={id} field={f.key} comments={thread} />
                      </details>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        ))}

        <section>
          <h2>Activity</h2>
          <ul className="activity">
            {[...pack.activity].reverse().slice(0, 20).map((a, i) => (
              <li key={i}>
                <span className="muted small">{when(a.at)}</span> {a.by} {a.action}
                {a.detail ? <>: “{a.detail}”</> : null}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

function Value({ field, answers }: { field: Field; answers: Answers }) {
  if (!isAnswered(field, answers)) return <p className="gap">Not provided</p>;
  const v = answers[field.key];
  if (field.kind === "text") return <p className="answer">{v as string}</p>;
  const rows = (v as string[][]).filter((r) => r.slice(field.presetRows ? 1 : 0).some((c) => c.trim()));
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{field.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((cell, j) => <td key={j}>{cell || "—"}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Thread({ packId, field, comments }: { packId: string; field: string; comments: Comment[] }) {
  return (
    <div className="thread">
      {comments.map((c) => (
        <div key={c.id} className={`comment ${c.resolved ? "resolved" : ""}`}>
          <div className="muted small">
            {c.by} · {when(c.at)} · on v{c.version}
            {c.resolved ? " · resolved" : ""}
          </div>
          <div>{c.body}</div>
          {!c.resolved && (
            <form action={resolveComment}>
              <input type="hidden" name="id" value={packId} />
              <input type="hidden" name="comment" value={c.id} />
              <button className="link-button small" type="submit">Mark resolved</button>
            </form>
          )}
        </div>
      ))}
      <form action={addComment} className="comment-form">
        <input type="hidden" name="id" value={packId} />
        <input type="hidden" name="field" value={field} />
        <textarea name="body" rows={2} placeholder="Add a comment" required />
        <button type="submit" className="secondary">Comment</button>
      </form>
    </div>
  );
}
