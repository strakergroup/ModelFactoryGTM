// Rule tests for lib/checks.ts. Run: npx tsx scripts/checks.test.ts
import assert from "node:assert/strict";
import sample from "./sample-v1.json";
import { backfillPairs, differsFor, gaOrBetaPairs, migrateAnswers, repointEvidence, reviewTargets, splitB1, stripFromLabels } from "../lib/migrate";
import { effectiveAnswers, factorySig, inheritedValue, INHERITING } from "../lib/inherit";
import { brokenReferences, checkPack, isStale, noteResolved, versionsIn, type CheckInput } from "../lib/checks";
import { sourceLabel } from "../lib/fields";
import { cardMarkdown, publicCard } from "../lib/card";

const types = ["custom_mt", "customer_trained"];
// Same pipeline as lib/store.ts: v1 -> v2 -> v3 -> v5, then Part A inheritance (empty Part A here).
const migrated = splitB1(backfillPairs(repointEvidence(migrateAnswers(sample as never).answers).answers).answers).answers;
const inheriting = INHERITING().map((f) => f.key);
const differs = differsFor(migrated, inheriting);
const base = effectiveAnswers(migrated, differs, {});
const TITLE = "SAMPLE – Legal EN→DE engine v2";
const run = (patch: Partial<CheckInput> = {}, answers = base) =>
  checkPack({ kind: "model", modelTypes: types, answers, today: "2026-09-27", name: TITLE, ...patch });
const kinds = (issues: ReturnType<typeof run>, key: string) => issues.filter((i) => i.key === key).map((i) => i.kind).sort();
let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log("ok -", name); };

const headline = base.b4_headline as string;
const claimRow = (text: string, approved = true) => [text, "Legal EN→DE engine v2", approved ? "B4 row 3, pilot 19 Sep 2026" : "", "P", approved ? "Morgan" : "", "", "b4_headline"];

test("sample flags exactly the expected issues", () => {
  const i = run();
  assert.deepEqual(kinds(i, "b4_headline"), ["claim", "visibility"]);
  for (const k of ["c1_terminology", "c1_tm", "c1_migration"]) assert.deepEqual(kinds(i, k), ["claim"]);
  assert.deepEqual(kinds(i, "c4_uplift"), ["claim", "scale"]);
  assert.deepEqual(kinds(i, "d1_margin"), ["required"]);
  assert.deepEqual(kinds(i, "b7_data_handling"), ["required"]);
  assert.deepEqual(kinds(i, "_pack"), ["split", "title"]);
  assert.deepEqual(kinds(i, "b6_latency"), ["spec"]);
  assert.deepEqual(kinds(i, "b3_domains"), ["placement"]);
  assert.deepEqual(kinds(i, "b5_error_modes"), ["llm"]);
  assert.deepEqual(kinds(i, "e_claims"), ["model"]);
  assert.deepEqual(kinds(i, "b1_internal_id"), ["naming"]);
  assert.equal(i.length, 16);
});

test("an approved claim clears the headline's claim and visibility flags", () => {
  const a = { ...base, e_claims: [...(base.e_claims as string[][]), claimRow(headline)] };
  assert.deepEqual(kinds(run({}, a), "b4_headline"), []);
});

test("a claim without Evidence or Approved by does not count", () => {
  const a = { ...base, e_claims: [claimRow(headline, false)] };
  assert.ok(kinds(run({}, a), "b4_headline").includes("claim"));
});

test("N/A needs a reason of 10+ characters", () => {
  assert.match(run({ na: { d1_margin: "n/a" } }).find((x) => x.key === "d1_margin")!.message, /at least 10/);
  assert.deepEqual(kinds(run({ na: { d1_margin: "Not priced yet: pilot only" } }), "d1_margin"), []);
});

test("an expired B4 row blocks", () => {
  const i = run({ today: "2027-04-01" });
  assert.ok(i.some((x) => x.kind === "expired" && x.blocking));
});

test("the two-product warning clears with an override reason", () => {
  assert.deepEqual(kinds(run({ splitOverride: { reason: "Sold as one SKU with an optional build" } }), "_pack"), ["title"]);
});

