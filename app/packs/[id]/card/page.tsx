import { notFound } from "next/navigation";
import { publicData } from "../../../../lib/publicData";
import { requireName } from "../../../../lib/session";
import { getPack } from "../../../../lib/store";
import CardView from "../../../CardView";
import PrintOnLoad from "../../../PrintOnLoad";

// Print-ready model card; the browser's "Save as PDF" makes the PDF. Launch-ready packs only.
export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireName();
  const found = await getPack(id);
  if (!found) notFound();
  const data = await publicData(found.pack);
  if (!data || !data.ready) {
    return (
      <main className="page card-page">
        <p className="warn-box">This model card isn&apos;t available: only Launch-ready packs can be exported.</p>
      </main>
    );
  }
  return (
    <main className="page card-page">
      <PrintOnLoad />
      <h1>{data.title}</h1>
      <p className="muted">{data.subtitle}</p>
      <CardView sections={data.sections} />
    </main>
  );
}
