"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clearSplitOverride, publishPack, saveDraft, saveSplitOverride } from "../../../../lib/actions";
import { blocking, checkPack, ISSUE_TITLE, llmSentences, PACK_KEY, thinSentences, type Issue } from "../../../../lib/checks";
import {
  MODEL_TYPES,
  NA_MIN,
  SPLIT_REASON_MIN,
  completion,
  sourceKey,
  sourceLabel,
  completionText,
  emptyTable,
  fieldLabel,
  helpFor,
  isDone,
  partsFor,
  TAG_LABEL,
  TAG_MEANING,
  type Answers,
  type Field,
  type NA,
  type TableField,
} from "../../../../lib/fields";
import { plusSixMonths, stripFromLabels } from "../../../../lib/migrate";

type Props = {
  id: string;
  kind: "factory" | "model";
  initialName: string;
  initialModelTypes: string[];
  initialOtherType: string;
  initialAnswers: Answers;
  initialNa: NA;
  initialEtag: string;
  version: number;
  splitOverride: { reason: string; by: string; at: string } | null;
  factoryRequestProcess: string;
  initialReviewFields: string[];
  initialReviewCells: string[];
};

const CLAIMS_KEY = "e_claims";
// Grow with the answer so merged text ("From …: …") is visible without scrolling.
const rowsFor = (v: string) => Math.min(14, Math.max(2, v.split("\n").length + Math.floor(v.length / 95)));
const today = () => new Date().toISOString().slice(0, 10);

