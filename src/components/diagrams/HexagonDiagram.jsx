import { useRef } from "react";
import { COLORS } from "../../lib/colors";
import { exportSvgAsPng } from "../../lib/exportUtils";

export function HexagonDiagram({ result, L, W, unit, pieceLabel = "Tile", sectionLabel = "layout" }) {
  const svgRef = useRef(null);
  const padL = 44, padT = 24, padR = 14, padB = 14;
  const virtualW = 320;
  const scale = virtualW / L;
  const drawW = L * scale;
  const drawH = W * scale;
  const pieces = result.hexagonPieces || [];
  // Alcove pieces sit outside the room's 0..L range — extend the canvas so
  // they're visible instead of clipped off, and shift everything right by
  // nearDepth so a near-wall alcove's negative x still lands on-canvas.
  const validAlcoves = (result.alcoves || []).filter((a) => a.span > 0 && a.depth > 0);
  const nearDepth = Math.max(0, ...validAlcoves.filter((a) => a.wall === "near").map((a) => a.depth));
  const farDepth = Math.max(0, ...validAlcoves.filter((a) => a.wall !== "near").map((a) => a.depth));
  const extraL = nearDepth * scale, extraR = farDepth * scale;
  const svgW = drawW + extraL + extraR + padL + padR;
  const svgH = drawH + padT + padB + 24;
  const px = (x) => padL + extraL + x * scale;
  const py = (y) => padT + y * scale;

  return (
    <section style={{ background: COLORS.blueprint, borderRadius: 10, padding: "14px 12px 18px", marginBottom: 12 }}>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: COLORS.chalk, letterSpacing: "0.06em", marginBottom: 6 }}>
        LAYOUT — {L}{unit} × {W}{unit} · hexagon tile · {result.totalPlanks} {pieceLabel.toLowerCase()}s
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height="auto" style={{ display: "block" }} preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="hex-diagram-title">
        <title id="hex-diagram-title">Hexagon tile layout for a {L}{unit} by {W}{unit} room, {result.totalPlanks} tiles</title>
        <line x1={px(0)} y1={14} x2={px(L)} y2={14} stroke={COLORS.chalkDim} strokeWidth="1" />
        <text x={px(L / 2)} y={10} fill={COLORS.chalk} fontSize="11" fontFamily="JetBrains Mono" textAnchor="middle">{L}{unit}</text>
        <text x={14} y={py(W / 2)} fill={COLORS.chalk} fontSize="11" fontFamily="JetBrains Mono" textAnchor="middle" transform={`rotate(-90 14 ${py(W / 2)})`}>{W}{unit}</text>
        {pieces.map((p, i) => (
          <polygon
            key={i}
            points={p.poly.map(([x, y]) => `${px(x)},${py(y)}`).join(" ")}
            fill={p.full ? (i % 2 === 0 ? COLORS.wood1 : COLORS.wood2) : COLORS.waste}
            stroke={COLORS.blueprint}
            strokeWidth="0.5"
            opacity={p.inAlcove ? 0.85 : 1}
          />
        ))}
        <rect x={px(0)} y={py(0)} width={drawW} height={drawH} fill="none" stroke={COLORS.chalk} strokeWidth="1.5" />
        <g transform={`translate(${px(0)}, ${py(0) + drawH + 14})`}>
          {[[COLORS.wood1, "Full tile"], [COLORS.waste, "Cut at perimeter"]].map(([c, label], i) => (
            <g key={label} transform={`translate(${i * 130}, 0)`}>
              <rect width="10" height="10" fill={c} rx="2" />
              <text x="16" y="9" fontSize="10" fontFamily="Inter" fill={COLORS.chalk}>{label}</text>
            </g>
          ))}
        </g>
      </svg>
      {validAlcoves.length > 0 && (
        <p style={{ fontSize: 11, color: COLORS.chalk, marginTop: 8, marginBottom: 0, fontFamily: "Inter" }}>
          Pieces shown outside the {L}{unit} × {W}{unit} outline continue the same hexagon pattern straight into an alcove.
        </p>
      )}
      <button
        onClick={() => exportSvgAsPng(svgRef.current, `${sectionLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-layout.png`, COLORS.blueprint)}
        style={{ marginTop: 10, width: "100%", minHeight: 38, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, borderRadius: 7, border: `1px solid ${COLORS.chalkDim}`, background: "transparent", color: COLORS.chalk, cursor: "pointer" }}
      >
        ⬇ Save diagram as image
      </button>
    </section>
  );
}
