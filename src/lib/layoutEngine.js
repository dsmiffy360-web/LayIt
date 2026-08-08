// layoutEngine.js — the verified calculation core of Measure Twice.
// Pure functions only: no DOM, no React, no browser APIs. Every algorithm
// here was numerically verified (exact area conservation, zero overlap)
// against hand-built test cases before being trusted — see the project
// history for the derivations. Ported unchanged from the working prototype.

const UNIT_TO_CM = { mm: 0.1, cm: 1, in: 2.54 };
const UNIT_DECIMALS = { mm: 0, cm: 1, in: 2 };
const ROW_BASED_METHODS = ["stagger-reuse", "cascade", "fixed-third", "random", "straight"];

function seededRandom(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function computeHerringboneExact(roomL, roomW, Pl, Pw, centered) {
  const W = Pw, L = Pl;
  if (L < W - 1e-9) return null; // length must be at least the width

  const kSpan = Math.ceil((roomL + roomW) / W) + 4;
  const xSpanNeeded = roomL + 2 * kSpan * W + 2 * L;
  const stepsOneSide = Math.ceil((2 * xSpanNeeded) / L) + 8;

  // Safety cap: a small plank width relative to a large room blows this grid
  // up fast. Bail out to the estimate rather than ever risk freezing the tab
  // on a pathological input.
  const estimatedWork = 2 * stepsOneSide * (2 * kSpan + 1);
  if (!isFinite(estimatedWork) || estimatedWork > 800000) {
    return null;
  }

  // Seed piece: anchored at the room's corner by default, or centered on the
  // room's midpoint when requested — a plank straddling the centerpoint
  // symmetrically, matching the "chalk line through the center" convention.
  const seedX = centered ? roomL / 2 - L / 2 : -(kSpan * W + L);
  const seedY = centered ? roomW / 2 - W / 2 : -(kSpan * W + L);

  const base = [{ x: seedX, y: seedY, w: L, h: W }];
  {
    let x = seedX, y = seedY, horiz = true;
    for (let i = 0; i < stepsOneSide; i++) {
      if (horiz) { x = x + L - W; y = y + W; horiz = false; base.push({ x, y, w: W, h: L }); }
      else { x = x + W; y = y + L - W; horiz = true; base.push({ x, y, w: L, h: W }); }
    }
  }
  {
    let x = seedX, y = seedY, horiz = true;
    for (let i = 0; i < stepsOneSide; i++) {
      if (horiz) { x = x - W; y = y - (L - W); horiz = false; base.push({ x, y, w: W, h: L }); }
      else { x = x - (L - W); y = y - W; horiz = true; base.push({ x, y, w: L, h: W }); }
    }
  }

  const pieces = [];
  for (let k = -kSpan; k <= kSpan; k++) {
    const dx = k * W, dy = -k * W;
    for (const p of base) {
      const px = p.x + dx, py = p.y + dy;
      if (px + p.w < 0 || px > roomL || py + p.h < 0 || py > roomW) continue;
      const ix0 = Math.max(px, 0), iy0 = Math.max(py, 0);
      const ix1 = Math.min(px + p.w, roomL), iy1 = Math.min(py + p.h, roomW);
      const iw = ix1 - ix0, ih = iy1 - iy0;
      if (iw > 1e-9 && ih > 1e-9) {
        const full = Math.abs(iw - p.w) < 1e-6 && Math.abs(ih - p.h) < 1e-6;
        pieces.push({ x: ix0, y: iy0, w: iw, h: ih, full, origW: p.w, origH: p.h });
      }
    }
  }
  return pieces;
}

function shoelaceArea(poly) {
  let s = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p1 = poly[i], p2 = poly[(i + 1) % n];
    s += p1[0] * p2[1] - p2[0] * p1[1];
  }
  return Math.abs(s) / 2;
}

function clipPolyToRect(poly, x0, y0, x1, y1) {
  const inside = [
    (p) => p[0] >= x0 - 1e-9,
    (p) => p[0] <= x1 + 1e-9,
    (p) => p[1] >= y0 - 1e-9,
    (p) => p[1] <= y1 + 1e-9,
  ];
  const cross = [
    (p1, p2) => { const t = (x0 - p1[0]) / (p2[0] - p1[0]); return [x0, p1[1] + t * (p2[1] - p1[1])]; },
    (p1, p2) => { const t = (x1 - p1[0]) / (p2[0] - p1[0]); return [x1, p1[1] + t * (p2[1] - p1[1])]; },
    (p1, p2) => { const t = (y0 - p1[1]) / (p2[1] - p1[1]); return [p1[0] + t * (p2[0] - p1[0]), y0]; },
    (p1, p2) => { const t = (y1 - p1[1]) / (p2[1] - p1[1]); return [p1[0] + t * (p2[0] - p1[0]), y1]; },
  ];
  let output = poly;
  for (let e = 0; e < 4; e++) {
    if (output.length === 0) break;
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i - 1 + input.length) % input.length];
      const curIn = inside[e](cur), prevIn = inside[e](prev);
      if (curIn) {
        if (!prevIn) output.push(cross[e](prev, cur));
        output.push(cur);
      } else if (prevIn) {
        output.push(cross[e](prev, cur));
      }
    }
  }
  return output;
}

