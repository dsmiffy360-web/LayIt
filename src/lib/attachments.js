import { supabase } from "./supabaseClient";
import { resizeImageToBlob } from "./exportUtils";

// Photo attachments per job (room shots, material receipts) — a stronger
// paper trail for tax records than the numbers alone. Stored in a private
// Storage bucket under {user_id}/{job_id}/{file}, RLS-scoped so a user can
// only ever touch their own folder (see supabase/schema.sql for the
// policy). Metadata (path/label/uploadedAt) lives in the job's own data
// blob, same as every other job field — this module only ever touches
// the actual file bytes.

const BUCKET = "job-attachments";

export async function uploadAttachment(jobId, file, label) {
  const blob = await resizeImageToBlob(file);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = `${user.id}/${jobId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return { id: crypto.randomUUID(), path, label, uploadedAt: Date.now() };
}

// Bucket is private, so a plain URL won't render — download the bytes
// (RLS-checked, same as any other authenticated request) and hand back an
// object URL the caller is responsible for revoking when done with it.
export async function getAttachmentObjectUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return URL.createObjectURL(data);
}

export async function deleteAttachment(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

// Called when a whole job is deleted, so its photos don't linger in
// Storage as orphaned files with nothing pointing back to them.
export async function deleteAllAttachmentsForJob(jobId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const folder = `${user.id}/${jobId}`;
  const { data: files, error: listError } = await supabase.storage.from(BUCKET).list(folder);
  if (listError) throw listError;
  if (!files || files.length === 0) return;
  const { error: removeError } = await supabase.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
  if (removeError) throw removeError;
}
