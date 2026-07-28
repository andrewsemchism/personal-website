/**
 * Jo Simulator — simulation state and rules.
 *
 * Everything here is plain data plus an `update` step; nothing touches the DOM
 * or the canvas, so the renderer and the React shell can stay dumb. Sounds are
 * queued onto `events` and drained by the caller once per frame.
 */

import type { Sfx } from './audio';

export const WORLD_W = 1280;
export const WORLD_H = 800;

/** Jo, the balls and the squirrels all stay inside this — it keeps the treeline clear. */
export const BOUNDS = { minX: 74, maxX: WORLD_W - 74, minY: 92, maxY: WORLD_H - 96 };

export const OWNER_POS = { x: WORLD_W / 2, y: WORLD_H - 132 };

export const RUN_SECONDS = 45;
export const MAX_TIME = 60;
const TIME_PER_DELIVERY = 4;
const TIME_PER_GOLDEN = 7;

const GRAVITY = 1500;
const DOG_SPEED = 320;
const DOG_CARRY_SPEED = 282;
const DOG_ACCEL = 11;
const ZOOMIE_SPEED = 1.22;
const ZOOMIE_SECONDS = 1.3;

const PICKUP_RADIUS = 42;
const PICKUP_HEIGHT = 46;
const DELIVER_RADIUS = 82;
const BARK_RADIUS = 210;
const BARK_COOLDOWN = 0.7;

export const COMBO_WINDOW = 10;
const MAX_MULTIPLIER = 4;

const SQUIRREL_SPEED = 205;
const SQUIRREL_FLEE_SPEED = 285;
const SQUIRREL_STEAL_RADIUS = 20;
const SQUIRREL_SCARE_RADIUS = 74;

const MAX_PARTICLES = 420;

export type Phase = 'title' | 'countdown' | 'playing' | 'paused' | 'over';

export type BallState = 'flying' | 'resting' | 'carried' | 'taken' | 'gone';

export type Ball = {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  spin: number;
  golden: boolean;
  state: BallState;
  /** Who is holding it while `carried` — Jo or a squirrel. */
  holder: 'dog' | number | null;
  /** How far the owner threw it, in pixels — longer throws pay more. */
  throwDist: number;
  thrownAt: number;
  restFor: number;
};

export type SquirrelState = 'seeking' | 'fleeing';

export type Squirrel = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  state: SquirrelState;
  targetBall: number | null;
  carrying: number | null;
  bob: number;
  /** Seconds left of panic after a bark — a scared squirrel will not turn back. */
  scared: number;
  life: number;
};

export type Dog = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  gait: number;
  speed: number;
  carrying: number | null;
  barkTimer: number;
  barkCooldown: number;
  joy: number;
  zoomies: number;
  tail: number;
  pawTimer: number;
};

export type ParticleKind = 'grass' | 'sparkle' | 'heart' | 'dust' | 'note';

export type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  rot: number;
  spin: number;
  color: string;
  kind: ParticleKind;
};