function computeChevronExact(roomL, roomW, Lraw, W, centered) {
  const Lp = Lraw - W;
  if (Lp <= 0) return null;
  const d = 1 / Math.sqrt(2);
  const makeA = (x0, y0) => [[x0, y0], [x0 + Lp * d, y0 + Lp * d], [x0 + Lp * d, y0 + Lp * d + W * Math.SQRT2], [x0, y0 + W * Math.SQRT2]];
  const makeB = (x0, y0) => [[x0, y0], [x0 + Lp * d, y0 - Lp * d], [x0 + Lp * d, y0 - Lp * d + W * Math.SQRT2], [x0, y0 + W * Math.SQRT2]];

  // Transforms a clipped room-space piece back into the plank's OWN local
  // frame (undoing the 45° rotation) and reads off the bottom/top edge
  // extents there. A wall cut, which is horizontal/vertical in room space,
  // becomes a 45°-diagonal line in this local frame — the same character as
  // the factory miter — so most cut pieces reduce to "a shorter point-length"
  // exactly like the uncut piece, just measurable directly off the polygon
  // instead of assumed.
  function extractCutSpec(clippedPoly, x0, y0, kind) {
    const tol = 1e-4;
    const local = clippedPoly.map(([px, py]) => {
      let X = px - x0, Y = py - y0;
      const theta = kind === "A" ? -Math.PI / 4 : Math.PI / 4;
      const c = Math.cos(theta), s = Math.sin(theta);
      let lx = X * c - Y * s, ly = X * s + Y * c;
      if (kind === "B") ly = -ly;
      return [lx, ly];
    });
    const n = local.length;
    let bottomXs = [], topXs = [];
    for (let i = 0; i < n; i++) {
      const p1 = local[i], p2 = local[(i + 1) % n];
      if (Math.abs(p1[1]) < tol && Math.abs(p2[1]) < tol) bottomXs.push(p1[0], p2[0]);
      if (Math.abs(p1[1] - W) < tol && Math.abs(p2[1] - W) < tol) topXs.push(p1[0], p2[0]);
    }
    const bottom = bottomXs.length ? [Math.min(...bottomXs), Math.max(...bottomXs)] : null;
    const top = topXs.length ? [Math.min(...topXs), Math.max(...topXs)] : null;
    return { bottom, top };
  }

  const diag = roomL + roomW;
  const dy = W * Math.SQRT2;

  // Build the list of (kind, x, y) starting points for one row — either
  // sweeping forward from a far corner (uncentered), or growing both
  // directions from a seed placed at the room's own center (centered).
  let starts;
  if (centered) {
    const nEach = Math.ceil(diag / (Lp * d)) + 10;
    const nRows = Math.ceil(diag / dy) + 10;
    const estimatedWork = (2 * nRows + 1) * (2 * nEach + 1);
    if (!isFinite(estimatedWork) || estimatedWork > 400000) return null;

    // Seed so the seam edge (the vertical seam between the seed piece and
    // its predecessor — the actual V point) has its midpoint exactly at
    // (roomL/2, roomW/2), not just a piece's rough centroid near there.
    const seedX = roomL / 2;
    const seedY = roomW / 2 - (W * Math.SQRT2) / 2;

    starts = [["A", seedX, seedY]];
    let x = seedX, y = seedY, kind = "A";
    for (let i = 0; i < nEach; i++) {
      let p;
      if (kind === "A") { p = makeA(x, y); x = p[1][0]; y = p[1][1]; kind = "B"; }
      else { p = makeB(x, y); x = p[1][0]; y = p[1][1]; kind = "A"; }
      starts.push([kind, x, y]);
    }
    x = seedX; y = seedY; kind = "A";
    for (let i = 0; i < nEach; i++) {
      if (kind === "A") { const px = x - Lp * d, py = y + Lp * d; x = px; y = py; kind = "B"; }
      else { const px = x - Lp * d, py = y - Lp * d; x = px; y = py; kind = "A"; }
      starts.push([kind, x, y]);
    }

    const pieces = [];
    for (let r = -nRows; r <= nRows; r++) {
      const ry = r * dy;
      for (const [kind2, sx, sy] of starts) {
        const y0 = sy + ry;
        const p = kind2 === "A" ? makeA(sx, y0) : makeB(sx, y0);
        const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
        if (Math.max(...xs) < 0 || Math.min(...xs) > roomL || Math.max(...ys) < 0 || Math.min(...ys) > roomW) continue;
        const clipped = clipPolyToRect(p, 0, 0, roomL, roomW);
        if (clipped.length >= 3) {
          const area = shoelaceArea(clipped);
          const full = Math.abs(area - Lp * W) < 1e-6;
          const cutSpec = full ? null : extractCutSpec(clipped, sx, y0, kind2);
          pieces.push({ poly: clipped, area, full, kind: kind2, cutSpec });
        }
      }
    }
    return pieces;
  }

  const startX = -diag, startY = -diag;
  const nPieces = Math.ceil(((roomL - startX) + diag) / (Lp * d)) + 10;
  const nRows = Math.ceil(((roomW - startY) + diag) / dy) + 10;

  // Safety cap, same reasoning as herringbone's — bail to the estimate
  // rather than ever risk freezing the tab on a pathological input.
  const estimatedWork = (2 * nRows + 1) * nPieces;
  if (!isFinite(estimatedWork) || estimatedWork > 400000) return null;

  const pieces = [];
  for (let r = -nRows; r <= nRows; r++) {
    let x = startX, y = startY + r * dy;
    let kind = "A";
    for (let i = 0; i < nPieces; i++) {
      let p;
      const pieceKind = kind, pieceX0 = x, pieceY0 = y;
      if (kind === "A") { p = makeA(x, y); x = p[1][0]; y = p[1][1]; kind = "B"; }
      else { p = makeB(x, y); x = p[1][0]; y = p[1][1]; kind = "A"; }
      const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
      if (Math.max(...xs) < 0 || Math.min(...xs) > roomL || Math.max(...ys) < 0 || Math.min(...ys) > roomW) continue;
      const clipped = clipPolyToRect(p, 0, 0, roomL, roomW);
      if (clipped.length >= 3) {
        const area = shoelaceArea(clipped);
        const full = Math.abs(area - Lp * W) < 1e-6;
        const cutSpec = full ? null : extractCutSpec(clipped, pieceX0, pieceY0, pieceKind);
        pieces.push({ poly: clipped, area, full, kind: pieceKind, cutSpec });
      }
    }
  }
  return pieces;
}

function computeBasketWeaveExact(roomL, roomW, Pl, Pw) {
  const S = Pl;
  const nBlocksX = Math.ceil(roomL / S);
  const nBlocksY = Math.ceil(roomW / S);
  const estimatedWork = nBlocksX * nBlocksY * Math.ceil(S / Pw);
  if (!isFinite(estimatedWork) || estimatedWork > 400000) return null;

  const pieces = [];
  for (let bx = 0; bx < nBlocksX; bx++) {
    for (let by = 0; by < nBlocksY; by++) {
      const blockX0 = bx * S, blockY0 = by * S;
      const blockW = Math.min(S, roomL - blockX0);
      const blockH = Math.min(S, roomW - blockY0);
      const horiz = (bx + by) % 2 === 0;
      if (horiz) {
        let y = blockY0;
        while (y < blockY0 + blockH - 1e-9) {
          const stripH = Math.min(Pw, blockY0 + blockH - y);
          pieces.push({ x: blockX0, y, w: blockW, h: stripH, full: Math.abs(blockW - Pl) < 1e-6 && Math.abs(stripH - Pw) < 1e-6, orient: "H" });
          y += stripH;
        }
      } else {
        let x = blockX0;
        while (x < blockX0 + blockW - 1e-9) {
          const stripW = Math.min(Pw, blockX0 + blockW - x);
          pieces.push({ x, y: blockY0, w: stripW, h: blockH, full: Math.abs(stripW - Pw) < 1e-6 && Math.abs(blockH - Pl) < 1e-6, orient: "V" });
          x += stripW;
        }
      }
    }
  }
  return pieces;
}

function extractDiagonalCutSpec(clippedPoly, x0, y0, kind, dim) {
  const tol = 1e-4;
  const local = clippedPoly.map(([px, py]) => {
    let X = px - x0, Y = py - y0;
    const theta = kind === "V" ? Math.PI / 4 : -Math.PI / 4;
    const c = Math.cos(theta), s = Math.sin(theta);
    let lx = X * c - Y * s, ly = X * s + Y * c;
    if (kind === "V") ly = -ly;
    return [lx, ly];
  });
  const n = local.length;
  let bottomXs = [], topXs = [];
  for (let i = 0; i < n; i++) {
    const p1 = local[i], p2 = local[(i + 1) % n];
    if (Math.abs(p1[1]) < tol && Math.abs(p2[1]) < tol) bottomXs.push(p1[0], p2[0]);
    if (Math.abs(p1[1] - dim) < tol && Math.abs(p2[1] - dim) < tol) topXs.push(p1[0], p2[0]);
  }
  const bottom = bottomXs.length ? [Math.min(...bottomXs), Math.max(...bottomXs)] : null;
  const top = topXs.length ? [Math.min(...topXs), Math.max(...topXs)] : null;
  return { bottom, top };
}

