// Vercel serverless function: /api/delete-account
// Called from the "Delete account" flow in App.jsx. Unlike the other
// billing endpoints, this trusts nothing from the request body — the
// caller is identified purely by their own Supabase access token, since
// the cost of a spoofed userId here is "someone else's account gets
// deleted" rather than "someone sees a billing portal link."
//
// Order matters: cancel Stripe first (so a deleted account never keeps
// getting billed), then wipe Storage (which isn't reachable by the DB's
// on-delete-cascade), then delete the auth user last — that cascade (see
// schema.sql) takes care of jobs/business_profiles/saved_materials/
// clients/subscriptions/push_subscriptions in one step.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role — server-only, never VITE_-prefixed
);

const ATTACHMENTS_BUCKET = "job-attachments";

// Storage .list() is one level deep only — the bucket holds
// {user_id}/{job_id}/{file}, so this walks the user's job-id "folders"
// and removes every file found under them.
async function deleteAllUserAttachments(userId) {
  const { data: jobFolders, error: listError } = await supabaseAdmin.storage.from(ATTACHMENTS_BUCKET).list(userId);
  if (listError) throw listError;
  if (!jobFolders || jobFolders.length === 0) return;

  const allPaths = [];
  for (const folder of jobFolders) {
    const { data: files, error: subListError } = await supabaseAdmin.storage
      .from(ATTACHMENTS_BUCKET)
      .list(`${userId}/${folder.name}`);
    if (subListError) throw subListError;
    for (const file of files || []) allPaths.push(`${userId}/${folder.name}/${file.name}`);
  }
  if (allPaths.length === 0) return;
  const { error: removeError } = await supabaseAdmin.storage.from(ATTACHMENTS_BUCKET).remove(allPaths);
  if (removeError) throw removeError;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const authHeader = req.headers.authorization || "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!accessToken) return res.status(401).json({ error: "Missing access token" });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !user) return res.status(401).json({ error: "Invalid or expired session" });

  let billingWarning = null;
  try {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sub?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      } catch (err) {
        // Already-canceled subscriptions error here too — not fatal either
        // way, since the goal (no further charges) is already satisfied.
        console.error("Stripe cancellation failed during account deletion:", err.message);
        billingWarning = "Your account was deleted, but we couldn't confirm your subscription was canceled — check your card statement and contact support if you're charged again.";
      }
    }

    await deleteAllUserAttachments(user.id);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    res.json({ ok: true, billingWarning });
  } catch (err) {
    console.error("Account deletion failed:", err.message);
    res.status(500).json({ error: err.message });
  }
}
