/**
 * Jo Simulator — the map.
 *
 * Jo's family owns two houses side by side, so the world is two backyards
 * sharing one fence line. That middle fence has two gaps in it, which is how
 * you get from yard to yard — and the only way to reach a ball that landed on
 * the far side.
 *
 * Everything here is plain geometry in world units plus the collision helpers
 * built on it. `game.ts` uses it to stop Jo walking through walls; `render.ts`
 * uses the same numbers to draw them, so the picture and the physics can never
 * drift apart.
 */

export const WORLD_W = 1280;
export const WORLD_H = 800;

/** The shared fence line between the two yards. Left of it is the far yard. */
export const MID_FENCE_X = 622;

/** Waist-high fence: a ball thrown above this sails over instead of bouncing. */
export const FENCE_HEIGHT = 40;

export type Vec = { x: number; y: number };
export type Poly = readonly Vec[];
export type Segment = { x1: number; y1: number; x2: number; y2: number };
export type Rect = { x: number; y: number; w: number; h: number };

const pt = (x: number, y: number): Vec => ({ x, y });

/* -------------------------------------------------------------------------- */
/* fence                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The two gaps in the middle fence, as spans down its length. Kept separate
 * from the segments so the renderer can scuff a dirt path through each one —
 * a gap you cannot see is a gap that just feels like a broken wall.
 */
export const FENCE_GAPS: readonly { y: number; height: number }[] = [
  { y: 262, height: 76 },
  { y: 512, height: 68 },
];

export const FENCES: readonly Segment[] = [
  // Perimeter.
  { x1: 32, y1: 30, x2: 1252, y2: 30 },
  { x1: 32, y1: 30, x2: 32, y2: 770 },
  { x1: 1252, y1: 30, x2: 1252, y2: 318 },
  // The middle run, broken by the two gaps.
  { x1: MID_FENCE_X, y1: 30, x2: MID_FENCE_X, y2: 262 },
  { x1: MID_FENCE_X, y1: 338, x2: MID_FENCE_X, y2: 512 },
  { x1: MID_FENCE_X, y1: 580, x2: MID_FENCE_X, y2: 664 },
  // Short gate closing the side passage between the deck and the near house.
  { x1: 911, y1: 578, x2: 940, y2: 538 },
];

/* -------------------------------------------------------------------------- */
/* buildings                                                                   */
/* -------------------------------------------------------------------------- */

export type House = {
  name: string;
  /** Rectangular blocks; an L-shaped house is simply two of them. */
  blocks: readonly Rect[];
  /** How far the roof oversails the walls. */
  eaves: number;
  roofLight: string;
  roofMid: string;
  roofDark: string;
};

/**
 * Near house on the right, far house along the bottom. The roofs are drawn
 * from `blocks` too, grown by `eaves`, so a roof always sits on its walls.
 */
export const HOUSES: readonly House[] = [
  {
    name: 'near',
    blocks: [
      { x: 938, y: 316, w: 342, h: 190 },
      { x: 1044, y: 494, w: 236, h: 130 },
    ],
    eaves: 13,
    roofLight: '#5b6169',
    roofMid: '#464c54',
    roofDark: '#32373e',
  },
  {
    name: 'far',
    blocks: [{ x: 352, y: 664, w: 258, h: 136 }],
    eaves: 12,
    roofLight: '#8e8d84',
    roofMid: '#74736c',
    roofDark: '#565550',
  },
  {
    name: 'middle',
    blocks: [{ x: 646, y: 688, w: 462, h: 112 }],
    eaves: 14,
    roofLight: '#5f656d',
    roofMid: '#4a5058',
    roofDark: '#363b42',
  },
];

/** Asphalt beside the near house — outside the fence, so no ball ever lands here. */
export const DRIVEWAY: Rect = { x: 1156, y: 624, w: 124, h: 176 };

/* -------------------------------------------------------------------------- */
/* decks                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Both decks, traced from the real outlines — the notched top edge on the near
 * one is the step down off the back door, and it is the detail that makes the
 * yard recognisable, so it is kept exactly.
 *
 * Decks are walkable: they are collision-free and only change what Jo runs on.
 */
export const DECKS: readonly Poly[] = [
  [
    pt(656, 556),
    pt(800, 554),
    pt(804, 578),
    pt(842, 576),
    pt(846, 554),
    pt(874, 553),
    pt(911, 578),
    pt(908, 700),
    pt(660, 702),
  ],
  [pt(62, 752), pt(147, 750), pt(154, 733), pt(210, 733), pt(216, 752), pt(321, 753), pt(321, 800), pt(62, 800)],
];

/* -------------------------------------------------------------------------- */
/* garden                                                                      */
/* -------------------------------------------------------------------------- */

/** The tomato patch down the left-hand side of the far yard. */
export const TOMATO_GARDEN: Rect = { x: 52, y: 520, w: 172, h: 148 };

/** Small shed tucked into the top-left corner. */
export const SHED: Rect = { x: 90, y: 58, w: 80, h: 46 };

/* -------------------------------------------------------------------------- */
/* derived collision data                                                      */
/* -------------------------------------------------------------------------- */

type Solid = { poly: Poly; minX: number; minY: number; maxX: number; maxY: number };

function rectPoly(r: Rect): Poly {
  return [pt(r.x, r.y), pt(r.x + r.w, r.y), pt(r.x + r.w, r.y + r.h), pt(r.x, r.y + r.h)];
}

