import { COLORS } from "../../lib/colors";
import { RectPiecesDiagram } from "./RectPiecesDiagram";

export function DoubleHerringboneDiagram({ result, L, W, unit, pieceLabel = "Plank", sectionLabel = "layout" }) {
  return (
    <RectPiecesDiagram
      pieces={result.doubleHerringbonePieces || []}
      L={L} W={W} unit={unit} pieceLabel={pieceLabel} sectionLabel={sectionLabel}
      label={`double herringbone, ${result.hbCentered ? "centered" : "corner"} start`}
      colorFn={(p, i) => (i % 2 === 0 ? COLORS.wood1 : COLORS.wood2)}
    />
  );
}
