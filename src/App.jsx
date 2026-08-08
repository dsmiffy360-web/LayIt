import { useState, useEffect } from "react";
import { onAuthChange, signInWithEmail, signInWithGoogle, signOut, getCurrentUser } from "./lib/auth";
import { listJobs, createJob, deleteJob, toggleArchiveJob } from "./lib/jobsApi";
import { getSubscriptionStatus, isContractorPlan, startCheckout, openBillingPortal, FREE_TIER_JOB_LIMIT } from "./lib/subscription";
import { JobWorkspace } from "./components/JobWorkspace";
import { COLORS } from "./lib/colors";

const inputStyle = { fontFamily: "Inter", fontSize: 16, padding: "12px 12px", minHeight: 44, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", color: COLORS.ink, width: "100%" };
const primaryButtonStyle = { minHeight: 48, borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})`, color: "#FFFFFF", fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const secondaryButtonStyle = { minHeight: 44, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.panel, color: COLORS.ink, fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, cursor: "pointer" };

// Phase 2: the job workspace (Setup/Material/Pattern/Results/Invoice) is
// now wired in for the ported patterns — see JobWorkspace.jsx and
// README.md "What's ported vs what's next" for exactly what that covers.

function SignInScreen() {
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

function JobList({ user, onOpenJob }) {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const refresh = async () => {
    try {
      setJobs(await listJobs());
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    refresh();
    getSubscriptionStatus(user.id).then(setSubscription).catch(() => {});

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

  const handleCreate = async () => {
    if (atFreeLimit) return;
    try {
      const id = await createJob({ name: "New job" });
      onOpenJob(id);
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
        <button onClick={signOut} style={secondaryButtonStyle}>Sign out</button>
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

      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, marginTop: 16, padding: jobs.filter((j) => !j.archived).length ? "4px 16px" : 18 }}>
        {jobs.filter((j) => !j.archived).map((j, i, arr) => (
          <div key={j.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
            <button onClick={() => onOpenJob(j.id)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", flex: 1, padding: 0 }}>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{j.name}</div>
              {j.client && <div style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub, marginTop: 2 }}>{j.client}</div>}
            </button>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={rowButtonStyle} onClick={async () => {
                try { await toggleArchiveJob(j.id, true); refresh(); } catch (err) { setError(err.message); }
              }}>Archive</button>
              <button style={{ ...rowButtonStyle, color: COLORS.wasteText }} onClick={async () => {
                try { await deleteJob(j.id); refresh(); } catch (err) { setError(err.message); }
              }}>Delete</button>
            </div>
          </div>
        ))}
        {jobs.filter((j) => !j.archived).length === 0 && (
          <p style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.sub, margin: 0 }}>No jobs yet — create your first one above.</p>
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

  useEffect(() => {
    getCurrentUser().then(setUser);
    return onAuthChange(setUser);
  }, []);

  if (user === undefined) return null; // brief auth check, avoid a flash of the sign-in screen
  if (!user) return <SignInScreen />;
  if (openJobId) return <JobWorkspace jobId={openJobId} onBackToJobs={() => setOpenJobId(null)} />;
  return <JobList user={user} onOpenJob={setOpenJobId} />;
}
