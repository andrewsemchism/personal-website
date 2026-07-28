/**
 * Canvas renderer for Jo Simulator.
 *
 * The park itself never changes, so it is baked once into two offscreen layers
 * (ground + foreground framing) at device resolution and blitted each frame.
 * Everything that moves is drawn between them, sorted back-to-front by y.
 */

import {
  OWNER_POS,
  WORLD_H,
  WORLD_W,
  type Ball,
  type Dog,
  type Game,
  type Owner,
  type Particle,
  type Squirrel,
} from './game';

const UI_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const LAMPS = [
  { x: 258, y: 196 },
  { x: WORLD_W - 258, y: 196 },
];

const DELIVER_RING = 76;

/* -------------------------------------------------------------------------- */
/* small helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Deterministic RNG so the park looks identical on every rebuild. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wobbly closed blob — the workhorse behind poodle curls, hedges and canopies. */
function fluffPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  lobes: number,
  seed: number,
  amp: number
): void {
  const steps = 60;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = 1 + Math.sin(a * lobes + seed) * amp + Math.sin(a * (lobes * 2 + 1) - seed) * amp * 0.35;
    const x = cx + Math.cos(a) * rx * r;
    const y = cy + Math.sin(a) * ry * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shadowBlob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha: number): void {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  grad.addColorStop(0, `rgba(6, 20, 18, ${alpha})`);
  grad.addColorStop(0.6, `rgba(6, 20, 18, ${alpha * 0.55})`);
  grad.addColorStop(1, 'rgba(6, 20, 18, 0)');
  ctx.fillStyle = grad;
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
}

/* -------------------------------------------------------------------------- */
/* baked scenery                                                               */
/* -------------------------------------------------------------------------- */

type Scenery = { ground: HTMLCanvasElement; front: HTMLCanvasElement; scale: number };

let cached: Scenery | null = null;

function makeLayer(scale: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WORLD_W * scale);
  canvas.height = Math.round(WORLD_H * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return { canvas, ctx };
}

function drawCanopy(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rng: () => number): void {
  // A tree from above: a dark mass with a lit crown and a hint of trunk shadow.
  ctx.save();
  ctx.fillStyle = 'rgba(4, 16, 14, 0.34)';
  fluffPath(ctx, x + r * 0.12, y + r * 0.16, r * 1.02, r * 0.92, 7, rng() * 6, 0.08);
  ctx.fill();

  const base = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.15, x, y, r);
  base.addColorStop(0, '#356b54');
  base.addColorStop(0.55, '#22483b');
  base.addColorStop(1, '#15332b');
  ctx.fillStyle = base;
  fluffPath(ctx, x, y, r, r * 0.94, 8, rng() * 6, 0.09);
  ctx.fill();

  // Clumps of leaves catching the light.
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * r * 0.62;
    const cr = r * (0.18 + rng() * 0.16);
    ctx.fillStyle = `rgba(74, 138, 108, ${0.16 + rng() * 0.2})`;
    fluffPath(ctx, x + Math.cos(a) * d - r * 0.1, y + Math.sin(a) * d - r * 0.14, cr, cr * 0.9, 6, rng() * 6, 0.12);
    ctx.fill();
  }
  ctx.restore();
}

function drawHedgeRun(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  thickness: number,
  rng: () => number
): void {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.ceil(len / (thickness * 0.55));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t + (rng() - 0.5) * thickness * 0.3;
    const y = from.y + (to.y - from.y) * t + (rng() - 0.5) * thickness * 0.3;
    const r = thickness * (0.5 + rng() * 0.22);
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
    grad.addColorStop(0, '#2c5a49');
    grad.addColorStop(0.6, '#1d4137');
    grad.addColorStop(1, '#132c26');
    ctx.fillStyle = grad;
    fluffPath(ctx, x, y, r, r * 0.86, 7, rng() * 6, 0.1);
    ctx.fill();
  }
}

