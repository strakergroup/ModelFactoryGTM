"use server";

import { redirect } from "next/navigation";
import type { Answers } from "./fields";
import { MODEL_TYPES, SIGNOFF_ROLES } from "./fields";
import { requireName } from "./session";
import { ConflictError, currentSignoffs, deletePackFile, getPack, newPack, savePack, type Pack } from "./store";

const now = () => new Date().toISOString();
const back = (id: string, error: string) => redirect(`/packs/${id}?error=${encodeURIComponent(error)}`);

async function load(id: string) {
  const found = await getPack(id);
  if (!found) redirect("/?error=" + encodeURIComponent("That pack no longer exists."));
  return found;
}

// Load, change, save. Blob storage can briefly return the previous copy right
// after a write (e.g. an autosave a second earlier); the ETag check then
// refuses the save, which protects the newer data. So wait and retry with a
// fresh read, and if it still conflicts, say so instead of crashing.
async function update(id: string, change: (p: Pack) => string | void): Promise<number> {
  const waits = [0, 300, 600, 1200, 2400];
  for (const wait of waits) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const { pack, etag } = await load(id);
    const problem = change(pack);
    if (problem) back(id, problem);
    try {
      await savePack(pack, etag);
      return pack.rev ?? 0;
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
    }
  }
  back(id, new ConflictError().message);
  return 0;
}

// Returns errors instead of throwing: thrown messages are hidden in production.
export async function saveDraft(
  id: string,
  answers: Answers,
  etag: string,
  meta?: { name: string; modelTypes: string[]; otherType: string },
): Promise<{ ok: true; etag: string; at: string } | { ok: false; error: string }> {
  const by = await requireName();
  const found = await getPack(id);
  if (!found) return { ok: false, error: "That pack no longer exists." };
  const { pack } = found;
  if (pack.status !== "draft" && pack.status !== "changes_requested") {
    return { ok: false, error: "This pack is in review and can't be edited. Reload the page." };
  }
  pack.answers = answers;
  if (meta && pack.kind === "model") {
    pack.name = meta.name.trim() || "Untitled model";
    // Answers for a type that's unticked are kept, just hidden, so re-ticking it brings them back.
    pack.modelTypes = meta.modelTypes.filter((t) => MODEL_TYPES.some((m) => m.id === t));
    pack.otherType = pack.modelTypes.includes("other") ? meta.otherType.trim().slice(0, 120) : undefined;
  }
  pack.updatedAt = now();
  pack.updatedBy = by;
  try {
    // Checked against the version this browser loaded, so a colleague's newer save is never overwritten.
    return { ok: true, etag: await savePack(pack, etag), at: pack.updatedAt };
  } catch (e) {
    return { ok: false, error: e instanceof ConflictError ? e.message : "Couldn't save. Check your connection and try again." };
  }
}

export async function createPack(formData: FormData) {
  const by = await requireName();
  const name = String(formData.get("name") ?? "").trim();
  const types = formData.getAll("types").map(String);
  const otherType = String(formData.get("otherType") ?? "").trim().slice(0, 120);
  if (!name) redirect("/?error=" + encodeURIComponent("Give the model a name."));
  if (types.includes("other") && !otherType) redirect("/?error=" + encodeURIComponent("You ticked Other: type what kind of model it is."));
  const pack = newPack("model", name, types, by);
  if (types.includes("other")) pack.otherType = otherType;
  await savePack(pack, null);
  redirect(`/packs/${pack.id}/edit?rev=${pack.rev}`);
}

export async function publishPack(formData: FormData) {
  const id = String(formData.get("id"));
  const by = await requireName();
  let version = 0;
  const rev = await update(id, (p) => {
    if (p.status !== "draft" && p.status !== "changes_requested") return "This pack is already published.";
    version = p.version + 1;
    if (p.modelTypes.includes("other") && !p.otherType?.trim()) return "You ticked Other: type what kind of model it is before publishing.";
    p.versions.push({ version, name: p.name, modelTypes: p.modelTypes, otherType: p.otherType, answers: p.answers, publishedBy: by, publishedAt: now() });
    p.version = version;
    p.status = "in_review";
    p.activity.push({ at: now(), by, action: `published v${version}` });
  });
  redirect(`/packs/${id}?published=${version}&rev=${rev}`);
}

// Taking a pack out of review to edit it. Its sign-offs belong to the old
// version, so they stop counting once the next version is published.
export async function reopenPack(formData: FormData) {
  const id = String(formData.get("id"));
  const by = await requireName();
  const rev = await update(id, (p) => {
    if (p.status !== "in_review" && p.status !== "launch_ready") return;
    p.status = "draft";
    p.activity.push({ at: now(), by, action: "reopened for editing" });
  });
  redirect(`/packs/${id}/edit?rev=${rev}`);
}

export async function requestChanges(formData: FormData) {
  const id = String(formData.get("id"));
  const note = String(formData.get("note") ?? "").trim();
  const by = await requireName();
  if (!note) back(id, "Say what needs to change.");
  const rev = await update(id, (p) => {
    if (p.status !== "in_review" && p.status !== "launch_ready") return "Only published packs can be sent back.";
    p.status = "changes_requested";
    p.comments.push({ id: crypto.randomUUID(), field: "_general", version: p.version, body: `Changes requested: ${note}`, by, at: now(), resolved: false });
    p.activity.push({ at: now(), by, action: "requested changes", detail: note });
  });
  redirect(`/packs/${id}?rev=${rev}`);
}

export async function signOff(formData: FormData) {
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const by = await requireName();
  const label = SIGNOFF_ROLES.find((r) => r.role === role)?.label;
  if (!label) back(id, "Unknown sign-off role.");
  const rev = await update(id, (p) => {
    if (p.status !== "in_review") return "Only packs in review can be signed off.";
    if (currentSignoffs(p).some((s) => s.role === role)) return `${label} has already signed off v${p.version}.`;
    p.signoffs.push({ version: p.version, role, by, note, at: now() });
    p.activity.push({ at: now(), by, action: `signed off v${p.version} as ${label}`, detail: note ?? undefined });
    if (new Set(currentSignoffs(p).map((s) => s.role)).size === SIGNOFF_ROLES.length) {
      p.status = "launch_ready";
      p.activity.push({ at: now(), by: "System", action: `v${p.version} is launch-ready` });
    }
  });
  redirect(`/packs/${id}?rev=${rev}`);
}

export async function addComment(formData: FormData) {
  const id = String(formData.get("id"));
  const field = String(formData.get("field"));
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const by = await requireName();
  let rev = 0;
  if (body) {
    rev = await update(id, (p) => {
      p.comments.push({ id: crypto.randomUUID(), field, version: p.version, body, by, at: now(), resolved: false });
    });
  }
  redirect(`/packs/${id}?rev=${rev}#f-${field}`);
}

export async function resolveComment(formData: FormData) {
  const id = String(formData.get("id"));
  const commentId = String(formData.get("comment"));
  const by = await requireName();
  const rev = await update(id, (p) => {
    const c = p.comments.find((x) => x.id === commentId);
    if (c) c.resolved = true;
    p.activity.push({ at: now(), by, action: "resolved a comment" });
  });
  redirect(`/packs/${id}?rev=${rev}`);
}

// Only never-published model drafts can be deleted, so nothing a reviewer
// has seen can disappear.
export async function deleteDraft(formData: FormData) {
  const id = String(formData.get("id"));
  await requireName();
  const { pack } = await load(id);
  if (pack.kind !== "model" || pack.version > 0) back(id, "Only models that were never published can be deleted.");
  await deletePackFile(id);
  redirect("/");
}
