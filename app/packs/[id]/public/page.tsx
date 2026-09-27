import Link from "next/link";
import { notFound } from "next/navigation";
import { isAnswered, partsFor, sourceLabel, type Answers } from "../../../../lib/fields";
import { requireName } from "../../../../lib/session";
import { getPack } from "../../../../lib/store";
import Header, { StatusPill } from "../../../Header";

// Only fields tagged P (Public), from the latest published version.
// This is what Marketing can reuse on the website, one-pagers and Sage.
export default async function PublicView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const name = await requireName();
  const found = await getPack(id);
  if (!found) notFound();
  const { pack } = found;
  const ver = pack.versions.find((x) => x.version === pack.version);
  const answers = (ver?.answers ?? {}) as Answers;
  const parts = partsFor(pack.kind, ver?.modelTypes ?? []);
  const ready = pack.status === "launch_ready";

  return (
    <div className="shell">
      <Header name={name} />
      <main className="page">
        <p className="crumb"><Link href={`/packs/${id}`}>← Back to review view</Link></p>
        <h1>{pack.name} <StatusPill status={pack.status} /></h1>
        <p className="muted">Public-only view: fields tagged P · Public from Rev {pack.version || "—"}. NDA and Internal fields are left out.</p>
        {!ready && (
          <p className="warn-box">
            <strong>Not approved for external use yet.</strong> This pack isn&apos;t launch-ready, so nothing here should go on the website, a one-pager or Sage.
          </p>
        )}
        {!ver && <p className="gap">Nothing published yet.</p>}
        {ver &&
          parts.map((part) => {
            const sections = part.sections
              .map((s) => ({ ...s, fields: s.fields.filter((f) => f.tag === "P" && isAnswered(f, answers)) }))
              .filter((s) => s.fields.length);
            if (!sections.length) return null;
            return (
              <section key={part.id}>
                <h2>{part.title}</h2>
                {sections.map((s) => (
                  <div key={s.id} className="section">
                    <h3>{s.title}</h3>
                    {s.fields.map((f) => (
                      <div key={f.key} className="review-field">
                        <div className="field-label">{f.label}</div>
                        {f.kind === "text" ? (
                          <p className="answer">{answers[f.key] as string}</p>
                        ) : (
                          <div className="table-wrap">
                            <table>
                              <thead><tr>{f.columns.map((c) => <th key={c.name}>{c.name}</th>)}</tr></thead>
                              <tbody>
                                {(answers[f.key] as string[][])
                                  .filter((r) => r.slice(f.presetRows ? 1 : 0).some((c) => c.trim()))
                                  .map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{(f.columns[j]?.name === "Source field" && c ? sourceLabel(c) : c) || "—"}</td>)}</tr>)}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            );
          })}
      </main>
    </div>
  );
}
