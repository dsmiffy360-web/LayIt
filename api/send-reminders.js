// Vercel serverless function: /api/send-reminders
// Runs daily via Vercel Cron (see vercel.json) — finds every active job
// scheduled for today and sends a same-day Web Push nudge to each device
// the job's owner has enabled reminders on. Expired subscriptions (410/404
// from the push service) get cleaned up as they're found, so the table
// doesn't accumulate dead rows from uninstalled devices.

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  // Vercel auto-attaches CRON_SECRET as a bearer token on scheduled
  // invocations when an env var of that exact name is set — this just
  // stops anyone else from hitting the URL and mass-notifying every user.
  const auth = req.headers.authorization;
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from("jobs")
      .select("id, name, client, user_id")
      .eq("scheduled_date", today)
      .eq("archived", false)
      .neq("status", "complete");
    if (jobsError) throw jobsError;

    if (!jobs.length) return res.json({ sent: 0, jobs: 0, cleanedUp: 0 });

    const userIds = [...new Set(jobs.map((j) => j.user_id))];
    const { data: subs, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", userIds);
    if (subsError) throw subsError;

    const subsByUser = new Map();
    for (const s of subs) {
      if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
      subsByUser.get(s.user_id).push(s);
    }

    let sent = 0;
    const deadSubscriptionIds = [];

    for (const job of jobs) {
      const userSubs = subsByUser.get(job.user_id) || [];
      const payload = JSON.stringify({
        title: "Job scheduled today",
        body: job.client ? `${job.name} — ${job.client}` : job.name,
        url: "/",
      });
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
          sent++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            deadSubscriptionIds.push(sub.id);
          } else {
            console.error("Push send failed:", err.message);
          }
        }
      }
    }

    if (deadSubscriptionIds.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", deadSubscriptionIds);
    }

    res.json({ sent, jobs: jobs.length, cleanedUp: deadSubscriptionIds.length });
  } catch (err) {
    console.error("send-reminders failed:", err.message);
    res.status(500).json({ error: err.message });
  }
}
