// Rule tests for lib/checks.ts. Run: npx tsx scripts/checks.test.ts
import assert from "node:assert/strict";
import sample from "./sample-v1.json";
import { backfillPairs, gaOrBetaPairs, migrateAnswers, repointEvidence, reviewTargets, stripFromLabels } from "../lib/migrate";
import { brokenReferences, checkPack, isStale, versionsIn, type CheckInput } from "../lib/checks";
import { sourceLabel } from "../lib/fields";

const types = ["custom_mt", "customer_trained"];
const base = backfillPairs(repointEvidence(migrateAnswers(sample as never).answers).answers).answers;
const run = (patch: Partial<CheckInput> = {}, answers = base) =>
  checkPack({ kind: "model", modelTypes: types, answers, today: "2026-09-27", ...patch });
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
  assert.deepEqual(kinds(i, "_pack"), ["split"]);
  assert.deepEqual(kinds(i, "b6_latency"), ["spec"]);
  assert.deepEqual(kinds(i, "b3_domains"), ["placement"]);
  assert.deepEqual(kinds(i, "b5_error_modes"), ["llm"]);
  assert.deepEqual(kinds(i, "e_claims"), ["model"]);
  assert.equal(i.length, 14);
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
  assert.deepEqual(kinds(run({ splitOverride: { reason: "Sold as one SKU with an optional build" } }), "_pack"), []);
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
  const all = JSON.stringify(m.answers) + JSON.stringify(m.notes);
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
  assert.deepEqual(kinds(run({ splitOverride: { reason: "One SKU" } }), "_pack"), ["split"]);
  assert.deepEqual(kinds(run({ splitOverride: { reason: "Sold under one SKU with an optional build fee" } }), "_pack"), []);
});

console.log(`\n${passed} passed`);
