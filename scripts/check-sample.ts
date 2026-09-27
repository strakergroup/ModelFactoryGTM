// Runs the v2 migration and launch-ready checks on the SAMPLE pack's answers.
import sample from "./sample-v1.json";
import { backfillPairs, migrateAnswers, repointEvidence, reviewTargets } from "../lib/migrate";
import { checkPack } from "../lib/checks";
import { completion, completionText } from "../lib/fields";

const types = ["custom_mt", "customer_trained"];
const m = migrateAnswers(sample as never);
// Same order as lib/store.ts: v1 -> v2, then v3 (review flags, evidence, backfill).
const review = reviewTargets(m.answers);
const e = repointEvidence(m.answers);
const b = backfillPairs(e.answers);
m.answers = b.answers;
console.log("review fields:", review.join(", "));
console.log("repoints:", JSON.stringify(e.repoints));
console.log("backfilled cells:", b.cells.join(", "));
console.log("claim evidence now:", (m.answers.e_claims as string[][])[0][2], "| source:", (m.answers.e_claims as string[][])[0][6]);
console.log("changed:", m.changed);
console.log("notes:\n  " + m.notes.join("\n  "));
for (const k of ["b2_oversight_assurance", "b5_error_modes", "d1_packaging", "d3_deliverables", "b7_how_used", "b7_routing_note", "d3_onboarding_ctm"]) console.log(`\n[${k}]\n${m.answers[k]}`);
console.log("\nB4 row 1:", JSON.stringify((m.answers.b4_metrics as string[][])[0]));
console.log(completionText(completion("model", types, m.answers)));
for (const i of checkPack({ kind: "model", modelTypes: types, answers: m.answers, today: "2026-09-27" })) console.log(`${i.blocking ? "BLOCK" : "warn "} ${i.kind.padEnd(10)} ${i.key.padEnd(18)} ${i.message}`);