function buildGround(scale: number): HTMLCanvasElement | null {
  const layer = makeLayer(scale);
  if (!layer) return null;
  const { canvas, ctx } = layer;
  const rng = mulberry32(20260728);

  // Lawn base — cooler and darker toward the treeline.
  const base = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  base.addColorStop(0, '#16332c');
  base.addColorStop(0.45, '#20463b');
  base.addColorStop(1, '#2a5648');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Mower stripes.
  ctx.save();
  ctx.translate(WORLD_W / 2, WORLD_H / 2);
  ctx.rotate(-0.13);
  ctx.translate(-WORLD_W / 2, -WORLD_H / 2);
  for (let x = -300; x < WORLD_W + 300; x += 132) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.022)';
    ctx.fillRect(x, -300, 66, WORLD_H + 600);
  }
  ctx.restore();

  // Uneven patches so the lawn is not a flat field of colour.
  for (let i = 0; i < 26; i++) {
    const x = rng() * WORLD_W;
    const y = 60 + rng() * (WORLD_H - 60);
    const r = 70 + rng() * 190;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rng() > 0.45;
    grad.addColorStop(0, dark ? 'rgba(10, 30, 26, 0.24)' : 'rgba(96, 158, 122, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    circle(ctx, x, y, r);
    ctx.fill();
  }

  // Gravel path curving across the upper lawn.
  ctx.save();
  ctx.lineCap = 'round';
  const pathPoints: [number, number][] = [
    [-60, 268],
    [300, 186],
    [640, 244],
    [1000, 178],
    [WORLD_W + 60, 250],
  ];
  const tracePath = () => {
    ctx.beginPath();
    ctx.moveTo(pathPoints[0][0], pathPoints[0][1]);
    for (let i = 1; i < pathPoints.length - 1; i++) {
      const [x1, y1] = pathPoints[i];
      const [x2, y2] = pathPoints[i + 1];
      ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
    }
    ctx.lineTo(pathPoints[pathPoints.length - 1][0], pathPoints[pathPoints.length - 1][1]);
  };
  ctx.strokeStyle = 'rgba(8, 22, 20, 0.45)';
  ctx.lineWidth = 60;
  tracePath();
  ctx.stroke();
  ctx.strokeStyle = '#585a55';
  ctx.lineWidth = 50;
  tracePath();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(126, 128, 118, 0.45)';
  ctx.lineWidth = 38;
  tracePath();
  ctx.stroke();
  // Gravel speckle, clipped to the path itself.
  ctx.save();
  ctx.lineWidth = 50;
  tracePath();
  ctx.strokeStyle = '#000';
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 1600; i++) {
    const x = rng() * WORLD_W;
    const y = 130 + rng() * 190;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(196, 194, 178, 0.32)' : 'rgba(34, 34, 30, 0.32)';
    ctx.fillRect(x, y, 1.8, 1.8);
  }
  ctx.restore();
  ctx.restore();

  // Grass blades — the texture that keeps the lawn from looking like paper.
  for (let i = 0; i < 5200; i++) {
    const x = rng() * WORLD_W;
    const y = rng() * WORLD_H;
    const near = y / WORLD_H;
    const h = 4 + rng() * (4 + near * 5);
    const lean = (rng() - 0.5) * 4;
    const shade = rng();
    ctx.strokeStyle =
      shade > 0.88
        ? `rgba(120, 174, 138, ${0.1 + near * 0.1})`
        : shade > 0.5
          ? `rgba(56, 112, 88, ${0.24 + near * 0.16})`
          : `rgba(18, 48, 41, ${0.26 + near * 0.18})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.4, y - h * 0.6, x + lean, y - h);
    ctx.stroke();
  }

  // Denser tufts so the lawn has clumps rather than even stubble.
  for (let t = 0; t < 220; t++) {
    const cx = rng() * WORLD_W;
    const cy = 80 + rng() * (WORLD_H - 80);
    const blades = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < blades; i++) {
      const x = cx + (rng() - 0.5) * 16;
      const h = 8 + rng() * 9;
      const lean = (rng() - 0.5) * 9;
      ctx.strokeStyle = rng() > 0.55 ? 'rgba(70, 130, 100, 0.34)' : 'rgba(16, 44, 38, 0.42)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.quadraticCurveTo(x + lean * 0.3, cy - h * 0.6, x + lean, cy - h);
      ctx.stroke();
    }
  }

  // Wildflowers, kept near the borders so the play area stays readable.
  for (let c = 0; c < 30; c++) {
    const edge = rng();
    const cx = edge < 0.5 ? 60 + rng() * 220 : WORLD_W - 60 - rng() * 220;
    const cy = 120 + rng() * (WORLD_H - 170);
    const petals = ['#dfd9c4', '#e6cf94', '#c4aad4', '#dfb2bd'];
    const color = petals[Math.floor(rng() * petals.length)];
    const count = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) {
      const x = cx + (rng() - 0.5) * 44;
      const y = cy + (rng() - 0.5) * 32;
      ctx.strokeStyle = 'rgba(46, 92, 72, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 5);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(10, 28, 24, 0.3)';
      circle(ctx, x + 0.7, y + 1, 1.8);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = color;
      circle(ctx, x, y, 1.7);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Hedge border framing the lawn, with trees breaking the line.
  drawHedgeRun(ctx, { x: -40, y: 34 }, { x: WORLD_W + 40, y: 34 }, 74, rng);
  drawHedgeRun(ctx, { x: -30, y: 60 }, { x: -30, y: WORLD_H + 30 }, 78, rng);
  drawHedgeRun(ctx, { x: WORLD_W + 30, y: 60 }, { x: WORLD_W + 30, y: WORLD_H + 30 }, 78, rng);
  drawHedgeRun(ctx, { x: -40, y: WORLD_H + 24 }, { x: WORLD_W + 40, y: WORLD_H + 24 }, 66, rng);

  const trees: [number, number, number][] = [
    [96, 18, 84],
    [372, 6, 96],
    [700, 20, 78],
    [1010, 4, 92],
    [1244, 34, 86],
    [-16, 300, 96],
    [-8, 596, 88],
    [WORLD_W + 12, 372, 100],
    [WORLD_W + 6, 660, 86],
  ];
  for (const [x, y, r] of trees) drawCanopy(ctx, x, y, r, rng);

  // Lampposts: baked warm pools on the grass, post caps on top.
  for (const lamp of LAMPS) {
    const pool = ctx.createRadialGradient(lamp.x, lamp.y + 24, 8, lamp.x, lamp.y + 24, 250);
    pool.addColorStop(0, 'rgba(255, 205, 130, 0.3)');
    pool.addColorStop(0.35, 'rgba(255, 190, 118, 0.14)');
    pool.addColorStop(1, 'rgba(255, 180, 110, 0)');
    ctx.fillStyle = pool;
    ellipse(ctx, lamp.x, lamp.y + 24, 250, 190);
    ctx.fill();

    ctx.fillStyle = 'rgba(6, 20, 18, 0.4)';
    ellipse(ctx, lamp.x + 10, lamp.y + 12, 26, 10);
    ctx.fill();
    ctx.fillStyle = '#2a3038';
    ellipse(ctx, lamp.x, lamp.y + 6, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#3a424c';
    ellipse(ctx, lamp.x, lamp.y - 2, 9, 5);
    ctx.fill();
    const bulb = ctx.createRadialGradient(lamp.x, lamp.y - 6, 1, lamp.x, lamp.y - 6, 26);
    bulb.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
    bulb.addColorStop(0.3, 'rgba(255, 208, 130, 0.5)');
    bulb.addColorStop(1, 'rgba(255, 190, 110, 0)');
    ctx.fillStyle = bulb;
    circle(ctx, lamp.x, lamp.y - 6, 26);
    ctx.fill();
  }

  // Picnic blanket, spread out beside where the owner stands.
  ctx.save();
  ctx.translate(OWNER_POS.x + 210, OWNER_POS.y + 34);
  ctx.rotate(-0.09);
  ctx.fillStyle = 'rgba(6, 20, 18, 0.35)';
  roundRect(ctx, -88, -50, 184, 104, 12);
  ctx.fill();
  ctx.fillStyle = '#cec2ab';
  roundRect(ctx, -92, -54, 184, 104, 10);
  ctx.fill();
  ctx.save();
  roundRect(ctx, -92, -54, 184, 104, 10);
  ctx.clip();
  ctx.fillStyle = 'rgba(148, 54, 60, 0.8)';
  for (let x = -92; x < 92; x += 34) ctx.fillRect(x, -54, 17, 104);
  for (let y = -54; y < 50; y += 34) ctx.fillRect(-92, y, 184, 17);
  ctx.fillStyle = 'rgba(96, 28, 34, 0.5)';
  for (let x = -92; x < 92; x += 34) {
    for (let y = -54; y < 50; y += 34) ctx.fillRect(x, y, 17, 17);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, -92, -54, 184, 104, 10);
  ctx.stroke();

  // Basket and a thermos on the blanket.
  ctx.fillStyle = 'rgba(6, 20, 18, 0.3)';
  ellipse(ctx, 56, 26, 20, 11);
  ctx.fill();
  ctx.fillStyle = '#8a6335';
  ellipse(ctx, 53, 23, 18, 11.5);
  ctx.fill();
  ctx.fillStyle = '#a3773f';
  ellipse(ctx, 53, 21, 15, 9);
  ctx.fill();
  ctx.strokeStyle = '#6f4f28';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(53, 21, 15, 9, 0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.fillStyle = '#5f7cae';
  roundRect(ctx, -72, 4, 13, 27, 5);
  ctx.fill();
  ctx.fillStyle = '#8fa8d2';
  roundRect(ctx, -72, 4, 13, 7, 4);
  ctx.fill();
  ctx.restore();

  // Park bench tucked against the left hedge.
  ctx.save();
  ctx.translate(150, 620);
  ctx.rotate(0.16);
  ctx.fillStyle = 'rgba(6, 20, 18, 0.35)';
  roundRect(ctx, -46, -16, 96, 44, 6);
  ctx.fill();
  ctx.fillStyle = '#6b5039';
  roundRect(ctx, -50, -20, 96, 40, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 20, 12, 0.5)';
  ctx.lineWidth = 2;
  for (let i = -50; i < 46; i += 12) {
    ctx.beginPath();
    ctx.moveTo(i, -20);
    ctx.lineTo(i, 20);
    ctx.stroke();
  }
  ctx.fillStyle = '#83654a';
  roundRect(ctx, -50, -20, 96, 12, 5);
  ctx.fill();
  ctx.restore();

  return canvas;
}

function buildFront(scale: number): HTMLCanvasElement | null {
  const layer = makeLayer(scale);
  if (!layer) return null;
  const { canvas, ctx } = layer;
  const rng = mulberry32(97531);

  // Blades of grass right at the camera, blurred by being drawn dark and soft.
  for (let i = 0; i < 260; i++) {
    const x = rng() * WORLD_W;
    const y = WORLD_H + 6;
    const h = 18 + rng() * 34;
    const lean = (rng() - 0.5) * 22;
    ctx.strokeStyle = `rgba(9, 26, 22, ${0.32 + rng() * 0.36})`;
    ctx.lineWidth = 2 + rng() * 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.4, y - h * 0.6, x + lean, y - h);
    ctx.stroke();
  }

  // Vignette.
  const vig = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.32, WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.92);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(4, 14, 20, 0.4)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  return canvas;
}

function scenery(scale: number): Scenery | null {
  if (cached && Math.abs(cached.scale - scale) < 0.02) return cached;
  const ground = buildGround(scale);
  const front = buildFront(scale);
  if (!ground || !front) return null;
  cached = { ground, front, scale };
  return cached;
}

/* -------------------------------------------------------------------------- */
/* entities                                                                    */
/* -------------------------------------------------------------------------- */

const COAT_LIGHT = '#ffffff';
const COAT_MID = '#e7edf9';
const COAT_SHADE = '#c3cfe6';
const SKIN = '#9c8894';
const SKIN_DARK = '#7d6a78';

const COAT_EDGE = 'rgba(86, 118, 160, 0.42)';

/** A pom-pom: dense curl cluster with a lit crown and a defined edge. */
function pom(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number): void {
  ctx.fillStyle = COAT_MID;
  ctx.strokeStyle = COAT_EDGE;
  ctx.lineWidth = 1.1;
  fluffPath(ctx, x, y, r, r * 0.96, 9, seed, 0.14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
  fluffPath(ctx, x - r * 0.16, y - r * 0.2, r * 0.6, r * 0.56, 8, seed * 1.7, 0.15);
  ctx.fill();
}

/** Jo: white miniature poodle in a Miami clip — shaved face, feet and tail base. */
function drawDog(ctx: CanvasRenderingContext2D, dog: Dog, elapsed: number): void {
  const speedFrac = Math.min(1, dog.speed / 320);
  const bobPhase = Math.sin(dog.gait * 2);
  const bob = Math.abs(bobPhase) * 5.5 * speedFrac;
  const spin = dog.joy > 0 ? (1 - dog.joy / 0.85) * Math.PI * 2 : 0;
  const breathe = 1 + Math.sin(elapsed * 2.4) * 0.014 * (1 - speedFrac);

  ctx.save();
  ctx.translate(dog.x, dog.y - bob);
  ctx.rotate(dog.angle + spin);
  ctx.scale(breathe, breathe);

  const swing = 8 * Math.max(0.25, speedFrac);
  const legs: [number, number, number][] = [
    [-16, 19, Math.sin(dog.gait + Math.PI)],
    [-16, -19, Math.sin(dog.gait)],
    [16, 19, Math.sin(dog.gait)],
    [16, -19, Math.sin(dog.gait + Math.PI)],
  ];

  // Shaved legs, drawn under the body so only the ankles show.
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 5.4;
  ctx.lineCap = 'round';
  for (const [lx, ly, phase] of legs) {
    ctx.beginPath();
    ctx.moveTo(lx * 0.5, ly * 0.4);
    ctx.lineTo(lx + phase * swing, ly);
    ctx.stroke();
  }

  // Tail: shaved base, pom on the tip, wagging harder the happier she is.
  const wag = Math.sin(dog.tail * 3.2) * (dog.joy > 0 ? 0.85 : 0.45);
  ctx.save();
  ctx.translate(-23, 0);
  ctx.rotate(Math.PI + wag);
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(10, 0);
  ctx.stroke();
  pom(ctx, 19, 0, 10.5, 1.4);
  ctx.restore();

  // Ankle pom-poms.
  for (const [lx, ly, phase] of legs) pom(ctx, lx + phase * swing, ly, 7.2, lx + ly);

  // Body coat.
  ctx.save();
  ctx.shadowColor = 'rgba(150, 195, 255, 0.5)';
  ctx.shadowBlur = 16;
  const coat = ctx.createLinearGradient(-26, -19, 18, 21);
  coat.addColorStop(0, COAT_LIGHT);
  coat.addColorStop(0.5, COAT_MID);
  coat.addColorStop(1, COAT_SHADE);
  ctx.fillStyle = coat;
  fluffPath(ctx, -3, 0, 25, 17, 12, 0.7, 0.058);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = COAT_EDGE;
  ctx.lineWidth = 1.2;
  fluffPath(ctx, -3, 0, 25, 17, 12, 0.7, 0.058);
  ctx.stroke();

  // Curl texture across the coat.
  ctx.strokeStyle = 'rgba(146, 170, 208, 0.38)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.4;
    const rx = 15 + Math.sin(i * 2.3) * 5;
    const ry = 10 + Math.cos(i * 1.7) * 4;
    ctx.beginPath();
    ctx.arc(-3 + Math.cos(a) * rx, Math.sin(a) * ry, 3.1, a - 1.1, a + 1.5);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  fluffPath(ctx, -6, -6, 14, 8, 10, 2.2, 0.1);
  ctx.fill();

  // Shaved muzzle — a clean pale snout, the signature of the Miami clip.
  const snout = ctx.createLinearGradient(30, -9, 52, 9);
  snout.addColorStop(0, '#c3b0b8');
  snout.addColorStop(1, SKIN);
  ctx.fillStyle = snout;
  ellipse(ctx, 42, 0, 14.5, 9.2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90, 72, 84, 0.4)';
  ctx.lineWidth = 1.1;
  ellipse(ctx, 42, 0, 14.5, 9.2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ellipse(ctx, 43, 3.6, 11, 4.6);
  ctx.fill();

  if (dog.barkTimer > 0) {
    ctx.fillStyle = '#5c3040';
    ellipse(ctx, 48, 0, 6, 4.6);
    ctx.fill();
    ctx.fillStyle = '#f3d7dd';
    ellipse(ctx, 47.5, 2, 3.2, 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = SKIN_DARK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(50, -3.2, 4, 0.5, 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(50, 3.2, 4, -1.9, -0.5);
    ctx.stroke();
  }

  ctx.fillStyle = '#241f2a';
  ellipse(ctx, 53.5, 0, 4.2, 3.6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  circle(ctx, 52.6, -1.3, 1.2);
  ctx.fill();

  // Ear puffs flanking the head, lagging behind the stride.
  const earLift = bobPhase * 2.4 * speedFrac;
  for (const side of [-1, 1]) {
    ctx.fillStyle = COAT_SHADE;
    ctx.strokeStyle = COAT_EDGE;
    ctx.lineWidth = 1.1;
    fluffPath(ctx, 22 - Math.abs(earLift) * 0.4, side * 16.5 + earLift * side * 0.5, 10.6, 10, 9, side * 2.1, 0.14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    fluffPath(ctx, 21, side * 15.4, 6.2, 5.8, 8, side * 1.3, 0.15);
    ctx.fill();
  }

  // Topknot.
  ctx.save();
  ctx.shadowColor = 'rgba(150, 195, 255, 0.45)';
  ctx.shadowBlur = 12;
  const head = ctx.createRadialGradient(24, -5, 2, 29, 0, 17);
  head.addColorStop(0, COAT_LIGHT);
  head.addColorStop(0.7, COAT_MID);
  head.addColorStop(1, COAT_SHADE);
  ctx.fillStyle = head;
  fluffPath(ctx, 28, 0, 15.2, 14.4, 11, 2.6, 0.08);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = COAT_EDGE;
  ctx.lineWidth = 1.1;
  fluffPath(ctx, 28, 0, 15.2, 14.4, 11, 2.6, 0.08);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  fluffPath(ctx, 26, -4.6, 9, 7.4, 9, 4.4, 0.1);
  ctx.fill();

  // Eyes, set in the shaved face just behind the snout.
  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(160, 142, 154, 0.75)';
    ellipse(ctx, 32.5, side * 8.6, 4.4, 4.2);
    ctx.fill();
    ctx.fillStyle = '#1d1822';
    ellipse(ctx, 32.5, side * 8.6, 2.8, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    circle(ctx, 33.5, side * 8.6 - 1, 1.1);
    ctx.fill();
  }

  ctx.restore();

  // Bark ring.
  if (dog.barkTimer > 0) {
    const t = 1 - dog.barkTimer / 0.35;
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.5;
    ctx.strokeStyle = '#cfe0ff';
    ctx.lineWidth = 3 * (1 - t) + 1;
    const mx = dog.x + Math.cos(dog.angle) * 50;
    const my = dog.y - bob + Math.sin(dog.angle) * 50;
    for (const scale of [1, 0.6]) {
      circle(ctx, mx, my, 18 + t * 100 * scale);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawDogShadow(ctx: CanvasRenderingContext2D, dog: Dog): void {
  const speedFrac = Math.min(1, dog.speed / 320);
  const bob = Math.abs(Math.sin(dog.gait * 2)) * 5.5 * speedFrac;
  ctx.save();
  ctx.translate(dog.x + 5, dog.y + 8);
  ctx.rotate(dog.angle);
  shadowBlob(ctx, 0, 0, 36 - bob * 0.8, 20 - bob * 0.5, 0.42);
  ctx.restore();
}

function drawOwner(ctx: CanvasRenderingContext2D, owner: Owner, elapsed: number): void {
  const throwT = owner.throwAnim > 0 ? 1 - owner.throwAnim / 0.55 : -1;
  const extend = throwT >= 0 ? Math.sin(throwT * Math.PI) * 16 : 0;
  const reach = owner.reach > 0 ? Math.sin((1 - owner.reach / 0.5) * Math.PI) * 10 : 0;
  const sway = Math.sin(elapsed * 1.5) * 0.03;

  ctx.save();
  ctx.translate(owner.x, owner.y);
  ctx.rotate(owner.angle + sway);

  // Boots peeking out behind.
  ctx.fillStyle = '#26303f';
  ellipse(ctx, -22, -10, 11, 7);
  ctx.fill();
  ellipse(ctx, -22, 10, 11, 7);
  ctx.fill();

  // Arms reaching forward off the shoulders.
  for (const side of [-1, 1]) {
    const isThrowing = side === 1 && throwT >= 0;
    const reachOut = (isThrowing ? extend : 0) + reach;
    ctx.strokeStyle = '#5b78ae';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, side * 21);
    ctx.lineTo(14 + reachOut, side * (21 - reachOut * 0.3));
    ctx.stroke();
    ctx.fillStyle = '#e8b98f';
    circle(ctx, 17 + reachOut, side * (21 - reachOut * 0.3), 5);
    ctx.fill();
  }

  // Shoulders — wider across than deep, which is what sells "person" from above.
  const jacket = ctx.createLinearGradient(-16, -24, 14, 24);
  jacket.addColorStop(0, '#89a6d7');
  jacket.addColorStop(1, '#4a6396');
  ctx.fillStyle = jacket;
  ellipse(ctx, 0, 0, 19, 25);
  ctx.fill();
  ctx.strokeStyle = 'rgba(14, 26, 44, 0.55)';
  ctx.lineWidth = 1.6;
  ellipse(ctx, 0, 0, 19, 25);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ellipse(ctx, -3, -11, 12, 9, -0.3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(14, 26, 44, 0.3)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(14, 0);
  ctx.stroke();

  // Scarf.
  ctx.fillStyle = '#c0464c';
  ellipse(ctx, 5, 0, 13, 15);
  ctx.fill();
  ctx.fillStyle = '#9c363c';
  ellipse(ctx, 3, 0, 9.5, 11);
  ctx.fill();

  // Head in a cream beanie.
  ctx.fillStyle = '#e0ae82';
  circle(ctx, 9, 0, 13.5);
  ctx.fill();
  const hat = ctx.createRadialGradient(4, -4, 2, 7, 0, 14);
  hat.addColorStop(0, '#f3ead6');
  hat.addColorStop(1, '#cbbb9c');
  ctx.fillStyle = hat;
  circle(ctx, 6, 0, 13);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 48, 34, 0.42)';
  ctx.lineWidth = 1.4;
  circle(ctx, 6, 0, 13);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(160, 60, 62, 0.6)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(6, 0, 10.5, -2.4, 2.4);
  ctx.stroke();
  ctx.fillStyle = '#f6f1e4';
  circle(ctx, 2, 0, 5);
  ctx.fill();
  // A hint of nose past the brim.
  ctx.fillStyle = '#d9a377';
  circle(ctx, 20.5, 0, 3.4);
  ctx.fill();

  ctx.restore();
}

function drawSquirrel(ctx: CanvasRenderingContext2D, s: Squirrel): void {
  const hop = Math.abs(Math.sin(s.bob)) * 4;
  ctx.save();
  ctx.translate(s.x, s.y - hop);
  ctx.rotate(s.angle);

  // Big fluffy tail arcing behind.
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    ctx.fillStyle = i === 2 ? '#c08b5c' : '#9a6438';
    fluffPath(ctx, -17 - t * 9, -t * 7, 10.5 - t * 1.6, 9.8 - t * 1.3, 8, i * 2.1, 0.14);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 226, 190, 0.35)';
  fluffPath(ctx, -29, -11, 6.4, 6, 7, 1.7, 0.15);
  ctx.fill();

  ctx.fillStyle = '#8d5c33';
  ellipse(ctx, 0, 0, 14, 10.6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 22, 12, 0.4)';
  ctx.lineWidth = 1.2;
  ellipse(ctx, 0, 0, 14, 10.6);
  ctx.stroke();
  ctx.fillStyle = '#a9703f';
  ellipse(ctx, -1, -2, 10, 6.8);
  ctx.fill();

  ctx.fillStyle = '#9a6438';
  circle(ctx, 11.5, 0, 8.4);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#7d4f2b';
    ellipse(ctx, 12.5, side * 6.4, 3.8, 4.6, side * 0.4);
    ctx.fill();
    ctx.fillStyle = '#12101a';
    circle(ctx, 15.5, side * 3.8, 1.9);
    ctx.fill();
  }
  ctx.fillStyle = '#2a1f1a';
  circle(ctx, 19, 0, 1.9);
  ctx.fill();

  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, b: Ball, elapsed: number): void {
  const r = b.golden ? 14 : 13;
  const sy = b.y - b.z * 0.62;

  if (b.state === 'resting') {
    // Gentle pulse so a ball at rest is easy to spot in the grass.
    const pulse = 0.5 + Math.sin(elapsed * 3.4) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 40 + pulse * 12);
    const tint = b.golden ? '255, 205, 100' : '160, 195, 255';
    glow.addColorStop(0, `rgba(${tint}, ${b.golden ? 0.42 : 0.25})`);
    glow.addColorStop(1, `rgba(${tint}, 0)`);
    ctx.fillStyle = glow;
    ellipse(ctx, b.x, b.y, 44 + pulse * 12, 26 + pulse * 8);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = b.golden ? `rgba(255, 214, 120, ${0.5 - pulse * 0.3})` : `rgba(180, 208, 255, ${0.36 - pulse * 0.22})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 20 + pulse * 14, 11 + pulse * 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(b.x, sy);
  ctx.rotate(b.rot * 0.35);

  ctx.save();
  circle(ctx, 0, 0, r);
  ctx.clip();
  if (b.golden) {
    const gold = ctx.createLinearGradient(-r, -r, r, r);
    gold.addColorStop(0, '#ffe9ab');
    gold.addColorStop(0.45, '#f2bd4c');
    gold.addColorStop(1, '#c98a1e');
    ctx.fillStyle = gold;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.save();
    ctx.rotate(elapsed * 1.6);
    ctx.fillRect(-r, -r * 0.22, r * 2, r * 0.3);
    ctx.restore();
  } else {
    // Serbian tricolour: red over blue over white.
    ctx.fillStyle = '#cf3b41';
    ctx.fillRect(-r, -r, r * 2, (r * 2) / 3);
    ctx.fillStyle = '#22468c';
    ctx.fillRect(-r, -r / 3, r * 2, (r * 2) / 3);
    ctx.fillStyle = '#f2f5fb';
    ctx.fillRect(-r, r / 3, r * 2, (r * 2) / 3);
  }
  const shade = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.15);
  shade.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
  shade.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  shade.addColorStop(1, 'rgba(10, 20, 30, 0.45)');
  ctx.fillStyle = shade;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  circle(ctx, 0, 0, r - 0.4);
  ctx.stroke();
  ctx.restore();
}

