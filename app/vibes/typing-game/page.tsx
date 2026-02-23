'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

const ALL_CHARS = "0123456789()-_=+{}[];:'\".>,</?~*&^%$#@!`|\\";

const PRESET_CHARS: Record<'numbers' | 'symbols', string> = {
  numbers: '0123456789',
  symbols: ALL_CHARS,
};

type Mode = 'numbers' | 'symbols' | 'custom';
type Phase = 'idle' | 'playing' | 'finished';

function pickRandom(chars: string, exclude?: string): string {
  let char: string;
  do {
    char = chars[Math.floor(Math.random() * chars.length)];
  } while (char === exclude && chars.length > 1);
  return char;
}

function ModeToggle({ mode, onSelect }: { mode: Mode; onSelect: (m: Mode) => void }) {
  return (
    <div className="flex gap-1 bg-[#fbfcff]/5 rounded-lg p-1">
      {(['numbers', 'symbols', 'custom'] as Mode[]).map(m => (
        <button
          key={m}
          onClick={() => onSelect(m)}
          className={`px-4 py-1.5 rounded-md font-sans text-sm font-medium transition-colors cursor-pointer capitalize ${
            mode === m
              ? 'bg-[#7796cb] text-[#274156]'
              : 'text-[#888e9e] hover:text-[#fbfcff]'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function CharPicker({
  selected,
  onToggle,
  onSelectAll,
  onClear,
}: {
  selected: Set<string>;
  onToggle: (c: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-1.5 max-w-xs">
        {ALL_CHARS.split('').map(c => (
          <button
            key={c}
            onClick={() => onToggle(c)}
            className={`w-9 h-9 rounded-lg font-mono text-base font-bold transition-all cursor-pointer ${
              selected.has(c)
                ? 'bg-[#7796cb]/30 ring-2 ring-[#7796cb] text-[#fbfcff]'
                : 'bg-[#fbfcff]/5 ring-1 ring-[#fbfcff]/10 text-[#888e9e] hover:text-[#fbfcff] hover:ring-[#7796cb]/30'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex gap-3 text-xs font-sans">
        <button onClick={onSelectAll} className="text-[#7796cb] hover:text-[#fbfcff] cursor-pointer transition-colors">
          select all
        </button>
        <span className="text-[#888e9e]/40">·</span>
        <button onClick={onClear} className="text-[#888e9e] hover:text-[#fbfcff] cursor-pointer transition-colors">
          clear
        </button>
      </div>
    </div>
  );
}

export default function TypingGame() {
  const [mode, setMode] = useState<Mode>('symbols');
  const [phase, setPhase] = useState<Phase>('idle');
  const [customChars, setCustomChars] = useState<Set<string>>(new Set(ALL_CHARS.split('')));
  const [currentChar, setCurrentChar] = useState<string>(() => pickRandom(ALL_CHARS));
  const [charKey, setCharKey] = useState(0);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [totalTyped, setTotalTyped] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const currentCharRef = useRef(currentChar);
  const modeRef = useRef(mode);
  const customCharsRef = useRef(customChars);

  useEffect(() => { currentCharRef.current = currentChar; }, [currentChar]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { customCharsRef.current = customChars; }, [customChars]);

  const getActiveChars = useCallback((m: Mode, cc: Set<string>) => {
    if (m === 'custom') return [...cc].join('') || ALL_CHARS;
    return PRESET_CHARS[m];
  }, []);

  const handleModeSelect = useCallback((m: Mode) => {
    setMode(m);
    modeRef.current = m;
    const chars = getActiveChars(m, customCharsRef.current);
    const c = pickRandom(chars);
    setCurrentChar(c);
    currentCharRef.current = c;
  }, [getActiveChars]);

  const handleToggleChar = useCallback((c: string) => {
    setCustomChars(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      customCharsRef.current = next;
      const chars = getActiveChars('custom', next);
      const newPreview = pickRandom(chars);
      setCurrentChar(newPreview);
      currentCharRef.current = newPreview;
      return next;
    });
  }, [getActiveChars]);

  const handleSelectAll = useCallback(() => {
    const next = new Set(ALL_CHARS.split(''));
    setCustomChars(next);
    customCharsRef.current = next;
    const c = pickRandom(ALL_CHARS);
    setCurrentChar(c);
    currentCharRef.current = c;
  }, []);

  const handleClear = useCallback(() => {
    const next = new Set<string>();
    setCustomChars(next);
    customCharsRef.current = next;
  }, []);

  const goToMenu = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setPhase('idle');
    setFeedback('none');
    const chars = getActiveChars(modeRef.current, customCharsRef.current);
    const c = pickRandom(chars);
    setCurrentChar(c);
    currentCharRef.current = c;
  }, [getActiveChars]);

  const startGame = useCallback(() => {
    const chars = getActiveChars(modeRef.current, customCharsRef.current);
    setPhase('playing');
    setTotalTyped(0);
    setTotalAttempts(0);
    setStreak(0);
    setBestStreak(0);
    setMisses(0);
    setTimeLeft(60);
    streakRef.current = 0;
    bestStreakRef.current = 0;
    const first = pickRandom(chars);
    setCurrentChar(first);
    currentCharRef.current = first;
    setCharKey(k => k + 1);
    setFeedback('none');
  }, [getActiveChars]);

  // Idle keydown: any key starts game (unless custom mode with no chars selected)
  useEffect(() => {
    if (phase !== 'idle') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key.length !== 1) return;
      if (modeRef.current === 'custom' && customCharsRef.current.size < 2) return;
      startGame();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, startGame]);

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setPhase('finished');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // Playing keydown
  useEffect(() => {
    if (phase !== 'playing') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key.length !== 1) return;
      if (e.key === ' ') e.preventDefault();

      const target = currentCharRef.current;
      setTotalAttempts(a => a + 1);

      if (e.key === target) {
        setTotalTyped(t => t + 1);

        const newStreak = streakRef.current + 1;
        streakRef.current = newStreak;
        setStreak(newStreak);

        if (newStreak > bestStreakRef.current) {
          bestStreakRef.current = newStreak;
          setBestStreak(newStreak);
        }

        setFeedback('correct');
        const chars = getActiveChars(modeRef.current, customCharsRef.current);
        const next = pickRandom(chars, target);
        setCurrentChar(next);
        currentCharRef.current = next;
        setCharKey(k => k + 1);

        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = setTimeout(() => setFeedback('none'), 150);
      } else {
        setMisses(m => m + 1);
        streakRef.current = 0;
        setStreak(0);
        setFeedback('wrong');

        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = setTimeout(() => setFeedback('none'), 400);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, getActiveChars]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const accuracy = totalAttempts > 0 ? Math.round((totalTyped / totalAttempts) * 100) : 100;
  const cpm = totalTyped > 0 ? Math.round((totalTyped / (60 - timeLeft)) * 60) : 0;
  const activeCharCount = mode === 'custom' ? customChars.size : PRESET_CHARS[mode].length;
  const canStart = mode !== 'custom' || customChars.size >= 2;

  const charBoxClass = (() => {
    const base = 'w-48 h-48 flex items-center justify-center rounded-2xl transition-all duration-100 text-8xl font-mono font-bold select-none';
    if (feedback === 'correct') return `${base} bg-[#7796cb]/30 ring-4 ring-[#7796cb] scale-105 text-[#fbfcff]`;
    if (feedback === 'wrong') return `${base} bg-red-500/20 ring-4 ring-red-500 text-[#fbfcff] animate-[wiggle_0.3s_ease-in-out]`;
    return `${base} bg-[#fbfcff]/5 ring-1 ring-[#7796cb]/30 text-[#fbfcff] animate-[charIn_0.12s_ease-out]`;
  })();

  if (phase === 'idle') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-[#fbfcff] font-mono mb-2">Symbol Trainer</h1>
          <p className="text-[#888e9e] font-sans text-lg">Practice the characters that trip you up in real code</p>
        </div>

        <ModeToggle mode={mode} onSelect={handleModeSelect} />

        {mode === 'custom' ? (
          <CharPicker
            selected={customChars}
            onToggle={handleToggleChar}
            onSelectAll={handleSelectAll}
            onClear={handleClear}
          />
        ) : (
          <div className="text-9xl font-mono text-[#7796cb]/40 animate-pulse select-none" aria-hidden>
            {currentChar}
          </div>
        )}

        <p className="text-[#888e9e] font-sans text-sm">
          {activeCharCount} char{activeCharCount !== 1 ? 's' : ''} · 60s
        </p>

        <button
          onClick={startGame}
          disabled={!canStart}
          className="mt-2 text-[#274156] bg-[#7796cb] font-sans font-semibold px-6 py-2 rounded-lg hover:bg-[#fbfcff] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#7796cb]"
        >
          {canStart ? 'Press any key to start' : 'Select at least 2 characters'}
        </button>

        <Link href="/vibes" className="text-[#888e9e] font-sans text-sm hover:text-[#fbfcff] no-underline">
          Back to Vibes
        </Link>
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <h1 className="text-4xl font-bold text-[#fbfcff] font-mono">Time&apos;s up!</h1>
        <div className="bg-[#fbfcff]/5 border border-[#7796cb]/40 rounded-xl p-8 w-full max-w-sm space-y-3 font-sans">
          {[
            ['Accuracy', `${accuracy}%`],
            ['Characters', String(totalTyped)],
            ['CPM', String(cpm)],
            ['Best Streak', String(bestStreak)],
            ['Misses', String(misses)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-[#888e9e]">{label}</span>
              <span className="text-[#fbfcff] font-semibold">{value}</span>
            </div>
          ))}
        </div>
        <button
          onClick={startGame}
          className="text-[#274156] bg-[#7796cb] font-sans font-semibold px-6 py-2 rounded-lg hover:bg-[#fbfcff] transition-colors cursor-pointer"
        >
          Play Again
        </button>
        <button
          onClick={goToMenu}
          className="text-[#888e9e] font-sans text-sm hover:text-[#fbfcff] transition-colors cursor-pointer"
        >
          ← Menu
        </button>
      </div>
    );
  }

  // Playing
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <div className="flex justify-between items-center w-full max-w-sm font-sans text-sm text-[#888e9e]">
        <span>streak <span className="text-[#fbfcff] font-semibold">{streak}</span> / best <span className="text-[#fbfcff] font-semibold">{bestStreak}</span></span>
        <span className={`font-mono font-bold text-base ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-[#fbfcff]'}`}>
          {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
        </span>
      </div>

      <div key={charKey} className={charBoxClass}>
        {currentChar}
      </div>

      <p className="text-[#888e9e] font-sans text-sm">Press the highlighted character</p>

      <div className="flex gap-6 font-sans text-sm text-[#888e9e]">
        <span>acc <span className="text-[#fbfcff] font-semibold">{accuracy}%</span></span>
        <span>typed <span className="text-[#fbfcff] font-semibold">{totalTyped}</span></span>
        <span>cpm <span className="text-[#fbfcff] font-semibold">{isNaN(cpm) ? 0 : cpm}</span></span>
      </div>

      <button
        onClick={goToMenu}
        className="text-[#888e9e] font-sans text-sm hover:text-[#fbfcff] transition-colors cursor-pointer mt-4"
      >
        ← Menu
      </button>
    </div>
  );
}