// An alcove's rectangle in the same room-local coordinate space diagonal
// plank's polygons already live in: a "far" alcove sits just past the L
// wall (x from roomL to roomL+depth), a "near" one sits just before the
// start wall (x from -depth to 0) — same convention BlueprintDiagram and
// the row-based engine already use.
function alcoveRectsFor(roomL, alcoves) {
  return (alcoves || [])
    .filter((a) => a.span > 0 && a.depth > 0)
    .map((a) => (a.wall === "near"
      ? { x0: -a.depth, y0: a.offset, x1: 0, y1: a.offset + a.span }
      : { x0: roomL, y0: a.offset, x1: roomL + a.depth, y1: a.offset + a.span }));
}

function computeDiagonalPlankExact(roomL, roomW, Pl, Pw, alcoves = []) {
  const d = 1 / Math.sqrt(2);
  const makePlank = (x0, y0) => [[x0, y0], [x0 + Pl * d, y0 + Pl * d], [x0 + Pl * d - Pw * d, y0 + Pl * d + Pw * d], [x0 - Pw * d, y0 + Pw * d]];
  const alcoveRects = alcoveRectsFor(roomL, alcoves);
  // Widen the swept region to whatever extra space the alcoves add, so
  // candidate planks are actually generated out there before clipping —
  // otherwise pieces that would only fall inside an alcove never get built.
  const minX = Math.min(0, ...alcoveRects.map((r) => r.x0));
  const maxX = Math.max(roomL, ...alcoveRects.map((r) => r.x1));
  const minY = Math.min(0, ...alcoveRects.map((r) => r.y0));
  const maxY = Math.max(roomW, ...alcoveRects.map((r) => r.y1));
  const diag = (maxX - minX) + (maxY - minY);
  const dyRow = Pw * Math.SQRT2;
  const nRows = Math.ceil(diag / dyRow) + 6;
  const nPieces = Math.ceil(diag / (Pl * d)) + 6;

  const estimatedWork = (2 * nRows + 1) * (2 * nPieces) * (1 + alcoveRects.length);
  if (!isFinite(estimatedWork) || estimatedWork > 400000) return null;

  const pieces = [];
  for (let r = -nRows; r <= nRows; r++) {
    let x0 = -diag + r * Pw * d, y0 = -diag - r * Pw * d;
    for (let i = 0; i < 2 * nPieces; i++) {
      const pieceX0 = x0, pieceY0 = y0;
      const p = makePlank(x0, y0);
      x0 += Pl * d; y0 += Pl * d;
      const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
      if (Math.max(...xs) < minX || Math.min(...xs) > maxX || Math.max(...ys) < minY || Math.min(...ys) > maxY) continue;

      const clipped = clipPolyToRect(p, 0, 0, roomL, roomW);
      if (clipped.length >= 3) {
        const area = shoelaceArea(clipped);
        if (area >= 1e-6) {
          const full = Math.abs(area - Pl * Pw) < 1e-6;
          const cutSpec = full ? null : extractDiagonalCutSpec(clipped, pieceX0, pieceY0, "H", Pw);
          pieces.push({ poly: clipped, area, full, cutSpec });
        }
      }

      for (const rect of alcoveRects) {
        const clippedA = clipPolyToRect(p, rect.x0, rect.y0, rect.x1, rect.y1);
        if (clippedA.length < 3) continue;
        const areaA = shoelaceArea(clippedA);
        if (areaA < 1e-6) continue; // discard degenerate boundary slivers
        const fullA = Math.abs(areaA - Pl * Pw) < 1e-6;
        const cutSpecA = fullA ? null : extractDiagonalCutSpec(clippedA, pieceX0, pieceY0, "H", Pw);
        pieces.push({ poly: clippedA, area: areaA, full: fullA, cutSpec: cutSpecA, inAlcove: true });
      }
    }
  }
  return pieces;
}

function computeDiagonalHerringboneExact(roomL, roomW, Pl, Pw) {
  if (Pl < Pw - 1e-9) return null;
  const span = roomL + roomW;
  const kSpan = Math.ceil(span / Pw) + 4;
  const xSpanNeeded = span + 2 * kSpan * Pw + 2 * Pl;
  const stepsOneSide = Math.ceil((2 * xSpanNeeded) / Pl) + 8;

  const estimatedWork = stepsOneSide * (2 * kSpan + 1);
  if (!isFinite(estimatedWork) || estimatedWork > 400000) return null;

  const base = [{ x: 0, y: 0, w: Pl, h: Pw, kind: "H" }];
  {
    let x = 0, y = 0, horiz = true;
    for (let i = 0; i < stepsOneSide; i++) {
      if (horiz) { x = x + Pl - Pw; y = y + Pw; horiz = false; base.push({ x, y, w: Pw, h: Pl, kind: "V" }); }
      else { x = x + Pw; y = y + Pl - Pw; horiz = true; base.push({ x, y, w: Pl, h: Pw, kind: "H" }); }
    }
  }
  {
    let x = 0, y = 0, horiz = true;
    for (let i = 0; i < stepsOneSide; i++) {
      if (horiz) { x = x - Pw; y = y - (Pl - Pw); horiz = false; base.push({ x, y, w: Pw, h: Pl, kind: "V" }); }
      else { x = x - (Pl - Pw); y = y - Pw; horiz = true; base.push({ x, y, w: Pl, h: Pw, kind: "H" }); }
    }
  }

  const theta = Math.PI / 4;
  const c = Math.cos(theta), s = Math.sin(theta);
  const rot = (x, y) => [x * c - y * s, x * s + y * c];

  const pieces = [];
  for (let k = -kSpan; k <= kSpan; k++) {
    const dx = k * Pw, dy = -k * Pw;
    for (const t of base) {
      const lx = t.x + dx, ly = t.y + dy;
      const localRect = [[lx, ly], [lx + t.w, ly], [lx + t.w, ly + t.h], [lx, ly + t.h]];
      const roomRect = localRect.map(([px, py]) => rot(px, py));
      const roomX0y0 = rot(lx, ly);
      const xs = roomRect.map((q) => q[0]), ys = roomRect.map((q) => q[1]);
      if (Math.max(...xs) < 0 || Math.min(...xs) > roomL || Math.max(...ys) < 0 || Math.min(...ys) > roomW) continue;
      const clipped = clipPolyToRect(roomRect, 0, 0, roomL, roomW);
      if (clipped.length >= 3) {
        const area = shoelaceArea(clipped);
        if (area < 1e-6) continue; // discard degenerate boundary slivers
        const full = Math.abs(area - t.w * t.h) < 1e-6;
        const dim = t.kind === "H" ? t.h : t.w;
        const cutSpec = full ? null : extractDiagonalCutSpec(clipped, roomX0y0[0], roomX0y0[1], t.kind, dim);
        pieces.push({ poly: clipped, area, full, cutSpec });
      }
    }
  }
  return pieces;
}

