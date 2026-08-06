import { COLORS } from "../../lib/colors";
import { UNIT_DECIMALS } from "../../lib/layoutEngine";

export function BasketWeaveCutList({ sectionResults, unit, pieceLabel = "Plank", checkedPieces = {}, onBump, onReset }) {
  const decimals = UNIT_DECIMALS[unit];
  let fullCount = 0;
  const cutTally = new Map();
  sectionResults.forEach((sec) => {
    (sec.basketWeavePieces || []).forEach((p) => {
      if (p.full) { fullCount++; return; }
      const len = p.orient === "H" ? p.w : p.h;
      const key = +len.toFixed(decimals);
      cutTally.set(key, (cutTally.get(key) || 0) + 1);
    });
  });
  const cutRows = Array.from(cutTally.entries()).sort((a, b) => b[0] - a[0]);

  const TallyRow = ({ tallyKey, count, label }) => {
    const done = Math.min(checkedPieces[tallyKey] || 0, count);
    const complete = done >= count;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: complete ? "#EAF3EE" : "#FCEEEA", border: `1px solid ${complete ? COLORS.reuse : COLORS.waste}` }}>
        <button onClick={() => onBump && onBump(tallyKey, count)} disabled={complete} style={{ flex: 1, display: "flex", justifyContent: "space-between", background: "none", border: "none", cursor: complete ? "default" : "pointer", padding: 0, fontFamily: "JetBrains Mono" }}>
          <span style={{ fontSize: 13, textDecoration: complete ? "line-through" : "none", opacity: complete ? 0.6 : 1 }}>{complete ? "✓ " : ""}{label}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{done}/{count}</span>
        </button>
        {done > 0 && <button onClick={() => onReset && onReset(tallyKey)} aria-label={`Reset count for ${label}`} style={{ minWidth: 40, minHeight: 40, border: "none", background: "none", cursor: "pointer", color: COLORS.sub, fontFamily: "JetBrains Mono", fontSize: 15 }}>↺</button>}
      </div>
    );
  };

  return (
    <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 18 }}>
      <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Basket weave cutting list</div>
      <div style={{ fontSize: 12, color: COLORS.sub, marginBottom: 12 }}>
        Square cuts only — no angles. Each block is a set of parallel strips; most are full length, the rest trimmed to fit the block or the room's edge.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {cutRows.map(([len, count]) => (
          <TallyRow key={len} tallyKey={`bw-cut-${len}`} count={count} label={`Cut to ${len}${unit}`} />
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 6, background: "#F5EEE3", border: `1px solid ${COLORS.wood1}` }}>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13 }}>Full {pieceLabel.toLowerCase()}s, no cutting</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}>× {fullCount}</span>
        </div>
      </div>
    </section>
  );
}
