import { COLORS } from "../../lib/colors";
import { computeSectionLayout, computeHerringboneExact, computeChevronExact, computeBasketWeaveExact, computeDiagonalPlankExact, computeDiagonalHerringboneExact, computePinwheelExact, computeDoubleHerringboneExact, computeHexagonExact, computeVersaillesExact, computeRollGoods, computeCutTally, ROW_BASED_METHODS, UNIT_TO_CM, UNIT_DECIMALS } from "../../lib/layoutEngine";
import { BlueprintDiagram } from "../diagrams/BlueprintDiagram";
import { HerringboneExactDiagram } from "../diagrams/HerringboneExactDiagram";
import { HerringboneExactCutList } from "../cutlists/HerringboneExactCutList";
import { ChevronExactDiagram } from "../diagrams/ChevronExactDiagram";
import { ChevronExactCutList } from "../cutlists/ChevronExactCutList";
import { BasketWeaveDiagram } from "../diagrams/BasketWeaveDiagram";
import { BasketWeaveCutList } from "../cutlists/BasketWeaveCutList";
import { DiagonalExactDiagram } from "../diagrams/DiagonalExactDiagram";
import { DiagonalExactCutList } from "../cutlists/DiagonalExactCutList";
import { PinwheelDiagram } from "../diagrams/PinwheelDiagram";
import { PinwheelCutList } from "../cutlists/PinwheelCutList";
import { DoubleHerringboneDiagram } from "../diagrams/DoubleHerringboneDiagram";
import { DoubleHerringboneCutList } from "../cutlists/DoubleHerringboneCutList";
import { HexagonDiagram } from "../diagrams/HexagonDiagram";
import { HexagonSummary } from "../cutlists/HexagonSummary";
import { VersaillesDiagram } from "../diagrams/VersaillesDiagram";
import { VersaillesCutList } from "../cutlists/VersaillesCutList";
import { RollGoodsResults } from "../RollGoodsResults";

// Ported: the row-based patterns (Staggered, Cascade, 1/3 brick, Random,
// Straight), all nine "exact" patterns (herringbone, chevron, basket
// weave, diagonal plank, diagonal herringbone, pinwheel, double
// herringbone, hexagon, Versailles), and now roll goods — every material
// type and pattern from the original build now works in the real app.
// Hexagon is the one exception that gets a summary instead of a tallied
// cut list (HexagonSummary), since a hexagon's six edges don't reduce to
// simple lengths against a straight wall the way every other pattern
// here does. Roll goods is checked before any layoutMethod branch since
// it's a materialType concern, not a pattern one.
const PORTED_ROW_METHODS = new Set(ROW_BASED_METHODS);

// The 9 "exact" patterns tile a plain rectangle with zero cut pieces — none
// of them have boundary-clipping logic, so an alcove (which makes the room
// non-rectangular) isn't something any of their geometries can tile through.
// Rather than teach 9 different tilings to cut pieces at an arbitrary notch,
// each alcove is filled on its own as a tiny straight-row sub-room (reusing
// the same verified engine the Straight pattern uses), tallied as its own
// separate cut list — the way an installer actually handles a small nook
// off a herringbone or hexagon floor: lay the main pattern in the main
// room, cut boards to fill the nook separately.
function computeAlcoveFillSections(sectionNums, Pl, Pw, unit, gap) {
  if (!(Pl > 0) || !(Pw > 0)) return [];
  const sections = [];
  sectionNums.forEach((s) => {
    (s.alcoves || []).forEach((a) => {
      if (a.span <= 0 || a.depth <= 0) return;
      const fill = computeSectionLayout({ L: a.depth, W: a.span, Pl, Pw, minStagger: 20, method: "straight", seed: 1, unit, gap });
      sections.push({ id: `${s.id}-alcove-${a.id}`, label: `${s.label} — alcove`, ...fill });
    });
  });
  return sections;
}

