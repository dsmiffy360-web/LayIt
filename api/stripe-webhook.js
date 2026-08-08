// Vercel serverless function: /api/stripe-webhook
// Configure this exact URL in the Stripe dashboard (Developers → Webhooks)
// once deployed. This is the ONLY thing allowed to write to the
// `subscriptions` table (see schema.sql — no client-side insert/update
// policy exists on purpose), using the service role key which bypasses
// Row Level Security. Never expose that key to the browser.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role — server-only, never VITE_-prefixed
);

export const config = {
  api: { bodyParser: false }, // Stripe needs the raw body to verify the signature
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

// Stripe moved `current_period_end` off the top-level Subscription object
// and onto each subscription item (to support multi-item subscriptions) —
// fall back to the old top-level field in case an older API version ever
// sends it there instead.
function getPeriodEnd(subscription) {
  return subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const rawBody = await buffer(req);
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id; // set when creating the checkout session
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const { error } = await supabaseAdmin.from("subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: session.customer,
        stripe_subscription_id: subscription.id,
        status: "active",
        plan: "contractor",
        current_period_end: new Date(getPeriodEnd(subscription) * 1000).toISOString(),
      });
      if (error) console.error("Failed to write subscription after checkout:", error.message);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const status = subscription.status === "active" ? "active" : subscription.status === "past_due" ? "past_due" : "canceled";
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({
          status,
          plan: status === "active" ? "contractor" : "free",
          current_period_end: new Date(getPeriodEnd(subscription) * 1000).toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);
      if (error) console.error("Failed to update subscription status:", error.message);
      break;
    }
    default:
      // Ignore event types we don't act on — Stripe sends many.
      break;
  }

  res.json({ received: true });
}
