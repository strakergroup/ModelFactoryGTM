import { fieldsFor, isDone, isNA, sectionOf, type Answers, type Field, type NA } from "./fields";

// The launch-ready checks. Pure functions: the editor runs them live in the
// browser, the review page shows them, and sign-off uses them to decide
// whether a pack can become Launch-ready.

export type IssueKind = "required" | "claim" | "visibility" | "expired" | "scale" | "split";
export type Issue = { key: string; kind: IssueKind; message: string; blocking: boolean; text?: string };

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
  /(\d+(?:[.,]\d+)?)\s*(?:minutes?|mins?|hours?|pts|points|×|x)(?![a-z])/gi,
];

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
  const out = new Set<string>();
  for (const re of PERF_PATTERNS) for (const m of s.matchAll(re)) out.add(norm(m[1]));
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

  // 5. Scale mismatch: COMET/chrF on 0–1 in B4, integer deltas in C4 uplift (warning).
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

  // 6. One sellable product per pack.
  if (modelTypes.includes("custom_mt") && modelTypes.includes("customer_trained") && !input.splitOverride?.reason?.trim()) {
    issues.push({
      key: PACK_KEY,
      kind: "split",
      blocking: true,
      message: "This pack covers a shared model and a customer-trained build. Split it unless both are sold under one SKU.",
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
  scale: "Scale warnings",
  split: "Pack covers two products",
};