function AlcoveFillBlock({ alcoveSections, unit, pieceLabel, checkedPieces, onBump, onReset }) {
  if (alcoveSections.length === 0) return null;
  const { cutRows, fullCount, isMixedWidth } = computeCutTally(alcoveSections, unit);
  const totalPlanks = alcoveSections.reduce((sum, s) => sum + s.totalPlanks, 0);
  return (
    <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 18 }}>
      <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Alcove fill</div>
      <p style={{ fontSize: 12, color: COLORS.sub, marginTop: 0, marginBottom: 10 }}>
        The pattern above doesn't tile through an alcove — each one is filled separately with straight-cut {pieceLabel.toLowerCase()}s, {totalPlanks} total.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {cutRows.map(([len, count, width]) => {
          const key = `alcove-${isMixedWidth ? `${len}-${width}` : `${len}`}`;
          const done = Math.min(checkedPieces[key] || 0, count);
          const complete = done >= count;
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: complete ? "#EAF3EE" : "#FCEEEA", border: `1px solid ${complete ? COLORS.reuse : COLORS.waste}` }}>
              <button onClick={() => onBump(key, count)} disabled={complete} style={{ flex: 1, display: "flex", justifyContent: "space-between", background: "none", border: "none", cursor: complete ? "default" : "pointer", fontFamily: "JetBrains Mono" }}>
                <span style={{ fontSize: 13, textDecoration: complete ? "line-through" : "none" }}>
                  {complete ? "✓ " : ""}Cut to {len}{unit}{isMixedWidth ? ` (${width}${unit} wide)` : ""}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{done}/{count}</span>
              </button>
              {done > 0 && <button onClick={() => onReset(key)} style={{ border: "none", background: "none", color: COLORS.sub, fontFamily: "JetBrains Mono" }}>↺</button>}
            </div>
          );
        })}
        {fullCount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 6, background: "#F5EEE3" }}>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 13 }}>Full {pieceLabel.toLowerCase()}s, no cutting</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}>× {fullCount}</span>
          </div>
        )}
      </div>
    </section>
  );
}

