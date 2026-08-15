import { supabase } from "./supabaseClient";

// Permanently deletes the signed-in user's account — see
// api/delete-account.js for what that actually tears down (jobs,
// photos, business profile, and any active subscription).
export async function deleteAccount() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch("/api/delete-account", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Failed to delete account");

  await supabase.auth.signOut();
  return body;
}
