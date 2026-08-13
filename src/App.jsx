import { useState, useEffect } from "react";
import { onAuthChange, signInWithEmail, signInWithGoogle, signOut, getCurrentUser } from "./lib/auth";
import { listJobs, createJob, duplicateJob, deleteJob, toggleArchiveJob } from "./lib/jobsApi";
import { getSubscriptionStatus, isContractorPlan, startCheckout, openBillingPortal, FREE_TIER_JOB_LIMIT } from "./lib/subscription";
import { computeJobInvoiceTotal, jobRevenueDate } from "./lib/invoiceTotal";
import { downloadTextFile, csvField } from "./lib/exportUtils";
import { getPushStatus, subscribeToPushNotifications, unsubscribeFromPushNotifications } from "./lib/pushNotifications";
import { JobWorkspace } from "./components/JobWorkspace";
import { LandingPage } from "./components/LandingPage";
import { COLORS } from "./lib/colors";

// Start of the current week (Monday)/month/year, as a timestamp — a job
// counts toward a period if its last-updated time falls on or after this.
function periodStart(period) {
  const now = new Date();
  if (period === "week") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d.getTime();
  }
  if (period === "year") return new Date(now.getFullYear(), 0, 1).getTime();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const inputStyle = { fontFamily: "Inter", fontSize: 16, padding: "12px 12px", minHeight: 44, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", color: COLORS.ink, width: "100%" };
const primaryButtonStyle = { minHeight: 48, borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})`, color: "#FFFFFF", fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const secondaryButtonStyle = { minHeight: 44, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.panel, color: COLORS.ink, fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, cursor: "pointer" };

// Phase 2: the job workspace (Setup/Material/Pattern/Results/Invoice) is
// now wired in for the ported patterns — see JobWorkspace.jsx and
// README.md "What's ported vs what's next" for exactly what that covers.

function SignInScreen({ onBack }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmail(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "72px auto", padding: "0 16px" }}>
      {onBack && (
        <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.sub, cursor: "pointer", padding: 0, marginBottom: 16, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600 }}>
          ← Back
        </button>
      )}
      <h1 style={{
        fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 34, textAlign: "center", margin: "0 0 28px",
        color: COLORS.accentText,
      }}>
        LayIt
      </h1>
      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 24 }}>
        <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, color: COLORS.sub, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 14px" }}>Sign in</div>
        {sent ? (
          <p style={{ fontFamily: "Inter", fontSize: 14, color: COLORS.sub, lineHeight: 1.5 }}>Check your email for a sign-in link.</p>
        ) : (
          <>
            <form onSubmit={handleEmailSignIn}>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
              <button type="submit" style={{ ...primaryButtonStyle, width: "100%", marginTop: 10 }}>
                Email me a sign-in link
              </button>
            </form>
            {error && <p style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.wasteText, marginTop: 10 }}>{error}</p>}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
              <div style={{ flex: 1, height: 1, background: COLORS.border, opacity: 0.4 }} />
              <span style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub }}>or</span>
              <div style={{ flex: 1, height: 1, background: COLORS.border, opacity: 0.4 }} />
            </div>
            <button onClick={signInWithGoogle} style={{ ...secondaryButtonStyle, width: "100%" }}>
              Continue with Google
            </button>
          </>
        )}
      </section>
    </div>
  );
}

// Job reminders toggle — Contractor-only (scheduling itself already is),
// renders nothing on unsupported browsers rather than a dead button.
// Status is per-device (this is a per-browser push subscription, not an
// account-wide setting), so it re-checks on mount rather than trusting
// any cached value.
function ReminderToggle({ onContractorPlan }) {
  const [status, setStatus] = useState(null); // null = still checking
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!onContractorPlan) return;
    getPushStatus().then(setStatus).catch(() => setStatus("unsupported"));
  }, [onContractorPlan]);

  if (!onContractorPlan || status === null || status === "unsupported") return null;

  const handleToggle = async () => {
    setBusy(true);
    setError("");
    try {
      if (status === "subscribed") {
        await unsubscribeFromPushNotifications();
        setStatus("unsubscribed");
      } else {
        await subscribeToPushNotifications();
        setStatus("subscribed");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={handleToggle}
        disabled={busy || status === "denied"}
        style={{
          minHeight: 36, borderRadius: 8, border: `1px solid ${status === "subscribed" ? COLORS.reuse : COLORS.border}`,
          background: status === "subscribed" ? "#F0EEE7" : "#FBFAF7",
          color: status === "subscribed" ? COLORS.reuse : COLORS.sub,
          fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, cursor: status === "denied" ? "default" : "pointer",
          padding: "0 14px", width: "100%",
        }}
      >
        {busy
          ? "Working…"
          : status === "subscribed"
          ? "✓ Job reminders on for this device"
          : status === "denied"
          ? "Notifications blocked — enable them in your browser settings"
          : "Enable job reminders on this device"}
      </button>
      {error && <p style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.wasteText, marginTop: 6 }}>{error}</p>}
    </div>
  );
}

function JobList({ user, onOpenJob, subscription, setSubscription }) {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [summaryPeriod, setSummaryPeriod] = useState("month");
  const [showSummary, setShowSummary] = useState(false);
  const [breakdownYear, setBreakdownYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const refresh = async () => {
    try {
      setJobs(await listJobs());
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    refresh();

    const checkout = new URLSearchParams(window.location.search).get("checkout");
    if (checkout === "success") {
      setCheckoutNotice("Your 7-day free trial has started — you're on the Contractor plan.");
      getSubscriptionStatus(user.id).then(setSubscription).catch(() => {});
    } else if (checkout === "canceled") {
      setCheckoutNotice("Checkout was canceled — you're still on the free plan.");
    }
    if (checkout) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const activeJobCount = jobs ? jobs.filter((j) => !j.archived).length : 0;
  const onContractorPlan = isContractorPlan(subscription);
  const atFreeLimit = !onContractorPlan && activeJobCount >= FREE_TIER_JOB_LIMIT;

  // Search/filter for the active job list — once there are more than a
  // handful of jobs, "chronological with no way to jump to a client or
  // status" stops being usable. Doesn't touch the Summary page's own
  // activeJobs (below), which is a different view with its own scope.
  const visibleActiveJobs = jobs
    ? jobs
        .filter((j) => !j.archived)
        .filter((j) => statusFilter === "all" || j.status === statusFilter)
        .filter((j) => {
          const q = searchQuery.trim().toLowerCase();
          if (!q) return true;
          return j.name.toLowerCase().includes(q) || (j.client || "").toLowerCase().includes(q);
        })
    : [];

  // Revenue summary — counts a job (archived or not) if it's marked
  // Complete and its revenue date (see jobRevenueDate) falls within the
  // selected period. Reuses the exact same total the Invoice step shows,
  // computed from each job's stored data blob, so this can never drift
  // from what the contractor actually sees on an individual invoice.
  const periodMs = jobs ? periodStart(summaryPeriod) : 0;
  const completedInPeriod = jobs ? jobs.filter((j) => j.status === "complete" && jobRevenueDate(j) >= periodMs) : [];
  const summaryValue = completedInPeriod.reduce((sum, j) => {
    if (!j.jobData) return sum;
    try {
      return sum + computeJobInvoiceTotal(j.jobData).total;
    } catch {
      return sum;
    }
  }, 0);

  // Upcoming — active jobs with a scheduled date today or later, soonest
  // first. A lightweight "what's coming up" list rather than a full
  // calendar view.
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingJobs = jobs
    ? jobs.filter((j) => !j.archived && j.scheduledDate && j.scheduledDate >= todayStr).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    : [];

  // Everything below is for the separate Summary page — a snapshot of the
  // business as a whole rather than the period-scoped revenue stat above,
  // so a contractor can see what's owed and what's stuck without digging
  // through every job individually.
  const activeJobs = jobs ? jobs.filter((j) => !j.archived) : [];
  const pipelineCounts = {
    quote: activeJobs.filter((j) => j.status === "quote").length,
    "in-progress": activeJobs.filter((j) => j.status === "in-progress").length,
    complete: activeJobs.filter((j) => j.status === "complete").length,
  };
  // Outstanding balance only counts jobs that have actually been worked on
  // (not bare quotes) and aren't fully paid — an unaccepted quote isn't
  // money owed yet.
  const outstandingBalance = activeJobs
    .filter((j) => j.status !== "quote" && j.jobData)
    .reduce((sum, j) => {
      try {
        const { total } = computeJobInvoiceTotal(j.jobData);
        const paymentStatus = j.jobData.paymentStatus;
        if (paymentStatus === "paid") return sum;
        const paid = paymentStatus === "deposit" ? Math.max(0, parseFloat(j.jobData.depositAmount) || 0) : 0;
        return sum + Math.max(0, total - paid);
      } catch {
        return sum;
      }
    }, 0);
  const overdueJobs = activeJobs
    .filter((j) => j.scheduledDate && j.scheduledDate < todayStr && j.status !== "complete")
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const avgJobValue = completedInPeriod.length ? summaryValue / completedInPeriod.length : 0;

  // Monthly breakdown, for tax tracking — every completed job (archived or
  // not, same as the period stat above) grouped by month for a chosen
  // year, using the same revenue-date rule so the two sections never
  // disagree about which month a job belongs in.
  const completedAllTime = jobs ? jobs.filter((j) => j.status === "complete") : [];
  const yearsWithData = Array.from(new Set(completedAllTime.map((j) => new Date(jobRevenueDate(j)).getFullYear())));
  const currentYear = new Date().getFullYear();
  if (!yearsWithData.includes(currentYear)) yearsWithData.push(currentYear);
  yearsWithData.sort((a, b) => b - a);
  const monthlyBreakdown = MONTH_NAMES.map((label, month) => {
    const monthJobs = completedAllTime.filter((j) => {
      const d = new Date(jobRevenueDate(j));
      return d.getFullYear() === breakdownYear && d.getMonth() === month;
    });
    const value = monthJobs.reduce((sum, j) => {
      if (!j.jobData) return sum;
      try {
        return sum + computeJobInvoiceTotal(j.jobData).total;
      } catch {
        return sum;
      }
    }, 0);
    return { label, count: monthJobs.length, value };
  });
  const yearTotal = monthlyBreakdown.reduce((sum, m) => sum + m.value, 0);

  // Paid jobs for the same selected year — a clickable reference list so a
  // contractor can jump back into any job whose income already landed in
  // the breakdown above, e.g. to re-pull an invoice for a tax filing.
  const paidJobsInYear = completedAllTime
    .filter((j) => j.jobData?.paymentStatus === "paid" && new Date(jobRevenueDate(j)).getFullYear() === breakdownYear)
    .map((j) => {
      let value = 0;
      try {
        value = computeJobInvoiceTotal(j.jobData).total;
      } catch {
        // leave value at 0
      }
      return { ...j, revenueDate: jobRevenueDate(j), value };
    })
    .sort((a, b) => b.revenueDate - a.revenueDate);

  const handleExportCsv = () => {
    const header = ["Job", "Client", "Date", "Amount"].map(csvField).join(",");
    const rows = paidJobsInYear.map((j) =>
      [j.name, j.client || "", new Date(j.revenueDate).toISOString().slice(0, 10), j.value.toFixed(2)].map(csvField).join(",")
    );
    downloadTextFile([header, ...rows].join("\n"), `layit-paid-jobs-${breakdownYear}.csv`, "text/csv");
  };

  const handleCreate = async () => {
    if (atFreeLimit) return;
    try {
      const id = await createJob({ name: "New job" });
      onOpenJob(id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDuplicate = async (id) => {
    if (atFreeLimit) return;
    try {
      const newId = await duplicateJob(id);
      onOpenJob(newId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await startCheckout(user.id, user.email);
    } catch (err) {
      setError(err.message);
      setUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      await openBillingPortal(user.id);
    } catch (err) {
      setError(err.message);
      setPortalLoading(false);
    }
  };

  const rowButtonStyle = { minHeight: 32, borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.panel, color: COLORS.sub, fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "0 10px" };

  if (error) return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <p style={{ fontFamily: "Inter", fontSize: 14, color: COLORS.wasteText }}>{error}</p>
    </div>
  );
  if (!jobs) return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <p style={{ fontFamily: "Inter", fontSize: 14, color: COLORS.sub }}>Loading your jobs…</p>
    </div>
  );

  if (showSummary) {
    return (
      <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px 40px" }}>
        <button onClick={() => setShowSummary(false)} style={{ background: "none", border: "none", color: COLORS.sub, cursor: "pointer", padding: 0, marginBottom: 16, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600 }}>
          ← Back
        </button>
        <h1 style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 28, color: COLORS.accentText, margin: "0 0 20px" }}>
          Summary
        </h1>

        {!onContractorPlan ? (
          <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 24, textAlign: "center" }}>
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Summary is a Contractor feature</div>
            <p style={{ fontSize: 13, color: COLORS.sub, margin: "0 0 18px", lineHeight: 1.5 }}>
              Revenue tracking, the monthly breakdown for tax records, outstanding balances, and the job pipeline are
              part of the Contractor plan. Start a 7-day free trial to unlock them.
            </p>
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              style={{ minHeight: 48, borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})`, color: "#FFFFFF", fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 24px" }}
            >
              {upgrading ? "Redirecting…" : "Start free trial"}
            </button>
          </section>
        ) : (
          <>
        <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 14, color: COLORS.ink }}>This period</span>
            <div style={{ display: "flex", border: `1px solid ${COLORS.border}`, borderRadius: 7, overflow: "hidden" }}>
              {[["week", "Week"], ["month", "Month"], ["year", "Year"]].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setSummaryPeriod(id)}
                  style={{
                    minHeight: 30, padding: "0 10px", fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, border: "none",
                    background: summaryPeriod === id ? `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})` : "#FBFAF7",
                    color: summaryPeriod === id ? "#FFFFFF" : COLORS.sub, cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "#FBFAF7", borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${COLORS.reuse}` }}>
              <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, textTransform: "uppercase" }}>Jobs completed</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 20, fontWeight: 600, marginTop: 2 }}>{completedInPeriod.length}</div>
            </div>
            <div style={{ background: "#FBFAF7", borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${COLORS.wood1}` }}>
              <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, textTransform: "uppercase" }}>Value of work</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 20, fontWeight: 600, marginTop: 2 }}>{summaryValue.toFixed(2)}</div>
            </div>
            <div style={{ background: "#FBFAF7", borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${COLORS.accent}`, gridColumn: "1 / -1" }}>
              <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, textTransform: "uppercase" }}>Average job value</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 20, fontWeight: 600, marginTop: 2 }}>{avgJobValue.toFixed(2)}</div>
            </div>
          </div>
        </section>

        <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 14, color: COLORS.ink, marginBottom: 12 }}>Right now</div>
          <div style={{ background: "#FBFAF7", borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${COLORS.wasteText}`, marginBottom: 10 }}>
            <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, textTransform: "uppercase" }}>Outstanding balance</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 20, fontWeight: 600, marginTop: 2 }}>{outstandingBalance.toFixed(2)}</div>
            <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, marginTop: 4 }}>Across jobs in progress or complete that aren't fully paid</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div style={{ background: "#FBFAF7", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, textTransform: "uppercase" }}>Quotes</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 600, marginTop: 2 }}>{pipelineCounts.quote}</div>
            </div>
            <div style={{ background: "#FBFAF7", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, textTransform: "uppercase" }}>In progress</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 600, marginTop: 2 }}>{pipelineCounts["in-progress"]}</div>
            </div>
            <div style={{ background: "#FBFAF7", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, textTransform: "uppercase" }}>Complete</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 600, marginTop: 2 }}>{pipelineCounts.complete}</div>
            </div>
          </div>
        </section>

        <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 14, color: COLORS.ink }}>Monthly breakdown</span>
            <select
              value={breakdownYear}
              onChange={(e) => setBreakdownYear(parseInt(e.target.value, 10))}
              style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", background: "#FBFAF7", color: COLORS.ink }}
            >
              {yearsWithData.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <p style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, margin: "0 0 10px" }}>
            By invoice date where set, otherwise last-updated — for quarterly estimates or year-end totals.
          </p>
          {monthlyBreakdown.map((m, i) => (
            <div
              key={m.label}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", alignItems: "center", padding: "7px 0", borderTop: i > 0 ? `1px solid ${COLORS.border}` : "none" }}
            >
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: m.count ? COLORS.ink : COLORS.sub }}>{m.label}</span>
              <span style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub }}>{m.count ? `${m.count} job${m.count === 1 ? "" : "s"}` : "—"}</span>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: m.count ? COLORS.ink : COLORS.sub, textAlign: "right" }}>{m.value.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0 0", marginTop: 6, borderTop: `2px solid ${COLORS.border}` }}>
            <span style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 13, color: COLORS.ink }}>{breakdownYear} total</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 15, fontWeight: 700, color: COLORS.accentText }}>{yearTotal.toFixed(2)}</span>
          </div>
        </section>

        <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "4px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 6px" }}>
            <span style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 14, color: COLORS.ink }}>
              Paid jobs — {breakdownYear} ({paidJobsInYear.length})
            </span>
            {paidJobsInYear.length > 0 && (
              <button
                onClick={handleExportCsv}
                style={{ minHeight: 28, borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", color: COLORS.sub, fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "0 10px" }}
              >
                Export CSV
              </button>
            )}
          </div>
          {paidJobsInYear.map((j, i, arr) => (
            <button
              key={j.id}
              onClick={() => onOpenJob(j.id)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "10px 0", borderTop: i > 0 ? `1px solid ${COLORS.border}` : "none", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: COLORS.ink }}>{j.name}</div>
                {j.client && <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, marginTop: 2 }}>{j.client}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: COLORS.reuse }}>{j.value.toFixed(2)}</div>
                <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, marginTop: 2 }}>
                  {new Date(j.revenueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </div>
            </button>
          ))}
          {paidJobsInYear.length === 0 && (
            <p style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.sub, padding: "0 0 12px" }}>No paid jobs for {breakdownYear} yet.</p>
          )}
        </section>

        {overdueJobs.length > 0 && (
          <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.wasteText}`, borderRadius: 12, padding: "4px 16px" }}>
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 14, color: COLORS.wasteText, padding: "12px 0 6px" }}>
              Overdue ({overdueJobs.length})
            </div>
            {overdueJobs.map((j, i, arr) => (
              <button
                key={j.id}
                onClick={() => onOpenJob(j.id)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "10px 0", borderTop: i > 0 ? `1px solid ${COLORS.border}` : "none", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <div>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: COLORS.ink }}>{j.name}</div>
                  {j.client && <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, marginTop: 2 }}>{j.client}</div>}
                </div>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: COLORS.wasteText, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {new Date(j.scheduledDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </span>
              </button>
            ))}
          </section>
        )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <h1 style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 34, color: COLORS.accentText, margin: 0 }}>
            LayIt
          </h1>
          {onContractorPlan && (
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 15, color: COLORS.accentText, marginTop: -4 }}>
              Contractor
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowSummary(true)} style={secondaryButtonStyle}>Summary</button>
          <button onClick={signOut} style={secondaryButtonStyle}>Sign out</button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, color: onContractorPlan ? COLORS.reuse : COLORS.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {onContractorPlan ? "Contractor plan" : `Free plan — ${activeJobCount}/${FREE_TIER_JOB_LIMIT} job`}
        </span>
        {onContractorPlan ? (
          <button onClick={handleManageBilling} disabled={portalLoading} style={{ ...rowButtonStyle, color: COLORS.accentText, borderColor: COLORS.accent }}>
            {portalLoading ? "Redirecting…" : "Manage billing"}
          </button>
        ) : (
          <button onClick={handleUpgrade} disabled={upgrading} style={{ ...rowButtonStyle, color: COLORS.accentText, borderColor: COLORS.accent }}>
            {upgrading ? "Redirecting…" : "Start free trial"}
          </button>
        )}
      </div>

      <ReminderToggle onContractorPlan={onContractorPlan} />

      {checkoutNotice && (
        <p style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.sub, background: "#F0EEE7", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>{checkoutNotice}</p>
      )}

      <button onClick={handleCreate} disabled={atFreeLimit} style={{ ...primaryButtonStyle, width: "100%", fontSize: 14, opacity: atFreeLimit ? 0.5 : 1, cursor: atFreeLimit ? "default" : "pointer" }}>
        + New job
      </button>
      {atFreeLimit && (
        <p style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub, marginTop: 6 }}>
          Free plan is limited to {FREE_TIER_JOB_LIMIT} active job — archive one, or start a free 7-day trial to add more.
        </p>
      )}

      {onContractorPlan && upcomingJobs.length > 0 && (
        <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "4px 16px", marginTop: 16 }}>
          <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 14, color: COLORS.ink, padding: "12px 0 6px" }}>Upcoming</div>
          {upcomingJobs.map((j, i, arr) => (
            <button
              key={j.id}
              onClick={() => onOpenJob(j.id)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "10px 0", borderTop: i > 0 ? `1px solid ${COLORS.border}` : "none", background: "none", border: "none", borderBottomWidth: 0, cursor: "pointer", textAlign: "left" }}
            >
              <div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: COLORS.ink }}>{j.name}</div>
                {j.client && <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, marginTop: 2 }}>{j.client}</div>}
              </div>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: COLORS.accentText, fontWeight: 600, whiteSpace: "nowrap" }}>
                {new Date(j.scheduledDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </button>
          ))}
        </section>
      )}

      {activeJobCount > 3 && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name or client…"
            style={{ flex: 1, minHeight: 40, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", color: COLORS.ink, fontFamily: "Inter", fontSize: 13, padding: "0 12px" }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minHeight: 40, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", color: COLORS.ink, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, padding: "0 8px" }}
          >
            <option value="all">All statuses</option>
            <option value="quote">Quote</option>
            <option value="in-progress">In progress</option>
            <option value="complete">Complete</option>
          </select>
        </div>
      )}

      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, marginTop: 16, padding: visibleActiveJobs.length ? "4px 16px" : 18 }}>
        {visibleActiveJobs.map((j, i, arr) => (
          <div key={j.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
            <button onClick={() => onOpenJob(j.id)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", flex: 1, padding: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{j.name}</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", color: j.status === "complete" ? COLORS.reuse : COLORS.sub }}>
                  {j.status === "in-progress" ? "In progress" : j.status === "complete" ? "Complete" : "Quote"}
                </span>
              </div>
              {j.client && <div style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub, marginTop: 2 }}>{j.client}</div>}
            </button>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={rowButtonStyle} disabled={atFreeLimit} onClick={() => handleDuplicate(j.id)} title={atFreeLimit ? `Free plan is limited to ${FREE_TIER_JOB_LIMIT} active job` : undefined}>Duplicate</button>
              <button style={rowButtonStyle} onClick={async () => {
                try { await toggleArchiveJob(j.id, true); refresh(); } catch (err) { setError(err.message); }
              }}>Archive</button>
              <button style={{ ...rowButtonStyle, color: COLORS.wasteText }} onClick={async () => {
                try { await deleteJob(j.id); refresh(); } catch (err) { setError(err.message); }
              }}>Delete</button>
            </div>
          </div>
        ))}
        {visibleActiveJobs.length === 0 && (
          <p style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.sub, margin: 0 }}>
            {activeJobCount === 0 ? "No jobs yet — create your first one above." : "No jobs match your search."}
          </p>
        )}
      </section>

      <button
        onClick={() => setShowArchived((v) => !v)}
        style={{ background: "none", border: "none", color: COLORS.sub, cursor: "pointer", padding: 0, marginTop: 20, fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
      >
        {showArchived ? "Hide" : "Show"} archived ({jobs.filter((j) => j.archived).length})
      </button>

      {showArchived && (
        <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, marginTop: 10, padding: jobs.filter((j) => j.archived).length ? "4px 16px" : 18 }}>
          {jobs.filter((j) => j.archived).map((j, i, arr) => (
            <div key={j.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 600, color: COLORS.sub }}>{j.name}</div>
                {j.client && <div style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub, marginTop: 2, opacity: 0.7 }}>{j.client}</div>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={rowButtonStyle} onClick={async () => {
                  try { await toggleArchiveJob(j.id, false); refresh(); } catch (err) { setError(err.message); }
                }}>Unarchive</button>
                <button style={{ ...rowButtonStyle, color: COLORS.wasteText }} onClick={async () => {
                  try { await deleteJob(j.id); refresh(); } catch (err) { setError(err.message); }
                }}>Delete</button>
              </div>
            </div>
          ))}
          {jobs.filter((j) => j.archived).length === 0 && (
            <p style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.sub, margin: 0 }}>No archived jobs.</p>
          )}
        </section>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = signed out
  const [openJobId, setOpenJobId] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);
  // Lifted above JobList/JobWorkspace so both can gate features on plan —
  // JobWorkspace needs it too now (Invoice is Contractor-only), not just
  // the job list's own badge/limit checks.
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    getCurrentUser().then(setUser);
    return onAuthChange(setUser);
  }, []);

  useEffect(() => {
    if (user) getSubscriptionStatus(user.id).then(setSubscription).catch(() => {});
  }, [user]);

  if (user === undefined) return null; // brief auth check, avoid a flash of the sign-in screen
  if (!user) {
    return showSignIn
      ? <SignInScreen onBack={() => setShowSignIn(false)} />
      : <LandingPage onGetStarted={() => setShowSignIn(true)} />;
  }
  if (openJobId) {
    return (
      <JobWorkspace
        jobId={openJobId}
        onBackToJobs={() => setOpenJobId(null)}
        user={user}
        onContractorPlan={isContractorPlan(subscription)}
      />
    );
  }
  return <JobList user={user} onOpenJob={setOpenJobId} subscription={subscription} setSubscription={setSubscription} />;
}