test("dates, versions, specs and TM '100% matches' are not claims", () => {
  const a = { ...base, b1_status: "Beta since 1 Sep 2026", b6_limits: "512 tokens per segment", c1_tm: "100% and fuzzy TM matches are reused" };
  const i = run({}, a);
  for (const k of ["b1_status", "b6_limits", "c1_tm"]) assert.deepEqual(kinds(i, k), []);
});

test("comparison words need a claim", () => {
  const a = { ...base, b1_one_line: "Faster than DeepL for legal German" };
  assert.deepEqual(kinds(run({}, a), "b1_one_line"), ["claim"]);
});

test("migration drops nothing: every old answer's text survives somewhere", () => {
  const m = migrateAnswers(sample as never);
  const all = JSON.stringify(m.answers) + JSON.stringify(m.notes) + JSON.stringify(migrated);
  for (const [k, v] of Object.entries(sample)) {
    if (typeof v === "string") assert.ok(all.includes(JSON.stringify(v).slice(1, -1)), `lost ${k}`);
  }
});

test("evidence citing a removed field is repointed to its replacement", () => {
  const claims = base.e_claims as string[][];
  assert.equal(claims[0][2], "B4 Results row 3: pilot, 3 legal linguists, 40k words, 19 Sep 2026");
  assert.equal(claims[0][6], "b4_metrics#3");
  assert.equal(sourceLabel(claims[0][6]), "B4 Results row 3");
});

test("unknown fields and missing B4 rows are broken references", () => {
  assert.deepEqual(brokenReferences("B4 Results row 3 + C1 Terminology", 3), []);
  assert.equal(brokenReferences("C1 Post-edit effort", 3).length, 1);
  assert.equal(brokenReferences("B4 Results row 7", 3).length, 1);
  const a = { ...base, e_claims: [["Claim", "", "C1 Quality by pair: EN→DE", "P", "Morgan", "", ""]] };
  assert.deepEqual(kinds(run({}, a), "e_claims"), ["evidence"]);
});

test("sign-offs before the migration, or on a Rev with blocking issues, are stale", () => {
  assert.equal(isStale("2026-09-27T10:55:00Z", "2026-09-27T11:19:00Z", false), true);
  assert.equal(isStale("2026-09-27T12:00:00Z", "2026-09-27T11:19:00Z", true), true);
  assert.equal(isStale("2026-09-27T12:00:00Z", "2026-09-27T11:19:00Z", false), false);
});

test("migration review flags cover every merged or moved field", () => {
  const r = reviewTargets(migrateAnswers(sample as never).answers).sort();
  assert.deepEqual(r, ["b2_oversight_assurance", "b3_domains", "b4_metrics", "b5_error_modes", "b7_how_used", "b7_routing_note", "d1_packaging", "d3_deliverables", "d3_onboarding_ctm"]);
});

test("one GA/Beta pair in C1 backfills empty B4 language-pair cells", () => {
  assert.deepEqual(gaOrBetaPairs("EN→DE (Beta, GA 3 Nov), EN→FR (Research)"), ["EN→DE"]);
  assert.deepEqual(gaOrBetaPairs("EN→DE (GA), EN→FR (Beta)"), ["EN→DE", "EN→FR"]);
  assert.deepEqual((base.b4_metrics as string[][]).map((r) => r[1]), ["EN→DE", "EN→DE", "EN→DE"]);
});

test("'From <old field>:' labels are stripped", () => {
  assert.equal(stripFromLabels("From Typical errors: A\n\nFrom Safety risks: B"), "A\n\nB");
});

test("claim rule: commercial terms and timelines are exempt, improvements are not", () => {
  const a = { ...base, c4_time_to_model: "4–6 weeks from data receipt", d3_eval_offer: "Free 2-week bake-off on up to 50k words", c4_ownership: "Deleted within 30 days" };
  const i = run({}, a);
  for (const k of ["c4_time_to_model", "d3_eval_offer", "c4_ownership"]) assert.deepEqual(kinds(i, k), []);
  assert.deepEqual(kinds(run({}, { ...base, b1_one_line: "Cuts review time by 17 minutes per contract" }), "b1_one_line"), ["claim"]);
});