export type FloatText = {
  x: number;
  y: number;
  text: string;
  sub?: string;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

export type Firefly = {
  x: number;
  y: number;
  phase: number;
  speed: number;
  radius: number;
  drift: number;
};

export type PawPrint = { x: number; y: number; angle: number; life: number; side: number };

export type Butterfly = {
  x: number;
  y: number;
  angle: number;
  speed: number;
  flap: number;
  hue: string;
};

export type Speech = { text: string; sub: string; life: number; maxLife: number };

export type Owner = {
  x: number;
  y: number;
  angle: number;
  /** 0 → idle, counts down through the wind-up and release. */
  throwAnim: number;
  reach: number;
  speech: Speech | null;
};

export type Game = {
  phase: Phase;
  /** Always-advancing clock used for animation, independent of the run timer. */
  elapsed: number;
  timeLeft: number;
  countdown: number;
  score: number;
  combo: number;
  bestCombo: number;
  comboTimer: number;
  deliveries: number;
  goldenDeliveries: number;
  steals: number;
  longestFetch: number;
  dog: Dog;
  owner: Owner;
  balls: Ball[];
  squirrels: Squirrel[];
  particles: Particle[];
  floats: FloatText[];
  fireflies: Firefly[];
  butterflies: Butterfly[];
  paws: PawPrint[];
  nextThrowAt: number;
  nextSquirrelAt: number;
  shake: number;
  flash: number;
  /** Title-screen attract mode: Jo plays herself and the run timer is frozen. */
  demo: boolean;
  events: Sfx[];
  nextId: number;
};

export type Input = { x: number; y: number; bark: boolean };

export type Summary = {
  score: number;
  deliveries: number;
  goldenDeliveries: number;
  bestCombo: number;
  steals: number;
};

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

function angleLerp(from: number, to: number, t: number): number {
  let delta = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

const CHEERS: readonly { text: string; sub: string }[] = [
  { text: 'Bravo, Jo!', sub: 'Well done, Jo!' },
  { text: 'Svaka čast!', sub: 'Nicely done!' },
  { text: 'Odlično!', sub: 'Excellent!' },
  { text: 'Tako je!', sub: "That's it!" },
  { text: 'Još jednom!', sub: 'One more time!' },
  { text: 'Ma vidi je!', sub: 'Look at her go!' },
];

const THROW_CALLS: readonly { text: string; sub: string }[] = [
  { text: 'Aport!', sub: 'Fetch!' },
  { text: 'Donesi lopticu!', sub: 'Bring the ball!' },
  { text: 'Hajde, Jo!', sub: 'Come on, Jo!' },
  { text: 'Trči!', sub: 'Run!' },
];

/* -------------------------------------------------------------------------- */
/* construction                                                                */
/* -------------------------------------------------------------------------- */

function makeDog(): Dog {
  return {
    x: OWNER_POS.x - 90,
    y: OWNER_POS.y - 40,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    gait: 0,
    speed: 0,
    carrying: null,
    barkTimer: 0,
    barkCooldown: 0,
    joy: 0,
    zoomies: 0,
    tail: 0,
    pawTimer: 0,
  };
}

function makeFireflies(): Firefly[] {
  return Array.from({ length: 26 }, () => ({
    x: rand(40, WORLD_W - 40),
    y: rand(120, WORLD_H - 40),
    phase: rand(0, Math.PI * 2),
    speed: rand(0.25, 0.7),
    radius: rand(16, 60),
    drift: rand(-14, 14),
  }));
}

function makeButterflies(): Butterfly[] {
  return Array.from({ length: 5 }, () => ({
    x: rand(150, WORLD_W - 150),
    y: rand(160, WORLD_H - 160),
    angle: rand(0, Math.PI * 2),
    speed: rand(28, 46),
    flap: rand(0, Math.PI * 2),
    hue: pick(['#f6d78a', '#e8a7c8', '#a9d8f0', '#f3f0e6']),
  }));
}

export function createGame(demo: boolean): Game {
  return {
    phase: demo ? 'title' : 'countdown',
    elapsed: 0,
    timeLeft: RUN_SECONDS,
    countdown: 3.6,
    score: 0,
    combo: 0,
    bestCombo: 0,
    comboTimer: 0,
    deliveries: 0,
    goldenDeliveries: 0,
    steals: 0,
    longestFetch: 0,
    dog: makeDog(),
    owner: { x: OWNER_POS.x, y: OWNER_POS.y, angle: -Math.PI / 2, throwAnim: 0, reach: 0, speech: null },
    balls: [],
    squirrels: [],
    particles: [],
    floats: [],
    fireflies: makeFireflies(),
    butterflies: makeButterflies(),
    paws: [],
    nextThrowAt: demo ? 0.8 : 0,
    nextSquirrelAt: 14,
    shake: 0,
    flash: 0,
    demo,
    events: [],
    nextId: 1,
  };
}

export function summarize(g: Game): Summary {
  return {
    score: g.score,
    deliveries: g.deliveries,
    goldenDeliveries: g.goldenDeliveries,
    bestCombo: g.bestCombo,
    steals: g.steals,
  };
}

/* -------------------------------------------------------------------------- */
/* spawning                                                                    */
/* -------------------------------------------------------------------------- */

function emit(g: Game, sound: Sfx): void {
  if (!g.demo) g.events.push(sound);
}

function addParticle(g: Game, p: Particle): void {
  if (g.particles.length >= MAX_PARTICLES) return;
  g.particles.push(p);
}

function burst(
  g: Game,
  x: number,
  y: number,
  kind: ParticleKind,
  count: number,
  colors: readonly string[],
  power = 1
): void {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(40, 170) * power;
    addParticle(g, {
      x,
      y,
      z: kind === 'grass' ? 2 : rand(6, 26),
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s * 0.6,
      vz: rand(80, 260) * power,
      life: rand(0.5, 1.1),
      maxLife: 1.1,
      size: rand(2.5, 5.5),
      rot: rand(0, Math.PI * 2),
      spin: rand(-9, 9),
      color: pick(colors),
      kind,
    });
  }
}

function say(g: Game, line: { text: string; sub: string }, seconds = 2.2): void {
  g.owner.speech = { text: line.text, sub: line.sub, life: seconds, maxLife: seconds };
}

function addFloat(g: Game, x: number, y: number, text: string, color: string, size = 30, sub?: string): void {
  g.floats.push({ x, y, text, sub, life: 1.5, maxLife: 1.5, color, size });
}

function ballsInPlay(g: Game): number {
  return g.balls.filter(b => b.state === 'flying' || b.state === 'resting' || b.state === 'carried').length;
}

function ballsWanted(g: Game): number {
  if (g.deliveries >= 14) return 3;
  if (g.deliveries >= 6) return 2;
  return 1;
}

function throwBall(g: Game): void {
  // Aim into the open field, biased away from wherever Jo already is.
  let best = { x: OWNER_POS.x, y: OWNER_POS.y - 400, score: -Infinity };
  for (let i = 0; i < 6; i++) {
    const angle = rand(-Math.PI + 0.5, -0.5);
    const dist = rand(330, 560);
    const x = clamp(OWNER_POS.x + Math.cos(angle) * dist, BOUNDS.minX + 40, BOUNDS.maxX - 40);
    const y = clamp(OWNER_POS.y + Math.sin(angle) * dist, BOUNDS.minY + 40, BOUNDS.maxY - 40);
    const fromDog = Math.hypot(x - g.dog.x, y - g.dog.y);
    const score = fromDog + dist * 0.4;
    if (score > best.score) best = { x, y, score };
  }

  const dx = best.x - OWNER_POS.x;
  const dy = best.y - OWNER_POS.y;
  const dist = Math.hypot(dx, dy);
  const flight = 0.85 + dist / 720;
  const golden = g.deliveries >= 3 && Math.random() < 0.14;

  g.balls.push({
    id: g.nextId++,
    x: OWNER_POS.x,
    y: OWNER_POS.y - 18,
    z: 34,
    vx: dx / flight,
    vy: dy / flight,
    vz: (GRAVITY * flight) / 2,
    rot: rand(0, Math.PI * 2),
    spin: rand(-14, 14),
    golden,
    state: 'flying',
    holder: null,
    throwDist: dist,
    thrownAt: g.elapsed,
    restFor: 0,
  });

  g.owner.angle = Math.atan2(dy, dx);
  g.owner.throwAnim = 0.55;
  emit(g, 'throw');
  say(g, golden ? { text: 'Zlatna loptica!', sub: 'Golden ball!' } : pick(THROW_CALLS), 2);
}

function spawnSquirrel(g: Game, target: Ball): void {
  const edge = Math.floor(rand(0, 3));
  const x = edge === 0 ? BOUNDS.minX - 60 : edge === 1 ? BOUNDS.maxX + 60 : rand(BOUNDS.minX, BOUNDS.maxX);
  const y = edge === 2 ? BOUNDS.minY - 60 : rand(BOUNDS.minY, BOUNDS.maxY - 180);
  g.squirrels.push({
    id: g.nextId++,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: Math.atan2(target.y - y, target.x - x),
    state: 'seeking',
    targetBall: target.id,
    carrying: null,
    bob: 0,
    scared: 0,
    life: 0,
  });
}

/* -------------------------------------------------------------------------- */
/* scoring                                                                     */
/* -------------------------------------------------------------------------- */

/** Combo payout: every delivery in a row adds 25%, up to 4×. */
export function multiplier(g: Game): number {
  return Math.min(MAX_MULTIPLIER, 1 + 0.25 * g.combo);
}

function deliver(g: Game, ball: Ball): void {
  const fetchSeconds = g.elapsed - ball.thrownAt;
  const distBonus = Math.round(ball.throwDist / 5);
  const speedBonus = Math.max(0, Math.round((7 - fetchSeconds) * 22));
  const mult = multiplier(g);
  const points = Math.round((100 + distBonus + speedBonus) * mult * (ball.golden ? 3 : 1));

  g.score += points;
  g.deliveries += 1;
  if (ball.golden) g.goldenDeliveries += 1;
  g.combo += 1;
  g.bestCombo = Math.max(g.bestCombo, g.combo);
  g.comboTimer = COMBO_WINDOW;
  g.longestFetch = Math.max(g.longestFetch, ball.throwDist);

  if (!g.demo) {
    g.timeLeft = Math.min(MAX_TIME, g.timeLeft + (ball.golden ? TIME_PER_GOLDEN : TIME_PER_DELIVERY));
  }

  ball.state = 'gone';
  ball.holder = null;
  g.dog.carrying = null;
  g.dog.joy = 0.85;
  g.dog.zoomies = ZOOMIE_SECONDS;
  g.owner.reach = 0.5;
  g.shake = Math.min(9, 4 + mult);
  g.flash = ball.golden ? 0.5 : 0.28;

  // Score pops over Jo rather than the owner, so it never lands on the cheer bubble.
  const px = g.dog.x;
  const py = g.dog.y - 46;
  addFloat(g, px, py, `+${points}`, ball.golden ? '#ffd76b' : '#fbfcff', ball.golden ? 40 : 32);
  if (g.combo >= 2) {
    addFloat(g, px + rand(-30, 30), py - 44, `×${mult.toFixed(2).replace(/\.?0+$/, '')}`, '#8fd8c0', 24, `niz ${g.combo}`);
  }
  burst(g, g.owner.x, g.owner.y - 30, 'heart', 7, ['#ff9fb6', '#ffc2d1', '#ffe0e7']);
  burst(g, g.dog.x, g.dog.y, 'sparkle', 16, ball.golden ? ['#ffd76b', '#fff3cd', '#ffffff'] : ['#fbfcff', '#a8bde0', '#8fd8c0']);
  burst(g, g.dog.x, g.dog.y, 'grass', 8, ['#4f7f63', '#3d6b53', '#6d9a77']);

  emit(g, ball.golden ? 'golden' : 'deliver');
  say(g, ball.golden ? { text: 'Zlatna! Bravo!', sub: 'Golden! Well done!' } : pick(CHEERS), 1.9);

  // Let the praise land before the next throw call replaces it.
  g.nextThrowAt = g.elapsed + 1;
}

function loseBall(g: Game, ball: Ball): void {
  ball.state = 'gone';
  ball.holder = null;
  g.steals += 1;
  // Half the streak, not all of it — a squirrel across the park is not always
  // something you could have stopped.
  g.combo = Math.floor(g.combo / 2);
  g.comboTimer = g.combo > 0 ? COMBO_WINDOW : 0;
  g.shake = 7;
  emit(g, 'steal');
  say(g, { text: 'Veverica! Pazi!', sub: 'A squirrel! Watch out!' }, 2.2);
  addFloat(g, ball.x, ball.y - 30, 'Ukradeno!', '#f08a8a', 26, 'stolen');
  g.nextThrowAt = g.elapsed + 0.8;
}

/* -------------------------------------------------------------------------- */
/* update                                                                      */
/* -------------------------------------------------------------------------- */

/** Title-screen brain: chase whatever is loose, then trot it home. */
function autopilot(g: Game): Input {
  const dog = g.dog;
  let tx = g.owner.x;
  let ty = g.owner.y - 30;

  if (dog.carrying === null) {
    let nearest: Ball | null = null;
    let nearestDist = Infinity;
    for (const ball of g.balls) {
      if (ball.state !== 'flying' && ball.state !== 'resting') continue;
      const d = Math.hypot(ball.x - dog.x, ball.y - dog.y);
      if (d < nearestDist) {
        nearest = ball;
        nearestDist = d;
      }
    }
    if (nearest) {
      // Lead a ball that is still travelling so the run looks intentional.
      tx = nearest.x + nearest.vx * 0.25;
      ty = nearest.y + nearest.vy * 0.25;
    } else {
      tx = g.owner.x + Math.cos(g.elapsed * 0.7) * 150;
      ty = g.owner.y - 150 + Math.sin(g.elapsed * 0.7) * 90;
    }
  }

  const dx = tx - dog.x;
  const dy = ty - dog.y;
  const len = Math.hypot(dx, dy) || 1;
  const ease = Math.min(1, len / 60);
  return { x: (dx / len) * ease, y: (dy / len) * ease, bark: false };
}

function updateDog(g: Game, dt: number, input: Input, frozen: boolean): void {
  const dog = g.dog;
  const carrying = dog.carrying !== null;
  const boost = dog.zoomies > 0 ? ZOOMIE_SPEED : 1;
  const maxSpeed = (carrying ? DOG_CARRY_SPEED : DOG_SPEED) * boost;

  let ix = frozen ? 0 : input.x;
  let iy = frozen ? 0 : input.y;
  const mag = Math.hypot(ix, iy);
  if (mag > 1) {
    ix /= mag;
    iy /= mag;
  }

  const targetVx = ix * maxSpeed;
  const targetVy = iy * maxSpeed;
  const k = 1 - Math.exp(-DOG_ACCEL * dt);
  dog.vx += (targetVx - dog.vx) * k;
  dog.vy += (targetVy - dog.vy) * k;

  dog.x += dog.vx * dt;
  dog.y += dog.vy * dt;

  if (dog.x < BOUNDS.minX) { dog.x = BOUNDS.minX; dog.vx = 0; }
  if (dog.x > BOUNDS.maxX) { dog.x = BOUNDS.maxX; dog.vx = 0; }
  if (dog.y < BOUNDS.minY) { dog.y = BOUNDS.minY; dog.vy = 0; }
  if (dog.y > BOUNDS.maxY) { dog.y = BOUNDS.maxY; dog.vy = 0; }

  dog.speed = Math.hypot(dog.vx, dog.vy);
  if (dog.speed > 6) {
    dog.angle = angleLerp(dog.angle, Math.atan2(dog.vy, dog.vx), 1 - Math.exp(-14 * dt));
  }
  dog.gait += (dog.speed / 26 + 1.5) * dt * (dog.speed > 6 ? 1 : 0.35);
  dog.tail += dt * (2.5 + dog.speed / 60);

  dog.barkTimer = Math.max(0, dog.barkTimer - dt);
  dog.barkCooldown = Math.max(0, dog.barkCooldown - dt);
  dog.joy = Math.max(0, dog.joy - dt);
  dog.zoomies = Math.max(0, dog.zoomies - dt);

  // Kick up grass and leave prints while running.
  if (dog.speed > 120) {
    dog.pawTimer -= dt * (dog.speed / 150);
    if (dog.pawTimer <= 0) {
      dog.pawTimer = 0.16;
      const side = g.paws.length % 2 === 0 ? 1 : -1;
      const nx = Math.cos(dog.angle + Math.PI / 2) * 9 * side;
      const ny = Math.sin(dog.angle + Math.PI / 2) * 9 * side;
      g.paws.push({ x: dog.x - Math.cos(dog.angle) * 12 + nx, y: dog.y - Math.sin(dog.angle) * 12 + ny, angle: dog.angle, life: 2.6, side });
      if (g.paws.length > 44) g.paws.shift();
      addParticle(g, {
        x: dog.x - Math.cos(dog.angle) * 16,
        y: dog.y - Math.sin(dog.angle) * 16,
        z: 2,
        vx: -Math.cos(dog.angle) * rand(20, 70) + rand(-30, 30),
        vy: -Math.sin(dog.angle) * rand(20, 70) + rand(-20, 20),
        vz: rand(50, 130),
        life: rand(0.35, 0.65),
        maxLife: 0.65,
        size: rand(2, 4),
        rot: rand(0, Math.PI * 2),
        spin: rand(-10, 10),
        color: pick(['#4f7f63', '#3d6b53', '#63946f']),
        kind: 'grass',
      });
    }
  }

  // Zoomie trail sparkles.
  if (dog.zoomies > 0 && Math.random() < dt * 30) {
    addParticle(g, {
      x: dog.x + rand(-12, 12),
      y: dog.y + rand(-10, 10),
      z: rand(4, 20),
      vx: rand(-20, 20),
      vy: rand(-20, 20),
      vz: rand(10, 50),
      life: 0.5,
      maxLife: 0.5,
      size: rand(1.5, 3),
      rot: 0,
      spin: 4,
      color: pick(['#fbfcff', '#a8bde0']),
      kind: 'sparkle',
    });
  }

  if (!frozen && input.bark && dog.barkCooldown <= 0) {
    dog.barkTimer = 0.35;
    dog.barkCooldown = BARK_COOLDOWN;
    emit(g, 'bark');
    addFloat(g, dog.x + Math.cos(dog.angle) * 34, dog.y + Math.sin(dog.angle) * 34 - 26, 'Av! Av!', '#cfe0ff', 22);
    for (const s of g.squirrels) {
      if (Math.hypot(s.x - dog.x, s.y - dog.y) < BARK_RADIUS) scare(g, s);
    }
    for (const b of g.butterflies) {
      if (Math.hypot(b.x - dog.x, b.y - dog.y) < BARK_RADIUS) {
        b.angle = Math.atan2(b.y - dog.y, b.x - dog.x) + rand(-0.5, 0.5);
        b.speed = 110;
      }
    }
  }
}

function scare(g: Game, s: Squirrel): void {
  if (s.carrying !== null) {
    const ball = g.balls.find(b => b.id === s.carrying);
    if (ball) {
      ball.state = 'resting';
      ball.holder = null;
      ball.restFor = 0;
      burst(g, ball.x, ball.y, 'grass', 6, ['#4f7f63', '#3d6b53']);
    }
    s.carrying = null;
  }
  s.state = 'fleeing';
  s.targetBall = null;
  s.scared = Math.max(s.scared, 2.5);
}

function updateBalls(g: Game, dt: number): void {
  const dog = g.dog;
  for (const ball of g.balls) {
    if (ball.state === 'gone') continue;

    if (ball.state === 'carried') {
      if (ball.holder === 'dog') {
        ball.x = dog.x + Math.cos(dog.angle) * 54;
        ball.y = dog.y + Math.sin(dog.angle) * 54;
        ball.z = 14;
        ball.rot += dog.speed * 0.004 * dt * 60;
      } else {
        const carrier = g.squirrels.find(s => s.id === ball.holder);
        if (carrier) {
          ball.x = carrier.x + Math.cos(carrier.angle) * 12;
          ball.y = carrier.y + Math.sin(carrier.angle) * 12;
          ball.z = 8;
        } else {
          ball.state = 'resting';
          ball.holder = null;
        }
      }
      continue;
    }

    if (ball.state === 'flying') {
      ball.vz -= GRAVITY * dt;
      ball.z += ball.vz * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.rot += ball.spin * dt;

      if (ball.x < BOUNDS.minX) { ball.x = BOUNDS.minX; ball.vx = Math.abs(ball.vx) * 0.55; }
      if (ball.x > BOUNDS.maxX) { ball.x = BOUNDS.maxX; ball.vx = -Math.abs(ball.vx) * 0.55; }
      if (ball.y < BOUNDS.minY) { ball.y = BOUNDS.minY; ball.vy = Math.abs(ball.vy) * 0.55; }
      if (ball.y > BOUNDS.maxY) { ball.y = BOUNDS.maxY; ball.vy = -Math.abs(ball.vy) * 0.55; }

      if (ball.z <= 0) {
        ball.z = 0;
        if (Math.abs(ball.vz) > 130) {
          ball.vz = Math.abs(ball.vz) * 0.44;
          ball.vx *= 0.74;
          ball.vy *= 0.74;
          ball.spin *= 0.7;
          emit(g, 'bounce');
          burst(g, ball.x, ball.y, 'grass', 4, ['#4f7f63', '#3d6b53'], 0.5);
        } else {
          ball.vz = 0;
        }
      }

      if (ball.z <= 0.01) {
        const damp = Math.exp(-2.4 * dt);
        ball.vx *= damp;
        ball.vy *= damp;
        ball.spin *= damp;
        if (Math.hypot(ball.vx, ball.vy) < 14) {
          ball.vx = 0;
          ball.vy = 0;
          ball.state = 'resting';
          ball.restFor = 0;
        }
      }
    }

    if (ball.state === 'resting') {
      ball.restFor += dt;
      if (ball.golden && Math.random() < dt * 14) {
        addParticle(g, {
          x: ball.x + rand(-14, 14),
          y: ball.y + rand(-10, 10),
          z: rand(2, 22),
          vx: rand(-8, 8),
          vy: rand(-8, 8),
          vz: rand(14, 40),
          life: 0.8,
          maxLife: 0.8,
          size: rand(1.5, 3),
          rot: 0,
          spin: 3,
          color: pick(['#ffd76b', '#fff3cd']),
          kind: 'sparkle',
        });
      }
    }

    // Jo scoops up anything loose and low enough to reach.
    if (dog.carrying === null && dog.joy <= 0 && ball.z < PICKUP_HEIGHT) {
      const d = Math.hypot(ball.x - dog.x, ball.y - dog.y);
      if (d < PICKUP_RADIUS + (ball.state === 'flying' ? 12 : 0)) {
        ball.state = 'carried';
        ball.holder = 'dog';
        dog.carrying = ball.id;
        emit(g, 'pickup');
        burst(g, ball.x, ball.y, 'sparkle', 8, ['#fbfcff', '#a8bde0', ball.golden ? '#ffd76b' : '#8fd8c0'], 0.6);
      }
    }
  }

  // Hand-off at the owner's feet.
  if (dog.carrying !== null) {
    const held = g.balls.find(b => b.id === dog.carrying);
    if (held && Math.hypot(dog.x - g.owner.x, dog.y - g.owner.y) < DELIVER_RADIUS) {
      deliver(g, held);
    }
  }

  if (g.balls.length > 12) g.balls = g.balls.filter(b => b.state !== 'gone');
}

function updateSquirrels(g: Game, dt: number): void {
  const dog = g.dog;
  for (const s of g.squirrels) {
    s.life += dt;
    s.scared = Math.max(0, s.scared - dt);
    s.bob += dt * (6 + Math.hypot(s.vx, s.vy) / 26);

    if (s.state === 'seeking' && Math.hypot(s.x - dog.x, s.y - dog.y) < SQUIRREL_SCARE_RADIUS) {
      scare(g, s);
    }

    let tx: number;
    let ty: number;
    let speed: number;

    if (s.state === 'seeking') {
      const ball = g.balls.find(b => b.id === s.targetBall);
      if (!ball || (ball.state !== 'resting' && ball.state !== 'flying')) {
        s.state = 'fleeing';
        s.targetBall = null;
        tx = s.x;
        ty = BOUNDS.minY - 140;
        speed = SQUIRREL_SPEED;
      } else {
        tx = ball.x;
        ty = ball.y;
        speed = SQUIRREL_SPEED;
        if (ball.state === 'resting' && Math.hypot(ball.x - s.x, ball.y - s.y) < SQUIRREL_STEAL_RADIUS) {
          ball.state = 'carried';
          ball.holder = s.id;
          s.carrying = ball.id;
          s.state = 'fleeing';
          burst(g, ball.x, ball.y, 'grass', 8, ['#4f7f63', '#3d6b53']);
        }
      }
    } else {
      // Head for the nearest edge and off the field.
      const toLeft = s.x - BOUNDS.minX;
      const toRight = BOUNDS.maxX - s.x;
      const toTop = s.y - BOUNDS.minY;
      const min = Math.min(toLeft, toRight, toTop);
      tx = min === toLeft ? BOUNDS.minX - 160 : min === toRight ? BOUNDS.maxX + 160 : s.x;
      ty = min === toTop ? BOUNDS.minY - 160 : s.y;
      speed = SQUIRREL_FLEE_SPEED;
    }

    const dx = tx - s.x;
    const dy = ty - s.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = 1 - Math.exp(-9 * dt);
    s.vx += ((dx / len) * speed - s.vx) * k;
    s.vy += ((dy / len) * speed - s.vy) * k;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (Math.hypot(s.vx, s.vy) > 8) s.angle = angleLerp(s.angle, Math.atan2(s.vy, s.vx), 1 - Math.exp(-12 * dt));
  }

  // Off-world squirrels leave, taking whatever they grabbed.
  g.squirrels = g.squirrels.filter(s => {
    const off =
      s.x < BOUNDS.minX - 150 || s.x > BOUNDS.maxX + 150 || s.y < BOUNDS.minY - 150 || s.y > BOUNDS.maxY + 150;
    if (!off || s.life < 0.6) return true;
    if (s.carrying !== null) {
      const ball = g.balls.find(b => b.id === s.carrying);
      if (ball) loseBall(g, ball);
    }
    return false;
  });
}

function updateAmbience(g: Game, dt: number): void {
  for (const f of g.fireflies) {
    f.phase += f.speed * dt;
    f.x += Math.cos(f.phase * 1.7) * f.drift * dt;
    f.y += Math.sin(f.phase) * f.drift * 0.6 * dt;
    if (f.x < 20) f.x = WORLD_W - 20;
    if (f.x > WORLD_W - 20) f.x = 20;
    if (f.y < 100) f.y = WORLD_H - 30;
    if (f.y > WORLD_H - 20) f.y = 110;
  }

  for (const b of g.butterflies) {
    const away = Math.hypot(b.x - g.dog.x, b.y - g.dog.y);
    if (away < 110) {
      b.angle = angleLerp(b.angle, Math.atan2(b.y - g.dog.y, b.x - g.dog.x), 1 - Math.exp(-6 * dt));
      b.speed = Math.min(130, b.speed + 180 * dt);
    } else {
      b.angle += Math.sin(g.elapsed * 1.6 + b.flap) * dt * 1.6;
      b.speed += (36 - b.speed) * dt;
    }
    b.flap += dt * 16;
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    if (b.x < BOUNDS.minX || b.x > BOUNDS.maxX) {
      b.angle = Math.PI - b.angle;
      b.x = clamp(b.x, BOUNDS.minX, BOUNDS.maxX);
    }
    if (b.y < BOUNDS.minY || b.y > BOUNDS.maxY) {
      b.angle = -b.angle;
      b.y = clamp(b.y, BOUNDS.minY, BOUNDS.maxY);
    }
  }

  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      g.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    if (p.kind === 'heart' || p.kind === 'note') {
      p.z += (p.vz * 0.4) * dt;
      p.vx *= 1 - dt * 1.4;
    } else {
      p.vz -= 700 * dt;
      p.z += p.vz * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz *= -0.35;
        p.vx *= 0.6;
        p.vy *= 0.6;
      }
    }
  }

  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.life -= dt;
    f.y -= 42 * dt;
    if (f.life <= 0) g.floats.splice(i, 1);
  }

  for (let i = g.paws.length - 1; i >= 0; i--) {
    g.paws[i].life -= dt;
    if (g.paws[i].life <= 0) g.paws.splice(i, 1);
  }

  if (g.owner.speech) {
    g.owner.speech.life -= dt;
    if (g.owner.speech.life <= 0) g.owner.speech = null;
  }

  g.owner.throwAnim = Math.max(0, g.owner.throwAnim - dt);
  g.owner.reach = Math.max(0, g.owner.reach - dt);
  g.shake = Math.max(0, g.shake - dt * 22);
  g.flash = Math.max(0, g.flash - dt * 1.6);
}