function computePinwheelExact(roomL, roomW, Pl, Pw) {
  if (Pl <= Pw + 1e-9) return null;
  const S = Pl + Pw;
  const centerSide = Pl - Pw;
  const nBlocksX = Math.ceil(roomL / S);
  const nBlocksY = Math.ceil(roomW / S);
  const estimatedWork = nBlocksX * nBlocksY * 5;
  if (!isFinite(estimatedWork) || estimatedWork > 400000) return null;

  const pieces = [];
  for (let bx = 0; bx < nBlocksX; bx++) {
    for (let by = 0; by < nBlocksY; by++) {
      const ox = bx * S, oy = by * S;
      const block = [
        { kind: "plank", x: ox, y: oy, w: Pl, h: Pw },
        { kind: "plank", x: ox + Pl, y: oy, w: Pw, h: Pl },
        { kind: "plank", x: ox + Pw, y: oy + Pl, w: Pl, h: Pw },
        { kind: "plank", x: ox, y: oy + Pw, w: Pw, h: Pl },
        { kind: "filler", x: ox + Pw, y: oy + Pw, w: centerSide, h: centerSide },
      ];
      for (const b of block) {
        const cx0 = Math.max(b.x, 0), cy0 = Math.max(b.y, 0);
        const cx1 = Math.min(b.x + b.w, roomL), cy1 = Math.min(b.y + b.h, roomW);
        const cw = cx1 - cx0, ch = cy1 - cy0;
        if (cw > 1e-9 && ch > 1e-9) {
          pieces.push({ x: cx0, y: cy0, w: cw, h: ch, kind: b.kind, full: Math.abs(cw - b.w) < 1e-6 && Math.abs(ch - b.h) < 1e-6 });
        }
      }
    }
  }
  return pieces;
}

function computeDoubleHerringboneExact(roomL, roomW, Pl, Pw, centered) {
  if (Pl < Pw - 1e-9) return null;
  const diag = roomL + roomW;
  const dy = Pw;

  let starts;
  if (centered) {
    const nEach = Math.ceil(diag / (Pl - Pw + Pw)) + 10; // same spirit as herringbone's stepsOneSide, simplified
    const kSpan = Math.ceil(diag / Pw) + 4;
    const xSpanNeeded = roomL + 2 * kSpan * Pw + 2 * Pl;
    const stepsOneSide = Math.ceil((2 * xSpanNeeded) / Pl) + 8;
    const estimatedWork = 2 * stepsOneSide * (2 * kSpan + 1) * 2;
    if (!isFinite(estimatedWork) || estimatedWork > 400000) return null;

    const seedX = roomL / 2 - Pl / 2, seedY = roomW / 2 - Pw / 2;
    const base = [{ x: seedX, y: seedY, w: Pl, h: Pw }];
    {
      let x = seedX, y = seedY, horiz = true;
      for (let i = 0; i < stepsOneSide; i++) {
        if (horiz) { x = x + Pl - Pw; y = y + Pw; horiz = false; base.push({ x, y, w: Pw, h: Pl }); }
        else { x = x + Pw; y = y + Pl - Pw; horiz = true; base.push({ x, y, w: Pl, h: Pw }); }
      }
    }
    {
      let x = seedX, y = seedY, horiz = true;
      for (let i = 0; i < stepsOneSide; i++) {
        if (horiz) { x = x - Pw; y = y - (Pl - Pw); horiz = false; base.push({ x, y, w: Pw, h: Pl }); }
        else { x = x - (Pl - Pw); y = y - Pw; horiz = true; base.push({ x, y, w: Pl, h: Pw }); }
      }
    }
    starts = [];
    for (let k = -kSpan; k <= kSpan; k++) {
      const dx = k * Pw, dky = -k * Pw;
      for (const b of base) starts.push({ x: b.x + dx, y: b.y + dky, w: b.w, h: b.h });
    }
  } else {
    const kSpan = Math.ceil(diag / Pw) + 4;
    const xSpanNeeded = roomL + 2 * kSpan * Pw + 2 * Pl;
    const nPieces = Math.ceil((2 * xSpanNeeded) / Pl) + 8;
    const estimatedWork = nPieces * (2 * kSpan + 1) * 2;
    if (!isFinite(estimatedWork) || estimatedWork > 400000) return null;

    const startX = -(kSpan * Pw + Pl), startY = -(kSpan * Pw + Pl);
    const base = [];
    let x = startX, y = startY, horiz = true;
    for (let i = 0; i < nPieces; i++) {
      if (horiz) { base.push({ x, y, w: Pl, h: Pw }); x = x + Pl - Pw; y = y + Pw; horiz = false; }
      else { base.push({ x, y, w: Pw, h: Pl }); x = x + Pw; y = y + Pl - Pw; horiz = true; }
    }
    starts = [];
    for (let k = -kSpan; k <= kSpan; k++) {
      const dx = k * Pw, dky = -k * Pw;
      for (const b of base) starts.push({ x: b.x + dx, y: b.y + dky, w: b.w, h: b.h });
    }
  }

  const pieces = [];
  for (const t of starts) {
    // split along the short (W) axis into two half-width sub-planks
    const subs = t.w < t.h
      ? [{ x: t.x, y: t.y, w: t.w / 2, h: t.h }, { x: t.x + t.w / 2, y: t.y, w: t.w / 2, h: t.h }]
      : [{ x: t.x, y: t.y, w: t.w, h: t.h / 2 }, { x: t.x, y: t.y + t.h / 2, w: t.w, h: t.h / 2 }];
    for (const s of subs) {
      if (s.x + s.w < 0 || s.x > roomL || s.y + s.h < 0 || s.y > roomW) continue;
      const cx0 = Math.max(s.x, 0), cy0 = Math.max(s.y, 0);
      const cx1 = Math.min(s.x + s.w, roomL), cy1 = Math.min(s.y + s.h, roomW);
      const cw = cx1 - cx0, ch = cy1 - cy0;
      if (cw > 1e-9 && ch > 1e-9) {
        pieces.push({ x: cx0, y: cy0, w: cw, h: ch, full: Math.abs(cw - s.w) < 1e-6 && Math.abs(ch - s.h) < 1e-6 });
      }
    }
  }
  return pieces;
}