function toSolid(poly: Poly): Solid {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { poly, minX, minY, maxX, maxY };
}

/**
 * Walls. The middle house is pulled in below its roof line so the deck that
 * overlaps it stays walkable — the roof simply oversails the decking.
 */
const SOLIDS: readonly Solid[] = [
  toSolid(rectPoly({ x: 938, y: 316, w: 342, h: 190 })),
  toSolid(rectPoly({ x: 1044, y: 494, w: 236, h: 130 })),
  toSolid(rectPoly({ x: 352, y: 672, w: 258, h: 128 })),
  toSolid(rectPoly({ x: 646, y: 702, w: 462, h: 98 })),
];

/* -------------------------------------------------------------------------- */
/* geometry helpers                                                            */
/* -------------------------------------------------------------------------- */

function closestOnSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): Vec {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return pt(x1, y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return pt(x1 + dx * t, y1 + dy * t);
}

function pointInPoly(px: number, py: number, poly: Poly): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polyBounds(poly: Poly): { minX: number; minY: number; maxX: number; maxY: number } {
  const s = toSolid(poly);
  return { minX: s.minX, minY: s.minY, maxX: s.maxX, maxY: s.maxY };
}

export function onDeck(x: number, y: number): boolean {
  for (const deck of DECKS) if (pointInPoly(x, y, deck)) return true;
  return false;
}

/* -------------------------------------------------------------------------- */
/* collision                                                                   */
/* -------------------------------------------------------------------------- */

/** Where a circle got pushed to, and the surface normal it slid off. */
export type Hit = { x: number; y: number; nx: number; ny: number };

function pushOutOfPoly(px: number, py: number, r: number, solid: Solid): Hit | null {
  if (px + r < solid.minX || px - r > solid.maxX || py + r < solid.minY || py - r > solid.maxY) return null;

  const poly = solid.poly;
  let bx = 0;
  let by = 0;
  let bestDist = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const c = closestOnSegment(px, py, poly[j].x, poly[j].y, poly[i].x, poly[i].y);
    const d = Math.hypot(px - c.x, py - c.y);
    if (d < bestDist) {
      bestDist = d;
      bx = c.x;
      by = c.y;
    }
  }

  const inside = pointInPoly(px, py, poly);
  if (!inside && bestDist >= r) return null;

  let nx = px - bx;
  let ny = py - by;
  const len = Math.hypot(nx, ny);
  if (len < 1e-6) {
    // Dead on an edge — fall back to the shallowest way out of the bounding box.
    const left = px - solid.minX;
    const right = solid.maxX - px;
    const up = py - solid.minY;
    const down = solid.maxY - py;
    const min = Math.min(left, right, up, down);
    nx = min === left ? -1 : min === right ? 1 : 0;
    ny = min === up ? -1 : min === down ? 1 : 0;
  } else if (inside) {
    nx = -nx / len;
    ny = -ny / len;
  } else {
    nx /= len;
    ny /= len;
  }

  return { x: bx + nx * r, y: by + ny * r, nx, ny };
}

function pushOffSegment(px: number, py: number, r: number, seg: Segment): Hit | null {
  const c = closestOnSegment(px, py, seg.x1, seg.y1, seg.x2, seg.y2);
  let nx = px - c.x;
  let ny = py - c.y;
  const d = Math.hypot(nx, ny);
  if (d >= r) return null;
  if (d < 1e-6) {
    // Standing exactly on the rail: shove along its perpendicular.
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const len = Math.hypot(dx, dy) || 1;
    nx = -dy / len;
    ny = dx / len;
  } else {
    nx /= d;
    ny /= d;
  }
  return { x: c.x + nx * r, y: c.y + ny * r, nx, ny };
}

/**
 * Slides a circle out of every wall it overlaps. `height` lets a ball in the
 * air clear the fence while still bouncing off the houses.
 *
 * Returns the resolved position plus the last normal, or null if nothing hit.
 */
export function resolveCircle(x: number, y: number, r: number, height = 0): Hit | null {
  let px = x;
  let py = y;
  let nx = 0;
  let ny = 0;
  let touched = false;

  // Two passes so an inside corner settles instead of ping-ponging.
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (const solid of SOLIDS) {
      const hit = pushOutOfPoly(px, py, r, solid);
      if (!hit) continue;
      px = hit.x;
      py = hit.y;
      nx = hit.nx;
      ny = hit.ny;
      moved = true;
      touched = true;
    }
    if (height < FENCE_HEIGHT) {
      for (const seg of FENCES) {
        const hit = pushOffSegment(px, py, r, seg);
        if (!hit) continue;
        px = hit.x;
        py = hit.y;
        nx = hit.nx;
        ny = hit.ny;
        moved = true;
        touched = true;
      }
    }
    if (!moved) break;
  }

  return touched ? { x: px, y: py, nx, ny } : null;
}

/**
 * True when a ball could sit here and still be fetchable: on the grass, clear
 * of every wall, and inside the fence.
 */
export function isOpenGround(x: number, y: number, margin: number): boolean {
  if (x < 60 || x > 1230 || y < 62 || y > 700) return false;
  for (const solid of SOLIDS) if (pushOutOfPoly(x, y, margin, solid)) return false;
  for (const seg of FENCES) if (pushOffSegment(x, y, margin, seg)) return false;
  if (x > DRIVEWAY.x - margin && y > DRIVEWAY.y - margin) return false;
  return true;
}
