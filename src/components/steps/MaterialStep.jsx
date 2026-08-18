import { useState, useEffect } from "react";
import { COLORS } from "../../lib/colors";
import { ROW_BASED_METHODS } from "../../lib/layoutEngine";
import { Field } from "../shared/Field";
import { TextField } from "../shared/TextField";
import { ConfirmButton } from "../shared/ConfirmButton";
import { LivePreview } from "../LivePreview";
import { listSavedMaterials, createSavedMaterial, deleteSavedMaterial } from "../../lib/savedMaterials";
import { getActiveDimensions } from "../../lib/materialDimensions";

let mixedWidthIdCounter = 1000;

export function MaterialStep({ job, updateJob }) {
  const { unit, projectType, materialType, materialName, layoutMethod, mixedWidthEnabled, mixedWidths, buffer, pricePerPack } = job;

  const { length: activeLength, width: activeWidth } = getActiveDimensions(job);
  const setActiveLength = (v) => updateJob(projectType === "ceiling" ? { ceilingTileLength: v } : materialType === "tile" ? { tileLength: v } : { plankLength: v });
  const setActiveWidth = (v) => updateJob(projectType === "ceiling" ? { ceilingTileWidth: v } : materialType === "tile" ? { tileWidth: v } : { plankWidth: v });

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

  // Saved materials — a small reusable price book so a contractor who
  // mostly installs the same handful of products doesn't retype
  // length/width/pack size/price on every new job.
  const [savedMaterials, setSavedMaterials] = useState(null);
  const [savedError, setSavedError] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");

  useEffect(() => {
    listSavedMaterials().then(setSavedMaterials).catch((err) => setSavedError(err.message));
  }, []);

  const applySavedMaterial = (m) => {
    if (projectType === "ceiling") {
      // Ceiling is always tile-shaped regardless of the saved material's
      // own type — apply its dimensions to the ceiling-specific fields so
      // it doesn't leak into (or get overwritten by) floor tile specs.
      updateJob({ materialName: m.name, ceilingTileLength: m.length, ceilingTileWidth: m.width, packSize: m.pack_size, pricePerPack: m.price_per_pack });
    } else if (m.material_type === "roll") {
      updateJob({ materialType: "roll", materialName: m.name, rollWidth: m.roll_width, pricePerPack: m.price_per_pack });
    } else if (m.material_type === "tile") {
      updateJob({ materialType: "tile", materialName: m.name, tileLength: m.length, tileWidth: m.width, packSize: m.pack_size, pricePerPack: m.price_per_pack });
    } else {
      updateJob({ materialType: "plank", materialName: m.name, plankLength: m.length, plankWidth: m.width, packSize: m.pack_size, pricePerPack: m.price_per_pack });
    }
  };

  const handleSaveMaterial = async () => {
    const name = saveNameInput.trim();
    if (!name) return;
    const payload = {
      name,
      material_type: materialType,
      length: materialType === "roll" ? "" : activeLength,
      width: materialType === "roll" ? "" : activeWidth,
      pack_size: materialType === "roll" ? "" : job.packSize,
      price_per_pack: pricePerPack,
      roll_width: materialType === "roll" ? job.rollWidth : "",
    };
    try {
      const id = await createSavedMaterial(payload);
      setSavedMaterials((prev) => [...prev, { id, ...payload }].sort((a, b) => a.name.localeCompare(b.name)));
      setSaveNameInput("");
      setShowSaveForm(false);
    } catch (err) {
      setSavedError(err.message);
    }
  };

  const handleDeleteSavedMaterial = async (id) => {
    try {
      await deleteSavedMaterial(id);
      setSavedMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setSavedError(err.message);
    }
  };

  return (
    <>
    <LivePreview job={job} />

    <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
      <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Saved materials</div>
      {savedError && <p style={{ fontSize: 12, color: COLORS.wasteText, marginTop: 0, marginBottom: 10 }}>{savedError}</p>}
      {savedMaterials && savedMaterials.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {savedMaterials.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "#FBFAF7" }}>
              <button onClick={() => applySavedMaterial(m)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: COLORS.ink }}>{m.name}</div>
                <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, marginTop: 2 }}>
                  {m.material_type === "roll"
                    ? `Roll · ${m.roll_width}${unit} wide${m.price_per_pack ? ` · ${m.price_per_pack}/${unit === "in" ? "sq ft" : "m²"}` : ""}`
                    : `${m.material_type === "tile" ? "Tile" : "Plank"} · ${m.length}×${m.width}${unit}${m.price_per_pack ? ` · ${m.price_per_pack}/pack` : ""}`}
                </div>
              </button>
              <ConfirmButton
                onConfirm={() => handleDeleteSavedMaterial(m.id)}
                armedLabel="Remove?"
                ariaLabel={`Remove saved material ${m.name}`}
                style={{ minHeight: 36, border: "none", background: "none", color: COLORS.wasteText, cursor: "pointer", fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, padding: "0 8px" }}
              >
                Remove
              </ConfirmButton>
            </div>
          ))}
        </div>
      )}
      {savedMaterials && savedMaterials.length === 0 && !showSaveForm && (
        <p style={{ fontSize: 12, color: COLORS.sub, marginTop: 0, marginBottom: 10 }}>
          Nothing saved yet — set up a material below, then save it here to reuse on future jobs.
        </p>
      )}
      {showSaveForm ? (
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <TextField label="Save current material as" value={saveNameInput} onChange={setSaveNameInput} placeholder="e.g. Oak Herringbone 120x19" />
          </div>
          <button onClick={handleSaveMaterial} style={{ alignSelf: "flex-end", minHeight: 44, minWidth: 44, borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})`, color: "#FFFFFF", fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 16px" }}>
            Save
          </button>
          <button onClick={() => { setShowSaveForm(false); setSaveNameInput(""); }} style={{ alignSelf: "flex-end", minHeight: 44, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", color: COLORS.sub, fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 14px" }}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSaveForm(true)}
          style={{ width: "100%", minHeight: 40, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, borderRadius: 7, border: `1px dashed ${COLORS.accent}`, background: "transparent", color: COLORS.accentText, cursor: "pointer" }}
        >
          + Save current material for reuse
        </button>
      )}
    </section>

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
    </>
  );
}