function computeHexagonExact(roomL, roomW, flatToFlat) {
  if (flatToFlat <= 0) return null;
  const r = flatToFlat / Math.sqrt(3);
  const hexAt = (cx, cy) => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i);
      pts.push([cx + r * Math.sin(a), cy - r * Math.cos(a)]);
    }
    return pts;
  };
  const dx = flatToFlat, dyRow = r * 1.5;
  const diag = roomL + roomW;
  const nCols = Math.ceil(diag / dx) + 4;
  const nRows = Math.ceil(diag / dyRow) + 4;

  const estimatedWork = (2 * nRows + 1) * (2 * nCols + 1);
  if (!isFinite(estimatedWork) || estimatedWork > 400000) return null;

  const hexArea = ((3 * Math.sqrt(3)) / 2) * r * r;
  const pieces = [];
  for (let row = -nRows; row <= nRows; row++) {
    const cy = row * dyRow;
    const rowOffset = row % 2 !== 0 ? dx / 2 : 0;
    for (let col = -nCols; col <= nCols; col++) {
      const cx = col * dx + rowOffset;
      const hp = hexAt(cx, cy);
      const xs = hp.map((p) => p[0]), ys = hp.map((p) => p[1]);
      if (Math.max(...xs) < 0 || Math.min(...xs) > roomL || Math.max(...ys) < 0 || Math.min(...ys) > roomW) continue;
      const clipped = clipPolyToRect(hp, 0, 0, roomL, roomW);
      if (clipped.length >= 3) {
        const area = shoelaceArea(clipped);
        if (area < 1e-6) continue;
        const full = Math.abs(area - hexArea) < 1e-6;
        pieces.push({ poly: clipped, area, full });
      }
    }
  }
  return pieces;
}

function computeVersaillesExact(roomL, roomW, S, C) {
  if (C <= 0 || C >= S) return null;
  const arm = (S - C) / 2;
  const panel = [
    { kind: "center", poly: [[arm, arm], [arm + C, arm], [arm + C, arm + C], [arm, arm + C]] },
    { kind: "arm", poly: [[arm, 0], [arm + C / 2, 0], [arm + C / 2, arm], [arm, arm]] },
    { kind: "arm", poly: [[arm + C / 2, 0], [arm + C, 0], [arm + C, arm], [arm + C / 2, arm]] },
    { kind: "arm", poly: [[arm, arm + C], [arm + C / 2, arm + C], [arm + C / 2, S], [arm, S]] },
    { kind: "arm", poly: [[arm + C / 2, arm + C], [arm + C, arm + C], [arm + C, S], [arm + C / 2, S]] },
    { kind: "arm", poly: [[0, arm], [arm, arm], [arm, arm + C / 2], [0, arm + C / 2]] },
    { kind: "arm", poly: [[0, arm + C / 2], [arm, arm + C / 2], [arm, arm + C], [0, arm + C]] },
    { kind: "arm", poly: [[arm + C, arm], [S, arm], [S, arm + C / 2], [arm + C, arm + C / 2]] },
    { kind: "arm", poly: [[arm + C, arm + C / 2], [S, arm + C / 2], [S, arm + C], [arm + C, arm + C]] },
    { kind: "corner", poly: [[0, 0], [arm, 0], [0, arm]] },
    { kind: "corner", poly: [[arm, 0], [arm, arm], [0, arm]] },
    { kind: "corner", poly: [[arm + C, 0], [S, 0], [S, arm]] },
    { kind: "corner", poly: [[arm + C, 0], [S, arm], [arm + C, arm]] },
    { kind: "corner", poly: [[S, arm + C], [S, S], [arm + C, S]] },
    { kind: "corner", poly: [[S, arm + C], [arm + C, S], [arm + C, arm + C]] },
    { kind: "corner", poly: [[0, arm + C], [arm, S], [0, S]] },
    { kind: "corner", poly: [[0, arm + C], [arm, arm + C], [arm, S]] },
  ];

  const nX = Math.ceil(roomL / S), nY = Math.ceil(roomW / S);
  const estimatedWork = nX * nY * panel.length;
  if (!isFinite(estimatedWork) || estimatedWork > 400000) return null;

  const pieces = [];
  for (let bx = 0; bx < nX; bx++) {
    for (let by = 0; by < nY; by++) {
      const ox = bx * S, oy = by * S;
      for (const { kind, poly } of panel) {
        const shifted = poly.map(([x, y]) => [x + ox, y + oy]);
        const xs = shifted.map((p) => p[0]), ys = shifted.map((p) => p[1]);
        if (Math.max(...xs) < 0 || Math.min(...xs) > roomL || Math.max(...ys) < 0 || Math.min(...ys) > roomW) continue;
        const clipped = clipPolyToRect(shifted, 0, 0, roomL, roomW);
        if (clipped.length >= 3) {
          const area = shoelaceArea(clipped);
          if (area < 1e-6) continue;
          const origArea = shoelaceArea(poly);
          const full = Math.abs(area - origArea) < 1e-6;
          pieces.push({ poly: clipped, area, full, kind });
        }
      }
    }
  }
  return pieces;
}

function computeCenteredGrid({ L, W, Pl, Pw, gap }) {
  const calcAxis = (total, size) => {
    let n = Math.floor((total + gap) / (size + gap) + 1e-9);
    let border = n > 0 ? (total - (n * size + Math.max(n - 1, 0) * gap)) / 2 : total / 2;
    if (n > 1 && border < size * 0.25) {
      n -= 1;
      border = (total - (n * size + Math.max(n - 1, 0) * gap)) / 2;
    }
    return { n, border };
  };
  const rowAxis = calcAxis(W, Pw);
  const colAxis = calcAxis(L, Pl);
  const hasBorderRow = rowAxis.border > 0.01;
  const hasBorderCol = colAxis.border > 0.01;
  const totalRows = rowAxis.n + (hasBorderRow ? 2 : 0);

  const rows = [];
  let totalPlanks = 0;

  for (let r = 0; r < totalRows; r++) {
    const isBorderRow = hasBorderRow && (r === 0 || r === totalRows - 1);
    const rowWidth = isBorderRow ? rowAxis.border : Pw;
    const pieces = [];
    if (hasBorderCol) {
      pieces.push({ kind: "cut-start", length: colAxis.border, offWaste: Pl - colAxis.border });
      totalPlanks++;
    }
    for (let c = 0; c < colAxis.n; c++) {
      pieces.push({ kind: "full", length: Pl });
      totalPlanks++;
    }
    if (hasBorderCol) {
      pieces.push({ kind: "cut-end", length: colAxis.border, offWaste: Pl - colAxis.border });
      totalPlanks++;
    }
    rows.push({ rowWidth, isRipped: isBorderRow, pieces });
  }

  const roomArea = L * W;
  const usedPlanksArea = totalPlanks * Pl * Pw;
  return { rows, totalPlanks, roomArea, usedPlanksArea, hasRippedRow: hasBorderRow, remW: rowAxis.border };
}

