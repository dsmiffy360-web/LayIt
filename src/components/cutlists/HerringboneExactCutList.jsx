import { COLORS } from "../../lib/colors";
import { UNIT_DECIMALS } from "../../lib/layoutEngine";

export function HerringboneExactCutList({ sectionResults, unit, pieceLabel = "Plank", checkedPieces = {}, onBump, onReset }) {
  const decimals = UNIT_DECIMALS[unit];
  let fullCount = 0;
  const cutTally = new Map(); // "wxh" -> count

  sectionResults.forEach((sec) => {
    (sec.herringbonePieces || []).forEach((p) => {
      if (p.full) {
        fullCount++;
      } else if (!p.reuse) {
        const key = `${+p.w.toFixed(decimals)}x${+p.h.toFixed(decimals)}`;
        cutTally.set(key, (cutTally.get(key) || 0) + 1);
      }
    });
  });

  const cutRows = Array.from(cutTally.entries()).sort((a, b) => b[1] - a[1]);
  const totalPlanks = sectionResults.reduce((sum, s) => sum + (s.totalPlanks || 0), 0);
  const avgWastePct = sectionResults.length
    ? (sectionResults.reduce((sum, s) => sum + (s.wasteFactor || 0), 0) / sectionResults.length) * 100
    : 0;

  return (
    <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 18 }}>
      <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Herringbone cutting list</div>
      <div style={{ fontSize: 12, color: COLORS.sub, marginBottom: 12 }}>
        This is an exact tiling — {totalPlanks} planks total, {avgWastePct.toFixed(1)}% waste (all at the perimeter). Every full plank is cut square (90°); only the pieces below need a saw.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {cutRows.map(([key, count]) => {
          const [w, h] = key.split("x");
          const tallyKey = `hb-cut-${key}`;
          const done = Math.min(checkedPieces[tallyKey] || 0, count);
          const complete = done >= count;
          return (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 6,
                background: complete ? "#EAF3EE" : "#FCEEEA",
                border: `1px solid ${complete ? COLORS.reuse : COLORS.waste}`,
              }}
            >
              <button
                onClick={() => onBump && onBump(tallyKey, count)}
                disabled={complete}
                style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: complete ? "default" : "pointer", padding: 0, fontFamily: "JetBrains Mono" }}
              >
                <span style={{ fontSize: 13, textDecoration: complete ? "line-through" : "none", opacity: complete ? 0.6 : 1 }}>
                  {complete ? "✓ " : ""}Cut to {w}{unit} × {h}{unit}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{done}/{count}</span>
              </button>
              {done > 0 && (
                <button
                  onClick={() => onReset && onReset(tallyKey)}
                  aria-label={`Reset count for ${w}${unit} by ${h}${unit} cuts`}
                  style={{ minWidth: 40, minHeight: 40, border: "none", background: "none", cursor: "pointer", color: COLORS.sub, fontFamily: "JetBrains Mono", fontSize: 15 }}
                >
                  ↺
                </button>
              )}
            </div>
          );
        })}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 10px",
            borderRadius: 6,
            background: "#F5EEE3",
            border: `1px solid ${COLORS.wood1}`,
          }}
        >
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13 }}>Full {pieceLabel.toLowerCase()}s, no cutting</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}>× {fullCount}</span>
        </div>
      </div>
      <p style={{ fontSize: 12, color: COLORS.sub, marginTop: 12, marginBottom: 0 }}>
        Start your first course flush with one corner — every piece above is positioned relative to that starting corner, matching the diagram.
      </p>
    </section>
  );
}
