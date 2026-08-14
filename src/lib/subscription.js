import { supabase } from "./supabaseClient";

// Reads the subscription row the Stripe webhook maintains (see
// api/stripe-webhook.js and schema.sql). This is read-only from the
// client on purpose — only the webhook, using the service role key, is
// allowed to write it, so a user's own browser can never grant itself
// "active" no matter what the client code does.

const cacheKey = (userId) => `layit-subscription-${userId}`;

// Last-known plan status, read synchronously on page load so a returning
// Contractor-plan user doesn't render as "free/locked" for the moment it
// takes the real fetch below to resolve — null (not yet fetched) is
// otherwise indistinguishable from a confirmed free plan.
export function getCachedSubscriptionStatus(userId) {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function getSubscriptionStatus(userId) {
  const { data, error } = await supabase.from("subscriptions").select("status, plan").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  const sub = data || { status: "free", plan: "free" };
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(sub));
  } catch {
    // ignore — worst case is one flicker next load
  }
  return sub;
}

export function isContractorPlan(subscription) {
  return subscription?.status === "active" && subscription?.plan === "contractor";
}

// Free-tier limits, matching the plan sketched earlier: 1 active job,
// everything else (patterns, export) unlocked as the trial funnel.
export const FREE_TIER_JOB_LIMIT = 1;

export async function canCreateJob(userId, currentJobCount) {
  const sub = await getSubscriptionStatus(userId);
  if (isContractorPlan(sub)) return true;
  return currentJobCount < FREE_TIER_JOB_LIMIT;
}

export async function startCheckout(userId, userEmail) {
  const res = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, userEmail }),
  });
  const { url, error } = await res.json();
  if (error) throw new Error(error);
  window.location.href = url;
}

export async function openBillingPortal(userId) {
  const res = await fetch("/api/create-portal-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const { url, error } = await res.json();
  if (error) throw new Error(error);
  window.location.href = url;
}
