'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ATTEMPTS_PER_RUN,
  SCORINGS,
  TARGETS,
  type Run,
  type Scoring,
  type Target,
  bestScore,
  clearRuns,
  errorsFor,
  formatDelta,
  formatSeconds,
  loadRuns,
  newRunId,
  persistRuns,
  relativeDate,
  runsFor,
  scoreRun,
} from './storage';

type Screen = 'home' | 'playing' | 'results';
type AttemptState = 'ready' | 'running' | 'stopped';

/** Longest an attempt can run before it stops itself, so a walk-away never hangs the round. */
const MAX_ATTEMPT_SECONDS = 30;
/** Ignore taps right after a stop so a double tap doesn't burn the next attempt. */
const ADVANCE_LOCKOUT_MS = 450;

const SCORING_LABEL: Record<Scoring, string> = {
  total: 'Total',
  best: 'Best',
};

const SCORING_BLURB: Record<Scoring, string> = {
  total: 'Every attempt counts — your five misses add up.',
  best: 'Only your single closest attempt counts.',
};

type Rating = { label: string; text: string; stroke: string; chip: string };

function ratingFor(error: number): Rating {
  if (error < 0.02) {
    return { label: 'Perfect', text: 'text-emerald-300', stroke: '#6ee7b7', chip: 'bg-emerald-400/15 text-emerald-300' };
  }
  if (error < 0.08) {
    return { label: 'Razor sharp', text: 'text-emerald-300', stroke: '#6ee7b7', chip: 'bg-emerald-400/15 text-emerald-300' };
  }
  if (error < 0.2) {
    return { label: 'Nice', text: 'text-[#a8bde0]', stroke: '#7796cb', chip: 'bg-[#7796cb]/20 text-[#a8bde0]' };
  }
  if (error < 0.5) {
    return { label: 'Close', text: 'text-amber-300', stroke: '#fcd34d', chip: 'bg-amber-400/15 text-amber-300' };
  }
  return { label: 'Way off', text: 'text-red-400', stroke: '#f87171', chip: 'bg-red-500/15 text-red-400' };
}

/** Full ring at a dead-on stop, empty ring once you are a second or more out. */
function accuracyFraction(error: number): number {
  return Math.max(0, 1 - error);
}