function drawBallShadow(ctx: CanvasRenderingContext2D, b: Ball): void {
  const lift = Math.min(1, b.z / 320);
  shadowBlob(ctx, b.x + 3, b.y + 3, 14 * (1 - lift * 0.45), 8 * (1 - lift * 0.45), 0.42 * (1 - lift * 0.6));
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const t = p.life / p.maxLife;
  const y = p.y - p.z * 0.6;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, t * 1.4));
  ctx.translate(p.x, y);
  ctx.rotate(p.rot);

  if (p.kind === 'sparkle') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.4;
    const s = p.size * (0.6 + t);
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(s, 0);
    ctx.moveTo(0, -s);
    ctx.lineTo(0, s);
    ctx.stroke();
    ctx.fillStyle = p.color;
    circle(ctx, 0, 0, s * 0.32);
    ctx.fill();
  } else if (p.kind === 'heart') {
    const s = p.size * 0.85;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.9);
    ctx.bezierCurveTo(-s * 1.4, -s * 0.25, -s * 0.5, -s * 1.25, 0, -s * 0.42);
    ctx.bezierCurveTo(s * 0.5, -s * 1.25, s * 1.4, -s * 0.25, 0, s * 0.9);
    ctx.fill();
  } else if (p.kind === 'grass') {
    ctx.fillStyle = p.color;
    ellipse(ctx, 0, 0, p.size * 1.5, p.size * 0.5);
    ctx.fill();
  } else {
    ctx.fillStyle = p.color;
    circle(ctx, 0, 0, p.size);
    ctx.fill();
  }
  ctx.restore();
}