function computeSectionLayout({ L, W, Pl, Pw, minStagger, method, seed, unit, gap = 0, centered = false, hbCentered = false, alcoves = [], widthCycle = null }) {
  if (centered && method === "straight") {
    return computeCenteredGrid({ L, W, Pl, Pw, gap });
  }

  // Herringbone/chevron are true 2D angled layouts, not row-packing.
  // Herringbone gets an exact, verified tiling instead of a rule-of-thumb
  // estimate — see computeHerringboneExact above. It works at any length >=
  // width ratio (2:1 is just the customary look, not a geometric requirement)
  // since it simulates the real staircase rather than assuming a shortcut
  // that only held at 2:1. Chevron gets an exact tiling too (see
  // computeChevronExact) — its rotated-45° mitered planks clip into
  // irregular polygons at the room's edges rather than simple rectangles,
  // so it doesn't reduce to a per-piece cut list the way herringbone's does,
  // but the plank count and waste are exact rather than estimated.
  if (method === "herringbone" || method === "chevron") {
    const roomArea = L * W;
    const validPlankShape = Pl >= Pw - 1e-9;

    let pieces = null;
    if (method === "herringbone" && validPlankShape) {
      pieces = computeHerringboneExact(L, W, Pl, Pw, hbCentered);
    }
    if (pieces) {
      const totalPlanks = pieces.length;
      const usedPlanksArea = totalPlanks * Pl * Pw;
      return {
        rows: [], totalPlanks, roomArea, usedPlanksArea, hasRippedRow: false, remW: 0,
        isAngled: true, cutAngle: 90, wasteFactor: (usedPlanksArea - roomArea) / roomArea,
        isHerringboneExact: true, herringbonePieces: pieces, hbCentered,
      };
    }

    if (method === "chevron") {
      // Try the exact geometric tiling first — see computeChevronExact above.
      // It only needs L > W (so a positive "point length" Lp = L - W exists).
      const chevronPieces = Pl > Pw + 1e-9 ? computeChevronExact(L, W, Pl, Pw, hbCentered) : null;
      if (chevronPieces) {
        const totalPlanks = chevronPieces.length;
        const usedPlanksArea = totalPlanks * Pl * Pw;
        return {
          rows: [], totalPlanks, roomArea, usedPlanksArea, hasRippedRow: false, remW: 0,
          isAngled: true, cutAngle: 45, wasteFactor: (usedPlanksArea - roomArea) / roomArea,
          isChevronExact: true, chevronPieces, hbCentered,
        };
      }

      // Fall back to the exact miter-area math (real geometry, just not a
      // full per-piece tiling) if the room was too large for the full
      // calculation, or the flat estimate if the plank shape can't miter at
      // all cleanly (L must be > 2W for a physically valid 45° cut).
      const validMiterShape = Pl > 2 * Pw + 1e-9;
      if (validMiterShape) {
        const installedAreaPerPlank = Pw * (Pl - Pw);
        const perimeterWasteFactor = 0.08;
        const totalPlanks = Math.ceil((roomArea * (1 + perimeterWasteFactor)) / installedAreaPerPlank);
        const usedPlanksArea = totalPlanks * Pl * Pw;
        return {
          rows: [], totalPlanks, roomArea, usedPlanksArea, hasRippedRow: false, remW: 0,
          isAngled: true, cutAngle: 45, wasteFactor: (usedPlanksArea - roomArea) / roomArea,
          chevronExactMiter: true,
        };
      }
    }

    const wasteFactor = method === "herringbone" ? 0.15 : 0.2;
    const cutAngle = method === "herringbone" ? 90 : 45;
    const totalPlanks = Math.ceil((roomArea * (1 + wasteFactor)) / (Pl * Pw));
    const usedPlanksArea = totalPlanks * Pl * Pw;
    return {
      rows: [], totalPlanks, roomArea, usedPlanksArea, hasRippedRow: false, remW: 0, isAngled: true, cutAngle, wasteFactor,
      offRatioNote: method === "herringbone" && !validPlankShape,
      tooLargeNote: method === "herringbone" && validPlankShape,
      chevronShapeNote: method === "chevron" && !(Pl > 2 * Pw + 1e-9),
    };
  }

  // Basket weave: axis-aligned, no rotation needed, so it's exact for any
  // Pl/Pw with no fallback required.
  if (method === "basketweave") {
    const roomArea = L * W;
    const pieces = computeBasketWeaveExact(L, W, Pl, Pw);
    const totalPlanks = pieces ? pieces.length : 0;
    const usedPlanksArea = totalPlanks * Pl * Pw;
    return {
      rows: [], totalPlanks, roomArea, usedPlanksArea, hasRippedRow: false, remW: 0,
      isAngled: true, cutAngle: 90, wasteFactor: pieces ? (usedPlanksArea - roomArea) / roomArea : 0,
      isBasketWeave: true, basketWeavePieces: pieces || [],
    };
  }

  // Diagonal plank and diagonal herringbone: exact polygon tilings, same
  // verification approach as chevron/herringbone above.
  if (method === "diagonalplank" || method === "diagonalherringbone") {
    const roomArea = L * W;
    const pieces = method === "diagonalplank"
      ? computeDiagonalPlankExact(L, W, Pl, Pw)
      : (Pl >= Pw - 1e-9 ? computeDiagonalHerringboneExact(L, W, Pl, Pw) : null);
    if (pieces) {
      const totalPlanks = pieces.length;
      const usedPlanksArea = totalPlanks * Pl * Pw;
      return {
        rows: [], totalPlanks, roomArea, usedPlanksArea, hasRippedRow: false, remW: 0,
        isAngled: true, cutAngle: method === "diagonalplank" ? 45 : 90,
        wasteFactor: (usedPlanksArea - roomArea) / roomArea,
        isDiagonalExact: true, diagonalPieces: pieces, diagonalKind: method,
      };
    }
    // fallback estimate if the room was too large, or (diagonal herringbone
    // only) the plank shape is invalid (length must be >= width)
    const wasteFactor = 0.12;
    const totalPlanks = Math.ceil((roomArea * (1 + wasteFactor)) / (Pl * Pw));
    const usedPlanksArea = totalPlanks * Pl * Pw;
    return {
      rows: [], totalPlanks, roomArea, usedPlanksArea, hasRippedRow: false, remW: 0,
      isAngled: true, cutAngle: method === "diagonalplank" ? 45 : 90, wasteFactor,
      diagonalShapeNote: method === "diagonalherringbone" && Pl < Pw - 1e-9,
    };
  }

  // Pinwheel: axis-aligned rectangles, exact for any Pl > Pw.
  if (method === "pinwheel") {
    const roomArea = L * W;
    const pieces = Pl > Pw + 1e-9 ? computePinwheelExact(L, W, Pl, Pw) : null;
    const totalPlanks = pieces ? pieces.filter((p) => p.kind === "plank").length : 0;
    const totalFillers = pieces ? pieces.filter((p) => p.kind === "filler").length : 0;
    const usedPlanksArea = pieces ? pieces.reduce((s, p) => s + p.w * p.h, 0) : 0;
    return {
      rows: [], totalPlanks: totalPlanks + totalFillers, roomArea, usedPlanksArea, hasRippedRow: false, remW: 0,
      isAngled: true, cutAngle: 90, wasteFactor: pieces ? (usedPlanksArea - roomArea) / roomArea : 0,
      isPinwheel: true, pinwheelPieces: pieces || [],
      pinwheelShapeNote: !(Pl > Pw + 1e-9),
    };
  }

  // Double herringbone: same verified herringbone construction, split into
  // two half-width sub-planks per slot before clipping.
  if (method === "doubleherringbone") {
    const roomArea = L * W;
    const pieces = Pl >= Pw - 1e-9 ? computeDoubleHerringboneExact(L, W, Pl, Pw, hbCentered) : null;
    if (pieces) {
      const usedPlanksArea = pieces.reduce((s, p) => s + p.w * p.h, 0);
      return {
        rows: [], totalPlanks: pieces.length, roomArea, usedPlanksArea, hasRippedRow: false, remW: 0,
        isAngled: true, cutAngle: 90, wasteFactor: (usedPlanksArea - roomArea) / roomArea,
        isDoubleHerringbone: true, doubleHerringbonePieces: pieces, hbCentered,
      };
    }
    const wasteFactor = 0.15;
    const totalPlanks = Math.ceil((roomArea * (1 + wasteFactor)) / (Pl * (Pw / 2)));
    const usedPlanksArea = totalPlanks * Pl * (Pw / 2);
    return {
      rows: [], totalPlanks, roomArea, usedPlanksArea, hasRippedRow: false, remW: 0,
      isAngled: true, cutAngle: 90, wasteFactor,
      offRatioNote: Pl < Pw - 1e-9,
    };
  }

  // Hexagon tile: standard honeycomb tessellation. Only offered in tile
  // mode; uses the tile's width (Pw) as the hexagon's flat-to-flat size.
  if (method === "hexagon") {
    const roomArea = L * W;
    const pieces = computeHexagonExact(L, W, Pw);
    const hexAreaEst = ((3 * Math.sqrt(3)) / 2) * (Pw / Math.sqrt(3)) * (Pw / Math.sqrt(3));
    if (pieces) {
      const totalPlanks = pieces.length;
      const usedPlanksArea = pieces.reduce((s, p) => s + p.area, 0);
      return {
        rows: [], totalPlanks, roomArea, usedPlanksArea, hasRippedRow: false, remW: 0,
        isAngled: true, cutAngle: 120, wasteFactor: (totalPlanks * hexAreaEst - roomArea) / roomArea,
        isHexagon: true, hexagonPieces: pieces,
      };
    }
    const wasteFactor = 0.15;
    const totalPlanks = Math.ceil((roomArea * (1 + wasteFactor)) / hexAreaEst);
    return {
      rows: [], totalPlanks, roomArea, usedPlanksArea: totalPlanks * hexAreaEst, hasRippedRow: false, remW: 0,
      isAngled: true, cutAngle: 120, wasteFactor,
    };
  }

  // Versailles: a specific, well-defined version of the classic square
  // medallion (see computeVersaillesExact) — reuses Pl as the overall panel
  // size and Pw as the center square's size, needing Pw < Pl.
  if (method === "versailles") {
    const roomArea = L * W;
    const pieces = Pw < Pl - 1e-9 ? computeVersaillesExact(L, W, Pl, Pw) : null;
    if (pieces) {
      const totalPlanks = pieces.length;
      const usedPlanksArea = pieces.reduce((s, p) => s + p.area, 0);
      return {
        rows: [], totalPlanks, roomArea, usedPlanksArea, hasRippedRow: false, remW: 0,
        isAngled: true, cutAngle: 45, wasteFactor: 0,
        isVersailles: true, versaillesPieces: pieces,
      };
    }
    const wasteFactor = 0.15;
    const totalPlanks = Math.ceil((roomArea * (1 + wasteFactor)) / (Pl * Pw));
    return {
      rows: [], totalPlanks, roomArea, usedPlanksArea: totalPlanks * Pl * Pw, hasRippedRow: false, remW: 0,
      isAngled: true, cutAngle: 45, wasteFactor,
      versaillesShapeNote: !(Pw < Pl - 1e-9),
    };
  }

  const validAlcoves = (alcoves || []).filter((a) => a.span > 0 && a.depth > 0);

  const thirdCycle = [1, 2 / 3, 1 / 3];
  const rng = method === "random" ? seededRandom(seed || 1) : null;
  const toCm = UNIT_TO_CM[unit] || 1;
  // round random cuts to the nearest 50mm where the plank is big enough for that
  // to leave a sane range of starter lengths — smaller planks fall back to a
  // finer snap (down to 10mm) so a valid cut position still exists.
  const plCm = Pl * toCm;
  const SNAP_CM = plCm >= 30 ? 5 : Math.max(1, Math.floor(plCm / 6));
  const snap = (v) => {
    const cm = v * toCm;
    const snappedCm = Math.round(cm / SNAP_CM) * SNAP_CM;
    return snappedCm / toCm;
  };

  // How many rows fit, each separated by a gap, plus a possible ripped final
  // row — generalized to a repeating cycle of widths (mixed-width floors)
  // instead of one fixed Pw. With a single-width cycle ([Pw]) this reduces
  // to exactly the same result as the old fixed-width formula (verified).
  const widths = widthCycle && widthCycle.length > 0 ? widthCycle : [Pw];
  const rowWidths = [];
  {
    let cursor = 0, idx = 0;
    while (cursor < W - 1e-9) {
      const intended = widths[idx % widths.length];
      const gapBefore = rowWidths.length > 0 ? gap : 0;
      const avail = W - cursor - gapBefore;
      if (avail <= 1e-9) break;
      const actual = Math.min(intended, avail);
      rowWidths.push(actual);
      cursor += gapBefore + actual;
      idx++;
    }
  }
  const totalRows = rowWidths.length;
  const hasRippedRow = totalRows > 0 && rowWidths[totalRows - 1] < widths[(totalRows - 1) % widths.length] - 1e-6;
  const remW = hasRippedRow ? rowWidths[totalRows - 1] : 0;

  const rows = [];
  let carry = 0;
  let totalPlanks = 0;
  let alcoveArea = 0;
  let yCursor = 0;

  for (let r = 0; r < totalRows; r++) {
    const isRipped = hasRippedRow && r === totalRows - 1;
    const rowWidth = rowWidths[r];
    // the nominal/stock width this row is ripped from — for a ripped row
    // this is wider than the actual installed rowWidth, since you cut a
    // full-width board narrower to fit, not a pre-narrow one.
    const nominalWidth = widths[r % widths.length];
    const rowYStart = yCursor;
    yCursor += rowWidth;

    // any row that touches an alcove's width span runs straight through into
    // it — a real floor layer just cuts that board longer to carry the row
    // on, rather than notching or ripping it. A row that only partially
    // overlaps still gets the full extension; the small corner where it
    // overshoots a wall that's still there gets scribed to fit by hand.
    const matchedAlcove = validAlcoves.find((a) => rowYStart < a.offset + a.span - 1e-6 && rowYStart + rowWidth > a.offset + 1e-6);
    const rowInAlcove = !!matchedAlcove;
    const rowPartial = rowInAlcove && !(rowYStart >= matchedAlcove.offset - 1e-6 && rowYStart + rowWidth <= matchedAlcove.offset + matchedAlcove.span + 1e-6);
    const rowL = rowInAlcove ? L + matchedAlcove.depth : L;
    if (rowInAlcove) alcoveArea += rowWidth * matchedAlcove.depth;

    let remaining = rowL;
    let isFirst = true;
    const pieces = [];
    const place = (length, extra) => {
      if (!isFirst) remaining -= gap;
      remaining -= length;
      isFirst = false;
      pieces.push({ length, ...extra });
    };

    if (r > 0) {
      if (method === "straight") {
        // rows begin aligned — no starter piece
      } else if (method === "fixed-third") {
        const frac = thirdCycle[r % 3];
        if (frac < 1) {
          const starter = Math.min(Pl * frac, remaining);
          place(starter, { kind: "cut-start", offWaste: Pl - starter });
          totalPlanks++;
        }
      } else if (method === "cascade") {
        if (carry > 1e-6) {
          const useLen = Math.min(carry, remaining);
          place(useLen, { kind: "offcut-reuse" });
        }
      } else if (method === "random") {
        const minFrac = Math.min(Math.max(minStagger / Pl, 0.1), 0.45);
        const frac = minFrac + rng() * (1 - 2 * minFrac);
        let starter = Math.min(Math.max(Pl * frac, minStagger), Pl - 1e-6, remaining);
        starter = snap(starter);
        starter = Math.min(Math.max(starter, minStagger), Pl - SNAP_CM / toCm, remaining);
        place(starter, { kind: "cut-start", offWaste: Pl - starter });
        totalPlanks++;
      } else {
        if (carry >= minStagger && carry <= remaining + 1e-9) {
          place(carry, { kind: "offcut-reuse" });
        } else {
          const starter = Math.min(Math.max(minStagger, Pl / 3), Pl, remaining);
          place(starter, { kind: "cut-start", offWaste: Pl - starter });
          totalPlanks++;
        }
      }
    }

    while (remaining - (isFirst ? 0 : gap) >= Pl - 1e-9) {
      place(Pl, { kind: "full" });
      totalPlanks++;
    }

    const finalAvail = remaining - (isFirst ? 0 : gap);
    if (finalAvail > 1e-6) {
      place(finalAvail, { kind: "cut-end", offWaste: Pl - finalAvail });
      totalPlanks++;
      carry = method === "stagger-reuse" || method === "cascade" ? Pl - finalAvail : 0;
    } else {
      carry = 0;
    }

    rows.push({ rowWidth, nominalWidth, isRipped, rowInAlcove, rowPartial, alcoveWall: matchedAlcove ? matchedAlcove.wall : null, alcoveDepth: matchedAlcove ? matchedAlcove.depth : 0, pieces });
  }

  const roomArea = L * W + alcoveArea;
  const usedPlanksArea = rows.reduce((sum, row) => sum + row.pieces.filter((p) => p.kind !== "offcut-reuse").length * Pl * row.nominalWidth, 0);
  const partialRowCount = rows.filter((r) => r.rowPartial).length;

  return { rows, totalPlanks, roomArea, usedPlanksArea, hasRippedRow, remW, alcoves: validAlcoves, partialRowCount, mixedWidthActive: !!(widthCycle && widthCycle.length > 0) };
}

