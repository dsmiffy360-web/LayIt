import { COLORS } from "../lib/colors";

const FEATURES = [
  { title: "14 lay patterns", desc: "Straight, herringbone, chevron, basket weave, hexagon, Versailles, and more — pick one and see it rendered before you commit material." },
  { title: "Real cut lists, not estimates", desc: "Exact piece counts and cut lengths for every pattern, with a tap-to-check-off list for cutting day." },
  { title: "Alcoves & odd-shaped rooms", desc: "Split a room into sections and add alcoves — the numbers account for them instead of quietly ignoring the nook." },
  { title: "Client-ready invoices", desc: "Business profile and bank details saved once, reused on every job. Print, copy as text, or save as PDF." },
  { title: "Works on your phone", desc: "Installable as an app on iOS or Android — measure and check off cuts on-site, not just at a desk." },
  { title: "Business summary", desc: "Jobs completed and value of work for this week, month, or year, at a glance on your job list." },
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
              <li>Full cut lists and invoicing</li>
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