test("measured specs with conditions pass", () => {
  assert.deepEqual(kinds(run({}, { ...base, b6_latency: "Median 0.9s, p95 2.4s per 1,000 words, measured on one L4 GPU at 37 concurrent requests" }), "b6_latency"), []);
});

test("Source field shows the display label, never the key", () => {
  assert.equal(sourceLabel("b4_headline"), "B4 Headline result");
  assert.equal(sourceLabel("b4_metrics"), "B4 Results");
  assert.equal(sourceLabel("b4_metrics#2"), "B4 Results row 2");
});

test("a claim for a different model version blocks; matching or factory-wide claims pass", () => {
  assert.deepEqual(versionsIn("Legal EN→DE engine v2"), ["v2"]);
  assert.deepEqual(versionsIn("legal-en-de-v2.1 · external name"), ["v2.1"]);
  const row = (model: string) => [["Claim text", model, "B4 Results row 3", "P", "Morgan", "", ""]];
  assert.deepEqual(kinds(run({}, { ...base, e_claims: row("Legal EN→DE engine v2") }), "e_claims"), ["model"]);
  assert.deepEqual(kinds(run({}, { ...base, e_claims: row("legal-en-de-v2.1") }), "e_claims"), []);
  assert.deepEqual(kinds(run({}, { ...base, e_claims: row("Factory-wide") }), "e_claims"), []);
  assert.deepEqual(kinds(run({}, { ...base, e_claims: row("Legal German engine") }), "e_claims"), []);
});

test("keeping two products in one pack needs a 20+ character reason", () => {
  assert.deepEqual(kinds(run({ splitOverride: { reason: "One SKU" } }), "_pack"), ["split", "title"]);
  assert.deepEqual(kinds(run({ splitOverride: { reason: "Sold under one SKU with an optional build fee" } }), "_pack"), ["title"]);
});

test("B1 splits into Internal ID and External product name", () => {
  assert.equal(migrated.b1_internal_id, "legal-en-de-v2.1");
  assert.equal(migrated.b1_external_name, "arbitr Legal German");
  assert.equal(migrated.b1_name_version, undefined);
});

test("title version that doesn't match B1 is flagged, not blocking", () => {
  const t = run().find((i) => i.kind === "title")!;
  assert.equal(t.blocking, false);
  assert.deepEqual(kinds(run({ name: "SAMPLE – Legal EN→DE engine v2.1" }), "_pack"), ["split"]);
});

test("public text repeating NDA/Internal text is a visibility conflict", () => {
  const a = { ...base, b3_domains: "Contracts and privacy. Very long sentences of sixty words or more with Swiss legal terms", b5_weaknesses: "Very long sentences of sixty words or more with Swiss legal terms, nested defined terms" };
  const v = run({}, a).filter((i) => i.key === "b3_domains" && i.kind === "visibility");
  assert.equal(v.length, 1);
  assert.match(v[0].message, /B5 Known weaknesses and gaps \(Under NDA\)/);
});

test("answered inheriting fields keep their answer; empty ones inherit Part A", () => {
  assert.ok(differs.includes("c4_isolation") && differs.includes("b2_oversight_assurance"));
  assert.ok(!differs.includes("b7_data_handling"));
  const factory = { a5_residency: "EU (Frankfurt)", a6_hosting: "AWS eu-central-1, single-tenant option" };
  assert.equal(inheritedValue("b7_data_handling", factory), "Data residency: EU (Frankfurt)\nHosting: AWS eu-central-1, single-tenant option\nSub-processors: available under NDA (Part A, A5 Sub-processors).");
  const eff = effectiveAnswers(migrated, differs, factory);
  assert.deepEqual(kinds(run({}, eff), "b7_data_handling"), []);
});

test("a Part A change makes inheriting sign-offs stale", () => {
  const before = factorySig(differs, { a5_residency: "EU" });
  const after = factorySig(differs, { a5_residency: "EU and US" });
  assert.notEqual(before, after);
  assert.equal(factorySig(differs, { a1_team_name: "x" }), factorySig(differs, { a1_team_name: "y" })); // not inherited
  assert.equal(isStale("2026-09-28T10:00:00Z", undefined, false, before !== after), true);
});

