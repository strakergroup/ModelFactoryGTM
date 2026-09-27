// Checks the example Part A and model pack against every rule before entering them in the app.
import factory from "./factory.json";
import model from "./model.json";
import { checkPack } from "../../lib/checks";
import { completion, completionText } from "../../lib/fields";
import { effectiveAnswers } from "../../lib/inherit";

const f = factory as never;
const fi = checkPack({ kind: "factory", modelTypes: [], answers: f });
console.log("Part A:", completionText(completion("factory", [], f)));
for (const i of fi) console.log(`  ${i.blocking ? "BLOCK" : "warn "} ${i.kind} ${i.key}: ${i.message}`);

const types = ["custom_mt"];
const eff = effectiveAnswers(model as never, [], f); // every inheriting field uses Part A
const mi = checkPack({ kind: "model", modelTypes: types, answers: eff, name: "arbitr Legal German v2.1", today: "2026-09-27" });
console.log("Model:", completionText(completion("model", types, eff)));
for (const i of mi) console.log(`  ${i.blocking ? "BLOCK" : "warn "} ${i.kind} ${i.key}: ${i.message}`);
console.log(fi.length + mi.length === 0 ? "\nCLEAN: no issues" : `\n${fi.length + mi.length} issue(s)`);
