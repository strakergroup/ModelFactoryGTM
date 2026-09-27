import { FACTORY_PARTS, MODEL_PARTS, SPLIT_REASON_MIN, fieldsFor, isDone, isNA, sectionOf, type Answers, type Field, type NA } from "./fields";

// The launch-ready checks. Pure functions: the editor runs them live in the
// browser, the review page shows them, and sign-off uses them to decide
// whether a pack can become Launch-ready.

export type IssueKind = "required" | "claim" | "visibility" | "expired" | "evidence" | "model" | "spec" | "split" | "scale" | "placement" | "llm";
export type IssueAction = "create_claim" | "move_to_b5" | "remove_llm";
export type Issue = { key: string; kind: IssueKind; message: string; blocking: boolean; text?: string; action?: IssueAction };

export type CheckInput = {
  kind: "factory" | "model";
  modelTypes: string[];
  answers: Answers;
  na?: NA;
  splitOverride?: { reason: string } | null;
  today?: string; // YYYY-MM-DD, for tests
};

export const PACK_KEY = "_pack"; // issues about the pack as a whole

// Claims register columns (Part E).
const CLAIM = 0;
const MODEL = 1;
const EVIDENCE = 2;
const APPROVED_BY = 4;
// B4 Results columns.
const B4 = { metric: 0, scale: 3, measured: 8, revalidate: 9 };

const COMPARISON = /\b(faster|better|replaces?|drop-in|versus|outperforms?)\b|\bvs\.?(?=\s|$)/gi;

// Numbers that describe performance: 98.6%, +6, COMET 0.87, 22 minutes, 3 pts.
const PERF_PATTERNS = [
  /([+\-−±]?\d+(?:[.,]\d+)?)\s?%/g,
  /(?:^|[\s(])([+−±]\s?\d+(?:[.,]\d+)?)/g,
  /\b(?:COMET(?:-22)?|chrF\+*|BLEU|MQM|TER|F1)\b[^\d\n]{0,15}?(\d+(?:[.,]\d+)?)/gi,
  /(\d+(?:[.,]\d+)?)\s*(?:COMET|chrF|BLEU)\b/gi,
  /(\d+(?:[.,]\d+)?)\s*(?:pts|points|×|x)(?![a-z])/gi,
];

// Time counts as a claim only when it's an improvement ("saves 22 minutes"),
// not a commercial term ("replies within 2 working days", "4–6 weeks").
const IMPROVEMENT = /\b(saves?|saved|saving|cuts?|reduc\w*|faster|less|fewer|shorter|improv\w*|drops?)\b|→|->/i;
const TIME_AMOUNT = /(\d+(?:[.,]\d+)?)\s*(?:minutes?|mins?)(?![a-z])/gi;
// Commercial terms are exempt even with a %: discounts, margins, retention.
const COMMERCIAL = /\b(discount|off list|rebate|margin|retention|retained|uptime|SLA)\b/i;

// Units and dates are not claims: "per 1,000 words", "12 Sep 2026", "2026-09-12", "v2.1".
function stripNoise(s: string): string {
  return s
    .replace(/\bper\s+[\d,.]+\s*\w+/gi, " ")
    // Terms, not measurements: "100% and fuzzy TM matches", "COMET-22".
    .replace(/\b\d{2,3}%\s*(?:and\s+fuzzy\s+)?(?:TM\s+)?match(?:es)?\b/gi, " ")
    .replace(/\b(COMET|chrF)-\d+\b/gi, "$1")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\b/gi, " ")
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\b/gi, " ")
    .replace(/\bv\d+(?:\.\d+)*\b/gi, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ");
}

// "1,000" -> "1000"; "0,87" -> "0.87"; "+6" -> "6"; "40K" -> "40k"
function norm(n: string): string {
  let v = n.replace(/[+\-−±%\s]/g, "").toLowerCase();
  v = /,\d{3}(?!\d)/.test(v) ? v.replace(/,/g, "") : v.replace(",", ".");
  return v.replace(/\.0+$/, "");
}

function perfNumbers(sentence: string): string[] {
  const s = stripNoise(sentence);
  if (COMMERCIAL.test(s)) return [];
  const out = new Set<string>();
  for (const re of PERF_PATTERNS) for (const m of s.matchAll(re)) out.add(norm(m[1]));
  if (IMPROVEMENT.test(s)) for (const m of s.matchAll(TIME_AMOUNT)) out.add(norm(m[1]));
  return [...out].filter(Boolean);
}

const comparisonWords = (s: string) => [...new Set([...s.matchAll(COMPARISON)].map((m) => m[0].toLowerCase().replace(/\.$/, "")))];

