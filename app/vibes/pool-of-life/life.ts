/**
 * Pool of Life — the arithmetic behind the visualisation.
 *
 * An Olympic pool is 50 × 25 × 2 m, which is 2,500,000 litres. At the usual
 * 0.05 mL a drop, that is 50,000,000,000 drops. Spread evenly across an
 * 80-year life it comes out at ~19.8 drops a second — call it 20 — or roughly
 * one millilitre a second, or 2.5 cm of waterline a year.
 */

export const POOL_LENGTH_M = 50;
export const POOL_WIDTH_M = 25;
export const POOL_DEPTH_M = 2;

/** 50 × 25 × 2 m = 2,500 m³ = 2,500,000 L. */
export const POOL_VOLUME_L = POOL_LENGTH_M * POOL_WIDTH_M * POOL_DEPTH_M * 1000;

/** The conventional drop: 20 of them to the millilitre. */
export const DROP_VOLUME_ML = 0.05;
export const DROPS_PER_POOL = (POOL_VOLUME_L * 1000) / DROP_VOLUME_ML;

export const MS_PER_DAY = 86_400_000;
/** Mean Gregorian year, so leap years come out in the wash. */
export const DAYS_PER_YEAR = 365.2425;
export const MS_PER_YEAR = DAYS_PER_YEAR * MS_PER_DAY;

export const DEFAULT_LIFE_EXPECTANCY = 80;
export const MIN_LIFE_EXPECTANCY = 20;
export const MAX_LIFE_EXPECTANCY = 120;

/** How many drops a second a life of `years` works out to. */
export function dropsPerSecond(years: number): number {
  return DROPS_PER_POOL / ((years * MS_PER_YEAR) / 1000);
}

/** How far the waterline climbs in a year, in metres. */
export function metresPerYear(years: number): number {
  return POOL_DEPTH_M / years;
}

export interface LifeStats {
  /** Milliseconds lived. Negative before birth, clamped to 0 everywhere else. */
  ageMs: number;
  ageYears: number;
  ageDays: number;
  /** Share of the pool that is full, 0–1. */
  fraction: number;
  litres: number;
  drops: number;
  /** Waterline height above the pool floor, in metres. */
  depthM: number;
  remainingMs: number;
  remainingYears: number;
  remainingLitres: number;
  remainingDrops: number;
  full: boolean;
}

export function computeStats(
  birthMs: number,
  nowMs: number,
  expectancyYears: number
): LifeStats {
  const spanMs = expectancyYears * MS_PER_YEAR;
  const ageMs = Math.max(0, nowMs - birthMs);
  const fraction = Math.min(1, ageMs / spanMs);
  const remainingMs = Math.max(0, spanMs - ageMs);

  return {
    ageMs,
    ageYears: ageMs / MS_PER_YEAR,
    ageDays: ageMs / MS_PER_DAY,
    fraction,
    litres: fraction * POOL_VOLUME_L,
    drops: fraction * DROPS_PER_POOL,
    depthM: fraction * POOL_DEPTH_M,
    remainingMs,
    remainingYears: remainingMs / MS_PER_YEAR,
    remainingLitres: (1 - fraction) * POOL_VOLUME_L,
    remainingDrops: (1 - fraction) * DROPS_PER_POOL,
    full: fraction >= 1,
  };
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatCount(n: number): string {
  return GROUPED.format(Math.floor(n));
}

const LITRES = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** Litres to the millilitre, so the last digit visibly ticks once a second. */
export function formatLitres(l: number): string {
  return LITRES.format(l);
}

export function formatPercent(fraction: number, digits = 4): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** Waterline in centimetres — metres are too coarse to feel anything. */
export function formatDepth(m: number): string {
  return `${(m * 100).toFixed(2)} cm`;
}

export interface AgeParts {
  years: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function ageParts(ms: number): AgeParts {
  const years = Math.floor(ms / MS_PER_YEAR);
  let rest = ms - years * MS_PER_YEAR;
  const days = Math.floor(rest / MS_PER_DAY);
  rest -= days * MS_PER_DAY;
  const hours = Math.floor(rest / 3_600_000);
  rest -= hours * 3_600_000;
  const minutes = Math.floor(rest / 60_000);
  rest -= minutes * 60_000;
  return { years, days, hours, minutes, seconds: Math.floor(rest / 1000) };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "34 y 128 d 07:42:19" — the seconds tick, which is the whole point. */
export function formatAge(ms: number): string {
  const { years, days, hours, minutes, seconds } = ageParts(ms);
  return `${years} y ${days} d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** A softer read of what is left: "45.7 years". */
export function formatSpan(ms: number): string {
  const years = ms / MS_PER_YEAR;
  if (years >= 1) return `${years.toFixed(1)} years`;
  const days = ms / MS_PER_DAY;
  if (days >= 1) return `${days.toFixed(0)} days`;
  return `${Math.max(0, Math.floor(ms / 3_600_000))} hours`;
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

/** Parses a `<input type="date">` value as local midnight. Null if unusable. */
export function parseBirthDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() > Date.now()) return null;
  return date.getTime();
}

export function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatBirthDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/* -------------------------------------------------------------------------- */
/* The clock                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The clock the whole page runs on: the HUD loop advances it, the 3D scene only
 * reads it. `live` pins it to the wall clock; otherwise it runs at `speed`×
 * real time, which is what scrubbing and the life replay are built out of.
 *
 * All state changes go through methods so callers never have to reach in and
 * assign — the fields below start deliberately inert, and the first `advance()`
 * snaps a live clock onto the wall clock.
 */
export class LifeClock {
  virtualMs = 0;
  speed = 1;
  live = true;
  /** While replaying a life, the moment to hand control back to the wall clock. */
  private replayUntil: number | null = null;

  advance(dtSeconds: number): void {
    if (this.live) {
      this.virtualMs = Date.now();
      return;
    }
    this.virtualMs += dtSeconds * 1000 * this.speed;
    if (this.replayUntil !== null && this.virtualMs >= this.replayUntil) {
      this.goLive();
    }
  }

  goLive(): void {
    this.virtualMs = Date.now();
    this.speed = 1;
    this.live = true;
    this.replayUntil = null;
  }

  /** Run detached from the wall clock at `perSecond` simulated seconds a second. */
  runAt(perSecond: number): void {
    this.live = false;
    this.speed = perSecond;
    this.replayUntil = null;
  }

  /** Jump to a moment and hold there. */
  scrubTo(ms: number): void {
    this.live = false;
    this.speed = 0;
    this.replayUntil = null;
    this.virtualMs = ms;
  }

  /** Rewind to birth and race back to now over `seconds` of real time. */
  replay(birthMs: number, seconds: number): void {
    const now = Date.now();
    this.live = false;
    this.virtualMs = birthMs;
    this.replayUntil = now;
    this.speed = Math.max(1, (now - birthMs) / 1000 / seconds);
  }

  /** Keeps a detached clock inside the life it belongs to. */
  clamp(minMs: number, maxMs: number): void {
    if (this.virtualMs < minMs) this.virtualMs = minMs;
    if (!this.live && this.virtualMs > maxMs) {
      this.virtualMs = maxMs;
      this.speed = 0;
    }
  }
}

export const SPEEDS = [
  { label: 'Live', perSecond: 1 },
  { label: '1 hr/s', perSecond: 3_600 },
  { label: '1 day/s', perSecond: 86_400 },
  { label: '1 yr/s', perSecond: MS_PER_YEAR / 1000 },
] as const;

export type SpeedLabel = (typeof SPEEDS)[number]['label'];
