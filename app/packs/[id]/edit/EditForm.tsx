"use client";

import { useEffect, useRef, useState } from "react";
import { publishPack, saveDraft } from "../../../../lib/actions";
import {
  MODEL_TYPES,
  completion,
  emptyTable,
  isAnswered,
  partsFor,
  TAG_LABEL,
  TAG_MEANING,
  type Answers,
  type TableField,
} from "../../../../lib/fields";

type Props = {
  id: string;
  kind: "factory" | "model";
  initialName: string;
  initialModelTypes: string[];
  initialOtherType: string;
  initialAnswers: Answers;
  initialEtag: string;
  version: number;
};

export default function EditForm({ id, kind, initialName, initialModelTypes, initialOtherType, initialAnswers, initialEtag, version }: Props) {
  const [modelTypes, setModelTypes] = useState<string[]>(initialModelTypes);
  const [otherType, setOtherType] = useState(initialOtherType);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [name, setName] = useState(initialName);
  const [state, setState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [message, setMessage] = useState("");
  const first = useRef(true);
  const etag = useRef(initialEtag);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setState("dirty");
    const timer = setTimeout(async () => {
      setState("saving");
      try {
        const res = await saveDraft(id, answers, etag.current, kind === "model" ? { name, modelTypes, otherType } : undefined);
        if (res.ok) {
          etag.current = res.etag;
          setState("saved");
          setMessage(`Saved ${new Date(res.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
        } else {
          setState("error");
          setMessage(res.error);
        }
      } catch {
        setState("error");
        setMessage("Couldn't save. Check your connection and try again.");
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [answers, name, modelTypes, otherType, id, kind]);

  // Warn before leaving with unsaved typing.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (state !== "saved") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  const setText = (key: string, value: string) => setAnswers((a) => ({ ...a, [key]: value }));
  const table = (f: TableField) => (Array.isArray(answers[f.key]) ? (answers[f.key] as string[][]) : emptyTable(f));
  const setTable = (key: string, rows: string[][]) => setAnswers((a) => ({ ...a, [key]: rows }));

  const parts = partsFor(kind, modelTypes);
  const c = completion(kind, modelTypes, answers);

  return (
    <div className="edit">
      <div className="edit-bar">
        <div>
          <strong>{c.done} of {c.total}</strong> answered
          <span className={`save-state ${state}`}>
            {state === "saving" ? "Saving…" : state === "dirty" ? "Unsaved changes" : message}
          </span>
        </div>
        <form action={publishPack}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={state !== "saved"} title={state !== "saved" ? "Wait for your changes to save" : ""}>
            Publish v{version + 1} for review
          </button>
        </form>
      </div>

      <p className="muted small legend">
        {(["P", "N", "I"] as const).map((t) => (
          <span key={t}>
            <span className={`tag t${t.toLowerCase()}`}>{t} · {TAG_LABEL[t]}</span> {TAG_MEANING[t]}
          </span>
        ))}
      </p>

      {kind === "model" && (
        <div className="field">
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
                  onChange={(e) =>
                    setModelTypes((ts) => (e.target.checked ? [...ts, m.id] : ts.filter((t) => t !== m.id)))
                  }
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
        </div>
      )}

      {parts.map((part) => (
        <section key={part.id}>
          <h2>{part.title}</h2>
          {part.draft && <p className="warn-box small">Draft questions, awaiting model team confirmation. Flag any question that is wrong or missing in a comment.</p>}
          {part.sections.map((s) => (
            <div key={s.id} className="section">
              <h3>{s.title}</h3>
              {s.fields.map((f) => (
                <div key={f.key} className={`field ${isAnswered(f, answers) ? "done" : ""}`}>
                  <div className="field-head">
                    <label htmlFor={f.key} className="field-label">{f.label}</label>
                    <span className={`tag t${f.tag.toLowerCase()}`}>{f.tag} · {TAG_LABEL[f.tag]}</span>
                  </div>
                  <p className="help">{f.help}</p>
                  {f.kind === "text" ? (
                    <textarea
                      id={f.key}
                      rows={2}
                      value={(answers[f.key] as string) ?? ""}
                      onChange={(e) => setText(f.key, e.target.value)}
                    />
                  ) : (
                    <TableEditor field={f} rows={table(f)} onChange={(rows) => setTable(f.key, rows)} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function TableEditor({ field, rows, onChange }: { field: TableField; rows: string[][]; onChange: (r: string[][]) => void }) {
  const set = (r: number, c: number, v: string) => onChange(rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));
  return (
    <div className="table-wrap">
      <table className="edit-table">
        <thead>
          <tr>
            {field.columns.map((c) => <th key={c}>{c}</th>)}
            {!field.presetRows && <th aria-label="Remove" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) =>
                field.presetRows && c === 0 ? (
                  <td key={c} className="preset">{cell}</td>
                ) : (
                  <td key={c}>
                    <input aria-label={field.columns[c]} value={cell} onChange={(e) => set(r, c, e.target.value)} />
                  </td>
                ),
              )}
              {!field.presetRows && (
                <td>
                  <button type="button" className="link-button" onClick={() => onChange(rows.filter((_, i) => i !== r))} disabled={rows.length === 1}>
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
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