function Toggle<T extends string | number>({
  options,
  value,
  onSelect,
  render,
  label,
}: {
  options: readonly T[];
  value: T;
  onSelect: (v: T) => void;
  render: (v: T) => string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[#888e9e] font-sans text-xs uppercase tracking-[0.18em]">{label}</span>
      <div className="flex gap-1 bg-[#fbfcff]/5 rounded-xl p-1">
        {options.map(option => (
          <button
            key={String(option)}
            type="button"
            onClick={() => onSelect(option)}
            className={`flex-1 px-4 py-2 rounded-lg font-sans text-sm font-medium transition-colors cursor-pointer ${
              option === value
                ? 'bg-[#7796cb] text-[#274156]'
                : 'text-[#888e9e] hover:text-[#fbfcff]'
            }`}
          >
            {render(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function AttemptDots({
  target,
  attempts,
  current,
}: {
  target: Target;
  attempts: number[];
  current: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: ATTEMPTS_PER_RUN }, (_, i) => {
        const done = i < attempts.length;
        const isCurrent = i === current;
        const color = done ? ratingFor(Math.abs(attempts[i] - target)).stroke : undefined;
        return (
          <span
            key={i}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              isCurrent ? 'w-7' : 'w-2.5'
            } ${done ? '' : isCurrent ? 'bg-[#7796cb]' : 'bg-[#fbfcff]/15'}`}
            style={done ? { backgroundColor: color } : undefined}
          />
        );
      })}
    </div>
  );
}

function ErrorBars({ target, attempts }: { target: Target; attempts: number[] }) {
  const errors = errorsFor(target, attempts);
  const scale = Math.max(0.5, ...errors);
  return (
    <div className="flex flex-col gap-2.5">
      {attempts.map((attempt, i) => {
        const error = errors[i];
        const rating = ratingFor(error);
        return (
          <div key={i} className="flex items-center gap-3 font-mono text-sm">
            <span className="text-[#888e9e] w-4 shrink-0">{i + 1}</span>
            <span className="text-[#fbfcff] w-14 shrink-0">{formatSeconds(attempt)}s</span>
            <span className="flex-1 h-1.5 rounded-full bg-[#fbfcff]/8 overflow-hidden">
              <span
                className="block h-full rounded-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.max(3, (error / scale) * 100)}%`,
                  backgroundColor: rating.stroke,
                }}
              />
            </span>
            <span className={`w-16 shrink-0 text-right ${rating.text}`}>
              {formatDelta(attempt - target)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function StopTheClock() {
  const [screen, setScreen] = useState<Screen>('home');
  const [target, setTarget] = useState<Target>(5);
  const [scoring, setScoring] = useState<Scoring>('total');

  const [runs, setRuns] = useState<Run[]>(loadRuns);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const [attempts, setAttempts] = useState<number[]>([]);
  const [attemptState, setAttemptState] = useState<AttemptState>('ready');
  const [lastElapsed, setLastElapsed] = useState<number | null>(null);
  const [canAdvance, setCanAdvance] = useState(true);

  const [finishedRun, setFinishedRun] = useState<Run | null>(null);
  const [isPersonalBest, setIsPersonalBest] = useState(false);

  const startedAtRef = useRef(0);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (lockoutRef.current) clearTimeout(lockoutRef.current);
    };
  }, []);

  const modeRuns = useMemo(() => runsFor(runs, target, scoring), [runs, target, scoring]);
  const modeBest = useMemo(() => bestScore(modeRuns), [modeRuns]);

  const startAttempt = useCallback(() => {
    startedAtRef.current = performance.now();
    setLastElapsed(null);
    setAttemptState('running');
  }, []);

  const stopAttempt = useCallback((elapsedOverride?: number) => {
    const elapsed = elapsedOverride ?? (performance.now() - startedAtRef.current) / 1000;
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    setLastElapsed(elapsed);
    setAttempts(prev => [...prev, elapsed]);
    setAttemptState('stopped');
    setCanAdvance(false);
    if (lockoutRef.current) clearTimeout(lockoutRef.current);
    lockoutRef.current = setTimeout(() => setCanAdvance(true), ADVANCE_LOCKOUT_MS);
  }, []);

  // Safety net: an attempt left running forever ends itself at the cap.
  useEffect(() => {
    if (attemptState !== 'running') return;
    autoStopRef.current = setTimeout(() => stopAttempt(MAX_ATTEMPT_SECONDS), MAX_ATTEMPT_SECONDS * 1000);
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
    };
  }, [attemptState, stopAttempt]);

  const finishRun = useCallback((finalAttempts: number[]) => {
    const score = scoreRun(scoring, target, finalAttempts);
    // Read fresh so a run played in another tab isn't clobbered.
    const existing = loadRuns();
    const previousBest = bestScore(runsFor(existing, target, scoring));
    const run: Run = {
      id: newRunId(),
      target,
      scoring,
      attempts: finalAttempts,
      score,
      date: Date.now(),
    };
    setRuns(persistRuns([run, ...existing]));
    setFinishedRun(run);
    setIsPersonalBest(previousBest === null || score < previousBest);
    setScreen('results');
  }, [scoring, target]);

  const startRun = useCallback(() => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (lockoutRef.current) clearTimeout(lockoutRef.current);
    setAttempts([]);
    setLastElapsed(null);
    setAttemptState('ready');
    setCanAdvance(true);
    setFinishedRun(null);
    setIsPersonalBest(false);
    setScreen('playing');
  }, []);

  const goHome = useCallback(() => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (lockoutRef.current) clearTimeout(lockoutRef.current);
    setAttemptState('ready');
    setLastElapsed(null);
    setAttempts([]);
    setScreen('home');
  }, []);

  const handlePress = useCallback(() => {
    if (attemptState === 'ready') {
      startAttempt();
      return;
    }
    if (attemptState === 'running') {
      stopAttempt();
      return;
    }
    if (!canAdvance) return;
    if (attempts.length >= ATTEMPTS_PER_RUN) {
      finishRun(attempts);
      return;
    }
    setLastElapsed(null);
    setAttemptState('ready');
  }, [attemptState, attempts, canAdvance, finishRun, startAttempt, stopAttempt]);

  // Space / Enter mirror the tap target for desktop play.
  const pressRef = useRef(handlePress);
  useEffect(() => { pressRef.current = handlePress; }, [handlePress]);

  useEffect(() => {
    if (screen !== 'playing') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (e.repeat) return;
      e.preventDefault();
      pressRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [screen]);

  const handleClearHistory = useCallback(() => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    clearRuns();
    setRuns([]);
    setConfirmingClear(false);
  }, [confirmingClear]);

  if (screen === 'home') {
    return (
      <div className="min-h-screen flex flex-col items-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md flex flex-col gap-8">
          <header className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-[#fbfcff] font-mono mb-3">Stop the Clock</h1>
            <p className="text-[#888e9e] font-sans text-base sm:text-lg">
              The timer runs hidden. Stop it as close to the target as you can — five attempts.
            </p>
          </header>

          <div className="bg-[#fbfcff]/5 ring-1 ring-[#7796cb]/20 rounded-2xl p-5 flex flex-col gap-5">
            <Toggle
              label="Target"
              options={TARGETS}
              value={target}
              onSelect={setTarget}
              render={t => `${t} seconds`}
            />
            <Toggle
              label="Scoring"
              options={SCORINGS}
              value={scoring}
              onSelect={setScoring}
              render={s => SCORING_LABEL[s]}
            />
            <p className="text-[#888e9e] font-sans text-sm -mt-1">{SCORING_BLURB[scoring]}</p>
          </div>

          <button
            type="button"
            onClick={startRun}
            className="text-[#274156] bg-[#7796cb] font-sans font-semibold text-lg px-6 py-4 rounded-2xl hover:bg-[#fbfcff] transition-colors cursor-pointer shadow-lg shadow-[#7796cb]/10"
          >
            Start
          </button>

          <section className="bg-[#fbfcff]/5 ring-1 ring-[#7796cb]/20 rounded-2xl p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[#fbfcff] font-sans font-semibold">Previous scores</h2>
              <span className="text-[#888e9e] font-mono text-xs">
                {target}s · {SCORING_LABEL[scoring]}
              </span>
            </div>

            {modeRuns.length === 0 ? (
              <p className="text-[#888e9e] font-sans text-sm">
                No runs yet for this mode. Your scores save on this device.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between bg-[#7796cb]/10 ring-1 ring-[#7796cb]/30 rounded-xl px-4 py-3">
                  <span className="text-[#888e9e] font-sans text-sm">Personal best</span>
                  <span className="text-[#fbfcff] font-mono text-xl font-bold">
                    {formatSeconds(modeBest ?? 0)}s off
                  </span>
                </div>

                <ul className="flex flex-col divide-y divide-[#fbfcff]/8">
                  {modeRuns.slice(0, 8).map(run => (
                    <li key={run.id} className="flex items-center gap-3 py-2.5">
                      <span className="flex gap-1 shrink-0">
                        {run.attempts.map((attempt, i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: ratingFor(Math.abs(attempt - run.target)).stroke }}
                          />
                        ))}
                      </span>
                      <span className="text-[#888e9e] font-sans text-sm flex-1">
                        {relativeDate(run.date)}
                      </span>
                      {run.score === modeBest && (
                        <span className="text-[#7796cb] font-sans text-[10px] uppercase tracking-[0.14em]">
                          best
                        </span>
                      )}
                      <span className="text-[#fbfcff] font-mono text-sm font-semibold w-20 text-right">
                        {formatSeconds(run.score)}s off
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={handleClearHistory}
                  onBlur={() => setConfirmingClear(false)}
                  className="self-start text-[#888e9e] font-sans text-xs hover:text-red-400 transition-colors cursor-pointer"
                >
                  {confirmingClear ? 'Tap again to erase all scores' : 'Clear history'}
                </button>
              </div>
            )}
          </section>

          <Link
            href="/vibes"
            className="text-[#888e9e] font-sans text-sm hover:text-[#fbfcff] no-underline text-center"
          >
            ← Back to Vibes
          </Link>
        </div>
      </div>
    );
  }

  if (screen === 'results' && finishedRun) {
    const rating = ratingFor(
      finishedRun.scoring === 'best' ? finishedRun.score : finishedRun.score / ATTEMPTS_PER_RUN
    );
    return (
      <div className="min-h-screen flex flex-col items-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md flex flex-col gap-8">
          <header className="text-center">
            <p className="text-[#888e9e] font-sans text-xs uppercase tracking-[0.18em] mb-3">
              {finishedRun.target}s · {SCORING_LABEL[finishedRun.scoring]} score
            </p>
            <div className="animate-[clockPop_0.35s_ease-out]">
              <span className={`text-6xl sm:text-7xl font-mono font-bold ${rating.text}`}>
                {formatSeconds(finishedRun.score)}
              </span>
              <span className="text-[#888e9e] font-mono text-2xl ml-2">s off</span>
            </div>
            <p className="text-[#888e9e] font-sans text-sm mt-3">
              {finishedRun.scoring === 'total'
                ? 'Sum of how far off all five attempts were'
                : 'Your closest attempt of the five'}
            </p>
            {isPersonalBest && (
              <p className="mt-4 inline-block bg-emerald-400/15 text-emerald-300 font-sans text-sm font-semibold px-4 py-1.5 rounded-full">
                New personal best
              </p>
            )}
          </header>

          <div className="bg-[#fbfcff]/5 ring-1 ring-[#7796cb]/20 rounded-2xl p-5">
            <ErrorBars target={finishedRun.target} attempts={finishedRun.attempts} />
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={startRun}
              className="text-[#274156] bg-[#7796cb] font-sans font-semibold text-lg px-6 py-4 rounded-2xl hover:bg-[#fbfcff] transition-colors cursor-pointer"
            >
              Play again
            </button>
            <button
              type="button"
              onClick={goHome}
              className="text-[#888e9e] font-sans text-sm hover:text-[#fbfcff] transition-colors cursor-pointer py-2"
            >
              ← Menu &amp; scores
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Playing
  const attemptNumber = Math.min(attempts.length + (attemptState === 'stopped' ? 0 : 1), ATTEMPTS_PER_RUN);
  const error = lastElapsed === null ? 0 : Math.abs(lastElapsed - target);
  const rating = ratingFor(error);
  const isLastAttempt = attempts.length >= ATTEMPTS_PER_RUN;
  const ringLength = 2 * Math.PI * 45;
  const progress = attemptState === 'stopped' ? accuracyFraction(error) : 0;

  const buttonLabel =
    attemptState === 'ready'
      ? 'Tap to start'
      : attemptState === 'running'
        ? 'Tap to stop'
        : isLastAttempt
          ? 'See results'
          : 'Next attempt';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-7 px-4 py-10">
      <div className="flex flex-col items-center gap-3">
        <p className="text-[#888e9e] font-sans text-sm">
          Attempt <span className="text-[#fbfcff] font-semibold">{attemptNumber}</span> of {ATTEMPTS_PER_RUN}
          <span className="mx-2 text-[#888e9e]/40">·</span>
          target <span className="text-[#fbfcff] font-semibold">{target}.00s</span>
        </p>
        <AttemptDots target={target} attempts={attempts} current={attemptNumber - 1} />
      </div>

      <button
        type="button"
        onPointerDown={handlePress}
        disabled={attemptState === 'stopped' && !canAdvance}
        aria-label={buttonLabel}
        className="relative w-[min(80vw,22rem)] aspect-square rounded-full select-none touch-manipulation cursor-pointer disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7796cb] focus-visible:ring-offset-4 focus-visible:ring-offset-[#274156] active:scale-[0.98] transition-transform"
      >
        <span className="absolute inset-0 rounded-full bg-[#fbfcff]/5 ring-1 ring-[#7796cb]/20" />

        {attemptState === 'running' && (
          <span className="absolute inset-6 rounded-full bg-[#7796cb]/20 blur-2xl animate-[clockBreathe_3.3s_ease-in-out_infinite]" />
        )}

        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="45" fill="none" stroke="#fbfcff" strokeOpacity="0.08" strokeWidth="2" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={rating.stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={ringLength}
            strokeDashoffset={ringLength * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
            opacity={attemptState === 'stopped' ? 1 : 0}
          />
        </svg>

        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6">
          {attemptState === 'ready' && (
            <>
              <span className="text-5xl sm:text-6xl font-mono font-bold text-[#fbfcff]/25">
                {target}.00
              </span>
              <span className="text-[#7796cb] font-sans text-sm font-medium">Tap to start</span>
            </>
          )}

          {attemptState === 'running' && (
            <>
              <span className="text-5xl sm:text-6xl font-mono font-bold bg-[linear-gradient(100deg,rgba(119,150,203,0.25)_20%,rgba(251,252,255,0.9)_50%,rgba(119,150,203,0.25)_80%)] bg-[length:220%_100%] bg-clip-text text-transparent animate-[clockShimmer_3.3s_linear_infinite]">
                ?.??
              </span>
              <span className="text-[#fbfcff] font-sans text-sm font-medium">Tap to stop</span>
            </>
          )}

          {attemptState === 'stopped' && lastElapsed !== null && (
            <span className="flex flex-col items-center gap-2 animate-[clockPop_0.3s_ease-out]">
              <span className="text-5xl sm:text-6xl font-mono font-bold text-[#fbfcff]">
                {formatSeconds(lastElapsed)}
              </span>
              <span className={`font-mono text-lg ${rating.text}`}>
                {formatDelta(lastElapsed - target)}s
              </span>
              <span className={`font-sans text-xs font-semibold px-3 py-1 rounded-full ${rating.chip}`}>
                {rating.label}
              </span>
            </span>
          )}
        </span>
      </button>

      <p className="text-[#888e9e] font-sans text-sm text-center h-5">
        {attemptState === 'stopped' ? buttonLabel : 'Space or tap anywhere in the dial'}
      </p>

      <div className="flex flex-wrap justify-center gap-2 min-h-8 max-w-md">
        {attempts.map((attempt, i) => {
          const attemptRating = ratingFor(Math.abs(attempt - target));
          return (
            <span
              key={i}
              className={`font-mono text-xs px-2.5 py-1 rounded-lg ${attemptRating.chip}`}
            >
              {formatDelta(attempt - target)}
            </span>
          );
        })}
      </div>

      <button
        type="button"
        onClick={goHome}
        className="text-[#888e9e] font-sans text-sm hover:text-[#fbfcff] transition-colors cursor-pointer"
      >
        ← Quit run
      </button>
    </div>
  );
}
