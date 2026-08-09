import { COLORS } from "../../lib/colors";
import { UNIT_TO_CM, UNIT_DECIMALS } from "../../lib/layoutEngine";
import { Field } from "../shared/Field";
import { ConfirmButton } from "../shared/ConfirmButton";
import { LivePreview } from "../LivePreview";

let sectionIdCounter = 1000; // seeded high — real IDs come from existing job data
let alcoveIdCounter = 1000;

// A quick shape-check for the section being edited — not a scaled technical
// drawing like the pattern/results diagrams, just "does this look like my
// room." Each section is its own independent rectangle in this app's data
// model (no stored adjacency between sections), so this only ever draws
// one rectangle at a time, never a combined L-shape.
function RoomPreview({ length, width, alcoves, unit }) {
  const L = parseFloat(length), W = parseFloat(width);
  if (isNaN(L) || isNaN(W) || L <= 0 || W <= 0) return null;

  const validAlcoves = (alcoves || [])
    .map((a) => ({ offset: parseFloat(a.offset) || 0, span: parseFloat(a.span) || 0, depth: parseFloat(a.depth) || 0, wall: a.wall === "near" ? "near" : "far" }))
    .filter((a) => a.span > 0 && a.depth > 0);
  const nearDepth = Math.max(0, ...validAlcoves.filter((a) => a.wall === "near").map((a) => a.depth));
  const farDepth = Math.max(0, ...validAlcoves.filter((a) => a.wall !== "near").map((a) => a.depth));

  const padX = 20, padY = 20;
  const virtualW = 240;
  const scale = virtualW / L;
  const drawW = L * scale, drawH = W * scale;
  const extraL = nearDepth * scale, extraR = farDepth * scale;
  const svgW = drawW + extraL + extraR + padX * 2;
  const svgH = drawH + padY * 2;
  const px = (x) => padX + extraL + x * scale;
  const py = (y) => padY + y * scale;

  return (
    <div style={{ background: "#F0EEE7", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 10px" }}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height="auto" style={{ display: "block", maxHeight: 140 }} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Room shape, ${length} by ${width} ${unit}`}>
        <rect x={px(0)} y={py(0)} width={drawW} height={drawH} fill="#FBFAF7" stroke={COLORS.wood1} strokeWidth="1.5" />
        {validAlcoves.map((a, i) => (
          <rect
            key={i}
            x={px(a.wall === "near" ? -a.depth : L)}
            y={py(a.offset)}
            width={a.depth * scale}
            height={a.span * scale}
            fill="#FBFAF7"
            stroke={COLORS.accent}
            strokeWidth="1.5"
            strokeDasharray="3,2"
          />
        ))}
        <text x={px(L / 2)} y={py(0) - 6} fill={COLORS.sub} fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">{length}{unit}</text>
        <text x={px(0) - 8} y={py(W / 2)} fill={COLORS.sub} fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle" transform={`rotate(-90 ${px(0) - 8} ${py(W / 2)})`}>{width}{unit}</text>
      </svg>
    </div>
  );
}

export function SetupStep({ job, updateJob }) {
  const { unit, sections, projectType } = job;

  const handleProjectTypeChange = (newType) => {
    if (newType === projectType) return;
    const patch = { projectType: newType };
    if (newType === "ceiling") {
      patch.materialType = "tile";
      patch.layoutMethod = "straight";
    }
    updateJob(patch);
  };

  const handleUnitChange = (newUnit) => {
    if (newUnit === unit) return;
    const decimals = UNIT_DECIMALS[newUnit];
    const convert = (v) => {
      const n = parseFloat(v);
      if (isNaN(n)) return v;
      const cmValue = n * UNIT_TO_CM[unit];
      return (cmValue / UNIT_TO_CM[newUnit]).toFixed(decimals);
    };
    updateJob({
      unit: newUnit,
      sections: sections.map((s) => ({ ...s, length: convert(s.length), width: convert(s.width) })),
      plankLength: convert(job.plankLength),
      plankWidth: convert(job.plankWidth),
      tileLength: convert(job.tileLength),
      tileWidth: convert(job.tileWidth),
      minStagger: convert(job.minStagger),
      groutGap: convert(job.groutGap),
      rollWidth: convert(job.rollWidth),
      mixedWidths: job.mixedWidths.map((w) => ({ ...w, width: convert(w.width) })),
    });
  };

  const updateSection = (id, patch) => {
    updateJob({ sections: sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  };
  const addSection = () => {
    sectionIdCounter += 1;
    updateJob({ sections: [...sections, { id: sectionIdCounter, label: `Section ${sections.length + 1}`, length: "150", width: "150", obstacle: "0", alcoves: [] }] });
  };
  const removeSection = (id) => {
    if (sections.length > 1) updateJob({ sections: sections.filter((s) => s.id !== id) });
  };
  const addAlcove = (sectionId) => {
    alcoveIdCounter += 1;
    updateJob({
      sections: sections.map((s) =>
        s.id === sectionId ? { ...s, alcoves: [...(s.alcoves || []), { id: alcoveIdCounter, offset: "0", span: "60", depth: "60", wall: "far" }] } : s
      ),
    });
  };
  const updateAlcove = (sectionId, alcoveId, patch) => {
    updateJob({
      sections: sections.map((s) =>
        s.id === sectionId ? { ...s, alcoves: s.alcoves.map((a) => (a.id === alcoveId ? { ...a, ...patch } : a)) } : s
      ),
    });
  };
  const removeAlcove = (sectionId, alcoveId) => {
    updateJob({ sections: sections.map((s) => (s.id === sectionId ? { ...s, alcoves: s.alcoves.filter((a) => a.id !== alcoveId) } : s)) });
  };

  return (
    <>
      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, marginBottom: 14, display: "flex", gap: 8 }}>
        {[{ id: "floor", label: "Flooring" }, { id: "ceiling", label: "Ceiling tiles" }].map((p) => (
          <button
            key={p.id}
            onClick={() => handleProjectTypeChange(p.id)}
            style={{
              flex: 1, minHeight: 44, fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, borderRadius: 8,
              border: `1px solid ${projectType === p.id ? COLORS.accent : COLORS.border}`,
              background: projectType === p.id ? `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})` : "#FBFAF7",
              color: projectType === p.id ? COLORS.ink : COLORS.sub, cursor: "pointer",
            }}
          >
            {p.label}
          </button>
        ))}
      </section>

      <LivePreview job={job} />

      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15 }}>Room sections</span>
          <div style={{ display: "flex", border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
            {["mm", "cm", "in"].map((u) => (
              <button
                key={u}
                onClick={() => handleUnitChange(u)}
                style={{
                  fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, padding: "10px 16px", minHeight: 44, border: "none", cursor: "pointer",
                  background: unit === u ? `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})` : "#FBFAF7",
                  color: unit === u ? COLORS.ink : COLORS.sub,
                }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sections.map((s) => (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: 10, background: "#FBFAF7", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 600, color: COLORS.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Section name
                </span>
                <input
                  value={s.label}
                  onChange={(e) => updateSection(s.id, { label: e.target.value })}
                  style={{ fontFamily: "Inter", fontSize: 16, padding: "12px 12px", minHeight: 44, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", color: COLORS.ink, width: "100%", boxSizing: "border-box" }}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label={`Length (${unit})`} value={s.length} onChange={(v) => updateSection(s.id, { length: v })} />
                <Field label={`Width (${unit})`} value={s.width} onChange={(v) => updateSection(s.id, { width: v })} />
              </div>
              <RoomPreview length={s.length} width={s.width} alcoves={s.alcoves} unit={unit} />
              <Field label={`Fixed obstacle (${unit}², e.g. an island — 0 if none)`} value={s.obstacle} onChange={(v) => updateSection(s.id, { obstacle: v })} step="1" />

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 600, color: COLORS.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Alcoves on the far wall
                </span>
                {(s.alcoves || []).length > 0 && (
                  <p style={{ fontSize: 11, color: COLORS.sub, margin: 0 }}>
                    Each is measured across the section's width, from the near wall (0{unit}). Any row that touches an
                    alcove's span gets cut longer to run straight into it. A row that only partly lines up still gets
                    extended; you'll scribe the small leftover corner to fit the wall by hand.
                  </p>
                )}
                {(s.alcoves || []).map((a, ai) => (
                  <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 10, background: "#FBFAF7", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, color: COLORS.accentText }}>Alcove {ai + 1}</span>
                      <ConfirmButton
                        onConfirm={() => removeAlcove(s.id, a.id)}
                        armedLabel="Tap again to remove"
                        ariaLabel={`Remove alcove ${ai + 1}`}
                        style={{ minHeight: 40, border: "none", background: "none", color: COLORS.wasteText, cursor: "pointer", fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 5 }}
                      >
                        Remove
                      </ConfirmButton>
                    </div>
                    <div style={{ display: "flex", border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
                      {[{ id: "near", label: `Near wall (0${unit} end)` }, { id: "far", label: "Far wall" }].map((w) => (
                        <button
                          key={w.id}
                          onClick={() => updateAlcove(s.id, a.id, { wall: w.id })}
                          style={{
                            flex: 1, minHeight: 40, fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                            background: (a.wall || "far") === w.id ? `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})` : "#FBFAF7",
                            color: (a.wall || "far") === w.id ? COLORS.ink : COLORS.sub,
                          }}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <Field label={`Offset (${unit})`} value={a.offset} onChange={(v) => updateAlcove(s.id, a.id, { offset: v })} />
                      <Field label={`Span (${unit})`} value={a.span} onChange={(v) => updateAlcove(s.id, a.id, { span: v })} />
                    </div>
                    <Field label={`Depth beyond the wall (${unit})`} value={a.depth} onChange={(v) => updateAlcove(s.id, a.id, { depth: v })} />
                  </div>
                ))}
                <button
                  onClick={() => addAlcove(s.id)}
                  style={{ minHeight: 44, borderRadius: 8, border: `1px dashed ${COLORS.accent}`, background: "transparent", color: COLORS.accentText, cursor: "pointer", fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}
                >
                  + Add alcove
                </button>
              </div>

              {sections.length === 1 ? (
                <button disabled style={{ minHeight: 44, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#F0EEE7", color: COLORS.border, cursor: "not-allowed", fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}>
                  Remove section
                </button>
              ) : (
                <ConfirmButton
                  onConfirm={() => removeSection(s.id)}
                  armedLabel="Tap again to remove this section"
                  style={{ minHeight: 44, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#FCEEEA", color: COLORS.wasteText, cursor: "pointer", fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}
                >
                  Remove section
                </ConfirmButton>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addSection}
          style={{ marginTop: 10, width: "100%", minHeight: 44, fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, padding: "10px 14px", borderRadius: 8, border: `1px dashed ${COLORS.accent}`, background: "transparent", color: COLORS.accentText, cursor: "pointer" }}
        >
          + Add section
        </button>
        <p style={{ fontSize: 12, color: COLORS.sub, marginTop: 10, marginBottom: 0 }}>
          For an L-shaped room, split it into rectangles and enter each as its own section. A fixed obstacle only
          trims the material estimate — the diagram and cut list still show the full rectangle.
        </p>
      </section>
    </>
  );
}