export default function EditForm(props: Props) {
  const { id, kind, version, splitOverride, factoryRequestProcess } = props;
  const [modelTypes, setModelTypes] = useState<string[]>(props.initialModelTypes);
  const [otherType, setOtherType] = useState(props.initialOtherType);
  const [answers, setAnswers] = useState<Answers>(props.initialAnswers);
  const [na, setNa] = useState<NA>(props.initialNa);
  const [naOpen, setNaOpen] = useState<Set<string>>(new Set(Object.keys(props.initialNa)));
  const [name, setName] = useState(props.initialName);
  const [state, setState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [message, setMessage] = useState("");
  const first = useRef(true);
  const etag = useRef(props.initialEtag);
  // Fields/cells that got migrated content; cleared by editing or "Mark reviewed".
  const [reviewFields, setReviewFields] = useState<string[]>(props.initialReviewFields);
  const [reviewCells, setReviewCells] = useState<string[]>(props.initialReviewCells);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const events = useRef<{ action: string; detail?: string }[]>([]);
  const [splitReason, setSplitReason] = useState("");

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setState("dirty");
    const timer = setTimeout(async () => {
      setState("saving");
      try {
        const sent = events.current;
        events.current = [];
        const res = await saveDraft(id, answers, etag.current, kind === "model" ? { name, modelTypes, otherType } : undefined, na, {
          fields: reviewFields,
          cells: reviewCells,
          events: sent,
        });
        if (res.ok) {
          etag.current = res.etag;
          setState("saved");
          setMessage(`Saved ${new Date(res.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
        } else {
          events.current = [...sent, ...events.current];
          setState("error");
          setMessage(res.error);
        }
      } catch {
        setState("error");
        setMessage("Couldn't save. Check your connection and try again.");
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [answers, na, name, modelTypes, otherType, reviewFields, reviewCells, id, kind]);

  // Warn before leaving with unsaved typing.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (state !== "saved") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  const setText = (key: string, value: string) => {
    if (reviewFields.includes(key)) setTouched((t) => new Set(t).add(key));
    setAnswers((a) => ({ ...a, [key]: value }));
  };
  // Saving a reviewed field strips the "From <old field>:" labels and clears its badge.
  const markReviewed = (key: string, how: string) => {
    const v = answers[key];
    if (typeof v === "string" && /^From [^:\n]+:/m.test(v)) setAnswers((a) => ({ ...a, [key]: stripFromLabels(v) }));
    setReviewFields((r) => r.filter((k) => k !== key));
    setReviewCells((c) => c.filter((x) => !x.startsWith(`${key}:`)));
    setTouched((t) => {
      const n = new Set(t);
      n.delete(key);
      return n;
    });
    events.current.push({ action: `reviewed ${fieldLabel(key)} (${how})` });
  };
  // One-click fixes offered on flags.
  const moveToB5 = () => {
    const b3 = String(answers.b3_domains ?? "");
    const moving = thinSentences(b3);
    if (!moving.length) return;
    const kept = moving.reduce((txt, m) => txt.replace(m, ""), b3).replace(/\s{2,}/g, " ").replace(/^[\s.;]+|[\s;]+$/g, "").trim();
    const b5 = String(answers.b5_weaknesses ?? "").trim();
    setAnswers((a) => ({ ...a, b3_domains: kept, b5_weaknesses: [b5, ...moving].filter(Boolean).join("\n") }));
    events.current.push({ action: "moved thin-area text from B3 to B5 Known weaknesses and gaps", detail: moving.join(" ") });
  };
  const removeLlm = () => {
    const v = String(answers.b5_error_modes ?? "");
    const gone = llmSentences(v);
    let next = v;
    for (const g of gone) next = next.replace(g, "");
    next = next.replace(/;\s*(?=\n|$)/g, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    setAnswers((a) => ({ ...a, b5_error_modes: next }));
    events.current.push({ action: "removed LLM-only text from B5 Error modes", detail: gone.join(" ") });
  };
  const table = (f: TableField) => (Array.isArray(answers[f.key]) ? (answers[f.key] as string[][]) : emptyTable(f));
  const setTable = (key: string, rows: string[][]) => setAnswers((a) => ({ ...a, [key]: rows }));

  const toggleNa = (key: string, on: boolean) => {
    setNaOpen((s) => {
      const next = new Set(s);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
    if (!on) setNa((n) => Object.fromEntries(Object.entries(n).filter(([k]) => k !== key)));
  };

  // "Create claim from this field": a pre-filled claims row linked back to the field.
  const claimsField = partsFor("model", []).flatMap((p) => p.sections.flatMap((s) => s.fields)).find((f) => f.key === CLAIMS_KEY) as TableField;
  const createClaim = (f: Field, text: string) => {
    const rows = table(claimsField).filter((r) => r.some((c) => c.trim()));
    // "Model or factory" comes from B1 so the claim names the model version it's evidence for.
    const b1 = String(answers.b1_name_version ?? "").split("·")[0].trim();
    setTable(CLAIMS_KEY, [...rows, [text.trim(), b1 || name, "", f.tag, "", "", f.key]]);
    setTimeout(() => document.getElementById(`ed-${CLAIMS_KEY}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const parts = partsFor(kind, modelTypes);
  const c = completion(kind, modelTypes, answers, na);
  const issues = useMemo(
    () => checkPack({ kind, modelTypes, answers, na, splitOverride }),
    [kind, modelTypes, answers, na, splitOverride],
  );
  const issuesFor = (key: string) => issues.filter((i) => i.key === key);
  const blockers = blocking(issues);
  const packIssue = issues.find((i) => i.key === PACK_KEY);

  return (
    <div className="edit">
      <div className="edit-bar">
        <div>
          <strong>{completionText(c)}</strong>
          {reviewFields.length > 0 && (
            <span className="review-badge">{reviewFields.length} field{reviewFields.length === 1 ? "" : "s"} need{reviewFields.length === 1 ? "s" : ""} review</span>
          )}
          <span className={`save-state ${state}`}>
            {state === "saving" ? "Saving…" : state === "dirty" ? "Unsaved changes" : message}
          </span>
        </div>
        <form action={publishPack}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={state !== "saved"} title={state !== "saved" ? "Wait for your changes to save" : ""}>
            Publish Rev {version + 1} for review
          </button>
        </form>
      </div>

      {blockers.length > 0 ? (
        <div className="block-box">
          <strong>{blockers.length} blocking issue{blockers.length === 1 ? "" : "s"}.</strong> You can publish for review, but this pack
          can&apos;t become Launch-ready until they&apos;re fixed.
          <ul>
            {(Object.keys(ISSUE_TITLE) as Issue["kind"][]).map((k) => {
              const list = issues.filter((i) => i.kind === k && i.blocking);
              if (!list.length) return null;
              return (
                <li key={k}>
                  <strong>{ISSUE_TITLE[k]}:</strong>{" "}
                  {[...new Set(list.map((i) => i.key))].map((key, n) => (
                    <span key={key}>
                      {n > 0 && ", "}
                      <a href={`#ed-${key}`}>{key === PACK_KEY ? "pack type" : fieldLabel(key)}</a>
                    </span>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="ok-box">No blocking issues. Once published and signed off by all four roles, this pack becomes Launch-ready.</p>
      )}
      <ReviewList issues={issues} href={(k) => `#ed-${k}`} />

      <p className="muted small legend">
        {(["P", "N", "I"] as const).map((t) => (
          <span key={t}>
            <span className={`tag t${t.toLowerCase()}`}>{t} · {TAG_LABEL[t]}</span> {TAG_MEANING[t]}
          </span>
        ))}
        <span><span className="req">Required</span> must be answered, or marked N/A with a reason</span>
      </p>

      {kind === "model" && (
        <div className="field" id={`ed-${PACK_KEY}`}>
          <label htmlFor="pack-name" className="field-label">Model name</label>
          <input id="pack-name" value={name} onChange={(e) => setName(e.target.value)} />
          <fieldset className="types">
            <legend className="field-label">Model type</legend>
            <p className="help">Pick all that apply. Each type adds its own questions below. Unticking a type hides its questions but keeps any answers.</p>
            {MODEL_TYPES.map((m) => (
              <label key={m.id} className="check">
                <input
                  type="checkbox"
                  checked={modelTypes.includes(m.id)}
                  onChange={(e) => setModelTypes((ts) => (e.target.checked ? [...ts, m.id] : ts.filter((t) => t !== m.id)))}
                />{" "}
                {m.label}
              </label>
            ))}
            {modelTypes.includes("other") && (
              <input
                className="other-inline"
                value={otherType}
                onChange={(e) => setOtherType(e.target.value)}
                placeholder="What kind of model is it?"
                aria-label="Other model type"
                maxLength={120}
              />
            )}
            {modelTypes.includes("other") && !otherType.trim() && (
              <p className="error small">Type what kind of model it is. You can&apos;t publish until you do.</p>
            )}
          </fieldset>

          {modelTypes.includes("custom_mt") && modelTypes.includes("customer_trained") && (
            <div className={packIssue ? "flag flag-block" : "flag flag-ok"}>
              <strong>{packIssue ? "Pack covers two products." : "Kept as one pack."}</strong>{" "}
              This pack covers a shared model and a customer-trained build. Split it unless both are sold under one SKU.
              {splitOverride ? (
                <form action={clearSplitOverride} className="inline-form">
                  <input type="hidden" name="id" value={id} />
                  <span className="small">
                    Override by {splitOverride.by}: “{splitOverride.reason}”
                  </span>{" "}
                  <button type="submit" className="link-button" disabled={state !== "saved"}>Remove override</button>
                </form>
              ) : (
                <form action={saveSplitOverride} className="inline-form">
                  <input type="hidden" name="id" value={id} />
                  <input
                    name="reason"
                    value={splitReason}
                    onChange={(e) => setSplitReason(e.target.value)}
                    placeholder={`Why both belong in one pack, e.g. “Sold under one SKU; the build is an optional line item”`}
                    minLength={SPLIT_REASON_MIN}
                    required
                    aria-label="Reason to keep as one pack"
                  />
                  <button
                    type="submit"
                    className="secondary"
                    disabled={state !== "saved" || splitReason.trim().length < SPLIT_REASON_MIN}
                    title={state !== "saved" ? "Wait for your changes to save" : `Reason needs at least ${SPLIT_REASON_MIN} characters`}
                  >
                    Keep as one pack
                  </button>
                  <span className="muted small">
                    {splitReason.trim().length < SPLIT_REASON_MIN
                      ? `${splitReason.trim().length} of ${SPLIT_REASON_MIN} characters minimum`
                      : "✓ Enough detail"}
                  </span>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {parts.map((part) => (
        <section key={part.id}>
          <h2>{part.title}</h2>
          {part.draft && <p className="warn-box small">Draft questions, awaiting model team confirmation. Flag any question that is wrong or missing in a comment.</p>}
          {part.sections.map((s) => (
            <div key={s.id} className="section">
              <h3>{s.title}</h3>
              {s.readonlyFactory && kind === "model" && (
                <div className="field readonly">
                  <div className="field-label">{s.readonlyFactory.label}</div>
                  <p className="help">Set once for every pack on the factory fact sheet (Part A, A9). Read-only here.</p>
                  <p className="answer">{factoryRequestProcess || <span className="gap">Not set on the factory fact sheet yet</span>}</p>
                </div>
              )}
              {s.fields.map((f) => {
                const own = issuesFor(f.key);
                const isNaOpen = naOpen.has(f.key);
                return (
                  <div
                    key={f.key}
                    id={`ed-${f.key}`}
                    className={`field ${f.subOf ? "sub" : ""} ${isDone(f, answers, na) ? "done" : ""} ${own.some((i) => i.blocking) ? "flagged" : ""}`}
                  >
                    <div className="field-head">
                      <label htmlFor={f.key} className="field-label">
                        {f.subOf ? "↳ " : ""}
                        {f.label}
                        {f.required && <span className="req">Required</span>}
                        {reviewFields.includes(f.key) && <span className="review-badge">Needs review</span>}
                      </label>
                      <span className={`tag t${f.tag.toLowerCase()}`}>{f.tag} · {TAG_LABEL[f.tag]}</span>
                    </div>
                    <p className="help">{helpFor(f, modelTypes)}</p>

                    {isNaOpen ? (
                      <input
                        className="na-reason"
                        value={na[f.key] ?? ""}
                        onChange={(e) => setNa((n) => ({ ...n, [f.key]: e.target.value }))}
                        placeholder={`Why this doesn't apply (at least ${NA_MIN} characters)`}
                        aria-label={`${f.label}: reason for N/A`}
                      />
                    ) : f.kind === "text" ? (
                      <textarea
                        id={f.key}
                        rows={rowsFor((answers[f.key] as string) ?? "")}
                        value={(answers[f.key] as string) ?? ""}
                        onChange={(e) => setText(f.key, e.target.value)}
                        onBlur={() => touched.has(f.key) && markReviewed(f.key, "edited")}
                      />
                    ) : (
                      <TableEditor
                        field={f}
                        rows={table(f)}
                        flaggedCells={reviewCells}
                        onChange={(rows, cell) => {
                          if (cell) setReviewCells((c) => c.filter((x) => x !== cell));
                          setTable(f.key, rows);
                        }}
                      />
                    )}

                    {reviewFields.includes(f.key) && (
                      <div className="flag flag-review">
                        Moved or merged here by the new structure. Check it reads right; editing it or marking it reviewed removes any “From …:” labels.
                        <button type="button" className="secondary small-button" onClick={() => markReviewed(f.key, "marked reviewed")}>
                          Mark reviewed
                        </button>
                      </div>
                    )}
                    <label className="check small na-toggle">
                      <input type="checkbox" checked={isNaOpen} onChange={(e) => toggleNa(f.key, e.target.checked)} /> Doesn&apos;t apply (N/A)
                    </label>

                    {own.map((i, n) => (
                      <div key={n} className={`flag ${i.blocking ? "flag-block" : "flag-warn"}`}>
                        {i.message}
                        {i.action === "create_claim" && (
                          <button type="button" className="secondary small-button" onClick={() => createClaim(f, i.text ?? String(answers[f.key] ?? ""))}>
                            Create claim from this field
                          </button>
                        )}
                        {i.action === "move_to_b5" && (
                          <button type="button" className="secondary small-button" onClick={moveToB5}>
                            Move to B5 Known weaknesses and gaps
                          </button>
                        )}
                        {i.action === "remove_llm" && (
                          <button type="button" className="secondary small-button" onClick={removeLlm}>
                            Remove LLM-only text
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function TableEditor({
  field,
  rows,
  onChange,
  flaggedCells = [],
}: {
  field: TableField;
  rows: string[][];
  onChange: (r: string[][], editedCell?: string) => void;
  flaggedCells?: string[];
}) {
  const measured = field.columns.findIndex((c) => c.name === "Date measured");
  const revalidate = field.columns.findIndex((c) => c.name === "Re-validate by");
  const source = field.columns.findIndex((c) => c.name === "Source field");
  const set = (r: number, c: number, v: string) =>
    onChange(
      rows.map((row, i) => {
        if (i !== r) return row;
        const next = row.map((x, j) => (j === c ? v : x));
        // Default re-validation: measurement date + 6 months, unless already set.
        if (c === measured && revalidate >= 0 && !row[revalidate]) next[revalidate] = plusSixMonths(v);
        return next;
      }),
      `${field.key}:${r}:${c}`,
    );
  return (
    <div className="table-wrap">
      <table className="edit-table">
        <thead>
          <tr>
            {field.columns.map((c) => <th key={c.name}>{c.name}</th>)}
            {!field.presetRows && <th aria-label="Remove" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => {
            const expired = revalidate >= 0 && row[revalidate] && row[revalidate] < today();
            return (
              <tr key={r} className={expired ? "expired-row" : ""}>
                {field.columns.map((col, c) => {
                  const cell = row[c] ?? "";
                  if (field.presetRows && c === 0) return <td key={c} className="preset">{cell}</td>;
                  const flagged = flaggedCells.includes(`${field.key}:${r}:${c}`);
                  return (
                    <td key={c} className={flagged ? "review-cell" : ""} title={flagged ? "Filled automatically: check it" : undefined}>
                      {c === source ? (
                        cell ? (
                          <a className="source-link" href={`#ed-${sourceKey(cell)}`}>{sourceLabel(cell)} ↗</a>
                        ) : (
                          <span className="muted small">—</span>
                        )
                      ) : col.type === "select" ? (
                        <select aria-label={col.name} value={cell} onChange={(e) => set(r, c, e.target.value)}>
                          <option value="">—</option>
                          {col.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={col.type === "date" ? "date" : "text"} aria-label={col.name} value={cell} onChange={(e) => set(r, c, e.target.value)} />
                      )}
                      {c === revalidate && expired && <span className="flag-inline">Past re-validate date</span>}
                      {flagged && <span className="review-inline">Check: filled from C1</span>}
                    </td>
                  );
                })}
                {!field.presetRows && (
                  <td>
                    <button type="button" className="link-button" onClick={() => onChange(rows.filter((_, i) => i !== r))} disabled={rows.length === 1}>
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!field.presetRows && (
        <button type="button" className="secondary" onClick={() => onChange([...rows, field.columns.map(() => "")])}>
          + Add row
        </button>
      )}
    </div>
  );
}

function ReviewList({ issues, href }: { issues: Issue[]; href: (key: string) => string }) {
  const warn = issues.filter((i) => !i.blocking);
  if (!warn.length) return null;
  const kinds = [...new Set(warn.map((i) => i.kind))];
  return (
    <div className="warn-box">
      <strong>Also review</strong> (these don&apos;t block Launch-ready):
      <ul>
        {kinds.map((k) => (
          <li key={k}>
            <strong>{ISSUE_TITLE[k]}:</strong>{" "}
            {[...new Set(warn.filter((i) => i.kind === k).map((i) => i.key))].map((key, n) => (
              <span key={key}>
                {n > 0 && ", "}
                <a href={href(key)}>{fieldLabel(key)}</a>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
