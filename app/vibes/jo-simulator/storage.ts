/** Best run and sound preference for Jo Simulator. Both live on this device only. */

const BEST_KEY = 'vibes:jo-simulator:best:v1';
const MUTED_KEY = 'vibes:jo-simulator:muted:v1';

export type BestRun = {
  score: number;
  deliveries: number;
  bestCombo: number;
  date: number;
};

function isBestRun(value: unknown): value is BestRun {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.score === 'number' && Number.isFinite(r.score) &&
    typeof r.deliveries === 'number' && Number.isFinite(r.deliveries) &&
    typeof r.bestCombo === 'number' && Number.isFinite(r.bestCombo) &&
    typeof r.date === 'number' && Number.isFinite(r.date)
  );
}

export function loadBest(): BestRun | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isBestRun(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Stores the run only when it beats the stored one, and returns whichever now stands. */
export function saveBest(run: BestRun): { best: BestRun; isNew: boolean } {
  const current = loadBest();
  if (current && current.score >= run.score) return { best: current, isNew: false };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(BEST_KEY, JSON.stringify(run));
    } catch {
      // Storage unavailable (private mode, quota) — the score just won't persist.
    }
  }
  return { best: run, isNew: true };
}

export function loadMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    // Preference just won't stick across visits.
  }
}
