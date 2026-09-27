import { cardMarkdown, publicCard } from "./card";
import { checkPack } from "./checks";
import { typeLabels } from "./fields";
import { revEffective } from "./inherit";
import { FACTORY_ID, getPack, type Pack } from "./store";

// Everything the public view, Markdown copy and PDF page need, from the latest published Rev.
export async function publicData(pack: Pack) {
  const v = pack.versions.find((x) => x.version === pack.version);
  if (!v) return null;
  const factory = pack.kind === "model" ? (await getPack(FACTORY_ID))?.pack.answers ?? {} : {};
  const answers = pack.kind === "model" ? revEffective(v, factory) : v.answers;
  const issues = checkPack({ kind: pack.kind, modelTypes: v.modelTypes, answers, na: v.na, splitOverride: v.splitOverride, name: v.name });
  const sections = publicCard({ kind: pack.kind, modelTypes: v.modelTypes, answers, na: v.na, issues });
  const external = typeof answers.b1_external_name === "string" && answers.b1_external_name.trim() ? answers.b1_external_name.trim() : v.name;
  const subtitle = pack.kind === "model" ? `${typeLabels(v.modelTypes, v.otherType)} · Rev ${v.version}` : `Factory fact sheet · Rev ${v.version}`;
  return { version: v.version, title: external, subtitle, sections, markdown: cardMarkdown(external, subtitle, sections), ready: pack.status === "launch_ready" };
}
