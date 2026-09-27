import { SCHEMA_VERSION, type Answers } from "./fields";

// Schema v1 -> v2. Runs when a pack is read. Nothing answered is dropped:
// merged fields are joined with a "From <old field>:" label per source, and
// text from removed fields is kept in migrationNotes for the model team.

type Merge = { to: string; from: { key: string; label: string }[] };

// Old fields that move to a new key, alone or joined with others.
export const MERGES: Merge[] = [
  { to: "b2_oversight_assurance", from: [{ key: "b2_oversight", label: "Required oversight" }, { key: "b7_assurance", label: "Assurance levels" }] },
  { to: "b7_how_used", from: [{ key: "b7_where", label: "Where it appears" }] },
  { to: "b7_routing_note", from: [{ key: "b7_routing", label: "Routing" }] },
  { to: "b5_error_modes", from: [{ key: "b5_errors", label: "Typical errors" }, { key: "b5_safety", label: "Safety risks" }] },
  { to: "d3_onboarding_ctm", from: [{ key: "c4_onboarding", label: "C4 Onboarding steps" }] },
  {
    to: "d1_packaging",
    from: [
      { key: "d1_how_sold", label: "How it's sold" },
      { key: "d1_pricing", label: "Pricing basis" },
      { key: "d1_credits", label: "Credit mapping" },
    ],
  },
  { to: "d3_deliverables", from: [{ key: "d3_deliverables", label: "What customers get" }, { key: "d3_reporting", label: "Ongoing reporting" }] },
];

// Old fields with no field of their own in v2. Their text is kept as a note.
export const REMOVED: { key: string; label: string; moveTo: string }[] = [
  { key: "c1_quality_by_pair", label: "C1 Quality by pair", moveTo: "Move these numbers into B4 Results (one row per pair)." },
  { key: "c1_post_edit", label: "C1 Post-edit effort", moveTo: "Move these numbers into B4 Results." },
  { key: "d3_request", label: "D3 Request process", moveTo: "Now a factory-wide setting (Part A, A9). Copy it there if it isn't already." },
];

// Kept in place but reworded: flag so someone checks the answer still fits.
const REWORDED: { key: string; note: string }[] = [
  { key: "b3_domains", note: "B3 Domains and languages covered: move any 'where it is thin' text to B5 Known weaknesses and gaps." },
];

const OLD_B4 = ["Metric", "Test set (name, size, domain)", "This model", "Previous version", "Generic baseline", "Comparator (name + score)", "Date measured"];
const OLD_CLAIMS_COLS = 6;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "12 Sep 2026" / "2026-09-12" -> "2026-09-12"; anything else -> "" (kept in notes).
export function toIsoDate(s: string): string {
  const v = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/);
  if (!m) return "";
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return "";
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function plusSixMonths(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + 6, d));
  return date.toISOString().slice(0, 10);
}

// Scale from the metric name and values: minutes / % / 0–1 / 0–100.
function inferScale(metric: string, values: string[]): string {
  if (/minute/i.test(metric)) return "minutes";
  if (values.some((v) => v.includes("%"))) return "%";
  const nums = values.map((v) => parseFloat(v.replace(",", "."))).filter((n) => !Number.isNaN(n));
  if (!nums.length) return "";
  return nums.every((n) => n <= 1) ? "0–1" : "0–100";
}

function join(parts: { label: string; text: string }[]): string {
  const filled = parts.filter((p) => p.text.trim());
  if (filled.length <= 1) return filled[0]?.text ?? "";
  return filled.map((p) => `From ${p.label}: ${p.text.trim()}`).join("\n\n");
}

export type Migrated = { answers: Answers; notes: string[]; changed: boolean };

