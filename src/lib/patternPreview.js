import {
  computeSectionLayout, computeHerringboneExact, computeChevronExact, computeBasketWeaveExact,
  computeDiagonalPlankExact, computeDiagonalHerringboneExact, computePinwheelExact,
  computeDoubleHerringboneExact, computeHexagonExact, computeVersaillesExact, ROW_BASED_METHODS,
} from "./layoutEngine";
import { getActiveDimensions } from "./materialDimensions";

// Computes just enough of a result to feed one of the already-ported
// diagram components, for the Pattern step's live preview — reuses the
// exact same verified functions ResultsStep.jsx uses, just for the first
// section only and without a cut list, since a preview's job is "show
// what this looks like," not "give the full shopping list." Returns
// { kind, result } where `kind` tells PatternStep which diagram
// component to render, or null if the current inputs can't produce one
// (bad dimensions, room too large for the safety cap, etc.) — in which
// case the Pattern step should simply show nothing rather than an error,
// since Setup/Material already validate those inputs on their own steps.
export function computePatternPreview(job) {
  const { layoutMethod, materialType, unit, hbCentered } = job;
  if (materialType === "roll") return null;
  const s = job.sections && job.sections[0];
  if (!s) return null;
  const L = parseFloat(s.length), W = parseFloat(s.width);
  if (isNaN(L) || isNaN(W) || L <= 0 || W <= 0) return null;

  const { length: activeLength, width: activeWidth } = getActiveDimensions(job);
  const Pl = parseFloat(activeLength), Pw = parseFloat(activeWidth);
  if (isNaN(Pl) || isNaN(Pw) || Pl <= 0 || Pw <= 0) return null;

  const gap = materialType === "tile" ? parseFloat(job.groutGap) || 0 : 0;
  // Same parsing ResultsStep.jsx applies before handing alcoves to the
  // engine — raw job state keeps these as form-input strings.
  const alcoves = (s.alcoves || []).map((a) => ({
    id: a.id, offset: parseFloat(a.offset) || 0, span: parseFloat(a.span) || 0,
    depth: parseFloat(a.depth) || 0, wall: a.wall === "near" ? "near" : "far",
  }));

  if (ROW_BASED_METHODS.includes(layoutMethod)) {
    if (Pw > W) return null;
    const result = computeSectionLayout({ L, W, Pl, Pw, minStagger: parseFloat(job.minStagger) || 20, method: layoutMethod, seed: s.id || 1, unit, gap, alcoves });
    return { kind: "blueprint", result: { ...result, L, W } };
  }

  if (layoutMethod === "herringbone") {
    if (Pl < Pw - 1e-9) return null;
    const pieces = computeHerringboneExact(L, W, Pl, Pw, hbCentered, alcoves);
    if (!pieces) return null;
    return { kind: "herringbone", result: { herringbonePieces: pieces, totalPlanks: pieces.filter((p) => !p.reuse).length, hbCentered, alcoves, L, W } };
  }
  if (layoutMethod === "chevron") {
    if (Pl <= Pw + 1e-9) return null;
    const pieces = computeChevronExact(L, W, Pl, Pw, hbCentered, alcoves);
    if (!pieces) return null;
    return { kind: "chevron", result: { chevronPieces: pieces, totalPlanks: pieces.length, hbCentered, alcoves, L, W } };
  }
  if (layoutMethod === "basketweave") {
    const pieces = computeBasketWeaveExact(L, W, Pl, Pw);
    if (!pieces || pieces.length === 0) return null;
    return { kind: "basketweave", result: { basketWeavePieces: pieces, totalPlanks: pieces.length, L, W } };
  }
  if (layoutMethod === "diagonalplank" || layoutMethod === "diagonalherringbone") {
    if (layoutMethod === "diagonalherringbone" && Pl < Pw - 1e-9) return null;
    const pieces = layoutMethod === "diagonalplank" ? computeDiagonalPlankExact(L, W, Pl, Pw, alcoves) : computeDiagonalHerringboneExact(L, W, Pl, Pw, alcoves);
    if (!pieces) return null;
    return { kind: "diagonal", result: { diagonalPieces: pieces, diagonalKind: layoutMethod, totalPlanks: pieces.length, alcoves, L, W } };
  }
  if (layoutMethod === "pinwheel") {
    if (Pl <= Pw + 1e-9) return null;
    const pieces = computePinwheelExact(L, W, Pl, Pw, alcoves);
    if (!pieces || pieces.length === 0) return null;
    return { kind: "pinwheel", result: { pinwheelPieces: pieces, alcoves, L, W } };
  }
  if (layoutMethod === "doubleherringbone") {
    if (Pl < Pw - 1e-9) return null;
    const pieces = computeDoubleHerringboneExact(L, W, Pl, Pw, hbCentered, alcoves);
    if (!pieces) return null;
    return { kind: "doubleherringbone", result: { doubleHerringbonePieces: pieces, hbCentered, alcoves, L, W } };
  }
  if (layoutMethod === "hexagon") {
    const pieces = computeHexagonExact(L, W, Pw, alcoves);
    if (!pieces) return null;
    return { kind: "hexagon", result: { hexagonPieces: pieces, totalPlanks: pieces.length, alcoves, L, W } };
  }
  if (layoutMethod === "versailles") {
    if (Pw >= Pl - 1e-9) return null;
    const pieces = computeVersaillesExact(L, W, Pl, Pw);
    if (!pieces) return null;
    return { kind: "versailles", result: { versaillesPieces: pieces, totalPlanks: pieces.length, L, W } };
  }
  return null;
}
