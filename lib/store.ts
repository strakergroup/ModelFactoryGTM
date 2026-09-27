import { BlobPreconditionFailedError, del, get, list, put } from "@vercel/blob";
import { SCHEMA_VERSION, type Answers, type NA } from "./fields";
import { backfillPairs, migrateAnswers, renameRevs, repointEvidence, reviewTargets } from "./migrate";

// Each pack is one private JSON file in Vercel Blob: packs/<id>.json.
// Writes use the file's ETag (ifMatch), so two people saving at once can't
// silently overwrite each other: the second save fails and asks for a reload.

export type Status = "draft" | "in_review" | "changes_requested" | "launch_ready";

export type Version = {
  version: number;
  name: string;
  modelTypes: string[];
  otherType?: string;
  answers: Answers;
  na?: NA;
  splitOverride?: SplitOverride;
  publishedBy: string;
  publishedAt: string;
};
export type Comment = { id: string; field: string; version: number; body: string; by: string; at: string; resolved: boolean };
export type SignOff = { version: number; role: string; by: string; note: string | null; at: string };
export type Activity = { at: string; by: string; action: string; detail?: string };
// Saved reason for keeping a shared model and a customer-trained build in one pack.
export type SplitOverride = { reason: string; by: string; at: string };

export type Pack = {
  id: string;
  kind: "factory" | "model";
  name: string;
  modelTypes: string[];
  otherType?: string; // what "Other" means, typed by the model team
  status: Status;
  answers: Answers; // the working draft
  na?: NA; // field key -> reason it doesn't apply
  splitOverride?: SplitOverride;
  schemaVersion?: number; // missing = v1
  needsReview?: boolean; // set by a migration that moved answered content
  migrationNotes?: string[];
  migratedAt?: string; // sign-offs older than this are stale
  reviewFields?: string[]; // fields that got merged/moved content, until an editor saves them
  reviewCells?: string[]; // "b4_metrics:<row>:<col>" cells filled by backfill, until edited
  version: number; // latest published version, 0 = never published
  versions: Version[];
  comments: Comment[];
  signoffs: SignOff[];
  activity: Activity[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  rev?: number; // +1 on every save; pages wait until they can see it
};

export class ConflictError extends Error {
  constructor() {
    super("Someone else saved this pack a moment ago. Reload the page to see their changes, then try again.");
  }
}

export const FACTORY_ID = "factory";

// get() can return a weak ETag (W/"abc") when the body was compressed, but
// put({ ifMatch }) only accepts the strong form ("abc"). Same fingerprint.
const strongEtag = (etag: string) => etag.replace(/^W\//, "");
const path = (id: string) => `packs/${id}.json`;

export async function getPack(id: string): Promise<{ pack: Pack; etag: string } | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const res = await get(path(id), { access: "private", useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) {
    if (id === FACTORY_ID) return createFactory();
    return null;
  }
  const pack = (await new Response(res.stream).json()) as Pack;
  const etag = strongEtag(res.blob.etag);
  if ((pack.schemaVersion ?? 1) < SCHEMA_VERSION) return migrate(pack, etag);
  return { pack, etag };
}

// One-time upgrade to the current schema, saved straight away. If answered
// content moved, the pack goes back to Draft and is flagged "needs review";
// published revisions and their sign-offs stay in the history.
async function migrate(pack: Pack, etag: string): Promise<{ pack: Pack; etag: string }> {
  const at = new Date().toISOString();
  // v1 -> v2: merge, rename and remove fields.
  if ((pack.schemaVersion ?? 1) < 2) {
    const m = migrateAnswers(pack.answers ?? {});
    pack.answers = m.answers;
    pack.versions = (pack.versions ?? []).map((v) => ({ ...v, answers: migrateAnswers(v.answers).answers }));
    pack.activity = (pack.activity ?? []).map((a) => ({ ...a, action: renameRevs(a.action) }));
    if (m.changed) {
      pack.needsReview = true;
      pack.migrationNotes = m.notes;
      pack.migratedAt = at;
      if (pack.status !== "draft") pack.status = "draft";
      pack.activity.push({ at, by: "System", action: "moved to the new fact pack structure (schema v2); back to Draft for review" });
    }
  }
  // v2 -> v3: repoint evidence, per-field review flags, B4 language-pair backfill.
  if ((pack.schemaVersion ?? 1) < 3) {
    const migrated = pack.needsReview || pack.activity.some((a) => a.action.startsWith("moved to the new fact pack structure"));
    if (migrated) {
      pack.migratedAt ??= pack.activity.find((a) => a.action.startsWith("moved to the new fact pack structure"))?.at ?? at;
      pack.reviewFields = reviewTargets(pack.answers);
    }
    const e = repointEvidence(pack.answers);
    pack.answers = e.answers;
    pack.versions = (pack.versions ?? []).map((v) => ({ ...v, answers: repointEvidence(v.answers).answers }));
    const b = backfillPairs(pack.answers);
    pack.answers = b.answers;
    if (b.cells.length) {
      pack.reviewCells = b.cells;
      if (!pack.reviewFields?.includes("b4_metrics")) pack.reviewFields = [...(pack.reviewFields ?? []), "b4_metrics"];
    }
    const changes = [
      ...e.repoints.map((r) => `Evidence repointed: “${r.from}” → “${r.to}”`),
      ...(b.cells.length ? [`B4 Language pair filled from C1 in ${b.cells.length} row(s); check them`] : []),
    ];
    if (changes.length || pack.reviewFields?.length) {
      pack.activity.push({ at, by: "System", action: "applied schema v3 checks", detail: changes.join(" | ") || undefined });
    }
  }
  pack.schemaVersion = SCHEMA_VERSION;
  try {
    return { pack, etag: await savePack(pack, etag) };
  } catch {
    // Someone else migrated it at the same moment; use theirs.
    const again = await getPack(pack.id);
    return again ?? { pack, etag };
  }
}

export async function listPacks(): Promise<Pack[]> {
  const { blobs } = await list({ prefix: "packs/" });
  const ids = blobs.map((b) => b.pathname.replace(/^packs\/|\.json$/g, ""));
  if (!ids.includes(FACTORY_ID)) ids.unshift(FACTORY_ID);
  const packs = await Promise.all(ids.map((id) => getPack(id)));
  return packs
    .filter((p): p is { pack: Pack; etag: string } => p !== null)
    .map((p) => p.pack)
    .sort((a, b) => (a.kind === b.kind ? b.updatedAt.localeCompare(a.updatedAt) : a.kind === "factory" ? -1 : 1));
}

export async function savePack(pack: Pack, etag: string | null): Promise<string> {
  pack.rev = (pack.rev ?? 0) + 1;
  try {
    const res = await put(path(pack.id), JSON.stringify(pack), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: etag !== null,
      ...(etag ? { ifMatch: etag } : {}),
      cacheControlMaxAge: 60,
    });
    return res.etag;
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError) throw new ConflictError();
    throw e;
  }
}