test("Part A gets required, claim and visibility checks against its own claims register", () => {
  const f = checkPack({ kind: "factory", modelTypes: [], answers: { a1_differentiator: "We are 30% faster than DeepL", a4_release_gate: "COMET must beat 0.84" , a4_reeval: "Quarterly, release gate COMET must beat 0.84 on held-out set" } });
  assert.ok(f.some((i) => i.key === "a1_differentiator" && i.kind === "claim" && /A10 Factory claims register/.test(i.message)));
  assert.ok(f.some((i) => i.key === "a4_reeval" && i.kind === "visibility"));
  assert.ok(f.some((i) => i.key === "a9_request_process" && i.kind === "required"));
});

test("migration notes clear when their condition is met", () => {
  assert.equal(noteResolved("D3 Request process (removed): ...", base, { a9_request_process: "Rep requests…" }), true);
  assert.equal(noteResolved("D3 Request process (removed): ...", base, {}), false);
  assert.equal(noteResolved("B3 Domains and languages covered: move …", base, {}), false);
  assert.equal(noteResolved("B3 Domains and languages covered: move …", { ...base, b3_domains: "Contracts" }, {}), true);
  assert.equal(noteResolved("C1 Post-edit effort (removed): ...", base, {}), true);
});

test("public model card: Public only, pending for blocked fields, claim wording only, no merge labels", () => {
  const issues = run();
  const sections = publicCard({ kind: "model", modelTypes: types, answers: base, issues });
  const mdText = cardMarkdown("arbitr Legal German", "Custom Language Model · Rev 3", sections);
  assert.match(mdText, /\*\*Headline result:\*\* Pending approval/);
  assert.match(mdText, /\*\*Claims register:\*\* Pending approval/); // blocked by the model mismatch
  assert.doesNotMatch(mdText, /From [A-Z][^:]{2,40}:/);
  for (const secret of ["legal-en-de-v2.1", "ARB-MDL", "1.8M", "Morgan", "0.87"]) assert.ok(!mdText.includes(secret), secret);
  // With the claim fixed and approved, the register shows the claim wording only.
  const fixed = { ...base, e_claims: [["Cuts post-editing time by about 40%", "legal-en-de-v2.1", "B4 Results row 3", "P", "Morgan", "19 Mar 2027", "b4_metrics#3"]] };
  const card2 = cardMarkdown("x", "y", publicCard({ kind: "model", modelTypes: types, answers: fixed, issues: run({}, fixed) }));
  assert.match(card2, /- Cuts post-editing time by about 40%/);
  assert.ok(!card2.includes("B4 Results row 3") && !card2.includes("Morgan"));
});

test("model IDs follow Company-BaseName-Size-Variant/Tune-Version", () => {
  for (const ok of ["Arbitr-MF-5B-DE-Legal-Base-v1", "Arbitr-MF-5B-DE-Legal-Base-v2.1", "Arbitr-Orion-800M-Instruct-v1.5"]) {
    assert.deepEqual(kinds(run({ name: ok }, { ...base, b1_internal_id: ok, b1_external_name: "x v2.1" }), "b1_internal_id"), [], ok);
  }
  for (const bad of ["legal-en-de-v2.1", "arbitr-MF-5B-Base-v1", "Arbitr-MF-Base-v1", "Arbitr-MF-5B-Base", "Arbitr-MF-5G-Base-v1"]) {
    assert.deepEqual(kinds(run({}, { ...base, b1_internal_id: bad }), "b1_internal_id"), ["naming"], bad);
  }
  const t = run({ name: "Something else" }, { ...base, b1_internal_id: "Arbitr-MF-5B-DE-Legal-Base-v2.1" }).filter((i) => i.kind === "title");
  assert.ok(t.some((i) => /rename it to “Arbitr-MF-5B-DE-Legal-Base-v2.1”/.test(i.message)));
});

console.log(`\n${passed} passed`);