export function ResultsStep({ job, updateJob, jobName }) {
  const { sections, unit, layoutMethod, materialType, checkedPieces, hbCentered } = job;
  const activeLength = materialType === "tile" ? job.tileLength : job.plankLength;
  const activeWidth = materialType === "tile" ? job.tileWidth : job.plankWidth;
  const pieceLabel = job.materialName.trim() || (materialType === "tile" ? "Tile" : "Plank");

  const nums = {
    Pl: parseFloat(activeLength),
    Pw: parseFloat(activeWidth),
    minStagger: parseFloat(job.minStagger),
    groutGap: parseFloat(job.groutGap),
    buffer: parseFloat(job.buffer),
    packSize: parseInt(job.packSize, 10),
  };
  const effectiveGap = materialType === "tile" && !isNaN(nums.groutGap) ? nums.groutGap : 0;

  const sectionNums = sections.map((s) => ({
    ...s,
    L: parseFloat(s.length),
    W: parseFloat(s.width),
    obstacleArea: Math.max(0, parseFloat(s.obstacle) || 0),
    alcoves: (s.alcoves || []).map((a) => ({ id: a.id, offset: parseFloat(a.offset) || 0, span: parseFloat(a.span) || 0, depth: parseFloat(a.depth) || 0, wall: a.wall === "near" ? "near" : "far" })),
  }));

  const bump = (key, max) => updateJob({ checkedPieces: { ...checkedPieces, [key]: Math.min((checkedPieces[key] || 0) + 1, max) } });
  const reset = (key) => {
    const next = { ...checkedPieces };
    delete next[key];
    updateJob({ checkedPieces: next });
  };

  // --- Roll goods branch --- (checked before any layoutMethod branch,
  // since materialType==="roll" is orthogonal to layoutMethod entirely —
  // the Pattern step shows "no pattern needed" for roll mode, so
  // layoutMethod just holds whatever was last selected and shouldn't be
  // used to route here. This also matters for validation: roll goods
  // doesn't need Pl, pack size, or stagger offset the way every pattern
  // below does, so this must not fall through to that check.)
  if (materialType === "roll") {
    const rw = parseFloat(job.rollWidth);
    if (isNaN(rw) || rw <= 0) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter a positive roll width on the Material step.</p>;
    }
    const bufNum = Math.max(0, parseFloat(job.buffer) || 0);
    for (const s of sectionNums) {
      if (isNaN(s.L) || isNaN(s.W) || s.L <= 0 || s.W <= 0) {
        return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive length and width for "{s.label}" on Setup.</p>;
      }
    }
    const rollResults = sectionNums.map((s) => ({ ...s, roomArea: s.L * s.W, rollResult: computeRollGoods(s.L, s.W, rw) }));

    let totalLength = 0, roomArea = 0, coveredArea = 0;
    rollResults.forEach((s) => {
      if (!s.rollResult) return;
      const chosen = s.rollResult[s.rollResult.recommended];
      totalLength += chosen.totalLength;
      roomArea += s.roomArea;
      coveredArea += chosen.totalLength * s.rollResult.rollWidth;
    });
    const bufferedLength = totalLength * (1 + bufNum / 100);
    const bufferedCoveredArea = coveredArea * (1 + bufNum / 100);
    const wastePct = roomArea > 0 ? ((coveredArea - roomArea) / roomArea) * 100 : 0;
    const toCmFactor = UNIT_TO_CM[unit] || 1;
    const areaUnitLabel = unit === "in" ? "sq ft" : "m²";
    const toAreaStd = (areaInUnit2) => (unit === "in" ? areaInUnit2 / 144 : (areaInUnit2 * toCmFactor * toCmFactor) / 10000);
    const rollTotals = { totalLength, bufferedLength, roomArea, coveredArea, wastePct, bufferedAreaStd: toAreaStd(bufferedCoveredArea), roomAreaStd: toAreaStd(roomArea), areaUnitLabel };

    const price = parseFloat(job.pricePerPack);
    const rollEstimatedCost = !isNaN(price) && price > 0 ? rollTotals.bufferedAreaStd * price : null;

    return (
      <RollGoodsResults
        sectionResults={rollResults}
        rollTotals={rollTotals}
        unit={unit}
        pieceLabel={pieceLabel}
        jobName={jobName}
        buffer={job.buffer}
        rollEstimatedCost={rollEstimatedCost}
        pricePerPack={job.pricePerPack}
        materialName={job.materialName}
      />
    );
  }

  // --- Herringbone branch ---
  if (layoutMethod === "herringbone") {
    if (isNaN(nums.Pl) || isNaN(nums.Pw) || nums.Pl <= 0 || nums.Pw <= 0) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive plank dimensions on the Material step.</p>;
    }
    if (nums.Pl < nums.Pw - 1e-9) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Herringbone needs the plank's length to be at least its width.</p>;
    }
    for (const s of sectionNums) {
      if (isNaN(s.L) || isNaN(s.W) || s.L <= 0 || s.W <= 0) {
        return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive length and width for "{s.label}" on Setup.</p>;
      }
    }
    const hbResults = sectionNums.map((s) => {
      const pieces = computeHerringboneExact(s.L, s.W, nums.Pl, nums.Pw, hbCentered, s.alcoves);
      if (!pieces) return { ...s, herringbonePieces: null };
      const totalPlanks = pieces.length;
      const usedPlanksArea = totalPlanks * nums.Pl * nums.Pw;
      const roomArea = s.L * s.W;
      return { ...s, herringbonePieces: pieces, totalPlanks, hbCentered, wasteFactor: (usedPlanksArea - roomArea) / roomArea };
    });
    if (hbResults.some((s) => !s.herringbonePieces)) {
      return (
        <p style={{ fontSize: 13, color: COLORS.sub }}>
          This room is too large relative to the plank width for the exact calculation to run safely — try a wider plank.
        </p>
      );
    }
    return (
      <>
        <HerringboneExactCutList sectionResults={hbResults} unit={unit} pieceLabel={pieceLabel} checkedPieces={checkedPieces} onBump={bump} onReset={reset} />
        {hbResults.map((sec, i) => (
          <div key={sec.id} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              {sections.length > 1 ? `${i + 1}. ${sec.label}` : sec.label}
            </div>
            <HerringboneExactDiagram result={sec} L={sec.L} W={sec.W} unit={unit} pieceLabel={pieceLabel} sectionLabel={`${jobName}-${sec.label}`} />
          </div>
        ))}
      </>
    );
  }

  // --- Chevron branch ---
  if (layoutMethod === "chevron") {
    if (isNaN(nums.Pl) || isNaN(nums.Pw) || nums.Pl <= 0 || nums.Pw <= 0) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive plank dimensions on the Material step.</p>;
    }
    if (nums.Pl <= nums.Pw + 1e-9) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Chevron needs the plank's length to be longer than its width.</p>;
    }
    for (const s of sectionNums) {
      if (isNaN(s.L) || isNaN(s.W) || s.L <= 0 || s.W <= 0) {
        return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive length and width for "{s.label}" on Setup.</p>;
      }
    }
    const chevResults = sectionNums.map((s) => {
      const pieces = computeChevronExact(s.L, s.W, nums.Pl, nums.Pw, hbCentered, s.alcoves);
      if (!pieces) return { ...s, chevronPieces: null };
      const totalPlanks = pieces.length;
      const usedPlanksArea = totalPlanks * nums.Pl * nums.Pw;
      const roomArea = s.L * s.W;
      return { ...s, chevronPieces: pieces, totalPlanks, hbCentered, wasteFactor: (usedPlanksArea - roomArea) / roomArea };
    });
    if (chevResults.some((s) => !s.chevronPieces)) {
      return (
        <p style={{ fontSize: 13, color: COLORS.sub }}>
          This room is too large relative to the plank width for the exact calculation to run safely — try a wider plank.
        </p>
      );
    }
    return (
      <>
        <ChevronExactCutList sectionResults={chevResults} unit={unit} pieceLabel={pieceLabel} checkedPieces={checkedPieces} onBump={bump} onReset={reset} />
        {chevResults.map((sec, i) => (
          <div key={sec.id} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              {sections.length > 1 ? `${i + 1}. ${sec.label}` : sec.label}
            </div>
            <ChevronExactDiagram result={sec} L={sec.L} W={sec.W} unit={unit} pieceLabel={pieceLabel} sectionLabel={`${jobName}-${sec.label}`} />
          </div>
        ))}
      </>
    );
  }

  // --- Basket weave branch ---
  if (layoutMethod === "basketweave") {
    if (isNaN(nums.Pl) || isNaN(nums.Pw) || nums.Pl <= 0 || nums.Pw <= 0) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive plank dimensions on the Material step.</p>;
    }
    for (const s of sectionNums) {
      if (isNaN(s.L) || isNaN(s.W) || s.L <= 0 || s.W <= 0) {
        return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive length and width for "{s.label}" on Setup.</p>;
      }
    }
    const bwResults = sectionNums.map((s) => {
      const pieces = computeBasketWeaveExact(s.L, s.W, nums.Pl, nums.Pw);
      const totalPlanks = pieces ? pieces.length : 0;
      const usedPlanksArea = totalPlanks * nums.Pl * nums.Pw;
      const roomArea = s.L * s.W;
      return { ...s, basketWeavePieces: pieces || [], totalPlanks, wasteFactor: pieces ? (usedPlanksArea - roomArea) / roomArea : 0 };
    });
    if (bwResults.some((s) => s.basketWeavePieces.length === 0)) {
      return (
        <p style={{ fontSize: 13, color: COLORS.sub }}>
          This room is too large relative to the plank size for the exact calculation to run safely — try a larger plank.
        </p>
      );
    }
    const bwAlcoveSections = computeAlcoveFillSections(sectionNums, nums.Pl, nums.Pw, unit, effectiveGap);
    return (
      <>
        <BasketWeaveCutList sectionResults={bwResults} unit={unit} pieceLabel={pieceLabel} checkedPieces={checkedPieces} onBump={bump} onReset={reset} />
        <AlcoveFillBlock alcoveSections={bwAlcoveSections} unit={unit} pieceLabel={pieceLabel} checkedPieces={checkedPieces} onBump={bump} onReset={reset} />
        {bwResults.map((sec, i) => (
          <div key={sec.id} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              {sections.length > 1 ? `${i + 1}. ${sec.label}` : sec.label}
            </div>
            <BasketWeaveDiagram result={sec} L={sec.L} W={sec.W} unit={unit} pieceLabel={pieceLabel} sectionLabel={`${jobName}-${sec.label}`} />
          </div>
        ))}
      </>
    );
  }

  // --- Diagonal plank / diagonal herringbone branch (shared components) ---
  if (layoutMethod === "diagonalplank" || layoutMethod === "diagonalherringbone") {
    if (isNaN(nums.Pl) || isNaN(nums.Pw) || nums.Pl <= 0 || nums.Pw <= 0) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive plank dimensions on the Material step.</p>;
    }
    if (layoutMethod === "diagonalherringbone" && nums.Pl < nums.Pw - 1e-9) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Diagonal herringbone needs the plank's length to be at least its width.</p>;
    }
    for (const s of sectionNums) {
      if (isNaN(s.L) || isNaN(s.W) || s.L <= 0 || s.W <= 0) {
        return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive length and width for "{s.label}" on Setup.</p>;
      }
    }
    const diagResults = sectionNums.map((s) => {
      const pieces = layoutMethod === "diagonalplank"
        ? computeDiagonalPlankExact(s.L, s.W, nums.Pl, nums.Pw, s.alcoves)
        : computeDiagonalHerringboneExact(s.L, s.W, nums.Pl, nums.Pw, s.alcoves);
      if (!pieces) return { ...s, diagonalPieces: null };
      const totalPlanks = pieces.length;
      const usedPlanksArea = totalPlanks * nums.Pl * nums.Pw;
      const roomArea = s.L * s.W;
      return { ...s, diagonalPieces: pieces, diagonalKind: layoutMethod, totalPlanks, wasteFactor: (usedPlanksArea - roomArea) / roomArea };
    });
    if (diagResults.some((s) => !s.diagonalPieces)) {
      return (
        <p style={{ fontSize: 13, color: COLORS.sub }}>
          This room is too large relative to the plank size for the exact calculation to run safely — try a larger plank.
        </p>
      );
    }
    return (
      <>
        <DiagonalExactCutList sectionResults={diagResults} unit={unit} pieceLabel={pieceLabel} checkedPieces={checkedPieces} onBump={bump} onReset={reset} />
        {diagResults.map((sec, i) => (
          <div key={sec.id} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              {sections.length > 1 ? `${i + 1}. ${sec.label}` : sec.label}
            </div>
            <DiagonalExactDiagram result={sec} L={sec.L} W={sec.W} unit={unit} pieceLabel={pieceLabel} sectionLabel={`${jobName}-${sec.label}`} />
          </div>
        ))}
      </>
    );
  }

  // --- Pinwheel branch ---
  if (layoutMethod === "pinwheel") {
    if (isNaN(nums.Pl) || isNaN(nums.Pw) || nums.Pl <= 0 || nums.Pw <= 0) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive plank dimensions on the Material step.</p>;
    }
    if (nums.Pl <= nums.Pw + 1e-9) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Pinwheel needs the plank's length to be longer than its width.</p>;
    }
    for (const s of sectionNums) {
      if (isNaN(s.L) || isNaN(s.W) || s.L <= 0 || s.W <= 0) {
        return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive length and width for "{s.label}" on Setup.</p>;
      }
    }
    const pwResults = sectionNums.map((s) => {
      const pieces = computePinwheelExact(s.L, s.W, nums.Pl, nums.Pw, s.alcoves);
      const totalPlanks = pieces ? pieces.filter((p) => p.kind === "plank").length : 0;
      const totalFillers = pieces ? pieces.filter((p) => p.kind === "filler").length : 0;
      const usedPlanksArea = pieces ? pieces.reduce((sum, p) => sum + p.w * p.h, 0) : 0;
      const roomArea = s.L * s.W;
      return { ...s, pinwheelPieces: pieces || [], totalPlanks: totalPlanks + totalFillers, wasteFactor: pieces ? (usedPlanksArea - roomArea) / roomArea : 0 };
    });
    if (pwResults.some((s) => s.pinwheelPieces.length === 0)) {
      return (
        <p style={{ fontSize: 13, color: COLORS.sub }}>
          This room is too large relative to the plank size for the exact calculation to run safely — try a larger plank.
        </p>
      );
    }
    return (
      <>
        <PinwheelCutList sectionResults={pwResults} unit={unit} pieceLabel={pieceLabel} checkedPieces={checkedPieces} onBump={bump} onReset={reset} />
        {pwResults.map((sec, i) => (
          <div key={sec.id} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              {sections.length > 1 ? `${i + 1}. ${sec.label}` : sec.label}
            </div>
            <PinwheelDiagram result={sec} L={sec.L} W={sec.W} unit={unit} pieceLabel={pieceLabel} sectionLabel={`${jobName}-${sec.label}`} />
          </div>
        ))}
      </>
    );
  }

  // --- Double herringbone branch ---
  if (layoutMethod === "doubleherringbone") {
    if (isNaN(nums.Pl) || isNaN(nums.Pw) || nums.Pl <= 0 || nums.Pw <= 0) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive plank dimensions on the Material step.</p>;
    }
    if (nums.Pl < nums.Pw - 1e-9) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Double herringbone needs the plank's length to be at least its width.</p>;
    }
    for (const s of sectionNums) {
      if (isNaN(s.L) || isNaN(s.W) || s.L <= 0 || s.W <= 0) {
        return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive length and width for "{s.label}" on Setup.</p>;
      }
    }
    const dhbResults = sectionNums.map((s) => {
      const pieces = computeDoubleHerringboneExact(s.L, s.W, nums.Pl, nums.Pw, hbCentered, s.alcoves);
      if (!pieces) return { ...s, doubleHerringbonePieces: null };
      const totalPlanks = pieces.length;
      const usedPlanksArea = pieces.reduce((sum, p) => sum + p.w * p.h, 0);
      const roomArea = s.L * s.W;
      return { ...s, doubleHerringbonePieces: pieces, totalPlanks, hbCentered, wasteFactor: (usedPlanksArea - roomArea) / roomArea };
    });
    if (dhbResults.some((s) => !s.doubleHerringbonePieces)) {
      return (
        <p style={{ fontSize: 13, color: COLORS.sub }}>
          This room is too large relative to the plank width for the exact calculation to run safely — try a wider plank.
        </p>
      );
    }
    return (
      <>
        <DoubleHerringboneCutList sectionResults={dhbResults} unit={unit} pieceLabel={pieceLabel} checkedPieces={checkedPieces} onBump={bump} onReset={reset} />
        {dhbResults.map((sec, i) => (
          <div key={sec.id} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              {sections.length > 1 ? `${i + 1}. ${sec.label}` : sec.label}
            </div>
            <DoubleHerringboneDiagram result={sec} L={sec.L} W={sec.W} unit={unit} pieceLabel={pieceLabel} sectionLabel={`${jobName}-${sec.label}`} />
          </div>
        ))}
      </>
    );
  }

  // --- Hexagon branch --- (uses Pw as the hex's flat-to-flat size; Pl
  // isn't used at all, unlike every other pattern here)
  if (layoutMethod === "hexagon") {
    if (isNaN(nums.Pw) || nums.Pw <= 0) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter a positive tile width on the Material step.</p>;
    }
    for (const s of sectionNums) {
      if (isNaN(s.L) || isNaN(s.W) || s.L <= 0 || s.W <= 0) {
        return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive length and width for "{s.label}" on Setup.</p>;
      }
    }
    const hexAreaEst = ((3 * Math.sqrt(3)) / 2) * (nums.Pw / Math.sqrt(3)) * (nums.Pw / Math.sqrt(3));
    const hexResults = sectionNums.map((s) => {
      const pieces = computeHexagonExact(s.L, s.W, nums.Pw, s.alcoves);
      if (!pieces) return { ...s, hexagonPieces: null };
      const totalPlanks = pieces.length;
      const usedPlanksArea = pieces.reduce((sum, p) => sum + p.area, 0);
      const roomArea = s.L * s.W;
      return { ...s, hexagonPieces: pieces, totalPlanks, wasteFactor: (totalPlanks * hexAreaEst - roomArea) / roomArea };
    });
    if (hexResults.some((s) => !s.hexagonPieces)) {
      return (
        <p style={{ fontSize: 13, color: COLORS.sub }}>
          This room is too large relative to the tile size for the exact calculation to run safely — try a larger tile.
        </p>
      );
    }
    return (
      <>
        <HexagonSummary sectionResults={hexResults} pieceLabel={pieceLabel} />
        {hexResults.map((sec, i) => (
          <div key={sec.id} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              {sections.length > 1 ? `${i + 1}. ${sec.label}` : sec.label}
            </div>
            <HexagonDiagram result={sec} L={sec.L} W={sec.W} unit={unit} pieceLabel={pieceLabel} sectionLabel={`${jobName}-${sec.label}`} />
          </div>
        ))}
      </>
    );
  }

  // --- Versailles branch ---
  if (layoutMethod === "versailles") {
    if (isNaN(nums.Pl) || isNaN(nums.Pw) || nums.Pl <= 0 || nums.Pw <= 0) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive plank dimensions on the Material step.</p>;
    }
    if (nums.Pw >= nums.Pl - 1e-9) {
      return <p style={{ fontSize: 13, color: COLORS.sub }}>Versailles needs the plank width (center block size) to be smaller than the plank length (panel size).</p>;
    }
    for (const s of sectionNums) {
      if (isNaN(s.L) || isNaN(s.W) || s.L <= 0 || s.W <= 0) {
        return <p style={{ fontSize: 13, color: COLORS.sub }}>Enter positive length and width for "{s.label}" on Setup.</p>;
      }
    }
    const versResults = sectionNums.map((s) => {
      const pieces = computeVersaillesExact(s.L, s.W, nums.Pl, nums.Pw);
      if (!pieces) return { ...s, versaillesPieces: null };
      const totalPlanks = pieces.length;
      return { ...s, versaillesPieces: pieces, totalPlanks, wasteFactor: 0 };
    });
    if (versResults.some((s) => !s.versaillesPieces)) {
      return (
        <p style={{ fontSize: 13, color: COLORS.sub }}>
          This room is too large relative to the panel size for the exact calculation to run safely — try a larger panel.
        </p>
      );
    }
    const versAlcoveSections = computeAlcoveFillSections(sectionNums, nums.Pl, nums.Pw, unit, effectiveGap);
    return (
      <>
        <VersaillesCutList sectionResults={versResults} unit={unit} pieceLabel={pieceLabel} checkedPieces={checkedPieces} onBump={bump} onReset={reset} />
        <AlcoveFillBlock alcoveSections={versAlcoveSections} unit={unit} pieceLabel={pieceLabel} checkedPieces={checkedPieces} onBump={bump} onReset={reset} />
        {versResults.map((sec, i) => (
          <div key={sec.id} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              {sections.length > 1 ? `${i + 1}. ${sec.label}` : sec.label}
            </div>
            <VersaillesDiagram result={sec} L={sec.L} W={sec.W} unit={unit} pieceLabel={pieceLabel} sectionLabel={`${jobName}-${sec.label}`} />
          </div>
        ))}
      </>
    );
  }

  const error = (() => {
    if ([nums.Pl, nums.Pw, nums.packSize, nums.minStagger].some((v) => isNaN(v) || v <= 0)) {
      return "Enter positive numbers for plank size, pack size, and stagger offset on the Material step.";
    }
    for (const s of sectionNums) {
      if (isNaN(s.L) || isNaN(s.W) || s.L <= 0 || s.W <= 0) return `Enter positive length and width for "${s.label}" on Setup.`;
      if (nums.Pw > s.W) return `Plank width can't exceed the width of "${s.label}".`;
    }
    return null;
  })();

  // Defensive catch-all: every option the Pattern step actually offers is
  // now handled by an explicit branch above, so this should be
  // unreachable in normal use — kept only in case a job carries a
  // layoutMethod value from before some future pattern is added here.
  if (!PORTED_ROW_METHODS.has(layoutMethod)) {
    return (
      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18 }}>
        <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Unrecognized pattern</div>
        <p style={{ fontSize: 13, color: COLORS.sub, margin: 0 }}>
          "{layoutMethod}" isn't a pattern this version recognizes — pick one again on the Pattern step.
        </p>
      </section>
    );
  }


  if (error) {
    return <p style={{ fontSize: 13, color: COLORS.sub }}>{error}</p>;
  }

  const sectionResults = sectionNums.map((s) => ({
    ...s,
    ...computeSectionLayout({
      L: s.L, W: s.W, Pl: nums.Pl, Pw: nums.Pw, minStagger: nums.minStagger, method: layoutMethod,
      seed: s.id, unit, gap: effectiveGap, alcoves: s.alcoves,
    }),
  }));

  const totalPlanks = sectionResults.reduce((sum, s) => sum + s.totalPlanks, 0);
  const roomArea = sectionResults.reduce((sum, s) => sum + s.roomArea, 0);
  const usedArea = sectionResults.reduce((sum, s) => sum + s.usedPlanksArea, 0);
  const wastePct = roomArea > 0 ? ((usedArea - roomArea) / roomArea) * 100 : 0;
  const bufNum = Math.max(0, isNaN(nums.buffer) ? 0 : nums.buffer);
  const bufferedPacks = Math.ceil((totalPlanks * (1 + bufNum / 100)) / nums.packSize);
  const price = parseFloat(job.pricePerPack);
  const estimatedCost = !isNaN(price) && price > 0 ? bufferedPacks * price : null;

  const { cutRows, fullCount, isMixedWidth } = computeCutTally(sectionResults, unit);
  const packLabel = materialType === "tile" ? "box" : "pack";

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: estimatedCost !== null ? 10 : 18 }}>
        {[
          [`${pieceLabel}s needed`, totalPlanks, COLORS.wood1],
          [`${packLabel}s + ${bufNum}% buffer`, bufferedPacks, COLORS.accent],
          ["Waste", `${wastePct.toFixed(1)}%`, wastePct > 12 ? COLORS.waste : COLORS.reuse],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: COLORS.panel, borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${color}` }}>
            <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 600, marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>

      {estimatedCost !== null && (
        <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 18, borderLeft: `3px solid ${COLORS.wood1}` }}>
          <div style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub, textTransform: "uppercase" }}>Estimated material cost</div>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 600, marginTop: 2 }}>{estimatedCost.toFixed(2)}</div>
        </section>
      )}

      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 18 }}>
        <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Batch cutting list</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {cutRows.map(([len, count, width]) => {
            const key = isMixedWidth ? `${len}-${width}` : `${len}`;
            const done = Math.min(checkedPieces[key] || 0, count);
            const complete = done >= count;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: complete ? "#EAF3EE" : "#FCEEEA", border: `1px solid ${complete ? COLORS.reuse : COLORS.waste}` }}>
                <button onClick={() => bump(key, count)} disabled={complete} style={{ flex: 1, display: "flex", justifyContent: "space-between", background: "none", border: "none", cursor: complete ? "default" : "pointer", fontFamily: "JetBrains Mono" }}>
                  <span style={{ fontSize: 13, textDecoration: complete ? "line-through" : "none" }}>
                    {complete ? "✓ " : ""}Cut to {len}{unit}{isMixedWidth ? ` (${width}${unit} wide)` : ""}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{done}/{count}</span>
                </button>
                {done > 0 && <button onClick={() => reset(key)} style={{ border: "none", background: "none", color: COLORS.sub, fontFamily: "JetBrains Mono" }}>↺</button>}
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 6, background: "#F5EEE3" }}>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 13 }}>Full {pieceLabel.toLowerCase()}s, no cutting</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}>× {fullCount}</span>
          </div>
        </div>
      </section>

      <section style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 18 }}>
        <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Row-by-row cut list</div>
        <p style={{ fontSize: 12, color: COLORS.sub, marginTop: 0, marginBottom: 12 }}>
          The batch list above groups identical cuts for efficient sawing. This shows the actual lay order instead, row by row, left to right.
        </p>
        {sectionResults.map((sec) => (
          <div key={sec.id} style={{ marginBottom: 14 }}>
            {sections.length > 1 && (
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, color: COLORS.accentText, marginBottom: 6 }}>{sec.label}</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sec.rows.map((row, ri) => (
                <div key={ri} style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, color: COLORS.sub, minWidth: 48 }}>Row {ri + 1}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {row.pieces.map((p, pi) => (
                      <span
                        key={pi}
                        style={{
                          fontFamily: "JetBrains Mono", fontSize: 12, padding: "3px 7px", borderRadius: 4,
                          background: p.kind === "offcut-reuse" ? "#EAF3EE" : p.kind === "full" ? "#F5EEE3" : "#FCEEEA",
                          color: p.kind === "offcut-reuse" ? COLORS.reuse : p.kind === "full" ? COLORS.ink : COLORS.wasteText,
                        }}
                      >
                        {p.length.toFixed(UNIT_DECIMALS[unit])}{unit}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {sectionResults.map((sec, i) => (
        <div key={sec.id} style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
            {sections.length > 1 ? `${i + 1}. ${sec.label}` : sec.label}
          </div>
          <BlueprintDiagram result={sec} L={sec.L} W={sec.W} unit={unit} pieceLabel={pieceLabel} sectionLabel={`${jobName}-${sec.label}`} />
        </div>
      ))}
    </>
  );
}
