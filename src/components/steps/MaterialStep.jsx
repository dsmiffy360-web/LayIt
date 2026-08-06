import { COLORS } from "../../lib/colors";
import { ROW_BASED_METHODS } from "../../lib/layoutEngine";
import { Field } from "../shared/Field";
import { TextField } from "../shared/TextField";
import { ConfirmButton } from "../shared/ConfirmButton";

let mixedWidthIdCounter = 1000;

export function MaterialStep({ job, updateJob }) {
  const { unit, projectType, materialType, materialName, layoutMethod, mixedWidthEnabled, mixedWidths, buffer, pricePerPack } = job;

  const activeLength = materialType === "tile" ? job.tileLength : job.plankLength;
  const activeWidth = materialType === "tile" ? job.tileWidth : job.plankWidth;
  const setActiveLength = (v) => updateJob(materialType === "tile" ? { tileLength: v } : { plankLength: v });
  const setActiveWidth = (v) => updateJob(materialType === "tile" ? { tileWidth: v } : { plankWidth: v });

  const pieceLabel = materialName.trim() || (materialType === "tile" ? "Tile" : "Plank");
  const packLabel = materialType === "tile" ? "box" : "pack";
  const mixedWidthActive = mixedWidthEnabled && ROW_BASED_METHODS.includes(layoutMethod) && materialType === "plank";

  const updateMixedWidth = (id, patch) => updateJob({ mixedWidths: mixedWidths.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
  const addMixedWidth = () => {
    mixedWidthIdCounter += 1;
    updateJob({ mixedWidths: [...mixedWidths, { id: mixedWidthIdCounter, width: "15" }] });
  };
  const removeMixedWidth = (id) => {
    if (mixedWidths.length > 2) updateJob({ mixedWidths: mixedWidths.filter((w) => w.id !== id) });
  };

  return (
    <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15 }}>
          {projectType === "ceiling" ? "Ceiling material" : "Flooring material"}
        </span>
        {projectType === "floor" && (
          <div style={{ display: "flex", border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
            {[{ id: "plank", label: "Plank" }, { id: "tile", label: "Tile" }, { id: "roll", label: "Roll goods" }].map((m) => (
              <button
                key={m.id}
                onClick={() => updateJob({ materialType: m.id })}
                style={{
                  fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, padding: "10px 16px", minHeight: 44, border: "none", cursor: "pointer",
                  background: materialType === m.id ? `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})` : "#FBFAF7",
                  color: materialType === m.id ? COLORS.ink : COLORS.sub,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <TextField
          label="Material name (optional)"
          value={materialName}
          onChange={(v) => updateJob({ materialName: v })}
          placeholder={materialType === "tile" ? "e.g. Ceramic, Porcelain, Vinyl Tile, Carpet Tile" : materialType === "roll" ? "e.g. Broadloom Carpet, Sheet Vinyl" : "e.g. Hardwood, Laminate, Vinyl Plank, Engineered"}
        />
        <p style={{ fontSize: 11, color: COLORS.sub, marginTop: 6, marginBottom: 0 }}>
          Shows up on the results, cut list, invoice, and CSV export instead of the generic "{materialType === "tile" ? "Tile" : materialType === "roll" ? "Roll" : "Plank"}". Leave blank to keep it generic.
        </p>
      </div>

      {materialType === "roll" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={`Roll width (${unit})`} value={job.rollWidth} onChange={(v) => updateJob({ rollWidth: v })} />
          <Field label="Waste buffer %" value={buffer} onChange={(v) => updateJob({ buffer: v })} step="1" />
          <Field label={`Price per ${unit === "in" ? "sq ft" : "m²"} (optional)`} value={pricePerPack} onChange={(v) => updateJob({ pricePerPack: v })} step="0.01" />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={`${pieceLabel} length (${unit})`} value={activeLength} onChange={setActiveLength} />
          <Field label={`${pieceLabel} width (${unit})`} value={activeWidth} onChange={setActiveWidth} />
          <Field label={`${pieceLabel}s per ${packLabel}`} value={job.packSize} onChange={(v) => updateJob({ packSize: v })} step="1" />
          <Field label={`Min. stagger offset (${unit})`} value={job.minStagger} onChange={(v) => updateJob({ minStagger: v })} />
          {materialType === "tile" && (
            <Field label={`${projectType === "ceiling" ? "Grid" : "Grout"} gap (${unit})`} value={job.groutGap} onChange={(v) => updateJob({ groutGap: v })} />
          )}
          <Field label="Waste buffer %" value={buffer} onChange={(v) => updateJob({ buffer: v })} step="1" />
          <Field label={`Price per ${packLabel} (optional)`} value={pricePerPack} onChange={(v) => updateJob({ pricePerPack: v })} step="0.01" />
        </div>
      )}

      {materialType === "roll" && (
        <p style={{ fontSize: 12, color: COLORS.sub, marginTop: 10, marginBottom: 0 }}>
          This calculates how much roll length you need to cover the room — not a seam-minimizing cut plan. Both
          strip orientations are shown on the results so you can weigh material against seam count and pile
          direction yourself. No lay pattern applies to roll goods, so the Pattern step is skipped.
        </p>
      )}

      {materialType === "plank" && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${COLORS.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: mixedWidthEnabled ? 10 : 0 }}>
            <span style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: COLORS.ink }}>Mixed-width planks</span>
            <div style={{ display: "flex", border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
              {[{ id: false, label: "Off" }, { id: true, label: "On" }].map((opt) => (
                <button
                  key={String(opt.id)}
                  onClick={() => updateJob({ mixedWidthEnabled: opt.id })}
                  style={{
                    minWidth: 52, minHeight: 36, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, border: "none",
                    background: mixedWidthEnabled === opt.id ? `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})` : "#FBFAF7",
                    color: mixedWidthEnabled === opt.id ? COLORS.ink : COLORS.sub,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {mixedWidthEnabled && (
            <div>
              <p style={{ fontSize: 12, color: COLORS.sub, marginTop: 0, marginBottom: 10 }}>
                Rows cycle through these widths in order, repeating — like a real multi-width plank carton. The "
                {pieceLabel} width" field above is ignored while this is on. Only applies to Staggered, Cascade, 1/3
                brick, Random, and Straight.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                {mixedWidths.map((w, i) => (
                  <div key={w.id} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <Field label={`Width ${i + 1} (${unit})`} value={w.width} onChange={(v) => updateMixedWidth(w.id, { width: v })} />
                    </div>
                    <ConfirmButton
                      onConfirm={() => removeMixedWidth(w.id)}
                      armedLabel="Remove?"
                      ariaLabel={`Remove width ${i + 1}`}
                      style={{ minHeight: 44, minWidth: 44, border: "none", background: "none", color: COLORS.wasteText, cursor: "pointer", fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 600, padding: "0 10px", borderRadius: 6 }}
                    >
                      ×
                    </ConfirmButton>
                  </div>
                ))}
              </div>
              <button
                onClick={addMixedWidth}
                style={{ width: "100%", minHeight: 40, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, borderRadius: 7, border: `1px dashed ${COLORS.accent}`, background: "transparent", color: COLORS.accentText, cursor: "pointer" }}
              >
                + Add width
              </button>
              {!mixedWidthActive && (
                <p style={{ fontSize: 12, color: COLORS.wasteText, marginTop: 10, marginBottom: 0 }}>
                  Not applied right now — switch to Staggered, Cascade, 1/3 brick, Random, or Straight on the Pattern step to use this mix.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: 12, color: COLORS.sub, marginTop: 10, marginBottom: 0 }}>
        Switch mm/cm/in on Setup and every value converts automatically. Stagger offset is the minimum joint-to-joint
        distance between rows.
        {materialType === "tile" && ` ${projectType === "ceiling" ? "Grid" : "Grout"} gap is factored into how many ${pieceLabel.toLowerCase()}s fit per row and per column.`}
      </p>
      {!isNaN(parseFloat(pricePerPack)) && parseFloat(pricePerPack) < 0 && (
        <p style={{ fontSize: 12, color: COLORS.wasteText, marginTop: 6, marginBottom: 0 }}>
          Price per {packLabel} is negative — the cost estimate is hidden until it's 0 or more.
        </p>
      )}
      {!isNaN(parseFloat(buffer)) && parseFloat(buffer) < 0 && (
        <p style={{ fontSize: 12, color: COLORS.wasteText, marginTop: 6, marginBottom: 0 }}>
          Waste buffer is negative — treated as 0% so the order never comes up short.
        </p>
      )}
    </section>
  );
}
