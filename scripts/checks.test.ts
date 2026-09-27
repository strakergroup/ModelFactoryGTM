// Rule tests for lib/checks.ts. Run: npx tsx scripts/checks.test.ts
import assert from "node:assert/strict";
import sample from "./sample-v1.json";
import { migrateAnswers } from "../lib/migrate";
import { checkPack, type CheckInput } from "../lib/checks";

const types = ["custom_mt", "customer_trained"];
const base = migrateAnswers(sample as never).answers;
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
  assert.equal(i.length, 10);
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

console.log(`\n${passed} passed`);
