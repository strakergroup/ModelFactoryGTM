import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDraft, reopenPack } from "../../../../lib/actions";
import ConfirmButton from "../../../ConfirmButton";
import { requireName } from "../../../../lib/session";
import { fieldLabel } from "../../../../lib/fields";
import { getPackAtLeast } from "../../../../lib/store";
import Header, { ErrorNote, StatusPill } from "../../../Header";
import EditForm from "./EditForm";

export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; rev?: string }>;
}) {
  const { id } = await params;
  const { error, rev } = await searchParams;
  const name = await requireName();
  const found = await getPackAtLeast(id, Number(rev) || undefined);
  if (!found) notFound();
  const { pack, etag } = found;

  const editable = pack.status === "draft" || pack.status === "changes_requested";
  const open = pack.comments.filter((c) => !c.resolved);

  return (
    <div className="shell">
      <Header name={name} />
      <main className="page">
        <p className="crumb"><Link href={`/packs/${id}`}>← Back to review view</Link></p>
        <h1>{pack.name} <StatusPill status={pack.status} /></h1>
        <ErrorNote error={error} />

        {!editable ? (
          <form action={reopenPack} className="warn-box">
            <input type="hidden" name="id" value={id} />
            This pack is {pack.status === "launch_ready" ? "launch-ready" : "in review"}. Editing takes it out of
            review and <strong>its sign-offs stop counting</strong>; you&apos;ll need to publish a new version.{" "}
            <button type="submit">Edit anyway</button>
          </form>
        ) : (
          <>
            {pack.status === "changes_requested" && open.length > 0 && (
              <div className="warn-box">
                <strong>Reviewers asked for changes:</strong>
                <ul>
                  {open.map((c) => (
                    <li key={c.id}>
                      {c.body} <span className="muted small">({c.by}{c.field !== "_general" ? ` · on ${fieldLabel(c.field)}` : ""})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <EditForm
              id={id}
              kind={pack.kind}
              initialName={pack.name}
              initialModelTypes={pack.modelTypes}
              initialOtherType={pack.otherType ?? ""}
              initialAnswers={pack.answers}
              initialEtag={etag}
              version={pack.version}
            />
            {pack.kind === "model" && pack.version === 0 && (
              <form action={deleteDraft} className="danger-zone">
                <input type="hidden" name="id" value={id} />
                <span className="muted small">Never published, so it can still be deleted.</span>
                <ConfirmButton message={`Delete "${pack.name}"? This can't be undone.`}>Delete this draft</ConfirmButton>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}