function computeRollGoods(roomL, roomW, rollWidth) {
  if (rollWidth <= 0) return null;
  const optionLengthwise = {
    strips: Math.ceil(roomW / rollWidth),
    stripLength: roomL,
    orientation: "lengthwise",
  };
  const optionWidthwise = {
    strips: Math.ceil(roomL / rollWidth),
    stripLength: roomW,
    orientation: "widthwise",
  };
  optionLengthwise.totalLength = optionLengthwise.strips * optionLengthwise.stripLength;
  optionWidthwise.totalLength = optionWidthwise.strips * optionWidthwise.stripLength;
  const recommended = optionLengthwise.totalLength <= optionWidthwise.totalLength ? "lengthwise" : "widthwise";
  return { lengthwise: optionLengthwise, widthwise: optionWidthwise, recommended, rollWidth, roomL, roomW };
}

function computeCutTally(sectionResults, unit) {
  const decimals = UNIT_DECIMALS[unit];
  let fullCount = 0;
  let reuseCount = 0;

  // Detect whether more than one distinct row width is actually present —
  // if so, a length alone doesn't identify which board a cut piece came
  // from, so the tally needs to include width too. Single-width jobs (the
  // vast majority) see no change in output.
  const widthsSeen = new Set();
  sectionResults.forEach((sec) => {
    sec.rows.forEach((row) => widthsSeen.add(+((row.nominalWidth ?? row.rowWidth).toFixed(decimals))));
  });
  const isMixedWidth = widthsSeen.size > 1;

  const cutTally = new Map(); // key -> { count, length, width }
  sectionResults.forEach((sec) => {
    sec.rows.forEach((row) => {
      const rowW = row.nominalWidth ?? row.rowWidth;
      row.pieces.forEach((p) => {
        if (p.kind === "full") {
          fullCount++;
        } else if (p.kind === "offcut-reuse") {
          reuseCount++;
        } else {
          const length = +p.length.toFixed(decimals);
          const width = +rowW.toFixed(decimals);
          const key = isMixedWidth ? `${length}x${width}` : `${length}`;
          const existing = cutTally.get(key);
          if (existing) existing.count++;
          else cutTally.set(key, { count: 1, length, width });
        }
      });
    });
  });

  const cutRows = Array.from(cutTally.values())
    .sort((a, b) => b.length - a.length || b.width - a.width)
    .map((v) => (isMixedWidth ? [v.length, v.count, v.width] : [v.length, v.count]));
  return { cutRows, fullCount, reuseCount, isMixedWidth };
}

