import { COLORS } from "../../lib/colors";
import { RectPiecesDiagram } from "./RectPiecesDiagram";

export function PinwheelDiagram({ result, L, W, unit, pieceLabel = "Plank", sectionLabel = "layout" }) {
  return (
    <RectPiecesDiagram
      pieces={result.pinwheelPieces || []}
      L={L} W={W} unit={unit} pieceLabel={pieceLabel} sectionLabel={sectionLabel}
      label="pinwheel"
      colorFn={(p) => (p.kind === "filler" ? COLORS.accent : COLORS.wood1)}
    />
  );
}
