'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './joSimulator.module.css';
import { SfxPlayer } from './audio';
import {
  COMBO_WINDOW,
  MAX_TIME,
  WORLD_H,
  WORLD_W,
  createGame,
  multiplier,
  summarize,
  update,
  type Game,
  type Input,
  type Phase,
  type Summary,
} from './game';
import { disposeScenery, render } from './render';
import { loadBest, loadMuted, saveBest, saveMuted, type BestRun } from './storage';

const JOYSTICK_RADIUS = 52;

/** Keys that would otherwise scroll the page while you are steering Jo. */
const SCROLL_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ']);

type StatProps = { label: string; sub: string; value: string; accent?: string };

function Stat({ label, sub, value, accent = 'text-[#fbfcff]' }: StatProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-[#fbfcff]/5 px-3 py-2.5 ring-1 ring-[#7796cb]/15">
      <span className={`font-mono text-xl font-bold leading-none ${accent}`}>{value}</span>
      <span className="font-sans text-[13px] text-[#a8bde0]">{label}</span>
      <span className="font-sans text-[11px] text-[#7f8798]">{sub}</span>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md bg-[#fbfcff]/10 px-1.5 py-0.5 font-mono text-[11px] text-[#cfdcf3] ring-1 ring-[#fbfcff]/15">
      {children}
    </kbd>
  );
}

export default function JoSimulator() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scoreRef = useRef<HTMLSpanElement>(null);
  const deliveredRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const timeBarRef = useRef<HTMLDivElement>(null);
  const comboWrapRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLSpanElement>(null);
  const comboBarRef = useRef<HTMLDivElement>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const joyKnobRef = useRef<HTMLDivElement>(null);
  const padKnobRef = useRef<HTMLDivElement>(null);

  const gameRef = useRef<Game | null>(null);
  const phaseRef = useRef<Phase>('title');
  const scaleRef = useRef(1);
  const sfxRef = useRef<SfxPlayer | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const inputRef = useRef<Input>({ x: 0, y: 0, bark: false });
  const joyRef = useRef({ active: false, id: -1, x: 0, y: 0 });

  const [phase, setPhase] = useState<Phase>('title');
  const [countLabel, setCountLabel] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [best, setBest] = useState<BestRun | null>(() => loadBest());
  const [muted, setMuted] = useState(() => loadMuted());

  const game = useCallback((): Game => {
    if (!gameRef.current) gameRef.current = createGame(true);
    return gameRef.current;
  }, []);

  /* ---------------------------------------------------------------- run control */

  const startRun = useCallback(() => {
    sfxRef.current?.unlock();
    gameRef.current = createGame(false);
    phaseRef.current = 'countdown';
    keysRef.current.clear();
    inputRef.current = { x: 0, y: 0, bark: false };
    setSummary(null);
    setIsNewBest(false);
    setCountLabel('3');
    setPhase('countdown');
  }, []);

  const backToTitle = useCallback(() => {
    gameRef.current = createGame(true);
    phaseRef.current = 'title';
    setSummary(null);
    setPhase('title');
  }, []);

  const togglePause = useCallback(() => {
    const g = game();
    if (g.phase === 'playing') {
      g.phase = 'paused';
      phaseRef.current = 'paused';
      setPhase('paused');
    } else if (g.phase === 'paused') {
      g.phase = 'playing';
      phaseRef.current = 'playing';
      setPhase('playing');
    }
  }, [game]);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      saveMuted(next);
      sfxRef.current?.setMuted(next);
      if (!next) sfxRef.current?.unlock();
      return next;
    });
  }, []);

  /* ---------------------------------------------------------------- audio setup */

  useEffect(() => {
    const player = new SfxPlayer(loadMuted());
    sfxRef.current = player;
    return () => {
      player.close();
      sfxRef.current = null;
    };
  }, []);

  /* ---------------------------------------------------------------- canvas size */

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 1) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.round(rect.width * dpr);
      const height = Math.round((rect.width * (WORLD_H / WORLD_W)) * dpr);
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      scaleRef.current = width / WORLD_W;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  /* ---------------------------------------------------------------- game loop */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let last = performance.now();

    const finishRun = (g: Game) => {
      const result = summarize(g);
      const stored = saveBest({
        score: result.score,
        deliveries: result.deliveries,
        bestCombo: result.bestCombo,
        date: Date.now(),
      });
      setBest(stored.best);
      setSummary(result);
      setIsNewBest(stored.isNew && result.score > 0);
    };

    const syncHud = (g: Game) => {
      if (scoreRef.current) scoreRef.current.textContent = g.score.toLocaleString('en-US');
      if (deliveredRef.current) deliveredRef.current.textContent = String(g.deliveries);
      if (timeRef.current) {
        const low = g.timeLeft < 10;
        timeRef.current.textContent = low ? g.timeLeft.toFixed(1) : String(Math.ceil(g.timeLeft));
        timeRef.current.style.color = low ? '#f2a1a1' : '#fbfcff';
        timeRef.current.classList.toggle(styles.lowTime, low && g.phase === 'playing');
      }
      if (timeBarRef.current) {
        timeBarRef.current.style.width = `${Math.max(0, Math.min(1, g.timeLeft / MAX_TIME)) * 100}%`;
        timeBarRef.current.style.backgroundColor =
          g.timeLeft < 10 ? '#e8807f' : g.timeLeft < 22 ? '#f0c874' : '#8fd8c0';
      }
      if (comboWrapRef.current) {
        comboWrapRef.current.style.opacity = g.combo >= 2 ? '1' : '0';
      }
      if (comboRef.current && g.combo >= 2) {
        comboRef.current.textContent = `×${multiplier(g).toFixed(2).replace(/\.?0+$/, '')}`;
      }
      if (comboBarRef.current) {
        comboBarRef.current.style.transform = `scaleX(${Math.max(0, g.comboTimer / COMBO_WINDOW)})`;
      }
    };

    const readInput = (): Input => {
      const keys = keysRef.current;
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      const joy = joyRef.current;
      if (joy.active) {
        x += joy.x;
        y += joy.y;
      }
      const input = inputRef.current;
      input.x = x;
      input.y = y;
      return input;
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      const g = game();
      update(g, dt, readInput());
      inputRef.current.bark = false;

      const player = sfxRef.current;
      if (player) for (const event of g.events) player.play(event);
      g.events.length = 0;

      if (g.phase !== phaseRef.current) {
        phaseRef.current = g.phase;
        setPhase(g.phase);
        if (g.phase === 'over') finishRun(g);
      }
      if (g.phase === 'countdown') {
        const next = g.countdown > 0.6 ? String(Math.max(1, Math.ceil(g.countdown - 0.6))) : 'Hajde!';
        setCountLabel(prev => (prev === next ? prev : next));
      }

      syncHud(g);
      ctx.setTransform(scaleRef.current, 0, 0, scaleRef.current, 0, 0);
      render(ctx, g, scaleRef.current);
    };

    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      disposeScenery();
    };
  }, [game]);

  /* ---------------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (SCROLL_KEYS.has(key)) e.preventDefault();
      if (e.repeat) return;
      keysRef.current.add(key);

      // Space doubles as "start" outside a run, since keydown here also
      // suppresses the browser's default button activation.
      if (key === ' ') {
        if (phaseRef.current === 'title' || phaseRef.current === 'over') startRun();
        else inputRef.current.bark = true;
        return;
      }
      if (key === 'escape') {
        togglePause();
        return;
      }
      if (key === 'enter') {
        if (phaseRef.current === 'title' || phaseRef.current === 'over') startRun();
        else if (phaseRef.current === 'paused') togglePause();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    const onBlur = () => keysRef.current.clear();
    const onVisibility = () => {
      if (document.hidden && phaseRef.current === 'playing') togglePause();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [startRun, togglePause]);

  /* ---------------------------------------------------------------- pointer steering */

  const originRef = useRef({ x: 0, y: 0 });
  const activeKnobRef = useRef<HTMLDivElement | null>(null);

  /** Feeds the steering vector from a pointer offset, and moves whichever knob owns it. */
  const applyJoystick = useCallback((clientX: number, clientY: number) => {
    const dx = clientX - originRef.current.x;
    const dy = clientY - originRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(1, dist / JOYSTICK_RADIUS);
    const nx = dist > 0 ? (dx / dist) * clamped : 0;
    const ny = dist > 0 ? (dy / dist) * clamped : 0;
    joyRef.current.x = nx;
    joyRef.current.y = ny;
    const knob = activeKnobRef.current;
    if (knob) knob.style.transform = `translate(${nx * JOYSTICK_RADIUS}px, ${ny * JOYSTICK_RADIUS}px)`;
  }, []);

  const endPointer = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerId !== joyRef.current.id) return;
    joyRef.current.active = false;
    joyRef.current.id = -1;
    joyRef.current.x = 0;
    joyRef.current.y = 0;
    if (joyBaseRef.current) joyBaseRef.current.style.opacity = '0';
    if (activeKnobRef.current) activeKnobRef.current.style.transform = 'translate(0px, 0px)';
    activeKnobRef.current = null;
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!joyRef.current.active || e.pointerId !== joyRef.current.id) return;
      applyJoystick(e.clientX, e.clientY);
    },
    [applyJoystick]
  );

  /** Drag anywhere on the play field: the stick springs up under your finger. */
  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (phaseRef.current !== 'playing' && phaseRef.current !== 'countdown') return;
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      joyRef.current.active = true;
      joyRef.current.id = e.pointerId;
      originRef.current = { x: e.clientX, y: e.clientY };
      activeKnobRef.current = joyKnobRef.current;
      wrap.setPointerCapture(e.pointerId);
      if (joyBaseRef.current) {
        joyBaseRef.current.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px)`;
        joyBaseRef.current.style.opacity = '1';
      }
      applyJoystick(e.clientX, e.clientY);
    },
    [applyJoystick]
  );

  /** The fixed pad below the field, so a thumb never covers the game on a phone. */
  const onPadPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const pad = e.currentTarget;
      const rect = pad.getBoundingClientRect();
      joyRef.current.active = true;
      joyRef.current.id = e.pointerId;
      originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      activeKnobRef.current = padKnobRef.current;
      pad.setPointerCapture(e.pointerId);
      applyJoystick(e.clientX, e.clientY);
    },
    [applyJoystick]
  );

  /* ---------------------------------------------------------------- render */

  const showHud = phase === 'playing' || phase === 'countdown' || phase === 'paused' || phase === 'over';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-3 py-6 sm:px-4 sm:py-9">
      <div
        className="flex w-full flex-col gap-3"
        style={{ maxWidth: 'min(72rem, calc((100dvh - 13rem) * 1.6))' }}
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-mono text-xl font-bold text-[#fbfcff] sm:text-2xl">Jo Simulator</h1>
            <p className="font-sans text-sm text-[#888e9e]">
              Bela mini pudlica · fetch the <span className="text-[#a8bde0]">loptica</span>
            </p>
          </div>
          <Link
            href="/vibes"
            className="shrink-0 font-sans text-sm text-[#888e9e] no-underline transition-colors hover:text-[#fbfcff]"
          >
            ← Vibes
          </Link>
        </div>

        <div
          ref={wrapRef}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          className="relative aspect-[8/5] w-full touch-none select-none overflow-hidden rounded-2xl bg-[#16332c] shadow-2xl shadow-black/40 ring-1 ring-[#7796cb]/25"
        >
          <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

          {/* Steering thumb — follows wherever you press. */}
          <div
            ref={joyBaseRef}
            className="pointer-events-none absolute left-0 top-0 -ml-[68px] -mt-[68px] h-[136px] w-[136px] rounded-full bg-[#0b1c26]/25 opacity-0 ring-2 ring-[#fbfcff]/20 transition-opacity duration-150"
          >
            <div
              ref={joyKnobRef}
              className="absolute left-1/2 top-1/2 -ml-7 -mt-7 h-14 w-14 rounded-full bg-[#fbfcff]/65 shadow-lg shadow-black/30"
            />
          </div>

          {/* HUD */}
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 transition-opacity duration-300 sm:gap-3 sm:p-4 ${
              showHud ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="flex flex-col gap-0.5 sm:gap-1">
              <span className="font-sans text-[8px] uppercase tracking-[0.18em] text-[#8fa3c4] sm:text-[10px]">
                Poeni
              </span>
              <span
                ref={scoreRef}
                className="font-mono text-lg font-bold leading-none tabular-nums text-[#fbfcff] sm:text-4xl"
              >
                0
              </span>
              <span className="font-sans text-[9px] text-[#8fa3c4] sm:text-[11px]">
                <span ref={deliveredRef} className="font-mono text-[#a8bde0]">
                  0
                </span>{' '}
                loptica
              </span>
            </div>

            <div className="flex min-w-[4.5rem] flex-col items-center gap-0.5 sm:min-w-[10rem] sm:gap-1">
              <span
                ref={timeRef}
                className="font-mono text-lg font-bold leading-none tabular-nums text-[#fbfcff] sm:text-3xl"
              >
                45
              </span>
              <div className="h-1 w-full overflow-hidden rounded-full bg-[#fbfcff]/12 sm:h-1.5">
                <div ref={timeBarRef} className="h-full rounded-full bg-[#8fd8c0]" style={{ width: '75%' }} />
              </div>
              <span className="font-sans text-[8px] uppercase tracking-[0.18em] text-[#8fa3c4] sm:text-[10px]">
                vreme
              </span>
            </div>

            <div className="pointer-events-auto flex flex-col items-end gap-1 sm:gap-2">
              <div className="flex gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  className="cursor-pointer rounded-lg bg-[#0b1c26]/70 px-2 py-1 font-sans text-[10px] text-[#cfdcf3] ring-1 ring-[#fbfcff]/15 backdrop-blur-sm transition-colors hover:bg-[#0b1c26]/90 hover:text-[#fbfcff] sm:px-2.5 sm:py-1.5 sm:text-xs"
                >
                  {muted ? 'Zvuk ✕' : 'Zvuk ♪'}
                </button>
                <button
                  type="button"
                  onClick={togglePause}
                  disabled={phase !== 'playing' && phase !== 'paused'}
                  className="cursor-pointer rounded-lg bg-[#0b1c26]/70 px-2 py-1 font-sans text-[10px] text-[#cfdcf3] ring-1 ring-[#fbfcff]/15 backdrop-blur-sm transition-colors hover:bg-[#0b1c26]/90 hover:text-[#fbfcff] disabled:cursor-default disabled:opacity-30 sm:px-2.5 sm:py-1.5 sm:text-xs"
                >
                  {phase === 'paused' ? 'Nastavi' : 'Pauza'}
                </button>
              </div>
              <span className="font-sans text-[9px] text-[#8fa3c4] sm:text-[11px]">
                najbolje{' '}
                <span className="font-mono text-[#a8bde0]">{(best?.score ?? 0).toLocaleString('en-US')}</span>
              </span>
            </div>
          </div>

          {/* Combo */}
          <div
            ref={comboWrapRef}
            className="pointer-events-none absolute bottom-3 left-3 opacity-0 transition-opacity duration-200 sm:bottom-4 sm:left-4"
          >
            <div className="rounded-xl bg-[#0b1c26]/70 px-3 py-2 ring-1 ring-[#ffbe78]/30 backdrop-blur-sm">
              <div className="flex items-baseline gap-2">
                <span ref={comboRef} className="font-mono text-lg font-bold leading-none text-[#ffd76b]">
                  ×1
                </span>
                <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-[#8fa3c4]">niz</span>
              </div>
              <div className="mt-1.5 h-1 w-20 overflow-hidden rounded-full bg-[#fbfcff]/12">
                <div ref={comboBarRef} className="h-full origin-left rounded-full bg-[#ffbe78]" />
              </div>
            </div>
          </div>

          {/* Countdown */}
          {phase === 'countdown' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                key={countLabel}
                className={`${styles.countIn} font-mono text-6xl font-bold text-[#fbfcff] drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)] sm:text-8xl`}
              >
                {countLabel}
              </span>
            </div>
          )}

          {/* Title */}
          {phase === 'title' && (
            <div
              className={`${styles.fadeIn} absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#08161f]/72 via-[#08161f]/50 to-[#08161f]/78 px-4 py-6`}
            >
              <div className="max-w-lg text-center">
                <p className="mb-2 font-sans text-[11px] uppercase tracking-[0.22em] text-[#8fa3c4]">
                  Park · sumrak · jedna pudlica
                </p>
                <h2 className="mb-2 bg-[linear-gradient(100deg,rgba(168,189,224,0.75)_20%,rgba(255,255,255,1)_50%,rgba(168,189,224,0.75)_80%)] bg-clip-text font-mono text-4xl font-bold text-transparent sm:text-6xl">
                  <span className={styles.sheen}>Jo Simulator</span>
                </h2>
                <p className="mb-1 font-sans text-base text-[#dbe5f7] sm:text-lg">
                  Ti si Jo — bela mini pudlica. Donesi lopticu!
                </p>
                <p className="mx-auto mb-5 max-w-md font-sans text-sm text-[#8fa3c4]">
                  You are Jo, a white miniature poodle in a Miami clip. Fetch every{' '}
                  <em className="not-italic text-[#a8bde0]">loptica</em> your owner throws and carry it back.
                  Each delivery buys more time — squirrels will try to take it first.
                </p>

                <button
                  type="button"
                  onClick={startRun}
                  className="mb-4 cursor-pointer rounded-2xl bg-[#7796cb] px-8 py-3.5 font-sans text-lg font-semibold text-[#274156] shadow-lg shadow-[#7796cb]/20 transition-colors hover:bg-[#fbfcff]"
                >
                  Hajde! · Play
                </button>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-sans text-xs text-[#8fa3c4]">
                  <span className="flex items-center gap-1.5">
                    <Key>W</Key>
                    <Key>A</Key>
                    <Key>S</Key>
                    <Key>D</Key> trči
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Key>Space</Key> laj
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Key>Esc</Key> pauza
                  </span>
                  <span className="[@media(pointer:fine)]:hidden">drag anywhere to steer</span>
                </div>

                {best && best.score > 0 && (
                  <p className="mt-4 font-sans text-sm text-[#8fa3c4]">
                    Najbolji rezultat{' '}
                    <span className="font-mono font-bold text-[#fbfcff]">
                      {best.score.toLocaleString('en-US')}
                    </span>{' '}
                    · {best.deliveries} loptica
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Paused */}
          {phase === 'paused' && (
            <div className={`${styles.fadeIn} absolute inset-0 flex items-center justify-center bg-[#08161f]/78 px-4`}>
              <div className="text-center">
                <h2 className="mb-1 font-mono text-3xl font-bold text-[#fbfcff] sm:text-4xl">Pauza</h2>
                <p className="mb-6 font-sans text-sm text-[#8fa3c4]">Jo čeka. — Jo is waiting.</p>
                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePause}
                    className="cursor-pointer rounded-2xl bg-[#7796cb] px-7 py-3 font-sans font-semibold text-[#274156] transition-colors hover:bg-[#fbfcff]"
                  >
                    Nastavi · Resume
                  </button>
                  <button
                    type="button"
                    onClick={backToTitle}
                    className="cursor-pointer font-sans text-sm text-[#8fa3c4] transition-colors hover:text-[#fbfcff]"
                  >
                    Prekini igru · Quit run
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Game over */}
          {phase === 'over' && summary && (
            <div
              className={`${styles.fadeIn} absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#08161f]/85 via-[#08161f]/70 to-[#08161f]/90 px-4 py-6`}
            >
              <div className={`${styles.pop} w-full max-w-md text-center`}>
                <p className="font-sans text-[11px] uppercase tracking-[0.22em] text-[#8fa3c4]">
                  Vreme je isteklo · time&rsquo;s up
                </p>
                <p className="mt-2 font-mono text-5xl font-bold text-[#fbfcff] sm:text-6xl">
                  {summary.score.toLocaleString('en-US')}
                </p>
                <p className="font-sans text-sm text-[#8fa3c4]">poeni</p>

                {isNewBest ? (
                  <p
                    className={`${styles.badge} mt-3 inline-block rounded-full bg-emerald-400/15 px-4 py-1.5 font-sans text-sm font-semibold text-emerald-300`}
                  >
                    Novi rekord! · New personal best
                  </p>
                ) : (
                  best && (
                    <p className="mt-3 font-sans text-sm text-[#8fa3c4]">
                      najbolje{' '}
                      <span className="font-mono text-[#a8bde0]">{best.score.toLocaleString('en-US')}</span>
                    </p>
                  )
                )}

                <div className="mt-5 grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
                  <Stat label="loptice" sub="delivered" value={String(summary.deliveries)} />
                  <Stat
                    label="zlatne"
                    sub="golden"
                    value={String(summary.goldenDeliveries)}
                    accent="text-[#ffd76b]"
                  />
                  <Stat label="najduži niz" sub="best streak" value={`${summary.bestCombo}`} />
                  <Stat
                    label="ukradeno"
                    sub="stolen"
                    value={String(summary.steals)}
                    accent={summary.steals > 0 ? 'text-[#f2a1a1]' : 'text-[#fbfcff]'}
                  />
                </div>

                <div className="mt-6 flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={startRun}
                    className="cursor-pointer rounded-2xl bg-[#7796cb] px-8 py-3.5 font-sans text-lg font-semibold text-[#274156] shadow-lg shadow-[#7796cb]/20 transition-colors hover:bg-[#fbfcff]"
                  >
                    Još jednom · Play again
                  </button>
                  <button
                    type="button"
                    onClick={backToTitle}
                    className="cursor-pointer font-sans text-sm text-[#8fa3c4] transition-colors hover:text-[#fbfcff]"
                  >
                    ← Naslovna · Menu
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Touch control deck — keeps thumbs off the play field on a phone. */}
        <div className="hidden items-center justify-between gap-4 pt-1 [@media(pointer:coarse)]:flex">
          <div
            onPointerDown={onPadPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            role="application"
            aria-label="Steer Jo"
            className="relative h-36 w-36 shrink-0 touch-none rounded-full bg-[#0b1c26]/70 ring-1 ring-[#7796cb]/25"
          >
            <div className="absolute inset-4 rounded-full ring-1 ring-[#fbfcff]/8" />
            <div
              ref={padKnobRef}
              className="pointer-events-none absolute left-1/2 top-1/2 -ml-8 -mt-8 h-16 w-16 rounded-full bg-[#7796cb]/70 shadow-lg shadow-black/40 ring-1 ring-[#fbfcff]/25"
            />
          </div>

          <p className="flex-1 text-center font-sans text-xs leading-relaxed text-[#7f8798]">
            Drag to run.
            <br />
            Tap AV! to bark.
          </p>

          <button
            type="button"
            onPointerDown={e => {
              e.preventDefault();
              inputRef.current.bark = true;
            }}
            aria-label="Bark"
            className="h-24 w-24 shrink-0 touch-none rounded-full bg-[#7796cb]/85 font-sans text-xl font-bold text-[#1b2c3a] ring-2 ring-[#fbfcff]/25 transition-transform active:scale-95"
          >
            AV!
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 font-sans text-xs text-[#7f8798]">
          <p>
            <span className="text-[#a8bde0]">Rečnik:</span> loptica = little ball · aport = fetch · veverica =
            squirrel · av av = woof woof · hajde = let&rsquo;s go
          </p>
          <p className="hidden sm:block">Deliver fast, keep the niz alive, and bark the squirrels off.</p>
        </div>
      </div>
    </div>
  );
}