export function update(g: Game, dt: number, rawInput: Input): void {
  if (g.phase === 'paused' || g.phase === 'over') {
    // Keep the world breathing behind the overlay, but freeze the run.
    g.elapsed += dt;
    updateAmbience(g, dt);
    return;
  }

  g.elapsed += dt;
  const input = g.demo ? autopilot(g) : rawInput;
  const frozen = g.phase === 'countdown';

  if (g.phase === 'countdown') {
    const before = Math.ceil(g.countdown);
    g.countdown -= dt;
    const after = Math.ceil(g.countdown);
    if (after !== before && after >= 1 && after <= 3) emit(g, 'count');
    if (g.countdown <= 0) {
      g.phase = 'playing';
      emit(g, 'start');
      g.nextThrowAt = g.elapsed;
    }
  }

  updateDog(g, dt, input, frozen);
  updateBalls(g, dt);
  updateSquirrels(g, dt);
  updateAmbience(g, dt);

  if (g.phase === 'playing' || g.demo) {
    if (g.comboTimer > 0) {
      g.comboTimer -= dt;
      if (g.comboTimer <= 0) {
        g.comboTimer = 0;
        g.combo = 0;
      }
    }

    if (g.elapsed >= g.nextThrowAt && ballsInPlay(g) < ballsWanted(g)) {
      throwBall(g);
      g.nextThrowAt = g.elapsed + 1.4;
    }

    const allowed = g.deliveries >= 12 ? 2 : g.deliveries >= 4 ? 1 : 0;
    if (g.squirrels.length < allowed && g.elapsed >= g.nextSquirrelAt) {
      const target = g.balls.find(b => b.state === 'resting' && b.restFor > 1.1);
      if (target) {
        spawnSquirrel(g, target);
        g.nextSquirrelAt = g.elapsed + rand(7, 12);
      } else {
        g.nextSquirrelAt = g.elapsed + 1;
      }
    }
  }

  if (g.phase === 'playing' && !g.demo) {
    g.timeLeft -= dt;
    if (g.timeLeft <= 0) {
      g.timeLeft = 0;
      g.phase = 'over';
      g.dog.carrying = null;
      for (const b of g.balls) if (b.holder === 'dog') b.state = 'resting';
      emit(g, 'over');
      // No speech bubble here — the results panel already says it, and the
      // bubble would sit underneath it.
      g.owner.speech = null;
    }
  }
}
