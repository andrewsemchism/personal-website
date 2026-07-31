import {
  DEFAULT_LIFE_EXPECTANCY,
  MAX_LIFE_EXPECTANCY,
  MIN_LIFE_EXPECTANCY,
} from './life';

const STORAGE_KEY = 'vibes:pool-of-life:v1';

export interface Settings {
  /** Birth date as epoch milliseconds (local midnight). */
  birthMs: number;
  expectancyYears: number;
  sound: boolean;
}

function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.birthMs === 'number' &&
    Number.isFinite(s.birthMs) &&
    s.birthMs <= Date.now() &&
    typeof s.expectancyYears === 'number' &&
    s.expectancyYears >= MIN_LIFE_EXPECTANCY &&
    s.expectancyYears <= MAX_LIFE_EXPECTANCY &&
    typeof s.sound === 'boolean'
  );
}

export function loadSettings(): Settings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSettings(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or quota — the pool just won't remember you next visit.
  }
}

export const DEFAULT_EXPECTANCY = DEFAULT_LIFE_EXPECTANCY;
