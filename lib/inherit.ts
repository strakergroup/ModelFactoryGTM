import { fieldLabel, fieldsFor, findField, sectionOf, type Answers } from "./fields";

// Pack fields that repeat factory policy default to the Part A answer
// ("Same as factory policy") unless the pack says "This model differs".

export const INHERITING = () => fieldsFor("model", ["custom_mt", "quality_risk", "llm", "customer_trained"]).filter((f) => f.inherits);

export const inherits = (key: string) => Boolean(findField(key)?.inherits);

// "Part A, A5 Data residency + A6 Hosting"
export function inheritSource(key: string): string {
  const f = findField(key);
  if (!f?.inherits) return "";
  return `Part A, ${f.inherits.keys.map((k) => `${sectionOf(k)} ${fieldLabel(k)}`).join(" + ")}`;
}

// The Part A text a pack field shows while it inherits ("" if Part A hasn't answered).
export function inheritedValue(key: string, factory: Answers): string {
  const f = findField(key);
  if (!f?.inherits) return "";
  const parts = f.inherits.keys
    .map((k) => ({ label: fieldLabel(k), text: typeof factory[k] === "string" ? (factory[k] as string).trim() : "" }))
    .filter((p) => p.text);
  if (!parts.length) return "";
  const body = parts.length === 1 ? parts[0].text : parts.map((p) => `${p.label}: ${p.text}`).join("\n");
  return f.inherits.note ? `${body}\n${f.inherits.note}` : body;
}

// A pack's answers with inherited fields filled from Part A.
export function effectiveAnswers(answers: Answers, differs: string[] = [], factory: Answers = {}): Answers {
  const out: Answers = { ...answers };
  for (const f of INHERITING()) if (!differs.includes(f.key)) out[f.key] = inheritedValue(f.key, factory);
  return out;
}

// Fingerprint of the Part A answers a pack inherits; a sign-off is stale if it changes.
export function factorySig(differs: string[] = [], factory: Answers = {}): string {
  const keys = INHERITING()
    .filter((f) => !differs.includes(f.key))
    .flatMap((f) => f.inherits!.keys);
  return JSON.stringify([...new Set(keys)].sort().map((k) => [k, factory[k] ?? ""]));
}

// Answers of a published Rev: frozen at publish. Revs published before
// inheritance existed (no factorySig) inherit from the current Part A.
export function revEffective(v: { answers: Answers; differs?: string[]; factorySig?: string }, factory: Answers): Answers {
  return v.factorySig !== undefined ? v.answers : effectiveAnswers(v.answers, v.differs, factory);
}
