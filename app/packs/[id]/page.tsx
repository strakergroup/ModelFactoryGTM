import Link from "next/link";
import { notFound } from "next/navigation";
import { addComment, archivePack, requestChanges, resolveComment, restorePack, signOff } from "../../../lib/actions";
import { effectiveAnswers, factorySig, inheritSource, revEffective } from "../../../lib/inherit";
import { completion, completionText, fieldLabel, helpFor, sourceLabel, isAnswered, isNA, partsFor, typeLabels, SIGNOFF_ROLES, type Answers, type Field, type NA } from "../../../lib/fields";
import { blocking, checkPack, isStale, ISSUE_TITLE, PACK_KEY, type Issue } from "../../../lib/checks";
import { requireName } from "../../../lib/session";
import { currentSignoffs, FACTORY_ID, getPack, getPackAtLeast, listPacks, type Comment } from "../../../lib/store";
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
  const factory = pack.kind === "model" ? await getPack(FACTORY_ID) : null;
  const factoryAnswers = factory?.pack.answers ?? {};
  // Reviewers see the published version (inherited Part A policy frozen in);
  // a never-published pack shows the live draft with current Part A policy.
  const shown: Answers =
    pack.kind !== "model" ? current?.answers ?? pack.answers : current ? revEffective(current, factoryAnswers) : effectiveAnswers(pack.answers, pack.differs, factoryAnswers);
  const shownDiffers = current ? current.differs ?? [] : pack.differs ?? [];
  const scope = current ? `Published Rev ${v}` : "Draft";
  const types = current?.modelTypes ?? pack.modelTypes;
  const prevAnswers = previous?.answers ?? null;
  const changed = (f: Field) => prevAnswers !== null && JSON.stringify(prevAnswers[f.key] ?? null) !== JSON.stringify(shown[f.key] ?? null);

  const parts = partsFor(pack.kind, types);
  const shownNa: NA = (current ? current.na : pack.na) ?? {};
  const shownOverride = current ? current.splitOverride : pack.splitOverride;
  const c = completion(pack.kind, types, shown, shownNa);
  const issues = checkPack({ kind: pack.kind, modelTypes: types, answers: shown, na: shownNa, splitOverride: shownOverride, name: current?.name ?? pack.name });
  const blockers = blocking(issues);
  const issuesFor = (key: string) => issues.filter((i) => i.key === key);
  const requestProcess = typeof factoryAnswers.a9_request_process === "string" ? factoryAnswers.a9_request_process : "";
  const byField = (key: string) => pack.comments.filter((x) => x.field === key);
  const changedCount = prevAnswers ? parts.flatMap((p) => p.sections.flatMap((s) => s.fields)).filter(changed).length : 0;
  // Sign-offs are stale if given before a migration, if this Rev now has blocking
  // issues, or if the Part A policy they inherited has changed since.
  const revBlocked = v > 0 && blockers.length > 0;
  const sigNow = pack.kind === "model" ? factorySig(shownDiffers, factoryAnswers) : undefined;
  const onRev = currentSignoffs(pack).map((s) => {
    const factoryMoved = Boolean(s.factorySig && s.factorySig !== sigNow);
    return { ...s, factoryMoved, stale: isStale(s.at, pack.migratedAt, revBlocked, factoryMoved) };
  });
  const signed = new Map(onRev.filter((s) => !s.stale).map((s) => [s.role, s]));
  const staleByRole = new Map(onRev.filter((s) => s.stale).map((s) => [s.role, s]));
  const reviewFields = pack.reviewFields ?? [];
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
          {completionText(c)} ·{" "}
          {current ? <>Rev {v} published {when(current.publishedAt)} by {current.publishedBy}</> : "Not published yet"}
          {pack.splitOverride && <><br />Kept as one pack by {pack.splitOverride.by}: “{pack.splitOverride.reason}”</>}
          {reviewFields.length > 0 && <span className="review-badge">{reviewFields.length} field{reviewFields.length === 1 ? "" : "s"} need{reviewFields.length === 1 ? "s" : ""} review</span>}
        </p>
        <ErrorNote error={error} />
        {published && <p className="ok-box">Published Rev {published}. Share this page&apos;s link with reviewers.</p>}
        {v > 0 && (pack.systemChanges?.length ?? 0) > 0 ? (
          <div className="warn-box">
            <strong>
              The draft has {pack.systemChanges!.length} system change{pack.systemChanges!.length === 1 ? "" : "s"}.
            </strong>{" "}
            <Link href={`/packs/${id}/edit`}>View draft</Link>. This page shows Rev {v}, the last published revision.
            <details>
              <summary>What changed</summary>
              <ul>
                {pack.systemChanges!.map((c, i) => <li key={i}>{c.what}</li>)}
              </ul>
            </details>
          </div>
        ) : pack.status === "draft" && v > 0 ? (
          <p className="warn-box">A new draft is being edited. This page shows Rev {v}, the last published revision.</p>
        ) : null}
        {v === 0 && <p className="warn-box">Draft: not published yet. Reviewers can read and comment, but can&apos;t sign off until it&apos;s published.</p>}

        {pack.archived && (
          <form action={restorePack} className="warn-box">
            <input type="hidden" name="id" value={id} />
            <strong>Archived</strong> by {pack.archived.by} on {when(pack.archived.at)}. It&apos;s hidden from the home page.{" "}
            <button type="submit" className="secondary">Restore</button>
          </form>
        )}
        <div className="actions">
          <Link className="button" href={`/packs/${id}/edit`}>Edit</Link>
          <Link className="button secondary" href={`/packs/${id}/public`}>Public-only view</Link>
          {pack.kind === "model" && !pack.archived && (
            <form action={archivePack}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className="secondary">Archive pack</button>
            </form>
          )}
          {prevAnswers && <span className="muted small">{changedCount} field{changedCount === 1 ? "" : "s"} changed since Rev {v - 1} (marked <span className="changed-dot">changed</span>)</span>}
        </div>

        {v > 0 && (blockers.length > 0 ? (
          <div className="block-box">
            <strong>{scope}: {blockers.length} blocking issue{blockers.length === 1 ? "" : "s"}. It can&apos;t become Launch-ready.</strong>{" "}
            Sign-offs are recorded, but the model team must fix these and publish a new Rev.
            <ul>
              {(Object.keys(ISSUE_TITLE) as Issue["kind"][]).map((k) => {
                const list = issues.filter((i) => i.kind === k && i.blocking);
                if (!list.length) return null;
                return (
                  <li key={k}>
                    <strong>{ISSUE_TITLE[k]}:</strong>{" "}
                    {[...new Set(list.map((i) => i.key))].map((key, n) => (
                      <span key={key}>{n > 0 && ", "}<a href={`#f-${key}`}>{key === PACK_KEY ? "pack type" : fieldLabel(key)}</a></span>
                    ))}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="ok-box">
            {scope}: no blocking issues.{" "}
            {pack.status === "launch_ready" ? "All sign-offs are in: this pack is Launch-ready." : "It becomes Launch-ready when every role signs off."}
          </p>
        ))}
        {v > 0 && <ReviewList issues={issues} href={(k) => `#f-${k}`} scope={scope} />}
        {issuesFor(PACK_KEY).map((i, n) => (
          <div key={n} id={`f-${PACK_KEY}`} className="flag flag-block">{i.message}</div>
        ))}
        {shownOverride && (
          <p className="flag flag-ok">Kept as one pack by {shownOverride.by}: “{shownOverride.reason}”</p>
        )}

        <section className="signoff">
          <h2>Sign-off {v > 0 && <span className="muted small">on Rev {v}</span>}</h2>
          <p className="help">Sign off only for a role you hold. Your name ({name}) is recorded with it.</p>
          <div className="signoff-grid">
            {SIGNOFF_ROLES.map((r) => {
              const s = signed.get(r.role);
              const stale = !s ? staleByRole.get(r.role) : undefined;
              return (
                <div key={r.role} className={`signoff-card ${s ? "signed" : stale ? "stale" : ""}`}>
                  <div className="signoff-role">{r.label}</div>
                  <div className="muted small">{r.scope}</div>
                  {stale && (
                    <div className="small">
                      <div className="stale-label">Stale – re-approval needed</div>
                      {stale.by} · {when(stale.at)}
                      <div>
                        {pack.migratedAt && stale.at < pack.migratedAt
                          ? "Given before the move to the new structure."
                          : stale.factoryMoved
                            ? "Part A policy this pack inherits has changed since."
                            : "This Rev now has blocking issues."}
                      </div>
                    </div>
                  )}
                  {s ? (
                    <div className="small">✓ {s.by} · {when(s.at)}{s.note ? <div className="muted">“{s.note}”</div> : null}</div>
                  ) : inReview && !revBlocked ? (
                    <form action={signOff} className="signoff-form">
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="role" value={r.role} />
                      <input name="note" placeholder="Note (optional)" aria-label={`${r.label} note`} />
                      <button type="submit">Sign off Rev {v} as {r.label}</button>
                    </form>
                  ) : !stale ? (
                    <div className="muted small">{revBlocked ? "Blocked until the issues above are fixed" : "Waiting"}</div>
                  ) : null}
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
                {s.readonlyFactory && pack.kind === "model" && (
                  <div className="review-field readonly">
                    <div className="field-label">{s.readonlyFactory.label}</div>
                    <p className="answer">{requestProcess || <span className="gap">Not set on the factory fact sheet yet</span>}</p>
                  </div>
                )}
                {s.fields.map((f) => {
                  const thread = byField(f.key);
                  const open = thread.filter((x) => !x.resolved).length;
                  return (
                    <div key={f.key} id={`f-${f.key}`} className={`review-field ${f.subOf ? "sub" : ""} ${issuesFor(f.key).some((i) => i.blocking) ? "flagged" : ""}`}>
                      <div className="field-head">
                        <span className="field-label">{f.subOf ? "↳ " : ""}{f.label}{f.required && <span className="req">Required</span>}{reviewFields.includes(f.key) && <span className="review-badge">Needs review</span>}{changed(f) && <span className="changed-dot">changed</span>}</span>
                        <TagPill tag={f.tag} />
                      </div>
                      <p className="help">{helpFor(f, types)}</p>
                      {pack.kind === "model" && f.inherits && !shownDiffers.includes(f.key) && (
                        <p className="inherited-label">Same as factory policy ({inheritSource(f.key)})</p>
                      )}
                      {isNA(f, shownNa) ? <p className="answer muted">N/A: {shownNa[f.key]}</p> : <Value field={f} answers={shown} />}
                      {issuesFor(f.key).map((i, n) => (
                        <div key={n} className={`flag ${i.blocking ? "flag-block" : "flag-warn"}`}>{i.message}</div>
                      ))}
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
        <thead><tr>{field.columns.map((c) => <th key={c.name}>{c.name}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((cell, j) => <td key={j}>{(field.columns[j]?.name === "Source field" && cell ? sourceLabel(cell) : cell) || "—"}</td>)}</tr>
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
            {c.by} · {when(c.at)} · on Rev {c.version}
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

function ReviewList({ issues, href, scope }: { issues: Issue[]; href: (key: string) => string; scope?: string }) {
  const warn = issues.filter((i) => !i.blocking);
  if (!warn.length) return null;
  const kinds = [...new Set(warn.map((i) => i.kind))];
  return (
    <div className="warn-box">
      <strong>{scope ? `${scope}: also review` : "Also review"}</strong> (these don&apos;t block Launch-ready):
      <ul>
        {kinds.map((k) => (
          <li key={k}>
            <strong>{ISSUE_TITLE[k]}:</strong>{" "}
            {[...new Set(warn.filter((i) => i.kind === k).map((i) => i.key))].map((key, n) => (
              <span key={key}>
                {n > 0 && ", "}
                <a href={href(key)}>{key === PACK_KEY ? "pack title and type" : fieldLabel(key)}</a>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