function drawSpeech(ctx: CanvasRenderingContext2D, owner: Owner): void {
  const speech = owner.speech;
  if (!speech) return;
  const age = 1 - speech.life / speech.maxLife;
  const pop = Math.min(1, (1 - speech.life / speech.maxLife) * 8);
  const fade = speech.life < 0.35 ? speech.life / 0.35 : 1;

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(owner.x, owner.y - 74 - age * 10);
  ctx.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4);

  ctx.font = `700 21px ${UI_FONT}`;
  const mainW = ctx.measureText(speech.text).width;
  ctx.font = `500 13px ${UI_FONT}`;
  const subW = ctx.measureText(speech.sub).width;
  const w = Math.max(mainW, subW) + 30;
  const h = 54;

  ctx.fillStyle = 'rgba(10, 24, 34, 0.82)';
  ctx.strokeStyle = 'rgba(168, 189, 224, 0.35)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, -w / 2, -h, w, h, 12);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-7, -1);
  ctx.lineTo(7, -1);
  ctx.lineTo(0, 10);
  ctx.closePath();
  ctx.fillStyle = 'rgba(10, 24, 34, 0.82)';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbfcff';
  ctx.font = `700 21px ${UI_FONT}`;
  ctx.fillText(speech.text, 0, -28);
  ctx.fillStyle = '#8fa3c4';
  ctx.font = `500 13px ${UI_FONT}`;
  ctx.fillText(speech.sub, 0, -11);
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* frame                                                                       */
/* -------------------------------------------------------------------------- */