// Every number worth protecting: decimals, 2+ digits, or 40k / 1.8M.
function significantNumbers(s: string): string[] {
  const out = new Set<string>();
  for (const m of stripNoise(s).matchAll(/\d+(?:[.,]\d+)*[kKmM]?/g)) {
    const raw = m[0];
    if (/[.,]\d|[kKmM]$/.test(raw) || raw.replace(/\D/g, "").length >= 2) out.add(norm(raw));
  }
  return [...out];
}

const allNumbers = (s: string) => new Set([...s.matchAll(/\d+(?:[.,]\d+)*[kKmM]?/g)].map((m) => norm(m[0])));
const sentences = (s: string) => s.split(/(?<=[.;!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
const quote = (xs: string[]) => xs.map((x) => `“${x}”`).join(", ");

export type ApprovedClaim = { text: string; numbers: Set<string> };

export function approvedClaims(answers: Answers): ApprovedClaim[] {
  const rows = Array.isArray(answers.e_claims) ? (answers.e_claims as string[][]) : [];
  return rows
    .filter((r) => r[CLAIM]?.trim() && r[EVIDENCE]?.trim() && r[APPROVED_BY]?.trim())
    .map((r) => ({ text: r[CLAIM].toLowerCase(), numbers: allNumbers(r[CLAIM]) }));
}

function covered(numbers: string[], words: string[], claims: ApprovedClaim[]): boolean {
  return claims.some((c) => numbers.every((n) => c.numbers.has(n)) && words.every((w) => c.text.includes(w)));
}

// Table cells that hold values: skips labels (B4 Metric), dates and dropdowns (Scale).
function valueCells(f: Field, answers: Answers): string[] {
  if (f.kind !== "table" || !Array.isArray(answers[f.key])) return [];
  const skip = new Set(f.columns.map((c, i) => (c.type === "date" || c.type === "select" || (f.key === "b4_metrics" && i === B4.metric) ? i : -1)));
  return (answers[f.key] as string[][]).flatMap((row) => row.filter((_, i) => !skip.has(i)));
}

const textOf = (answers: Answers, key: string) => (typeof answers[key] === "string" ? (answers[key] as string) : "");

// A measured spec with numbers must say what it was measured under.
const CONDITIONS = /\b(measured|under|load|concurren\w*|batch|GPU|CPU|hardware|instance|region|document type|documents? of|test set|benchmark|on\s+(?:a|an|our|the)\s+\w+)\b/i;

// Text in B3 about thin or weak coverage belongs in B5.
export const THIN = /\b(thin|weak(?:er|ness)?|limited|sparse|gaps?|poor(?:er)?|lacks?|lacking|not covered|under-?represented)\b/i;
export const thinSentences = (s: string) => sentences(s).filter((x) => THIN.test(x));

// LLM-only content that doesn't belong in an MT model's Error modes.
export const LLM_ONLY = /\b(hallucinat\w*|toxic\w*|prompt[- ]injection)\b/i;
export const llmSentences = (s: string) => s.split(/(?<=[.;!?])\s+|\n+/).map((x) => x.trim()).filter((x) => x && LLM_ONLY.test(x));

// Evidence references like "B4 Results row 3", "C1 Terminology", "A9 Request process".
const SECTION_LABELS = new Map<string, string[]>();
for (const part of [...FACTORY_PARTS, ...MODEL_PARTS]) for (const s of part.sections) SECTION_LABELS.set(s.id, s.fields.map((f) => f.label.toLowerCase()));

export function brokenReferences(evidence: string, b4Rows: number): string[] {
  const broken: string[] = [];
  for (const m of evidence.matchAll(/\b([A-E]\d)\s+([A-Z][A-Za-z&'’/ -]*?)(?=\s*(?:row\s+\d+|[:,;+()]|$))(?:\s*row\s+(\d+))?/g)) {
    const [whole, section, rawLabel, row] = m;
    const labels = SECTION_LABELS.get(section);
    const label = rawLabel.trim().toLowerCase();
    if (!labels) {
      broken.push(whole.trim());
      continue;
    }
    const known = labels.some((l) => l === label || l.startsWith(label) || label.startsWith(l));
    if (!known) broken.push(whole.trim());
    else if (row && section === "B4" && (Number(row) < 1 || Number(row) > b4Rows)) broken.push(`${whole.trim()} (B4 has ${b4Rows} row${b4Rows === 1 ? "" : "s"})`);
  }
  return broken;
}

// Model versions like v2, v2.1, V3.0.1 (lower-cased).
export const versionsIn = (s: string) => [...new Set([...s.matchAll(/\bv(\d+(?:\.\d+)*)\b/gi)].map((m) => `v${m[1]}`))];

// A sign-off stops counting if it predates a schema migration, or if the Rev it approved now has blocking issues.
export function isStale(signedAt: string, migratedAt: string | undefined, revHasBlocking: boolean): boolean {
  return revHasBlocking || Boolean(migratedAt && signedAt < migratedAt);
}

export function checkPack(input: CheckInput): Issue[] {
  const { kind, modelTypes, answers } = input;
  const na = input.na ?? {};
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const fields = fieldsFor(kind, modelTypes);
  const issues: Issue[] = [];
  const claims = approvedClaims(answers);

  // 1. Required fields: answered, or N/A with a reason.
  for (const f of fields) {
    if (!f.required || isDone(f, answers, na)) continue;
    const short = na[f.key]?.trim() && !isNA(f, na);
    issues.push({
      key: f.key,
      kind: "required",
      blocking: true,
      message: short
        ? "Required: the N/A reason must be at least 10 characters."
        : f.key === "e_claims"
          ? "Required: add at least one claim."
          : "Required: answer this, or mark it N/A with a reason.",
    });
  }
  if (kind === "factory") return issues;

  // Numbers held in NDA and Internal fields, with where each one lives.
  const secret = new Map<string, string>();
  for (const f of fields) {
    if (f.tag === "P" || isNA(f, na)) continue;
    const values = f.kind === "text" ? [textOf(answers, f.key)] : valueCells(f, answers);
    for (const v of values) for (const n of significantNumbers(v)) if (!secret.has(n)) secret.set(n, `${sectionOf(f.key)} ${f.label} (${f.tag === "N" ? "Under NDA" : "Internal"})`);
  }

  // 2 + 3. Public text fields: unregistered claims and visibility conflicts.
  for (const f of fields as Field[]) {
    if (f.tag !== "P" || f.kind !== "text" || isNA(f, na)) continue;
    const text = textOf(answers, f.key);
    if (!text.trim()) continue;
    const unregistered: string[] = [];
    const conflicts = new Map<string, string[]>();
    for (const s of sentences(text)) {
      const nums = perfNumbers(s);
      const words = comparisonWords(s);
      if ((nums.length || words.length) && !covered(nums, words, claims)) unregistered.push(s);
      for (const n of significantNumbers(s)) {
        const src = secret.get(n);
        if (!src || claims.some((c) => c.numbers.has(n))) continue;
        conflicts.set(src, [...(conflicts.get(src) ?? []), n]);
      }
    }
    if (unregistered.length) {
      issues.push({
        key: f.key,
        kind: "claim",
        blocking: true,
        action: "create_claim",
        text: unregistered.join(" "),
        message: `Unregistered public claim: ${quote(unregistered)} doesn't match an approved claim in Part E (approved = has Evidence and Approved by).`,
      });
    }
    for (const [src, nums] of conflicts) {
      issues.push({
        key: f.key,
        kind: "visibility",
        blocking: true,
        message: `Visibility conflict: ${quote([...new Set(nums)])} also appear${nums.length === 1 ? "s" : ""} in ${src}. Remove it here, or cover it with an approved claim.`,
      });
    }
  }

  // 4. Expired metrics in B4.
  const b4 = Array.isArray(answers.b4_metrics) ? (answers.b4_metrics as string[][]) : [];
  const expired = b4.filter((r) => r[B4.revalidate] && r[B4.revalidate] < today && r[B4.metric]?.trim());
  if (expired.length) {
    issues.push({
      key: "b4_metrics",
      kind: "expired",
      blocking: true,
      message: `Expired metric: ${expired.map((r) => `“${r[B4.metric]}” (re-validate by ${r[B4.revalidate]})`).join(", ")}. Re-measure it or remove the row.`,
    });
  }

  // 5. Evidence that cites a field or B4 row that doesn't exist.
  const claimRows = Array.isArray(answers.e_claims) ? (answers.e_claims as string[][]) : [];
  const broken = claimRows
    .filter((r) => r[CLAIM]?.trim() && r[EVIDENCE]?.trim())
    .flatMap((r) => brokenReferences(r[EVIDENCE], b4.filter((x) => x.some((c) => c?.trim())).length).map((ref) => `“${r[CLAIM]}” cites ${ref}`));
  if (broken.length) {
    issues.push({
      key: "e_claims",
      kind: "evidence",
      blocking: true,
      message: `Broken evidence reference: ${broken.join("; ")}. Point it at a field that exists (e.g. “B4 Results row 3”).`,
    });
  }

  // 5b. A claim's "Model or factory" must name the same model version as B1.
  const b1Versions = versionsIn(textOf(answers, "b1_name_version"));
  const mismatched = claimRows.filter((r) => {
    const model = r[MODEL] ?? "";
    if (!r[CLAIM]?.trim() || /\bfactory\b/i.test(model)) return false;
    const v = versionsIn(model);
    return v.length > 0 && b1Versions.length > 0 && !v.every((x) => b1Versions.includes(x));
  });
  if (mismatched.length) {
    issues.push({
      key: "e_claims",
      kind: "model",
      blocking: true,
      message: `Model mismatch: ${mismatched
        .map((r) => `“${r[CLAIM]}” is for “${r[MODEL]}” (${versionsIn(r[MODEL]).join(", ")})`)
        .join("; ")}, but B1 says ${b1Versions.join(", ")}. Fix “Model or factory”, or mark the claim as factory-wide.`,
    });
  }

  // 6. Measured specs must name their conditions.
  for (const f of fields) {
    if (!f.measured || f.kind !== "text" || isNA(f, na)) continue;
    const text = textOf(answers, f.key);
    if (/\d/.test(stripNoise(text)) && !CONDITIONS.test(text)) {
      issues.push({
        key: f.key,
        kind: "spec",
        blocking: true,
        message: "Spec without measurement conditions: say what these numbers were measured under (hardware, load, document type or test set).",
      });
    }
  }

  // 7. B3 text about thin areas belongs in B5 (review flag, not blocking).
  const thin = thinSentences(textOf(answers, "b3_domains"));
  if (thin.length && !isNA(fields.find((f) => f.key === "b3_domains") ?? ({ key: "b3_domains" } as Field), na)) {
    issues.push({
      key: "b3_domains",
      kind: "placement",
      blocking: false,
      action: "move_to_b5",
      text: thin.join(" "),
      message: `Weakness text belongs in B5: ${quote(thin)}.`,
    });
  }

  // 8. MT models: LLM-only content in Error modes (review flag, not blocking).
  if (!modelTypes.includes("llm")) {
    const llm = llmSentences(textOf(answers, "b5_error_modes"));
    if (llm.length) {
      issues.push({
        key: "b5_error_modes",
        kind: "llm",
        blocking: false,
        action: "remove_llm",
        text: llm.join("\n"),
        message: `LLM-only content in an MT model: ${quote(llm)}.`,
      });
    }
  }

  // 9. Scale mismatch: COMET/chrF on 0–1 in B4, integer deltas in C4 uplift (warning).
  const zeroOne = b4.filter((r) => /COMET|chrF/i.test(r[B4.metric] ?? "") && r[B4.scale] === "0–1").map((r) => r[B4.metric]);
  const uplift = textOf(answers, "c4_uplift");
  if (modelTypes.includes("customer_trained") && zeroOne.length && /[+±]\s?\d+(?![.,]\d)/.test(uplift) && !/points|×\s?100|x\s?100/i.test(uplift)) {
    issues.push({
      key: "c4_uplift",
      kind: "scale",
      blocking: false,
      message: `Scale mismatch: B4 reports ${[...new Set(zeroOne)].join(", ")} on a 0–1 scale, so deltas must be on the same scale (“+0.03”, not “+3”) or labelled “points (×100)”.`,
    });
  }

  // 10. One sellable product per pack.
  if (modelTypes.includes("custom_mt") && modelTypes.includes("customer_trained") && (input.splitOverride?.reason?.trim().length ?? 0) < SPLIT_REASON_MIN) {
    issues.push({
      key: PACK_KEY,
      kind: "split",
      blocking: true,
      message: `This pack covers a shared model and a customer-trained build. Split it unless both are sold under one SKU (then keep it as one pack with a reason of at least ${SPLIT_REASON_MIN} characters).`,
    });
  }

  return issues;
}

export const blocking = (issues: Issue[]) => issues.filter((i) => i.blocking);

export const ISSUE_TITLE: Record<IssueKind, string> = {
  required: "Missing required fields",
  claim: "Unregistered public claims",
  visibility: "Visibility conflicts",
  expired: "Expired metrics",
  evidence: "Broken evidence references",
  model: "Claims for a different model version",
  spec: "Specs without measurement conditions",
  split: "Pack covers two products",
  scale: "Scale warnings",
  placement: "Text in the wrong field",
  llm: "LLM-only content in an MT model",
};