export function migrateAnswers(old: Answers): Migrated {
  const a: Answers = { ...old };
  const notes: string[] = [];
  let changed = false;
  const text = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");

  for (const m of MERGES) {
    const sources = m.from.map((f) => ({ label: f.label, text: text(f.key) }));
    const joined = join(sources);
    const existing = m.from.some((f) => f.key === m.to) ? "" : text(m.to);
    for (const f of m.from) if (f.key !== m.to) delete a[f.key];
    if (joined) {
      a[m.to] = existing ? `${existing}\n\n${joined}` : joined;
      if (sources.filter((s) => s.text.trim()).length > 1 || m.from[0].key !== m.to) changed = true;
    }
  }

  for (const r of REMOVED) {
    const v = text(r.key);
    delete a[r.key];
    if (v.trim()) {
      notes.push(`${r.label} (removed): "${v.trim()}". ${r.moveTo}`);
      changed = true;
    }
  }

  for (const r of REWORDED) if (text(r.key).trim()) notes.push(r.note);

  // B4: add Language pair / Scope, Scale and Re-validate by; dates become ISO.
  const b4 = a.b4_metrics;
  if (Array.isArray(b4) && b4.length && b4[0].length === OLD_B4.length) {
    a.b4_metrics = b4.map((row) => {
      const [metric, testSet, thisModel, prev, generic, comparator, measured] = row;
      const iso = toIsoDate(measured ?? "");
      if (measured?.trim() && !iso) notes.push(`B4 Results "${metric}": couldn't read the date "${measured}". Re-enter it.`);
      const scale = metric?.trim() ? inferScale(metric, [thisModel, prev, generic]) : "";
      return [metric, "", testSet, scale, thisModel, prev, generic, comparator, iso, plusSixMonths(iso)];
    });
    if (b4.some((r) => r.some((c) => c?.trim()))) {
      notes.push("B4 Results: new columns added. Fill in Language pair / Scope, and confirm the Scale inferred from the values.");
      changed = true;
    }
  }

  // Claims register: add the Source field column.
  const claims = a.e_claims;
  if (Array.isArray(claims) && claims.length && claims[0].length === OLD_CLAIMS_COLS) {
    a.e_claims = claims.map((row) => [...row, ""]);
  }

  return { answers: a, notes, changed };
}

export const needsMigration = (schemaVersion?: number) => (schemaVersion ?? 1) < SCHEMA_VERSION;

// Pack revisions (v1, v2) are now Rev 1, Rev 2 in the stored activity log.
export const renameRevs = (s: string) => s.replace(/\bv(\d+)\b/g, "Rev $1");

// ---------------------------------------------------------------------------
// Schema v3: evidence repointing, per-field review flags, B4 pair backfill.
// ---------------------------------------------------------------------------

const B4_METRIC = 0;
const B4_SCOPE = 1;
const CLAIM_EVIDENCE = 2;
const CLAIM_SOURCE = 6;

