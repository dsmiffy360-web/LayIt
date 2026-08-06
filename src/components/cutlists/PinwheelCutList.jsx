import { COLORS } from "../../lib/colors";
import { UNIT_DECIMALS } from "../../lib/layoutEngine";

export function PinwheelCutList({ sectionResults, unit, pieceLabel = "Plank", checkedPieces = {}, onBump, onReset }) {
  const decimals = UNIT_DECIMALS[unit];
  let fullPlankCount = 0, fullFillerCount = 0;
  const plankCutTally = new Map();
  const fillerCutTally = new Map();

  sectionResults.forEach((sec) => {
    (sec.pinwheelPieces || []).forEach((p) => {
      const isFiller = p.kind === "filler";
      if (p.full) {
        if (isFiller) fullFillerCount++; else fullPlankCount++;
        return;
      }
      const len = isFiller ? Math.max(p.w, p.h) : (p.w >= p.h ? p.w : p.h);
      const key = +len.toFixed(decimals);
      const tally = isFiller ? fillerCutTally : plankCutTally;
      tally.set(key, (tally.get(key) || 0) + 1);
    });
  });

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
      <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Pinwheel cutting list</div>
      <div style={{ fontSize: 12, color: COLORS.sub, marginBottom: 12 }}>
        Square cuts only. Each block is 4 planks around a small square accent piece — most are full length, the rest trimmed to fit the block or the room's edge.
      </div>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: COLORS.accentText, letterSpacing: "0.06em", fontWeight: 600, marginBottom: 6 }}>PLANKS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {Array.from(plankCutTally.entries()).sort((a, b) => b[0] - a[0]).map(([len, count]) => (
          <TallyRow key={len} tallyKey={`pw-plank-${len}`} count={count} label={`Cut to ${len}${unit}`} />
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 6, background: "#F5EEE3", border: `1px solid ${COLORS.wood1}` }}>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13 }}>Full {pieceLabel.toLowerCase()}s, no cutting</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}>× {fullPlankCount}</span>
        </div>
      </div>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: COLORS.accentText, letterSpacing: "0.06em", fontWeight: 600, marginBottom: 6 }}>CENTER ACCENT SQUARES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Array.from(fillerCutTally.entries()).sort((a, b) => b[0] - a[0]).map(([len, count]) => (
          <TallyRow key={len} tallyKey={`pw-filler-${len}`} count={count} label={`Cut square to ${len}${unit}`} />
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 6, background: "#F5EEE3", border: `1px solid ${COLORS.accent}` }}>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13 }}>Full squares, no cutting</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}>× {fullFillerCount}</span>
        </div>
      </div>
    </section>
  );
}
