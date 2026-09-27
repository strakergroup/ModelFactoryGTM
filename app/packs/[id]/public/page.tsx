import Link from "next/link";
import { notFound } from "next/navigation";
import { publicData } from "../../../../lib/publicData";
import { requireName } from "../../../../lib/session";
import { getPack } from "../../../../lib/store";
import CardActions from "../../../CardActions";
import CardView from "../../../CardView";
import Header, { StatusPill } from "../../../Header";

// Public (P) fields from the latest published Rev: what Marketing can reuse on
// the website, one-pagers and Sage. Fields with a blocking flag show "Pending approval".
export default async function PublicView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const name = await requireName();
  const found = await getPack(id);
  if (!found) notFound();
  const { pack } = found;
  const data = await publicData(pack);

  return (
    <div className="shell">
      <Header name={name} />
      <main className="page">
        <p className="crumb"><Link href={`/packs/${id}`}>← Back to review view</Link></p>
        <h1>{pack.name} <StatusPill status={pack.status} /></h1>
        {!data ? (
          <p className="gap">Nothing published yet.</p>
        ) : (
          <>
            <p className="muted">
              Public-only view of Published Rev {data.version}: fields tagged P · Public. NDA and Internal fields are left out; fields with a
              blocking flag show “Pending approval”.
            </p>
            {!data.ready && (
              <p className="warn-box">
                <strong>Not approved for external use yet.</strong> This pack isn&apos;t Launch-ready, so nothing here should go on the website, a
                one-pager or Sage.
              </p>
            )}
            <CardActions markdown={data.markdown} pdfHref={`/packs/${id}/card`} ready={data.ready} />
            <CardView sections={data.sections} />
          </>
        )}
      </main>
    </div>
  );
}