// Old field names that evidence may cite -> the reference that replaced them.
// "row" means: point at the B4 Results row that holds those numbers.
export const EVIDENCE_REPOINTS: { from: RegExp; to: string | { b4RowMatching: RegExp }; key: string }[] = [
  { from: /\bC1\s+Post-edit effort\b/gi, to: { b4RowMatching: /minute|post-?edit/i }, key: "b4_metrics" },
  { from: /\bC1\s+Quality by pair\b/gi, to: { b4RowMatching: /COMET|chrF|BLEU/i }, key: "b4_metrics" },
  { from: /\bD3\s+Request process\b/gi, to: "A9 Request process", key: "a9_request_process" },
  { from: /\bB2\s+Required oversight\b/gi, to: "B2 Oversight and assurance", key: "b2_oversight_assurance" },
  { from: /\bB7\s+Assurance levels\b/gi, to: "B2 Oversight and assurance", key: "b2_oversight_assurance" },
  { from: /\bB7\s+Where it appears\b/gi, to: "B7 How arbitr uses it", key: "b7_how_used" },
  { from: /\bB7\s+Routing\b(?!\s+logic)/gi, to: "B7 Routing logic", key: "b7_routing_note" },
  { from: /\bB5\s+(?:Typical errors|Safety risks)\b/gi, to: "B5 Error modes", key: "b5_error_modes" },
  { from: /\bD1\s+(?:How it's sold|Pricing basis|Credit mapping)\b/gi, to: "D1 Packaging & pricing", key: "d1_packaging" },
  { from: /\bD3\s+(?:What customers get|Ongoing reporting)\b/gi, to: "D3 Deliverables and reporting", key: "d3_deliverables" },
  { from: /\bC4\s+Onboarding steps\b/gi, to: "D3 Customer-trained build", key: "d3_onboarding_ctm" },
  { from: /\bB3\s+Domains and languages\b(?!\s+covered)/gi, to: "B3 Domains and languages covered", key: "b3_domains" },
  { from: /\bB5\s+Known weaknesses\b(?!\s+and gaps)/gi, to: "B5 Known weaknesses and gaps", key: "b5_weaknesses" },
];

export type Repoint = { claim: string; from: string; to: string };

// Rewrites old field names in claims Evidence, and fills an empty Source field.
export function repointEvidence(answers: Answers): { answers: Answers; repoints: Repoint[] } {
  const claims = Array.isArray(answers.e_claims) ? (answers.e_claims as string[][]) : [];
  const b4 = Array.isArray(answers.b4_metrics) ? (answers.b4_metrics as string[][]) : [];
  const repoints: Repoint[] = [];
  const next = claims.map((row) => {
    let evidence = row[CLAIM_EVIDENCE] ?? "";
    let source = row[CLAIM_SOURCE] ?? "";
    for (const r of EVIDENCE_REPOINTS) {
      evidence = evidence.replace(r.from, (match) => {
        let to: string;
        if (typeof r.to === "string") to = r.to;
        else {
          const pattern = r.to.b4RowMatching;
          const i = b4.findIndex((x) => pattern.test(x[B4_METRIC] ?? ""));
          to = i >= 0 ? `B4 Results row ${i + 1}` : "B4 Results";
        }
        repoints.push({ claim: row[0] ?? "", from: match, to });
        if (!source) source = r.key;
        return to;
      });
    }
    // "B4 row 3" -> "B4 Results row 3", then drop repeated references ("X + X: detail" -> "X: detail").
    evidence = evidence.replace(/\bB4\s+row\s+(\d+)/gi, "B4 Results row $1");
    const parts = evidence.split(/\s*\+\s*(?=[A-E]\d)/);
    const ref = (p: string) => p.split(":")[0].trim().toLowerCase();
    evidence = parts
      .filter((p, i) => !parts.some((q, j) => j !== i && ref(q) === ref(p) && (q.length > p.length || (q.length === p.length && j < i))))
      .join(" + ");
    const out = [...row];
    while (out.length <= CLAIM_SOURCE) out.push("");
    out[CLAIM_EVIDENCE] = evidence;
    out[CLAIM_SOURCE] = source;
    return out;
  });
  return { answers: claims.length ? { ...answers, e_claims: next } : answers, repoints };
}

// Fields that received merged or moved content in the v1 -> v2 migration.
export function reviewTargets(answers: Answers): string[] {
  const filled = (k: string) =>
    typeof answers[k] === "string" ? (answers[k] as string).trim().length > 0 : Array.isArray(answers[k]) && (answers[k] as string[][]).some((r) => r.some((c) => c?.trim()));
  const keys = new Set<string>();
  for (const m of MERGES) {
    const movedIn = m.from.some((f) => f.key !== m.to);
    const merged = typeof answers[m.to] === "string" && /^From [^:\n]+:/m.test(answers[m.to] as string);
    if (filled(m.to) && (movedIn || merged)) keys.add(m.to);
  }
  for (const r of REWORDED) if (filled(r.key)) keys.add(r.key);
  if (filled("b4_metrics")) keys.add("b4_metrics");
  return [...keys];
}

// "EN→DE (Beta, GA 3 Nov), EN→FR (Research)" -> ["EN→DE"]
export function gaOrBetaPairs(c1Pairs: string): string[] {
  const out: string[] = [];
  for (const m of c1Pairs.matchAll(/([A-Za-z]{2,3}(?:-[A-Za-z]{2})?\s*(?:→|->|>)\s*[A-Za-z]{2,3}(?:-[A-Za-z]{2})?)\s*\(([^)]*)\)/g)) {
    if (/\b(GA|Beta)\b/i.test(m[2])) out.push(m[1].replace(/\s*(?:->|>)\s*/, "→").replace(/\s+/g, ""));
  }
  return [...new Set(out)];
}

// Fills empty B4 "Language pair / Scope" cells when C1 has exactly one GA/Beta pair.
export function backfillPairs(answers: Answers): { answers: Answers; cells: string[] } {
  const pairs = gaOrBetaPairs(typeof answers.c1_pairs === "string" ? answers.c1_pairs : "");
  const b4 = Array.isArray(answers.b4_metrics) ? (answers.b4_metrics as string[][]) : [];
  if (pairs.length !== 1 || !b4.length) return { answers, cells: [] };
  const cells: string[] = [];
  const next = b4.map((row, r) => {
    if (!row[B4_METRIC]?.trim() || row[B4_SCOPE]?.trim()) return row;
    cells.push(`b4_metrics:${r}:${B4_SCOPE}`);
    const out = [...row];
    out[B4_SCOPE] = pairs[0];
    return out;
  });
  return { answers: { ...answers, b4_metrics: next }, cells };
}

// Removes the "From <old field>:" labels a merge added.
export const stripFromLabels = (s: string) => s.replace(/^From [^:\n]+:\s*/gm, "").replace(/\n{3,}/g, "\n\n").trim();
