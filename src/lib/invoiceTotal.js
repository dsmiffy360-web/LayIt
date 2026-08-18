import {
  computeSectionLayout, computeHerringboneExact, computeChevronExact, computeBasketWeaveExact,
  computeDiagonalPlankExact, computeDiagonalHerringboneExact, computePinwheelExact,
  computeDoubleHerringboneExact, computeHexagonExact, computeVersaillesExact, ROW_BASED_METHODS,
} from "./layoutEngine";
import { getActiveDimensions } from "./materialDimensions";

// Total physical pieces (planks/tiles) needed across every section of a job,
// for whichever of the 14 lay patterns is selected — mirrors the exact same
// validation each pattern already uses in ResultsStep.jsx, so a job that
// wouldn't compute there returns null here too rather than a wrong number.
// Roll goods is priced by area, not piece count, so it's handled separately
// in computeMaterialsAmount below.
function computeTotalPieces(job) {
  const { layoutMethod, materialType, unit, hbCentered, sections } = job;
  const { length: activeLength, width: activeWidth } = getActiveDimensions(job);
  const Pl = parseFloat(activeLength), Pw = parseFloat(activeWidth);
  if (isNaN(Pw) || Pw <= 0) return null;
  if (layoutMethod !== "hexagon" && (isNaN(Pl) || Pl <= 0)) return null;
  const gap = materialType === "tile" ? parseFloat(job.groutGap) || 0 : 0;

  let total = 0;
  let any = false;
  for (const s of sections) {
    const L = parseFloat(s.length), W = parseFloat(s.width);
    if (isNaN(L) || isNaN(W) || L <= 0 || W <= 0) continue;

    if (ROW_BASED_METHODS.includes(layoutMethod)) {
      if (Pw > W) continue;
      const r = computeSectionLayout({ L, W, Pl, Pw, minStagger: parseFloat(job.minStagger) || 20, method: layoutMethod, seed: s.id, unit, gap, alcoves: s.alcoves });
      total += r.totalPlanks;
      any = true;
      continue;
    }

    let pieces = null;
    if (layoutMethod === "herringbone" && Pl >= Pw - 1e-9) pieces = computeHerringboneExact(L, W, Pl, Pw, hbCentered);
    else if (layoutMethod === "chevron" && Pl > Pw + 1e-9) pieces = computeChevronExact(L, W, Pl, Pw, hbCentered);
    else if (layoutMethod === "basketweave") pieces = computeBasketWeaveExact(L, W, Pl, Pw);
    else if (layoutMethod === "diagonalplank") pieces = computeDiagonalPlankExact(L, W, Pl, Pw, s.alcoves);
    else if (layoutMethod === "diagonalherringbone" && Pl >= Pw - 1e-9) pieces = computeDiagonalHerringboneExact(L, W, Pl, Pw);
    else if (layoutMethod === "pinwheel" && Pl > Pw + 1e-9) pieces = computePinwheelExact(L, W, Pl, Pw);
    else if (layoutMethod === "doubleherringbone" && Pl >= Pw - 1e-9) pieces = computeDoubleHerringboneExact(L, W, Pl, Pw, hbCentered);
    else if (layoutMethod === "hexagon") pieces = computeHexagonExact(L, W, Pw);
    else if (layoutMethod === "versailles" && Pw < Pl - 1e-9) pieces = computeVersaillesExact(L, W, Pl, Pw);

    if (pieces) {
      total += pieces.length;
      any = true;
    }
  }
  return any ? total : null;
}

// Materials cost for a job — buffered pack count × price/pack, same formula
// regardless of which of the 14 patterns produced the piece count.
export function computeMaterialsAmount(job) {
  if (job.materialType === "roll") return null; // area-priced, not pack-priced — not covered here
  const packSize = parseInt(job.packSize, 10);
  const price = parseFloat(job.pricePerPack);
  if (isNaN(packSize) || packSize <= 0 || isNaN(price) || price <= 0) return null;

  const totalPieces = computeTotalPieces(job);
  if (totalPieces === null) return null;

  const bufNum = Math.max(0, parseFloat(job.buffer) || 0);
  const bufferedPacks = Math.ceil((totalPieces * (1 + bufNum / 100)) / packSize);
  return { amount: bufferedPacks * price, bufferedPacks, price, packLabel: job.materialType === "tile" ? "box" : "pack" };
}

// A job's date for revenue/tax tracking. Prefers the invoice date (entered
// once on the Invoice step) over last-updated, since last-updated shifts
// every time the job row is saved — editing a client's phone number months
// after a job wrapped shouldn't move that job's income into a different
// tax period. Falls back to last-updated for jobs with no invoice date set.
// `j` needs { jobData, updatedAt } — the shape both the job-list summary
// and client-history views already load their jobs in.
export function jobRevenueDate(j) {
  const inv = j.jobData?.invoiceDate;
  if (inv) {
    const d = new Date(inv);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return j.updatedAt;
}

// Full invoice total for a job — same math as InvoiceStep.jsx's live
// preview, extracted here so other views (e.g. the job-list revenue
// summary) use the exact same numbers rather than a second calculation
// that could drift out of sync.
export function computeJobInvoiceTotal(job) {
  const materials = computeMaterialsAmount(job);
  const materialsAmount = materials ? materials.amount : 0;
  const laborAmount = Math.max(0, parseFloat(job.laborCost) || 0);
  const extrasAmount = (job.extraLineItems || []).reduce((sum, li) => sum + Math.max(0, parseFloat(li.amount) || 0), 0);
  const subtotal = materialsAmount + laborAmount + extrasAmount;
  const taxPct = Math.max(0, parseFloat(job.taxRate) || 0);
  const tax = subtotal * (taxPct / 100);
  return { total: subtotal + tax, subtotal, tax, materials };
}