export function render(ctx: CanvasRenderingContext2D, g: Game, scale: number): void {
  const layers = scenery(Math.min(2, scale));

  ctx.save();
  if (g.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  if (layers) {
    ctx.drawImage(layers.ground, 0, 0, WORLD_W, WORLD_H);
  } else {
    ctx.fillStyle = '#20463b';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  // Paw prints pressed into the grass.
  for (const paw of g.paws) {
    const a = paw.life / 2.6;
    ctx.save();
    ctx.globalAlpha = a * 0.3;
    ctx.translate(paw.x, paw.y);
    ctx.rotate(paw.angle);
    ctx.fillStyle = '#0d2822';
    ellipse(ctx, 0, 0, 3.6, 2.8);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const t = (i - 1) * 0.8;
      circle(ctx, 3.4, t * 2.1, 1.15);
      ctx.fill();
    }
    ctx.restore();
  }

  // Delivery zone at the owner's feet.
  {
    const carrying = g.dog.carrying !== null;
    const pulse = 0.5 + Math.sin(g.elapsed * (carrying ? 5 : 2)) * 0.5;
    ctx.save();
    ctx.setLineDash([12, 10]);
    ctx.lineDashOffset = -g.elapsed * (carrying ? 40 : 12);
    ctx.strokeStyle = carrying
      ? `rgba(143, 216, 192, ${0.35 + pulse * 0.35})`
      : `rgba(168, 189, 224, ${0.12 + pulse * 0.06})`;
    ctx.lineWidth = carrying ? 2.6 : 1.6;
    ctx.beginPath();
    ctx.ellipse(OWNER_POS.x, OWNER_POS.y + 8, DELIVER_RING, DELIVER_RING * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (carrying) {
      ctx.setLineDash([]);
      const glow = ctx.createRadialGradient(OWNER_POS.x, OWNER_POS.y + 8, 4, OWNER_POS.x, OWNER_POS.y + 8, DELIVER_RING);
      glow.addColorStop(0, `rgba(143, 216, 192, ${0.12 + pulse * 0.07})`);
      glow.addColorStop(1, 'rgba(143, 216, 192, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(OWNER_POS.x, OWNER_POS.y + 8, DELIVER_RING, DELIVER_RING * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Combo aura under Jo.
  if (g.combo >= 2) {
    const heat = Math.min(1, g.combo / 8);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const aura = ctx.createRadialGradient(g.dog.x, g.dog.y + 6, 2, g.dog.x, g.dog.y + 6, 52);
    aura.addColorStop(0, `rgba(255, 190, 120, ${0.1 + heat * 0.18})`);
    aura.addColorStop(1, 'rgba(255, 170, 90, 0)');
    ctx.fillStyle = aura;
    ellipse(ctx, g.dog.x, g.dog.y + 6, 52, 30);
    ctx.fill();
    ctx.restore();
  }

  // Shadows first so nothing casts onto another body.
  for (const s of g.squirrels) shadowBlob(ctx, s.x + 4, s.y + 6, 20, 11, 0.36);
  for (const b of g.balls) {
    if (b.state === 'gone') continue;
    drawBallShadow(ctx, b);
  }
  shadowBlob(ctx, g.owner.x + 6, g.owner.y + 11, 37, 21, 0.44);
  drawDogShadow(ctx, g.dog);

  // Bodies, back to front.
  type Item = { y: number; draw: () => void };
  const items: Item[] = [];
  items.push({ y: g.owner.y, draw: () => drawOwner(ctx, g.owner, g.elapsed) });
  items.push({ y: g.dog.y, draw: () => drawDog(ctx, g.dog, g.elapsed) });
  for (const s of g.squirrels) items.push({ y: s.y, draw: () => drawSquirrel(ctx, s) });
  for (const b of g.balls) {
    if (b.state === 'gone') continue;
    // A carried ball always sits in front of whoever is holding it.
    const sortY = b.state === 'carried' ? (b.holder === 'dog' ? g.dog.y : b.y) + 0.5 : b.y;
    items.push({ y: sortY, draw: () => drawBall(ctx, b, g.elapsed) });
  }
  items.sort((a, b) => a.y - b.y);
  for (const item of items) item.draw();

  for (const p of g.particles) drawParticle(ctx, p);

  // Butterflies drift above everything on the ground.
  for (const b of g.butterflies) {
    const flap = Math.abs(Math.sin(b.flap));
    ctx.save();
    ctx.translate(b.x, b.y - 26);
    ctx.rotate(b.angle + Math.PI / 2);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = b.hue;
    for (const side of [-1, 1]) {
      ellipse(ctx, side * 3.2 * (0.35 + flap * 0.65), -1, 3.4 * (0.3 + flap * 0.7), 4.4);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(30, 26, 30, 0.7)';
    ellipse(ctx, 0, 0, 0.9, 3.4);
    ctx.fill();
    ctx.restore();
  }

  // Warm light spilling over anything standing in a lamp pool.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const lamp of LAMPS) {
    const pool = ctx.createRadialGradient(lamp.x, lamp.y + 24, 10, lamp.x, lamp.y + 24, 230);
    pool.addColorStop(0, 'rgba(255, 196, 122, 0.09)');
    pool.addColorStop(1, 'rgba(255, 180, 110, 0)');
    ctx.fillStyle = pool;
    ellipse(ctx, lamp.x, lamp.y + 24, 230, 180);
    ctx.fill();
  }

  // Fireflies.
  for (const f of g.fireflies) {
    const glowT = 0.35 + 0.65 * Math.abs(Math.sin(f.phase * 1.3));
    const x = f.x + Math.cos(f.phase * 2.1) * f.radius;
    const y = f.y + Math.sin(f.phase * 1.6) * f.radius * 0.5;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 12);
    grad.addColorStop(0, `rgba(255, 236, 160, ${0.75 * glowT})`);
    grad.addColorStop(0.35, `rgba(255, 216, 120, ${0.28 * glowT})`);
    grad.addColorStop(1, 'rgba(255, 210, 110, 0)');
    ctx.fillStyle = grad;
    circle(ctx, x, y, 12);
    ctx.fill();
  }
  ctx.restore();

  drawSpeech(ctx, g.owner);

  // Floating score text.
  for (const f of g.floats) {
    const t = f.life / f.maxLife;
    const pop = Math.min(1, (1 - t) * 6);
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 2.2);
    ctx.translate(f.x, f.y);
    ctx.scale(0.7 + pop * 0.3, 0.7 + pop * 0.3);
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(8, 20, 28, 0.65)';
    ctx.font = `700 ${f.size}px ${UI_FONT}`;
    ctx.strokeText(f.text, 0, 0);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, 0, 0);
    if (f.sub) {
      ctx.font = `600 ${f.size * 0.46}px ${UI_FONT}`;
      ctx.strokeText(f.sub, 0, f.size * 0.62);
      ctx.fillStyle = 'rgba(251, 252, 255, 0.75)';
      ctx.fillText(f.sub, 0, f.size * 0.62);
    }
    ctx.restore();
  }

  if (layers) ctx.drawImage(layers.front, 0, 0, WORLD_W, WORLD_H);

  if (g.flash > 0.01) {
    ctx.fillStyle = `rgba(255, 245, 220, ${g.flash * 0.3})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  ctx.restore();
}

/** Frees the baked layers — called when the game unmounts. */
export function disposeScenery(): void {
  cached = null;
}