function classifyChevronCut(spec, tol = 0.5) {
  if (!spec) return { tier: "full" };
  const { bottom, top } = spec;
  if (bottom && top) {
    const bLen = bottom[1] - bottom[0], tLen = top[1] - top[0];
    if (Math.abs(bLen - tLen) < tol) return { tier: "simple", len: bLen };
    return { tier: "compound", bLen, tLen };
  }
  if (bottom) return { tier: "simple", len: bottom[1] - bottom[0] };
  if (top) return { tier: "simple", len: top[1] - top[0] };
  return { tier: "sliver" };
}

function rollStripsToPieces(rollResult, orientation) {
  const opt = rollResult[orientation];
  const pieces = [];
  if (orientation === "lengthwise") {
    // strips run along roomL, stacked along roomW
    for (let i = 0; i < opt.strips; i++) {
      const y = i * rollResult.rollWidth;
      const h = Math.min(rollResult.rollWidth, rollResult.roomW - y);
      if (h > 1e-9) pieces.push({ x: 0, y, w: rollResult.roomL, h });
    }
  } else {
    // strips run along roomW, stacked along roomL
    for (let i = 0; i < opt.strips; i++) {
      const x = i * rollResult.rollWidth;
      const w = Math.min(rollResult.rollWidth, rollResult.roomL - x);
      if (w > 1e-9) pieces.push({ x, y: 0, w, h: rollResult.roomW });
    }
  }
  return pieces;
}

export {
  UNIT_TO_CM, UNIT_DECIMALS, ROW_BASED_METHODS,
  seededRandom,
  computeHerringboneExact,
  shoelaceArea,
  clipPolyToRect,
  computeChevronExact,
  computeBasketWeaveExact,
  extractDiagonalCutSpec,
  computeDiagonalPlankExact,
  computeDiagonalHerringboneExact,
  computePinwheelExact,
  computeDoubleHerringboneExact,
  computeHexagonExact,
  computeVersaillesExact,
  computeCenteredGrid,
  computeSectionLayout,
  computeRollGoods,
  computeCutTally,
  classifyChevronCut,
  rollStripsToPieces
};
