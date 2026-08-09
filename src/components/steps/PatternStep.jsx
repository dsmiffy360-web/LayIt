import { COLORS } from "../../lib/colors";
import { computePatternPreview } from "../../lib/patternPreview";
import { PREVIEW_DIAGRAMS } from "../LivePreview";

const PATTERNS = [
  { id: "stagger-reuse", title: "Staggered — least waste", desc: "Each row's offcut starts the next, so joints fall randomly. Uses the fewest planks.", projects: ["floor"] },
  { id: "cascade", title: "Cascade — always reuse", desc: "Every row starts with the leftover from the row above, however short.", projects: ["floor"] },
  { id: "fixed-third", title: "1/3 brick pattern", desc: "Joints step over by a consistent third each row.", projects: ["floor"] },
  { id: "random", title: "Random", desc: "Every row gets a freshly randomized offset for a natural, no-repeat scatter.", projects: ["floor"] },
  { id: "straight", title: "Straight / stack bond", desc: "Every row starts with a full plank, so joints line up in a grid.", projects: ["floor", "ceiling"] },
  { id: "herringbone", title: "Herringbone", desc: "Classic 90° zigzag. Exact tiling if length ≥ width.", projects: ["floor"] },
  { id: "chevron", title: "Chevron parquet", desc: "Continuous V pattern with 45° mitered ends.", projects: ["floor"] },
  { id: "basketweave", title: "Basket weave", desc: "Checkerboard blocks alternating plank direction.", projects: ["floor"] },
  { id: "diagonalplank", title: "Diagonal plank", desc: "Straight planks run at 45° to the walls.", projects: ["floor"] },
  { id: "diagonalherringbone", title: "Diagonal herringbone", desc: "Herringbone rotated 45° to the walls.", projects: ["floor"] },
  { id: "pinwheel", title: "Pinwheel / windmill", desc: "Four planks around a small square accent block.", projects: ["floor"] },
  { id: "doubleherringbone", title: "Double herringbone", desc: "Herringbone with paired half-width planks per slot.", projects: ["floor"] },
  { id: "hexagon", title: "Hexagon tile", desc: "Honeycomb tessellation, sized by tile width.", projects: ["floor"] },
  { id: "versailles", title: "Versailles panel", desc: "Square medallion — center block, woven arms, corner accents.", projects: ["floor"] },
];

export function PatternStep({ job, updateJob }) {
  const { projectType, materialType, layoutMethod } = job;

  if (materialType === "roll") {
    return (
      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
        <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 8 }}>No pattern needed</div>
        <p style={{ fontSize: 13, color: COLORS.sub, margin: 0 }}>
          Roll goods go down as full-width strips cut from the roll — there's no lay pattern to choose. Head to
          Results to see how much roll length you need.
        </p>
      </section>
    );
  }

  const options = PATTERNS.filter((opt) => opt.projects.includes(projectType));
  const preview = computePatternPreview(job);
  const PreviewDiagram = preview && PREVIEW_DIAGRAMS[preview.kind];
  const pieceLabel = job.materialName.trim() || (materialType === "tile" ? "Tile" : "Plank");

  return (
    <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
      <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Lay pattern</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {options.map((opt) => {
          const isSelected = layoutMethod === opt.id;
          return (
            <div key={opt.id}>
              <button
                onClick={() => updateJob({ layoutMethod: opt.id })}
                style={{
                  width: "100%", textAlign: "left", padding: 12, borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${isSelected ? COLORS.accent : COLORS.border}`,
                  background: isSelected ? "#FBF3E9" : "#FBFAF7",
                }}
              >
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: isSelected ? COLORS.accentText : COLORS.ink }}>
                  {opt.title}
                </div>
                <div style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub, marginTop: 3 }}>{opt.desc}</div>
              </button>
              {isSelected && PreviewDiagram && (
                <div style={{ marginTop: 8, padding: "0 2px" }}>
                  <div style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 600, color: COLORS.sub, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                    Preview {job.sections.length > 1 ? `— ${job.sections[0].label}` : ""}
                  </div>
                  <PreviewDiagram result={preview.result} L={preview.result.L} W={preview.result.W} unit={job.unit} pieceLabel={pieceLabel} sectionLabel="pattern-preview" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {(layoutMethod === "herringbone" || layoutMethod === "chevron") && (
        <div style={{ marginTop: 12 }}>
          <span style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 600, color: COLORS.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Start point
          </span>
          <div style={{ display: "flex", border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden", marginTop: 4 }}>
            {[{ id: false, label: "Corner" }, { id: true, label: "Center of room" }].map((sp) => (
              <button
                key={String(sp.id)}
                onClick={() => updateJob({ hbCentered: sp.id })}
                style={{
                  flex: 1, minHeight: 44, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, border: "none",
                  background: job.hbCentered === sp.id ? `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})` : "#FBFAF7",
                  color: job.hbCentered === sp.id ? COLORS.ink : COLORS.sub,
                }}
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
