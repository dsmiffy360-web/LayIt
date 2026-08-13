import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { loadJob, saveJob } from "../lib/jobsApi";
import { COLORS } from "../lib/colors";
import { SetupStep } from "./steps/SetupStep";
import { MaterialStep } from "./steps/MaterialStep";
import { PatternStep } from "./steps/PatternStep";
import { ResultsStep } from "./steps/ResultsStep";
import { InvoiceStep } from "./steps/InvoiceStep";
import { ROW_BASED_METHODS } from "../lib/layoutEngine";
import { startCheckout } from "../lib/subscription";

// Invoice is Contractor-only. Shown in place of the real step for a free-
// plan user — visible and reachable (not hidden from the step nav) so the
// upgrade path is obvious, rather than a feature that just silently isn't
// there.
function InvoicePaywall({ user }) {
  const [upgrading, setUpgrading] = useState(false);
  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await startCheckout(user.id, user.email);
    } catch {
      setUpgrading(false);
    }
  };
  return (
    <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 24, textAlign: "center" }}>
      <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Invoicing is a Contractor feature</div>
      <p style={{ fontSize: 13, color: COLORS.sub, margin: "0 0 18px", lineHeight: 1.5 }}>
        Client-ready invoices, saved business/bank details, and payment tracking are part of the Contractor plan.
        Start a 7-day free trial to unlock this job's invoice.
      </p>
      <button
        onClick={handleUpgrade}
        disabled={upgrading}
        style={{ minHeight: 48, borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})`, color: "#FFFFFF", fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 24px" }}
      >
        {upgrading ? "Redirecting…" : "Start free trial"}
      </button>
    </section>
  );
}

// Default shape for a brand-new job's `data` JSONB blob — matches the
// artifact's defaultJobData() field-for-field, so a job created here reads
// back identically whether it started here or (during migration) as an
// imported local job from the artifact prototype.
export function defaultJobData() {
  return {
    unit: "cm",
    sections: [{ id: 1, label: "Main area", length: "420", width: "330", obstacle: "0", alcoves: [] }],
    plankLength: "120",
    plankWidth: "19",
    tileLength: "60",
    tileWidth: "60",
    rollWidth: "366",
    packSize: "8",
    minStagger: "20",
    buffer: "8",
    layoutMethod: "stagger-reuse",
    projectType: "floor",
    materialType: "plank",
    materialName: "",
    groutGap: "0.3",
    pricePerPack: "",
    checkedPieces: {},
    hbCentered: false,
    mixedWidthEnabled: false,
    mixedWidths: [{ id: 1, width: "12" }, { id: 2, width: "19" }],
    clientAddress: "",
    invoiceNumber: "",
    invoiceDate: "",
    laborCost: "",
    taxRate: "",
    invoiceNotes: "Payment due within 30 days.",
    extraLineItems: [],
    paymentStatus: "unpaid",
    depositAmount: "",
    attachments: [],
  };
}

const STEPS = [
  { key: "setup", label: "Setup", hint: "Describe the room. Split into extra sections for L-shapes, and add alcoves for nooks that should get longer boards, not shorter ones." },
  { key: "material", label: "Material", hint: "Set your plank, tile, or roll size — this drives every number after this step." },
  { key: "pattern", label: "Pattern", hint: "Pick how it's laid out. The diagram below updates live so you can see the difference before committing." },
  { key: "results", label: "Results", hint: "Your shopping list and cut list. Tap any piece to check it off as you cut." },
  { key: "invoice", label: "Invoice", hint: "Turn the cost estimate into something you can hand a client." },
];

export function JobWorkspace({ jobId, onBackToJobs, user, onContractorPlan }) {
  const [job, setJob] = useState(null);
  const [jobName, setJobName] = useState("New job");
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState(null);
  const [jobStatus, setJobStatus] = useState("quote");
  const [scheduledDate, setScheduledDate] = useState("");
  const [step, setStep] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  // Job status tracking and scheduling are Contractor features, same gate
  // as Invoice — a free-plan click starts the upgrade flow instead of
  // changing anything, so the controls stay visible (not hidden) but
  // inert until the user is actually on the plan that unlocks them.
  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await startCheckout(user.id, user.email);
    } catch {
      setUpgrading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadJob(jobId)
      .then((data) => {
        if (cancelled) return;
        setJob({ ...defaultJobData(), ...data });
        setJobName(data.name || "New job");
        setClientName(data.client || "");
        setClientId(data.clientId || null);
        setJobStatus(data.status || "quote");
        setScheduledDate(data.scheduledDate || "");
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  // Patch one or more fields in the job data at once — every step
  // component calls this instead of holding its own local state, so
  // there's a single source of truth and a single autosave path.
  const updateJob = useCallback((patch) => {
    setJob((prev) => ({ ...prev, ...patch }));
  }, []);

  // Debounced autosave: wait for a pause in edits before writing, so
  // typing a dimension doesn't fire a network request per keystroke.
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!job || loading) return;
    setSaveStatus("Saving…");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveJob(jobId, { ...job, name: jobName, client: clientName, clientId, status: jobStatus, scheduledDate });
        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(""), 1500);
      } catch (err) {
        setSaveStatus("Couldn't save — check your connection");
      }
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [job, jobName, clientName, clientId, jobStatus, scheduledDate, jobId, loading]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: COLORS.sub }}>Loading job…</div>;
  if (loadError) return <div style={{ padding: 40, textAlign: "center", color: COLORS.waste }}>Couldn't load this job: {loadError}</div>;

  const stepProps = { job, updateJob, unit: job.unit };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 40px" }}>
      {/* Thin job strip — back to landing + current job name, matches the
          artifact's WorkspaceJobStrip */}
      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 10, marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onBackToJobs} style={{ minHeight: 36, borderRadius: 8, border: "none", background: "#F0EEE7", color: COLORS.accentText, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, padding: "0 12px", cursor: "pointer" }}>
            ← Jobs
          </button>
          <input
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            style={{ flex: 1, border: "none", background: "none", fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: COLORS.ink, minWidth: 0 }}
          />
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: COLORS.sub, opacity: saveStatus ? 1 : 0, transition: "opacity 0.3s" }}>{saveStatus || "·"}</span>
        </div>
        {onContractorPlan ? (
          <div style={{ display: "flex", border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
            {[["quote", "Quote"], ["in-progress", "In progress"], ["complete", "Complete"]].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setJobStatus(id)}
                style={{
                  flex: 1, minHeight: 32, fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, border: "none",
                  background: jobStatus === id ? (id === "complete" ? COLORS.reuse : `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})`) : "#FBFAF7",
                  color: jobStatus === id ? (id === "complete" ? COLORS.ink : "#FFFFFF") : COLORS.sub,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            style={{ minHeight: 32, borderRadius: 8, border: `1px dashed ${COLORS.border}`, background: "#FBFAF7", color: COLORS.sub, fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "left", padding: "0 10px" }}
          >
            {upgrading ? "Redirecting…" : "Locked — job status tracking is a Contractor feature. Tap to start a free trial."}
          </button>
        )}
        {onContractorPlan ? (
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 600, color: COLORS.sub, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
              Scheduled
            </span>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              style={{ flex: 1, minHeight: 36, borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", color: COLORS.ink, fontFamily: "JetBrains Mono", fontSize: 12, padding: "0 8px" }}
            />
            {scheduledDate && (
              <button onClick={() => setScheduledDate("")} aria-label="Clear scheduled date" style={{ border: "none", background: "none", color: COLORS.sub, cursor: "pointer", fontFamily: "JetBrains Mono", fontSize: 14, padding: "0 4px" }}>
                ×
              </button>
            )}
          </label>
        ) : (
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            style={{ minHeight: 36, borderRadius: 7, border: `1px dashed ${COLORS.border}`, background: "#FBFAF7", color: COLORS.sub, fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "left", padding: "0 10px" }}
          >
            {upgrading ? "Redirecting…" : "Locked — scheduling is a Contractor feature. Tap to start a free trial."}
          </button>
        )}
      </section>

      {/* Step nav */}
      <div style={{ display: "flex", background: "#F0EEE7", borderRadius: 10, padding: 4, marginBottom: 8, gap: 2 }}>
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStep(i)}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: 7,
              border: "none",
              background: step === i ? `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})` : "transparent",
              color: step === i ? "#FFFFFF" : COLORS.sub,
              fontFamily: "JetBrains Mono",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: COLORS.sub, marginTop: -4, marginBottom: 14, lineHeight: 1.4 }}>{STEPS[step].hint}</p>

      {step === 0 && <SetupStep {...stepProps} />}
      {step === 1 && <MaterialStep {...stepProps} />}
      {step === 2 && <PatternStep {...stepProps} />}
      {step === 3 && <ResultsStep {...stepProps} jobName={jobName} />}
      {step === 4 && (
        onContractorPlan
          ? <InvoiceStep {...stepProps} jobId={jobId} jobName={jobName} clientName={clientName} setClientName={setClientName} clientId={clientId} setClientId={setClientId} />
          : <InvoicePaywall user={user} />
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        {step > 0 && (
          <button onClick={() => setStep((n) => n - 1)} style={{ flex: 1, minHeight: 48, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.panel, color: COLORS.ink, fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ← Back
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button onClick={() => setStep((n) => n + 1)} style={{ flex: 2, minHeight: 48, borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})`, color: "#FFFFFF", fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Next: {STEPS[step + 1].label} →
          </button>
        )}
      </div>
    </div>
  );
}