export function newPack(kind: Pack["kind"], name: string, modelTypes: string[], by: string, id = crypto.randomUUID()): Pack {
  const now = new Date().toISOString();
  return {
    id,
    kind,
    name,
    modelTypes,
    status: "draft",
    answers: {},
    schemaVersion: SCHEMA_VERSION,
    version: 0,
    versions: [],
    comments: [],
    signoffs: [],
    activity: [{ at: now, by, action: "created" }],
    createdAt: now,
    updatedAt: now,
    updatedBy: by,
  };
}

async function createFactory(): Promise<{ pack: Pack; etag: string } | null> {
  const pack = newPack("factory", "Factory fact sheet (Part A)", [], "System", FACTORY_ID);
  try {
    const etag = await savePack(pack, null);
    return { pack, etag };
  } catch {
    // Another request created it first; read theirs.
    const res = await get(path(FACTORY_ID), { access: "private", useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return { pack: (await new Response(res.stream).json()) as Pack, etag: strongEtag(res.blob.etag) };
  }
}

export function currentSignoffs(pack: Pack) {
  return pack.signoffs.filter((s) => s.version === pack.version);
}

export async function deletePackFile(id: string) {
  await del(path(id));
}

// Reads right after a write can briefly return the previous copy. After an
// action we know the revision we just saved, so wait (up to ~3s) to see it.
export async function getPackAtLeast(id: string, rev?: number) {
  const waits = [0, 250, 500, 1000, 1500];
  let found: Awaited<ReturnType<typeof getPack>> = null;
  for (const wait of waits) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    found = await getPack(id);
    if (!found || !rev || (found.pack.rev ?? 0) >= rev) return found;
  }
  return found;
}
