export const TARGETS = [5, 10] as const;
export type Target = (typeof TARGETS)[number];

export const SCORINGS = ['total', 'best'] as const;
export type Scoring = (typeof SCORINGS)[number];

export const ATTEMPTS_PER_RUN = 5;

export type Run = {
  id: string;
  target: Target;
  scoring: Scoring;
  /** Elapsed seconds for each attempt, in order. */
  attempts: number[];
  /** Seconds off target — lower is better in both scoring modes. */
  score: number;
  date: number;
};

const STORAGE_KEY = 'vibes:stop-the-clock:runs:v1';
const MAX_RUNS = 100;

export function errorsFor(target: Target, attempts: number[]): number[] {
  return attempts.map(a => Math.abs(a - target));
}

export function scoreRun(scoring: Scoring, target: Target, attempts: number[]): number {
  const errors = errorsFor(target, attempts);
  if (errors.length === 0) return 0;
  return scoring === 'total'
    ? errors.reduce((sum, e) => sum + e, 0)
    : Math.min(...errors);
}

function isRun(value: unknown): value is Run {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    (r.target === 5 || r.target === 10) &&
    (r.scoring === 'total' || r.scoring === 'best') &&
    Array.isArray(r.attempts) &&
    r.attempts.every(a => typeof a === 'number' && Number.isFinite(a)) &&
    typeof r.score === 'number' &&
    Number.isFinite(r.score) &&
    typeof r.date === 'number' &&
    Number.isFinite(r.date)
  );
}

export function loadRuns(): Run[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRun).sort((a, b) => b.date - a.date);
  } catch {
    return [];
  }
}

/** Writes the newest MAX_RUNS runs and returns exactly what was stored. */
export function persistRuns(runs: Run[]): Run[] {
  const capped = runs.slice(0, MAX_RUNS);
  if (typeof window === 'undefined') return capped;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Storage unavailable (private mode, quota) — scores just won't persist.
  }
  return capped;
}

export function clearRuns(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — history stays as-is in memory.
  }
}

export function runsFor(runs: Run[], target: Target, scoring: Scoring): Run[] {
  return runs.filter(r => r.target === target && r.scoring === scoring);
}

export function bestScore(runs: Run[]): number | null {
  if (runs.length === 0) return null;
  return Math.min(...runs.map(r => r.score));
}

export function newRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatSeconds(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  return `${sign}${Math.abs(delta).toFixed(2)}`;
}

export function relativeDate(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
