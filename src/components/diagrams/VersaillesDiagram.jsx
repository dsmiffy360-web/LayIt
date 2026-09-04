import { useRef } from "react";
import { COLORS } from "../../lib/colors";
import { exportSvgAsPng } from "../../lib/exportUtils";

export function VersaillesDiagram({ result, L, W, farL, unit, pieceLabel = "Plank", sectionLabel = "layout" }) {
  const svgRef = useRef(null);
  const padL = 44, padT = 24, padR = 14, padB = 14;
  const effFarL = farL || L;
  const isTrapezoid = Math.abs(effFarL - L) > 1e-9;
  const virtualW = 320;
  const scale = virtualW / Math.max(L, effFarL);
  const drawW = L * scale;
  const drawH = W * scale;
  const svgW = Math.max(drawW, effFarL * scale) + padL + padR;
  const svgH = drawH + padT + padB + 24 + (isTrapezoid ? 14 : 0);
  const pieces = result.versaillesPieces || [];
  const kindColor = { center: COLORS.accent, arm: COLORS.wood1, corner: COLORS.wood2 };
  const rightXAt = (yInRoom) => padL + (L + (effFarL - L) * (W > 0 ? yInRoom / W : 0)) * scale;

  return (
    <section style={{ background: COLORS.blueprint, borderRadius: 10, padding: "14px 12px 18px", marginBottom: 12 }}>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: COLORS.chalk, letterSpacing: "0.06em", marginBottom: 6 }}>
        LAYOUT — {L}{unit}{isTrapezoid ? ` – ${effFarL}${unit}` : ""} × {W}{unit} · Versailles panel · {result.totalPlanks} pieces
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height="auto" style={{ display: "block" }} preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="vers-diagram-title">
        <title id="vers-diagram-title">Versailles panel layout for a {L}{unit} by {W}{unit} room{isTrapezoid ? ` (far wall ${effFarL}${unit})` : ""}, {result.totalPlanks} pieces</title>
        <line x1={padL} y1={14} x2={padL + drawW} y2={14} stroke={COLORS.chalkDim} strokeWidth="1" />
        <text x={padL + drawW / 2} y={10} fill={COLORS.chalk} fontSize="11" fontFamily="JetBrains Mono" textAnchor="middle">{L}{unit}</text>
        <text x={14} y={padT + drawH / 2} fill={COLORS.chalk} fontSize="11" fontFamily="JetBrains Mono" textAnchor="middle" transform={`rotate(-90 14 ${padT + drawH / 2})`}>{W}{unit}</text>
        {pieces.map((p, i) => (
          <polygon
            key={i}
            points={p.poly.map(([x, y]) => `${padL + x * scale},${padT + y * scale}`).join(" ")}
            fill={kindColor[p.kind] || COLORS.wood1}
            stroke={COLORS.blueprint}
            strokeWidth="0.5"
          />
        ))}
        {isTrapezoid ? (
          <polygon
            points={`${padL},${padT} ${padL + drawW},${padT} ${rightXAt(W)},${padT + drawH} ${padL},${padT + drawH}`}
            fill="none" stroke={COLORS.chalk} strokeWidth="1.5"
          />
        ) : (
          <rect x={padL} y={padT} width={drawW} height={drawH} fill="none" stroke={COLORS.chalk} strokeWidth="1.5" />
        )}
        {isTrapezoid && (
          <text x={padL + drawW / 2} y={padT + drawH + 12} fill={COLORS.accentText} fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">
            {effFarL}{unit} (far wall)
          </text>
        )}
        <g transform={`translate(${padL}, ${padT + drawH + 14 + (isTrapezoid ? 14 : 0)})`}>
          {[[COLORS.accent, "Center"], [COLORS.wood1, "Arm"], [COLORS.wood2, "Corner"]].map(([c, label], i) => (
            <g key={label} transform={`translate(${i * 100}, 0)`}>
              <rect width="10" height="10" fill={c} rx="2" />
              <text x="16" y="9" fontSize="10" fontFamily="Inter" fill={COLORS.chalk}>{label}</text>
            </g>
          ))}
        </g>
      </svg>
      <button
        onClick={() => exportSvgAsPng(svgRef.current, `${sectionLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-layout.png`, COLORS.blueprint)}
        style={{ marginTop: 10, width: "100%", minHeight: 38, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, borderRadius: 7, border: `1px solid ${COLORS.chalkDim}`, background: "transparent", color: COLORS.chalk, cursor: "pointer" }}
      >
        ⬇ Save diagram as image
      </button>
    </section>
  );
}
