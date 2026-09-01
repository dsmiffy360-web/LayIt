import { COLORS } from "../lib/colors";
import { computeHerringboneExact } from "../lib/layoutEngine";
import { HerringboneExactDiagram } from "./diagrams/HerringboneExactDiagram";
import { HerringboneExactCutList } from "./cutlists/HerringboneExactCutList";

// A real example, not a mockup — computed once at load time from the same
// engine every job uses, so it can never drift out of sync with how the
// app actually behaves. Herringbone + an alcove doubles as proof of the
// two claims right above it: the pattern continuing into the alcove, and
// (since the engine now reuses offcuts there) some pieces coming from
// scrap instead of a fresh plank.
const DEMO_L = 400, DEMO_W = 300, DEMO_PL = 120, DEMO_PW = 19;
const DEMO_ALCOVES = [{ id: 1, offset: 80, span: 100, depth: 60, wall: "far" }];
const demoPieces = computeHerringboneExact(DEMO_L, DEMO_W, DEMO_PL, DEMO_PW, false, DEMO_ALCOVES) || [];
const demoTotalPlanks = demoPieces.filter((p) => !p.reuse).length;
const demoUsedArea = demoTotalPlanks * DEMO_PL * DEMO_PW;
const demoRoomArea = DEMO_L * DEMO_W;
const demoResult = {
  herringbonePieces: demoPieces,
  totalPlanks: demoTotalPlanks,
  hbCentered: false,
  alcoves: DEMO_ALCOVES,
  wasteFactor: demoPieces.length ? (demoUsedArea - demoRoomArea) / demoRoomArea : 0,
};

const FEATURES = [
  { title: "Alcoves get the real pattern, not scrap", desc: "Most calculators treat an odd nook as a rectangle plus leftover material. LayIt actually continues herringbone, chevron, hexagon, and more straight into the alcove." },
  { title: "One tool, start to finish", desc: "Measure the room, get the cut list, hand over a client-ready invoice, and pull a tax-ready income breakdown at year end — no separate measuring app, invoicing tool, and spreadsheet to keep in sync." },
  { title: "Built for the job site, not the office", desc: "Installable on your phone and works offline. The cut list is a tap-to-check-off checklist you actually use mid-cut, not a PDF you printed at a desk." },
  { title: "14 lay patterns", desc: "Straight, herringbone, chevron, basket weave, hexagon, Versailles, and more — pick one and see it rendered before you commit material." },
  { title: "Client-ready invoices", desc: "Your logo, business profile, and bank details saved once, reused on every job. Print, copy as text, or save as PDF. Contractor plan." },
  { title: "Client sign-off, not just an invoice", desc: "Capture a signature right on the invoice confirming the client accepted the finished work — a paper trail beyond the payment record. Contractor plan." },
  { title: "A nudge before the job, not after", desc: "Turn on same-day push reminders for scheduled jobs, so nothing slips because it wasn't top of mind that morning. Contractor plan." },
  { title: "Business summary & tax records", desc: "Jobs completed and value of work at a glance, a monthly income breakdown, paid-jobs export, and room/receipt photos kept with each job for tax time. Contractor plan." },
];

const inputLikeButton = { minHeight: 52, borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})`, color: "#FFFFFF", fontFamily: "JetBrains Mono", fontSize: 15, fontWeight: 600, cursor: "pointer", padding: "0 28px" };

export function LandingPage({ onGetStarted }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 60px" }}>
      <div style={{ textAlign: "center", padding: "56px 0 40px" }}>
        <h1 style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 40, color: COLORS.accentText, margin: "0 0 12px" }}>
          LayIt
        </h1>
        <p style={{ fontFamily: "Inter", fontSize: 17, color: COLORS.ink, maxWidth: 480, margin: "0 auto 28px", lineHeight: 1.5 }}>
          Flooring and ceiling cut planning for contractors — know exactly how much material and how many cuts a job needs before you open a box.
        </p>
        <button onClick={onGetStarted} style={inputLikeButton}>
          Get started free
        </button>
        <p style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub, marginTop: 12 }}>
          Free plan available — no card required to start.
        </p>
      </div>

      <section style={{ marginBottom: 48 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, color: COLORS.ink, marginBottom: 6 }}>{f.title}</div>
              <p style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.sub, margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 22, color: COLORS.ink, textAlign: "center", margin: "0 0 8px" }}>
          A real example, not a mockup
        </h2>
        <p style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.sub, textAlign: "center", maxWidth: 480, margin: "0 auto 20px", lineHeight: 1.5 }}>
          This diagram and cut list are computed live by LayIt's own engine — a 4m × 3m room with an alcove, herringbone pattern. Watch the pattern carry straight into the alcove instead of stopping at the wall, and some pieces coming from a reused offcut instead of a fresh plank.
        </p>
        <HerringboneExactDiagram result={demoResult} L={DEMO_L} W={DEMO_W} unit="cm" pieceLabel="Plank" sectionLabel="example" />
        <HerringboneExactCutList sectionResults={[demoResult]} unit="cm" pieceLabel="Plank" />
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 22, color: COLORS.ink, textAlign: "center", margin: "0 0 20px" }}>
          Simple pricing
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 24 }}>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, color: COLORS.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>Free</div>
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 28, color: COLORS.ink, margin: "6px 0 14px" }}>£0</div>
            <ul style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.sub, margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>1 active job at a time</li>
              <li>All 14 lay patterns</li>
              <li>Full cut lists</li>
            </ul>
          </div>
          <div style={{ background: COLORS.panel, border: `2px solid ${COLORS.accent}`, borderRadius: 12, padding: 24 }}>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, color: COLORS.accentText, textTransform: "uppercase", letterSpacing: "0.04em" }}>Contractor</div>
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 28, color: COLORS.ink, margin: "6px 0 4px" }}>
              £12.99<span style={{ fontSize: 14, fontWeight: 500, color: COLORS.sub }}>/month</span>
            </div>
            <div style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.reuse, fontWeight: 600, marginBottom: 14 }}>7-day free trial</div>
            <ul style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.sub, margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>Unlimited active jobs</li>
              <li>Client-ready invoicing & sign-off</li>
              <li>Photo attachments & job reminders</li>
              <li>Everything in Free</li>
              <li>Cancel anytime</li>
            </ul>
          </div>
        </div>
      </section>

      <div style={{ textAlign: "center" }}>
        <button onClick={onGetStarted} style={inputLikeButton}>
          Get started
        </button>
      </div>
    </div>
  );
}
