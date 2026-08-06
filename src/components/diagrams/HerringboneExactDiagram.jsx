import { useRef } from "react";
import { COLORS } from "../../lib/colors";
import { exportSvgAsPng } from "../../lib/exportUtils";

export function HerringboneExactDiagram({ result, L, W, unit, pieceLabel = "Plank", sectionLabel = "layout" }) {
  const svgRef = useRef(null);
  const padL = 44, padT = 24, padR = 14, padB = 14;
  const virtualW = 320;
  const scale = virtualW / L;
  const drawW = L * scale;
  const drawH = W * scale;
  const svgW = drawW + padL + padR;
  const svgH = drawH + padT + padB + 24;
  const pieces = result.herringbonePieces || [];

  return (
    <section style={{ background: COLORS.blueprint, borderRadius: 10, padding: "14px 12px 18px", marginBottom: 12 }}>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: COLORS.chalk, letterSpacing: "0.06em", marginBottom: 6 }}>
        LAYOUT — {L}{unit} × {W}{unit} · exact herringbone, {result.hbCentered ? "centered" : "corner"} start · {result.totalPlanks} {pieceLabel.toLowerCase()}s
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height="auto" style={{ display: "block" }} preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="hb-diagram-title">
        <title id="hb-diagram-title">Exact herringbone tiling for a {L}{unit} by {W}{unit} room, {result.totalPlanks} planks</title>
        <line x1={padL} y1={14} x2={padL + drawW} y2={14} stroke={COLORS.chalkDim} strokeWidth="1" />
        <text x={padL + drawW / 2} y={10} fill={COLORS.chalk} fontSize="11" fontFamily="JetBrains Mono" textAnchor="middle">
          {L}{unit}
        </text>
        <text
          x={14}
          y={padT + drawH / 2}
          fill={COLORS.chalk}
          fontSize="11"
          fontFamily="JetBrains Mono"
          textAnchor="middle"
          transform={`rotate(-90 14 ${padT + drawH / 2})`}
        >
          {W}{unit}
        </text>
        {pieces.map((p, i) => (
          <rect
            key={i}
            x={padL + p.x * scale}
            y={padT + p.y * scale}
            width={Math.max(p.w * scale - 0.5, 0)}
            height={Math.max(p.h * scale - 0.5, 0)}
            fill={p.full ? (i % 2 === 0 ? COLORS.wood1 : COLORS.wood2) : COLORS.waste}
            stroke={COLORS.blueprint}
            strokeWidth="0.5"
          />
        ))}
        <rect x={padL} y={padT} width={drawW} height={drawH} fill="none" stroke={COLORS.chalk} strokeWidth="1.5" />
        {result.hbCentered && (
          <g>
            <line x1={padL + drawW / 2 - 6} y1={padT + drawH / 2} x2={padL + drawW / 2 + 6} y2={padT + drawH / 2} stroke={COLORS.chalk} strokeWidth="1.5" />
            <line x1={padL + drawW / 2} y1={padT + drawH / 2 - 6} x2={padL + drawW / 2} y2={padT + drawH / 2 + 6} stroke={COLORS.chalk} strokeWidth="1.5" />
          </g>
        )}
        <g transform={`translate(${padL}, ${padT + drawH + 14})`}>
          {[
            [COLORS.wood1, "Full plank"],
            [COLORS.waste, "Cut at perimeter"],
          ].map(([c, label], i) => (
            <g key={label} transform={`translate(${i * 150}, 0)`}>
              <rect width="10" height="10" fill={c} rx="2" />
              <text x="16" y="9" fontSize="10" fontFamily="Inter" fill={COLORS.chalk}>{label}</text>
            </g>
          ))}
        </g>
      </svg>
      <button
        onClick={() => exportSvgAsPng(svgRef.current, `${sectionLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-layout.png`, COLORS.blueprint)}
        style={{
          marginTop: 10,
          width: "100%",
          minHeight: 38,
          fontFamily: "JetBrains Mono",
          fontSize: 12,
          fontWeight: 600,
          borderRadius: 7,
          border: `1px solid ${COLORS.chalkDim}`,
          background: "transparent",
          color: COLORS.chalk,
          cursor: "pointer",
        }}
      >
        ⬇ Save diagram as image
      </button>
    </section>
  );
}
