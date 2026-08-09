import { COLORS } from "../lib/colors";
import { computePatternPreview } from "../lib/patternPreview";
import { BlueprintDiagram } from "./diagrams/BlueprintDiagram";
import { HerringboneExactDiagram } from "./diagrams/HerringboneExactDiagram";
import { ChevronExactDiagram } from "./diagrams/ChevronExactDiagram";
import { BasketWeaveDiagram } from "./diagrams/BasketWeaveDiagram";
import { DiagonalExactDiagram } from "./diagrams/DiagonalExactDiagram";
import { PinwheelDiagram } from "./diagrams/PinwheelDiagram";
import { DoubleHerringboneDiagram } from "./diagrams/DoubleHerringboneDiagram";
import { HexagonDiagram } from "./diagrams/HexagonDiagram";
import { VersaillesDiagram } from "./diagrams/VersaillesDiagram";

// Shared with PatternStep.jsx, which renders the same preview inline under
// whichever pattern option is selected — this is the single source of
// truth for "preview kind" -> diagram component so the two never drift.
export const PREVIEW_DIAGRAMS = {
  blueprint: BlueprintDiagram,
  herringbone: HerringboneExactDiagram,
  chevron: ChevronExactDiagram,
  basketweave: BasketWeaveDiagram,
  diagonal: DiagonalExactDiagram,
  pinwheel: PinwheelDiagram,
  doubleherringbone: DoubleHerringboneDiagram,
  hexagon: HexagonDiagram,
  versailles: VersaillesDiagram,
};

// A consistent "what does this look like right now" preview shown on
// Setup, Material, and Pattern (Pattern also shows a copy under whichever
// option is selected — this is the same computation, just always visible
// regardless of which of those three steps you're on). Renders nothing for
// roll goods (no lay pattern applies) or whenever the current inputs can't
// produce a result yet (blank/invalid dimensions) — same "just show
// nothing" behavior computePatternPreview already documents.
export function LivePreview({ job }) {
  if (job.materialType === "roll") return null;
  const preview = computePatternPreview(job);
  const PreviewDiagram = preview && PREVIEW_DIAGRAMS[preview.kind];
  if (!PreviewDiagram) return null;

  const pieceLabel = job.materialName.trim() || (job.materialType === "tile" ? "Tile" : "Plank");

  return (
    <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
      <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Live preview</div>
      <PreviewDiagram result={preview.result} L={preview.result.L} W={preview.result.W} unit={job.unit} pieceLabel={pieceLabel} sectionLabel="live-preview" />
    </section>
  );
}
