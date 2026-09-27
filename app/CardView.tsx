import type { CardSection } from "../lib/card";

// Renders the public model card (shared by the Public-only view and the PDF page).
export default function CardView({ sections }: { sections: CardSection[] }) {
  if (!sections.length) return <p className="gap">Nothing public to show yet.</p>;
  return (
    <>
      {sections.map((s) => (
        <section key={s.title} className="section">
          <h3>{s.title}</h3>
          {s.items.map((i, n) => (
            <div key={n} className="review-field">
              <div className="field-label">{i.label}</div>
              {i.kind === "pending" && <p className="pending">Pending approval</p>}
              {i.kind === "text" && <p className="answer">{i.text}</p>}
              {i.kind === "claims" && (
                <ul className="claims-list">
                  {i.claims.map((c) => <li key={c}>{c}</li>)}
                </ul>
              )}
              {i.kind === "table" && (
                <div className="table-wrap">
                  <table>
                    <thead><tr>{i.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>{i.rows.map((r, k) => <tr key={k}>{i.columns.map((_, j) => <td key={j}>{r[j] || "—"}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
