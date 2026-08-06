import { useRef } from "react";
import { COLORS } from "../../lib/colors";
import { exportSvgAsPng } from "../../lib/exportUtils";

export function BlueprintDiagram({ result, L, W, unit, pieceLabel = "Plank", sectionLabel = "layout" }) {
  const svgRef = useRef(null);
  const padL = 44, padT = 24, padR = 14, padB = 14;
  const allAlcoves = result.alcoves || [];
  const nearAlcoves = allAlcoves.filter((a) => a.wall === "near").sort((a, b) => a.offset - b.offset);
  const farAlcoves = allAlcoves.filter((a) => a.wall !== "near").sort((a, b) => a.offset - b.offset);
  const hasAlcoves = allAlcoves.length > 0;
  const maxNearDepth = nearAlcoves.length ? Math.max(...nearAlcoves.map((a) => a.depth)) : 0;
  const maxFarDepth = farAlcoves.length ? Math.max(...farAlcoves.map((a) => a.depth)) : 0;

  const virtualW = 320;
  const scale = virtualW / (L + maxNearDepth + maxFarDepth);
  const baseDrawW = L * scale;
  const leftProtrusion = maxNearDepth * scale;
  const rightProtrusion = maxFarDepth * scale;
  const baseLeft = padL + leftProtrusion;
  const baseRight = baseLeft + baseDrawW;
  const drawW = leftProtrusion + baseDrawW + rightProtrusion;
  const drawH = W * scale;
  const svgW = drawW + padL + padR;
  const svgH = drawH + padT + padB + (hasAlcoves ? 42 : 24);

  let yCursor = padT;

  let outlinePoints = null;
  if (hasAlcoves) {
    outlinePoints = [[baseLeft, padT], [baseRight, padT]];
    farAlcoves.forEach((a) => {
      const protrudeX = baseRight + a.depth * scale;
      outlinePoints.push([baseRight, padT + a.offset * scale]);
      outlinePoints.push([protrudeX, padT + a.offset * scale]);
      outlinePoints.push([protrudeX, padT + (a.offset + a.span) * scale]);
      outlinePoints.push([baseRight, padT + (a.offset + a.span) * scale]);
    });
    outlinePoints.push([baseRight, padT + drawH]);
    outlinePoints.push([baseLeft, padT + drawH]);
    [...nearAlcoves].reverse().forEach((a) => {
      const protrudeX = baseLeft - a.depth * scale;
      outlinePoints.push([baseLeft, padT + (a.offset + a.span) * scale]);
      outlinePoints.push([protrudeX, padT + (a.offset + a.span) * scale]);
      outlinePoints.push([protrudeX, padT + a.offset * scale]);
      outlinePoints.push([baseLeft, padT + a.offset * scale]);
    });
  }

  return (
    <section style={{ background: COLORS.blueprint, borderRadius: 10, padding: "14px 12px 18px", marginBottom: 12 }}>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: COLORS.chalk, letterSpacing: "0.06em", marginBottom: 6 }}>
        LAYOUT — {L}{unit} × {W}{unit}{hasAlcoves ? ` + ${allAlcoves.length} alcove${allAlcoves.length > 1 ? "s" : ""}` : ""} · {result.rows.length} row{result.rows.length > 1 ? "s" : ""}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height="auto" style={{ display: "block" }} preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="diagram-title">
        <title id="diagram-title">Scaled diagram of a {L}{unit} by {W}{unit} room showing {result.rows.length} rows of {pieceLabel.toLowerCase()}s</title>
        <line x1={baseLeft} y1={14} x2={baseRight} y2={14} stroke={COLORS.chalkDim} strokeWidth="1" />
        <text x={baseLeft + baseDrawW / 2} y={10} fill={COLORS.chalk} fontSize="11" fontFamily="JetBrains Mono" textAnchor="middle">{L}{unit}</text>
        <text x={10} y={padT + drawH / 2} fill={COLORS.chalk} fontSize="11" fontFamily="JetBrains Mono" textAnchor="middle" transform={`rotate(-90 10 ${padT + drawH / 2})`}>{W}{unit}</text>

        {result.rows.map((row, ri) => {
          const rowH = row.rowWidth * scale;
          const y = yCursor;
          yCursor += rowH;
          const startX = row.rowInAlcove && row.alcoveWall === "near" ? baseLeft - row.alcoveDepth * scale : baseLeft;
          let xCursor = startX;
          return (
            <g key={ri}>
              {row.pieces.map((p, pi) => {
                const pw = p.length * scale;
                const x = xCursor;
                xCursor += pw;
                const fill = p.kind === "offcut-reuse" ? COLORS.reuse : ri % 2 === 0 ? COLORS.wood1 : COLORS.wood2;
                return (
                  <g key={pi}>
                    <rect x={x} y={y} width={Math.max(pw - 1, 0)} height={Math.max(rowH - 1, 0)} fill={fill}
                      stroke={row.rowPartial ? COLORS.waste : COLORS.blueprint}
                      strokeWidth={row.rowPartial ? "1.5" : "1"}
                      strokeDasharray={row.rowPartial ? "3,2" : undefined} />
                    {pw > 34 && (
                      <text x={x + pw / 2} y={y + rowH / 2 + 4} fontSize="10" fontFamily="JetBrains Mono" fill="#1E1B16" textAnchor="middle" opacity={0.85}>
                        {p.length.toFixed(0)}
                      </text>
                    )}
                    {(p.kind === "cut-start" || p.kind === "cut-end") && (
                      <line x1={x + (p.kind === "cut-start" ? pw : 0)} y1={y} x2={x + (p.kind === "cut-start" ? pw : 0)} y2={y + rowH} stroke={COLORS.waste} strokeWidth="2" />
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {outlinePoints ? (
          <polygon points={outlinePoints.map((p) => p.join(",")).join(" ")} fill="none" stroke={COLORS.chalk} strokeWidth="1.5" />
        ) : (
          <rect x={baseLeft} y={padT} width={baseDrawW} height={drawH} fill="none" stroke={COLORS.chalk} strokeWidth="1.5" />
        )}

        <g transform={`translate(${baseLeft}, ${padT + drawH + (hasAlcoves ? 32 : 14)})`}>
          {[[COLORS.wood1, `Full ${pieceLabel.toLowerCase()}`], [COLORS.reuse, "Reused offcut"], [COLORS.waste, "Cut edge"]].map(([c, label], i) => (
            <g key={label} transform={`translate(${i * 150}, 0)`}>
              <rect width="10" height="10" fill={c} rx="2" />
              <text x="16" y="9" fontSize="10" fontFamily="Inter" fill={COLORS.chalk}>{label}</text>
            </g>
          ))}
        </g>
      </svg>
      {hasAlcoves && (
        <p style={{ fontSize: 11, color: COLORS.chalk, marginTop: 8, marginBottom: 0, fontFamily: "Inter" }}>
          Rows shaded past the {L}{unit} line continue straight into an alcove — only rows that don't reach one get cut at the wall line.
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
