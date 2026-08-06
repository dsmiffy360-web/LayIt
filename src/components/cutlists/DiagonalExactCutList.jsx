import { COLORS } from "../../lib/colors";
import { UNIT_DECIMALS, classifyChevronCut } from "../../lib/layoutEngine";

export function DiagonalExactCutList({ sectionResults, unit, pieceLabel = "Plank", checkedPieces = {}, onBump, onReset }) {
  const decimals = UNIT_DECIMALS[unit];
  const isPlank = sectionResults[0] && sectionResults[0].diagonalKind === "diagonalplank";
  let fullCount = 0, sliverCount = 0;
  const simpleTally = new Map();
  const compoundTally = new Map();

  sectionResults.forEach((sec) => {
    (sec.diagonalPieces || []).forEach((p) => {
      const c = classifyChevronCut(p.full ? null : p.cutSpec);
      if (c.tier === "full") fullCount++;
      else if (c.tier === "sliver") sliverCount++;
      else if (c.tier === "simple") {
        const key = +c.len.toFixed(decimals);
        simpleTally.set(key, (simpleTally.get(key) || 0) + 1);
      } else {
        const key = `${+c.bLen.toFixed(decimals)}×${+c.tLen.toFixed(decimals)}`;
        compoundTally.set(key, (compoundTally.get(key) || 0) + 1);
      }
    });
  });

  const simpleRows = Array.from(simpleTally.entries()).sort((a, b) => b[0] - a[0]);
  const compoundRows = Array.from(compoundTally.entries()).sort((a, b) => b[1] - a[1]);
  const totalPlanks = fullCount + sliverCount + Array.from(simpleTally.values()).reduce((a, b) => a + b, 0) + Array.from(compoundTally.values()).reduce((a, b) => a + b, 0);

  const TallyRow = ({ tallyKey, count, label, sub }) => {
    const done = Math.min(checkedPieces[tallyKey] || 0, count);
    const complete = done >= count;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: complete ? "#EAF3EE" : "#FCEEEA", border: `1px solid ${complete ? COLORS.reuse : COLORS.waste}` }}>
        <button onClick={() => onBump && onBump(tallyKey, count)} disabled={complete} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: complete ? "default" : "pointer", padding: 0, fontFamily: "JetBrains Mono" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, textDecoration: complete ? "line-through" : "none", opacity: complete ? 0.6 : 1 }}>{complete ? "✓ " : ""}{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{done}/{count}</span>
          </div>
          {sub && <div style={{ fontSize: 11, color: COLORS.sub, marginTop: 2 }}>{sub}</div>}
        </button>
        {done > 0 && <button onClick={() => onReset && onReset(tallyKey)} aria-label={`Reset count for ${label}`} style={{ minWidth: 40, minHeight: 40, border: "none", background: "none", cursor: "pointer", color: COLORS.sub, fontFamily: "JetBrains Mono", fontSize: 15 }}>↺</button>}
      </div>
    );
  };

  return (
    <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 18 }}>
      <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
        {isPlank ? "Diagonal plank" : "Diagonal herringbone"} cutting list
      </div>
      <div style={{ fontSize: 12, color: COLORS.sub, marginBottom: 12 }}>
        {totalPlanks} planks total. Every board sits at 45° to the walls, so a wall cut lands at 45° on the board too — most
        perimeter pieces reduce to a single length measurement, cut with a mitre saw set once at 45°. A handful need
        two measurements (a stepped cut) or are small corner slivers best measured off the diagram.
      </div>

      {simpleRows.length > 0 && (
        <>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: COLORS.accentText, letterSpacing: "0.06em", fontWeight: 600, marginBottom: 6 }}>
            SINGLE-CUT PIECES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {simpleRows.map(([len, count]) => (
              <TallyRow key={len} tallyKey={`diag-simple-${len}`} count={count} label={`Cut to ${len}${unit} (45° end)`} />
            ))}
          </div>
        </>
      )}

      {compoundRows.length > 0 && (
        <>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: COLORS.accentText, letterSpacing: "0.06em", fontWeight: 600, marginBottom: 6 }}>
            STEPPED (TWO-CUT) PIECES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {compoundRows.map(([key, count]) => {
              const [bLen, tLen] = key.split("×");
              return (
                <TallyRow
                  key={key}
                  tallyKey={`diag-compound-${key}`}
                  count={count}
                  label={`Near edge ${bLen}${unit}, far edge ${tLen}${unit}`}
                  sub="Cut each edge to its own length — the cut steps between them."
                />
              );
            })}
          </div>
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 6, background: "#F5EEE3", border: `1px solid ${COLORS.wood1}` }}>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13 }}>Full {pieceLabel.toLowerCase()}s, no cutting</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}>× {fullCount}</span>
        </div>
        {sliverCount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 6, background: "#FBF3E9", border: `1px solid ${COLORS.accent}` }}>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 13 }}>Small corner slivers — measure off the diagram</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}>× {sliverCount}</span>
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, color: COLORS.sub, marginTop: 14, marginBottom: 0 }}>
        Start from a chalk line through the room's center (or its longest sightline) and work outward — that keeps
        the pattern symmetrical and pushes the odd cuts out to the edges, where they're covered by trim.
      </p>
    </section>
  );
}
