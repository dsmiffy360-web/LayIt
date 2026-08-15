// Vercel serverless function: /api/create-checkout-session
// Called from the client's "Upgrade" button. Creates a Stripe Checkout
// session and returns the URL to redirect to — Stripe hosts the actual
// payment form, so no card data ever touches this app's own code.

import Stripe from "stripe";
import * as Sentry from "@sentry/node";
import { wrapHandler } from "./_sentry.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { userId, userEmail } = req.body;
  if (!userId || !userEmail) return res.status(400).json({ error: "Missing userId or userEmail" });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: userEmail,
      client_reference_id: userId, // read back in the webhook to link the subscription to this user
      line_items: [{ price: process.env.STRIPE_CONTRACTOR_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.PUBLIC_APP_URL}/account?checkout=success`,
      cancel_url: `${process.env.PUBLIC_APP_URL}/account?checkout=canceled`,
      // 7-day free trial — card is collected now but not charged until the
      // trial ends. The webhook already marks the account active/contractor
      // as soon as checkout completes (see stripe-webhook.js), so trial
      // users get full access immediately; if the trial-end charge fails or
      // they cancel, the existing customer.subscription.updated/deleted
      // handling already downgrades them correctly with no changes needed.
      subscription_data: { trial_period_days: 7 },
      // Stripe's own hosted portal (billing.stripe.com) handles upgrade/
      // downgrade/cancel from here on — no custom UI needed for that.
      allow_promotion_codes: true,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session creation failed:", err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: err.message });
  }
}

export default wrapHandler(handler);
