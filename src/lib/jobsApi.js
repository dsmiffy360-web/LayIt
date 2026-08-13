import { supabase } from "./supabaseClient";
import { deleteAllAttachmentsForJob } from "./attachments";

// This module is the direct replacement for the artifact's window.storage
// calls (job-index, job-{id}, active-job-id). Function names and shapes
// were kept close to that original code on purpose, so porting the
// landing page / job switcher / autosave logic is mostly a search-and-
// replace of the storage calls for these, not a rewrite of the UI logic.

export async function listJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, name, client, status, archived, updated_at, scheduled_date, data")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  // Match the artifact's job-index shape: { id, name, client, status, updatedAt, archived }
  // — jobData is included too so the job-list summary can compute revenue
  // totals without a second round trip per job.
  return data.map((j) => ({
    id: j.id,
    name: j.name,
    client: j.client,
    status: j.status,
    archived: j.archived,
    updatedAt: new Date(j.updated_at).getTime(),
    scheduledDate: j.scheduled_date,
    jobData: j.data,
  }));
}

export async function loadJob(jobId) {
  const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).single();
  if (error) throw error;
  // The artifact's applyJobData() expects one flat object with name/client
  // alongside the rest of the job fields — merge data JSONB back out.
  return { ...data.data, name: data.name, client: data.client, clientId: data.client_id, status: data.status, archived: data.archived, scheduledDate: data.scheduled_date };
}

export async function createJob(initialData) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      name: initialData.name || "New job",
      client: initialData.client || "",
      status: initialData.status || "quote",
      data: initialData,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function duplicateJob(sourceJobId) {
  const source = await loadJob(sourceJobId);
  return createJob({
    ...source,
    name: `${source.name || "Job"} (copy)`,
    checkedPieces: {},
    invoiceNumber: "",
    invoiceDate: "",
    paymentStatus: "unpaid",
    depositAmount: "",
    status: "quote",
    scheduledDate: "", // a copy isn't scheduled for the same date as the original
    attachments: [], // a copy doesn't inherit the original's room photos/receipts
  });
}

export async function saveJob(jobId, jobData) {
  const { error } = await supabase
    .from("jobs")
    .update({
      name: jobData.name,
      client: jobData.client,
      client_id: jobData.clientId || null,
      status: jobData.status,
      scheduled_date: jobData.scheduledDate || null,
      data: jobData,
    })
    .eq("id", jobId);
  if (error) throw error;
}

export async function toggleArchiveJob(jobId, archived) {
  const { error } = await supabase.from("jobs").update({ archived }).eq("id", jobId);
  if (error) throw error;
}

export async function deleteJob(jobId) {
  // Best-effort — a Storage hiccup shouldn't block the user from deleting
  // the job itself. Orphaned attachment files with no job pointing to them
  // are a minor cleanup issue, not a reason to fail this action.
  try {
    await deleteAllAttachmentsForJob(jobId);
  } catch {
    // ignore
  }
  const { error } = await supabase.from("jobs").delete().eq("id", jobId);
  if (error) throw error;
}

export async function getBusinessProfile() {
  const { data, error } = await supabase.from("business_profiles").select("name, contact, bank_details, logo").maybeSingle();
  if (error) throw error;
  return data || { name: "", contact: "", bank_details: "", logo: null };
}

export async function saveBusinessProfile(profile) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("business_profiles").upsert({ user_id: user.id, ...profile });
  if (error) throw error;
}

// One-time import for people who used the artifact prototype: pass the
// contents of their browser's window.storage job blobs and this creates
// matching rows, so switching to the real app doesn't lose existing work.
export async function importLocalJobs(localJobIndex, loadLocalJobFn) {
  const created = [];
  for (const meta of localJobIndex) {
    const localData = await loadLocalJobFn(meta.id);
    const newId = await createJob(localData);
    created.push(newId);
  }
  return created;
}
