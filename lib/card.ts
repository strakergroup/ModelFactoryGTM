import { blocking, claimsKeyFor, type Issue } from "./checks";
import { isAnswered, isNA, partsFor, type Answers, type NA, type TableField } from "./fields";
import { stripFromLabels } from "./migrate";

// The public model card: only Public (P) fields, never "From <field>:" labels,
// the claims register as claim wording only, and any field with a blocking
// flag shown as "Pending approval" without its text. Used by the Public-only
// view, "Copy as model card" (Markdown) and the print/PDF page.

export type CardItem =
  | { kind: "text"; label: string; text: string }
  | { kind: "table"; label: string; columns: string[]; rows: string[][] }
  | { kind: "claims"; label: string; claims: string[] }
  | { kind: "pending"; label: string };
export type CardSection = { title: string; items: CardItem[] };

export function publicCard(input: {
  kind: "factory" | "model";
  modelTypes: string[];
  answers: Answers;
  na?: NA;
  issues: Issue[];
}): CardSection[] {
  const blockedKeys = new Set(blocking(input.issues).map((i) => i.key));
  const claimsKey = claimsKeyFor(input.kind);
  const out: CardSection[] = [];
  for (const part of partsFor(input.kind, input.modelTypes)) {
    for (const s of part.sections) {
      const items: CardItem[] = [];
      for (const f of s.fields) {
        if (f.tag !== "P" || isNA(f, input.na) || !isAnswered(f, input.answers)) continue;
        if (blockedKeys.has(f.key)) {
          items.push({ kind: "pending", label: f.label });
          continue;
        }
        const v = input.answers[f.key];
        if (f.key === claimsKey) {
          const claims = (v as string[][]).map((r) => r[0]?.trim()).filter(Boolean);
          if (claims.length) items.push({ kind: "claims", label: f.label, claims });
        } else if (f.kind === "text") {
          items.push({ kind: "text", label: f.label, text: stripFromLabels(v as string) });
        } else {
          const t = f as TableField;
          const rows = (v as string[][]).filter((r) => r.slice(t.presetRows ? 1 : 0).some((c) => c?.trim()));
          items.push({ kind: "table", label: f.label, columns: t.columns.map((c) => c.name), rows });
        }
      }
      if (items.length) out.push({ title: s.title, items });
    }
  }
  return out;
}

const md = (s: string) => s.replace(/([\\`*_[\]#|])/g, "\\$1");

export function cardMarkdown(title: string, subtitle: string, sections: CardSection[]): string {
  const lines = [`# ${md(title)}`, "", `_${md(subtitle)}_`, ""];
  for (const s of sections) {
    lines.push(`## ${md(s.title)}`, "");
    for (const i of s.items) {
      if (i.kind === "pending") lines.push(`**${md(i.label)}:** Pending approval`, "");
      else if (i.kind === "text") lines.push(`**${md(i.label)}**`, "", ...i.text.split("\n").map(md), "");
      else if (i.kind === "claims") lines.push(`**${md(i.label)}**`, "", ...i.claims.map((c) => `- ${md(c)}`), "");
      else {
        lines.push(`**${md(i.label)}**`, "", `| ${i.columns.map(md).join(" | ")} |`, `| ${i.columns.map(() => "---").join(" | ")} |`);
        for (const r of i.rows) lines.push(`| ${i.columns.map((_, j) => md(r[j] ?? "")).join(" | ")} |`);
        lines.push("");
      }
    }
  }
  return lines.join("\n").trim() + "\n";
}
