import { COLORS } from "../../lib/colors";

export function HexagonSummary({ sectionResults, pieceLabel = "Tile" }) {
  const totalTiles = sectionResults.reduce((sum, s) => sum + (s.totalPlanks || 0), 0);
  const fullCount = sectionResults.reduce((sum, s) => sum + (s.hexagonPieces || []).filter((p) => p.full).length, 0);
  const cutCount = totalTiles - fullCount;
  const avgWastePct = sectionResults.length
    ? (sectionResults.reduce((sum, s) => sum + (s.wasteFactor || 0), 0) / sectionResults.length) * 100
    : 0;

  return (
    <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 18 }}>
      <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Hexagon tile cutting guide</div>
      <div style={{ fontSize: 12, color: COLORS.sub, marginBottom: 12 }}>
        This is an exact tiling — {totalTiles} tiles total ({fullCount} full, {cutCount} needing a trim), {avgWastePct.toFixed(1)}% waste.
        A hexagon has six edges, none of them square to a straight wall, so — unlike the rectangular patterns — there's
        no length-based cut list here: every perimeter tile is a slightly different shape, best scribed and cut
        individually against the wall using the diagram above as a placement guide. This matches how hex tile is
        normally installed in practice.
      </div>
    </section>
  );
}
