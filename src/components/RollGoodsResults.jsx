import { useState } from "react";
import { COLORS } from "../lib/colors";
import { rollStripsToPieces } from "../lib/layoutEngine";
import { RectPiecesDiagram } from "./diagrams/RectPiecesDiagram";

export function RollGoodsResults({ sectionResults, rollTotals, unit, pieceLabel, jobName, buffer, rollEstimatedCost, pricePerPack, materialName }) {
  const bufNum = Math.max(0, parseFloat(buffer) || 0);

  const buildRollText = () => {
    const lines = [];
    lines.push(`Measure Twice — Roll goods plan${materialName ? ` (${materialName})` : ""}`);
    lines.push(`Total roll length needed: ${rollTotals.totalLength.toFixed(1)}${unit} · with ${bufNum}% buffer: ${rollTotals.bufferedLength.toFixed(1)}${unit}`);
    lines.push(`Area to order (with buffer): ${rollTotals.bufferedAreaStd.toFixed(1)} ${rollTotals.areaUnitLabel}`);
    if (rollEstimatedCost !== null) lines.push(`Estimated cost: ${rollEstimatedCost.toFixed(2)}`);
    lines.push("");
    sectionResults.forEach((sec) => {
      if (!sec.rollResult) return;
      lines.push(`Section: ${sec.label} (${sec.L}${unit} x ${sec.W}${unit})`);
      ["lengthwise", "widthwise"].forEach((orient) => {
        const o = sec.rollResult[orient];
        const star = sec.rollResult.recommended === orient ? " ← less material" : "";
        lines.push(`  ${orient}: ${o.strips} strip${o.strips > 1 ? "s" : ""} × ${o.stripLength.toFixed(1)}${unit} = ${o.totalLength.toFixed(1)}${unit}${star}`);
      });
      lines.push("");
    });
    return lines.join("\n");
  };

  const [copyStatus, setCopyStatus] = useState("");
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildRollText());
      setCopyStatus("Copied!");
    } catch (e) {
      setCopyStatus("Couldn't copy");
    }
    setTimeout(() => setCopyStatus(""), 2000);
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: rollEstimatedCost !== null ? 10 : 18 }}>
        {[
          ["Roll length needed", `${rollTotals.totalLength.toFixed(1)}${unit}`, COLORS.wood1],
          [`+${bufNum}% buffer (length)`, `${rollTotals.bufferedLength.toFixed(1)}${unit}`, COLORS.accent],
          [`Area to order, +${bufNum}%`, `${rollTotals.bufferedAreaStd.toFixed(1)} ${rollTotals.areaUnitLabel}`, COLORS.wood2],
          ["Waste", `${rollTotals.wastePct.toFixed(1)}%`, rollTotals.wastePct > 12 ? COLORS.waste : COLORS.reuse],
        ].map(([label, val, accentColor]) => (
          <div key={label} style={{ background: COLORS.panel, borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${accentColor}`, boxShadow: "0 1px 2px rgba(30,27,22,0.05), 0 4px 14px rgba(30,27,22,0.05)" }}>
            <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 600, marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>

      {rollEstimatedCost !== null && (
        <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 18, borderLeft: `3px solid ${COLORS.wood1}` }}>
          <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>Estimated material cost</div>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 600, marginTop: 2 }}>{rollEstimatedCost.toFixed(2)}</div>
        </section>
      )}

      <button
        onClick={handleCopy}
        style={{ width: "100%", minHeight: 44, marginBottom: 18, fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", color: COLORS.ink, cursor: "pointer" }}
      >
        {copyStatus || "📋 Copy as text"}
      </button>

      {sectionResults.map((sec, i) => {
        if (!sec.rollResult) return null;
        const r = sec.rollResult;
        return (
          <div key={sec.id} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              {sectionResults.length > 1 ? `${i + 1}. ${sec.label}` : sec.label}
            </div>
            <RectPiecesDiagram
              pieces={rollStripsToPieces(r, r.recommended)}
              L={sec.L} W={sec.W} unit={unit} pieceLabel="Strip" sectionLabel={`${jobName}-${sec.label}`}
              label={`roll goods, ${r.recommended}`}
              colorFn={(p, idx) => (idx % 2 === 0 ? COLORS.wood1 : COLORS.wood2)}
            />
            <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Both orientations</div>
              {["lengthwise", "widthwise"].map((orient) => {
                const o = r[orient];
                const isRecommended = r.recommended === orient;
                return (
                  <div
                    key={orient}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 12px", borderRadius: 8, marginBottom: 8,
                      background: isRecommended ? "#EAF3EE" : "#FBFAF7",
                      border: `1px solid ${isRecommended ? COLORS.reuse : COLORS.border}`,
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}>
                        {orient === "lengthwise" ? "Strips run lengthwise" : "Strips run widthwise"}{isRecommended ? " — less material" : ""}
                      </div>
                      <div style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub, marginTop: 2 }}>
                        {o.strips} strip{o.strips > 1 ? "s" : ""} × {o.stripLength.toFixed(1)}{unit}
                      </div>
                    </div>
                    <div style={{ fontFamily: "JetBrains Mono", fontSize: 15, fontWeight: 600 }}>{o.totalLength.toFixed(1)}{unit}</div>
                  </div>
                );
              })}
              <p style={{ fontSize: 12, color: COLORS.sub, marginTop: 8, marginBottom: 0 }}>
                Fewer, wider seams aren't always the cheaper option, and pile/pattern direction matters more than material
                savings for most rooms — pick whichever orientation suits the room, not necessarily the one with less waste.
              </p>
            </section>
          </div>
        );
      })}
    </>
  );
}
