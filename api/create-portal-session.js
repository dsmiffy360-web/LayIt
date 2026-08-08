// Vercel serverless function: /api/create-portal-session
// Called from the client's "Manage billing" button. Looks up the user's
// Stripe customer ID (via the service role key, since a raw Stripe
// customer ID isn't exposed to the client) and returns a link to Stripe's
// hosted Customer Portal, where they can update payment method, change
// plan, or cancel — no custom billing UI needed for any of that.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.stripe_customer_id) {
      return res.status(400).json({ error: "No billing account found for this user yet." });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${process.env.PUBLIC_APP_URL}/`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Portal session creation failed:", err.message);
    res.status(500).json({ error: err.message });
  }
}
