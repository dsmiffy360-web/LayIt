import { supabase } from "./supabaseClient";

// A small saved address book (see schema.sql) — pick a client on the
// Invoice step instead of retyping their name/address, and see their
// past jobs linked via jobs.client_id.

export async function listClients() {
  const { data, error } = await supabase.from("clients").select("id, name, address, contact").order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createClient(client) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("clients")
    .insert({ user_id: user.id, ...client })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteClient(id) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

// Every other job (any status, archived or not) linked to this client,
// excluding the one currently open — the "history" a repeat client builds up.
export async function listJobsForClient(clientId, excludeJobId) {
  let query = supabase
    .from("jobs")
    .select("id, name, status, updated_at")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });
  if (excludeJobId) query = query.neq("id", excludeJobId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
