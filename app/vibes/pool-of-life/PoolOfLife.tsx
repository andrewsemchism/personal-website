'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './poolOfLife.module.css';
import PoolScene, { type ViewName } from './PoolScene';
import { PoolAudio } from './audio';
import {
  DEFAULT_LIFE_EXPECTANCY,
  DROPS_PER_POOL,
  MAX_LIFE_EXPECTANCY,
  MIN_LIFE_EXPECTANCY,
  LifeClock,
  MS_PER_YEAR,
  POOL_VOLUME_L,
  SPEEDS,
  computeStats,
  dropsPerSecond,
  formatAge,
  formatBirthDate,
  formatCount,
  formatDepth,
  formatLitres,
  formatPercent,
  formatSpan,
  metresPerYear,
  parseBirthDate,
  toDateInputValue,
} from './life';
import { loadSettings, saveSettings, type Settings } from './storage';

/** How long a whole-life replay takes to run, in real seconds. */
const REPLAY_SECONDS = 40;

const VIEW_LABELS: Record<ViewName, string> = {
  orbit: 'Orbit',
  poolside: 'Poolside',
  inside: 'In the pool',
  underwater: 'Underwater',
};

export default function PoolOfLife() {
  // Safe as an initialiser: the page only ever renders on the client.
  const [settings, setSettings] = useState<Settings | null>(() => loadSettings());
  const [editing, setEditing] = useState(false);

  const start = useCallback((next: Settings) => {
    saveSettings(next);
    setSettings(next);
    setEditing(false);
  }, []);

  if (!settings || editing) {
    return <Setup initial={settings} onStart={start} />;
  }

  return (
    <Pool
      key={`${settings.birthMs}:${settings.expectancyYears}`}
      settings={settings}
      onEdit={() => setEditing(true)}
      onSettingsChange={next => {
        saveSettings(next);
        setSettings(next);
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Setup                                                                      */
/* -------------------------------------------------------------------------- */

function Setup({
  initial,
  onStart,
}: {
  initial: Settings | null;
  onStart: (settings: Settings) => void;
}) {
  const [date, setDate] = useState(initial ? toDateInputValue(initial.birthMs) : '');
  const [years, setYears] = useState(
    String(initial?.expectancyYears ?? DEFAULT_LIFE_EXPECTANCY)
  );
  const [error, setError] = useState('');

  // "Today" is not a pure value, so the ceiling on the date picker is written
  // straight to the input after mount rather than computed during render.
  const dateInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = dateInputRef.current;
    if (input) input.max = toDateInputValue(Date.now());
  }, []);

  const parsedYears = Number(years);
  const yearsValid =
    Number.isFinite(parsedYears) &&
    parsedYears >= MIN_LIFE_EXPECTANCY &&
    parsedYears <= MAX_LIFE_EXPECTANCY;

  const preview = yearsValid ? parsedYears : DEFAULT_LIFE_EXPECTANCY;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const birthMs = parseBirthDate(date);
    if (birthMs === null) {
      setError('Pick a date of birth that has already happened.');
      return;
    }
    if (!yearsValid) {
      setError(`Life expectancy has to be between ${MIN_LIFE_EXPECTANCY} and ${MAX_LIFE_EXPECTANCY}.`);
      return;
    }
    onStart({ birthMs, expectancyYears: parsedYears, sound: initial?.sound ?? false });
  }

  return (
    <div className={styles.root}>
      <div className={styles.setup}>
        <form className={styles.setupCard} onSubmit={submit}>
          <h1 className={styles.wordmark}>Pool of Life</h1>

          <p className={styles.blurb}>
            An Olympic swimming pool holds <strong>2,500,000 litres</strong>. At twenty
            drops to the millilitre, that is <strong>fifty billion drops</strong>.
          </p>
          <p className={styles.blurb}>
            Lay one human life alongside it and the arithmetic gets blunt. The pool has
            to fill in the time you have, which means it never stops and it never
            hurries. Your pool has been filling since the day you were born, and you
            have never once seen the level go down.
          </p>

          <div className={styles.rate}>
            {preview} years → {dropsPerSecond(preview).toFixed(1)} drops a second ·{' '}
            {(metresPerYear(preview) * 100).toFixed(1)} cm of waterline a year
          </div>

          <div className={styles.fields}>
            <label className={styles.field}>
              <span className={styles.label}>Date of birth</span>
              <input
                ref={dateInputRef}
                className={styles.input}
                type="date"
                value={date}
                required
                onChange={event => {
                  setDate(event.target.value);
                  setError('');
                }}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Expect to live (years)</span>
              <input
                className={styles.input}
                type="number"
                inputMode="numeric"
                min={MIN_LIFE_EXPECTANCY}
                max={MAX_LIFE_EXPECTANCY}
                value={years}
                onChange={event => {
                  setYears(event.target.value);
                  setError('');
                }}
              />
            </label>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submit} type="submit" disabled={!date || !yearsValid}>
            Fill the pool
          </button>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pool                                                                       */
/* -------------------------------------------------------------------------- */

function write(ref: React.RefObject<HTMLElement | null>, text: string) {
  const node = ref.current;
  if (node && node.textContent !== text) node.textContent = text;
}

function Pool({
  settings,
  onEdit,
  onSettingsChange,
}: {
  settings: Settings;
  onEdit: () => void;
  onSettingsChange: (settings: Settings) => void;
}) {
  const { birthMs, expectancyYears } = settings;

  const clock = useMemo(() => new LifeClock(), []);
  // Built once and kept: rebuilding it would tear down the AudioContext.
  const audioRef = useRef<PoolAudio | null>(null);
  if (audioRef.current === null) audioRef.current = new PoolAudio(!settings.sound);

  const [view, setView] = useState<ViewName>('orbit');
  const [speedIndex, setSpeedIndex] = useState(0);
  const [sound, setSound] = useState(settings.sound);
  const [submerged, setSubmerged] = useState(false);
  const [full, setFull] = useState(false);

  const speedIndexRef = useRef(0);
  const dragging = useRef(false);

  const dropsRef = useRef<HTMLDivElement>(null);
  const ageRef = useRef<HTMLSpanElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const litresRef = useRef<HTMLSpanElement>(null);
  const depthRef = useRef<HTMLSpanElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const dropsLeftRef = useRef<HTMLSpanElement>(null);
  const timeLeftRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.dispose();
  }, []);

  /* The single owner of time: advances the clock and repaints every readout. */
  useEffect(() => {
    const spanMs = expectancyYears * MS_PER_YEAR;
    const endMs = birthMs + spanMs;
    let frame = 0;
    let last = performance.now();
    let wasFull = false;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      clock.advance(dt);
      clock.clamp(birthMs, endMs);
      // A finished replay hands control back to the wall clock; follow it in the UI.
      if (clock.live && speedIndexRef.current !== 0) {
        speedIndexRef.current = 0;
        setSpeedIndex(0);
      }

      const stats = computeStats(birthMs, clock.virtualMs, expectancyYears);
      write(dropsRef, formatCount(stats.drops));
      write(ageRef, formatAge(stats.ageMs));
      write(litresRef, `${formatLitres(stats.litres)} L`);
      write(depthRef, formatDepth(stats.depthM));
      write(percentRef, formatPercent(stats.fraction));
      write(dropsLeftRef, formatCount(stats.remainingDrops));
      write(timeLeftRef, stats.full ? 'none' : formatSpan(stats.remainingMs));
      write(
        dateRef,
        new Date(clock.virtualMs).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );

      if (!dragging.current && scrubRef.current) {
        scrubRef.current.value = String(stats.fraction);
      }
      if (stats.full !== wasFull) {
        wasFull = stats.full;
        setFull(stats.full);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [birthMs, expectancyYears, clock]);

  const onSplash = useCallback(() => audioRef.current?.drip(), []);

  const selectSpeed = useCallback(
    (index: number) => {
      audioRef.current?.unlock();
      speedIndexRef.current = index;
      setSpeedIndex(index);
      if (index === 0) clock.goLive();
      else clock.runAt(SPEEDS[index].perSecond);
    },
    [clock]
  );

  const replay = useCallback(() => {
    audioRef.current?.unlock();
    speedIndexRef.current = -1;
    setSpeedIndex(-1);
    clock.replay(birthMs, REPLAY_SECONDS);
  }, [birthMs, clock]);

  const scrub = useCallback(
    (value: number) => {
      speedIndexRef.current = -1;
      setSpeedIndex(-1);
      clock.scrubTo(birthMs + value * expectancyYears * MS_PER_YEAR);
    },
    [birthMs, clock, expectancyYears]
  );

  const toggleSound = useCallback(() => {
    const next = !sound;
    setSound(next);
    audioRef.current?.setMuted(!next);
    onSettingsChange({ ...settings, sound: next });
  }, [onSettingsChange, settings, sound]);

  return (
    <div className={`${styles.root} ${submerged ? styles.submerged : ''}`}>
      <div className={styles.canvas}>
        <PoolScene
          clock={clock}
          birthMs={birthMs}
          expectancyYears={expectancyYears}
          view={view}
          onSplash={onSplash}
          onSubmergedChange={setSubmerged}
        />
      </div>

      <div className={styles.hud}>
        <div className={styles.top}>
          <div className={styles.panel}>
            <div className={styles.label}>Drops in your pool</div>
            <div className={styles.heroNumber} ref={dropsRef}>
              0
            </div>
            <div className={styles.heroSub}>
              of {formatCount(DROPS_PER_POOL)} — one Olympic pool
            </div>
            <div className={styles.ageLine}>
              <span className={styles.ageLabel}>lived</span>{' '}
              <span ref={ageRef} />
            </div>
            <div className={styles.dateLine} ref={dateRef} />
            {full && <div className={styles.fullNote}>The pool is full.</div>}
          </div>

          <div className={styles.topRight}>
            <div className={`${styles.panel} ${styles.right}`}>
              <div className={styles.label}>Pool of Life</div>
              <div className={styles.heroSub}>born {formatBirthDate(birthMs)}</div>
              <div className={styles.heroSub}>
                {expectancyYears}-year pool · 50 × 25 × 2 m ·{' '}
                {formatCount(POOL_VOLUME_L)} L
              </div>
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <div className={styles.panel}>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <div className={styles.label}>In the pool</div>
                <span className={styles.statValue} ref={litresRef} />
              </div>
              <div className={styles.stat}>
                <div className={styles.label}>Waterline</div>
                <span className={styles.statValue} ref={depthRef} />
              </div>
              <div className={styles.stat}>
                <div className={styles.label}>Poured</div>
                <span className={styles.statValue} ref={percentRef} />
              </div>
              <div className={styles.stat}>
                <div className={styles.label}>Drops left</div>
                <span className={`${styles.statValue} ${styles.accent}`} ref={dropsLeftRef} />
              </div>
              <div className={styles.stat}>
                <div className={styles.label}>Time left</div>
                <span className={`${styles.statValue} ${styles.accent}`} ref={timeLeftRef} />
              </div>
              <div className={styles.stat}>
                <div className={styles.label}>Rate</div>
                <span className={styles.statValue}>
                  {dropsPerSecond(expectancyYears).toFixed(1)} drops/sec
                </span>
              </div>
            </div>

            <div className={styles.scrubRow}>
              <span className={styles.scrubEdge}>birth</span>
              <input
                ref={scrubRef}
                className={styles.scrub}
                type="range"
                min={0}
                max={1}
                step={0.0001}
                defaultValue={0}
                aria-label="Scrub through your life"
                onPointerDown={() => {
                  dragging.current = true;
                }}
                onPointerUp={() => {
                  dragging.current = false;
                }}
                onPointerCancel={() => {
                  dragging.current = false;
                }}
                onInput={event => scrub(Number(event.currentTarget.value))}
              />
              <span className={styles.scrubEdge}>{expectancyYears} yrs</span>
            </div>
          </div>

          <div className={styles.controls}>
            <div className={styles.group}>
              {(Object.keys(VIEW_LABELS) as ViewName[]).map(name => (
                <button
                  key={name}
                  type="button"
                  className={`${styles.chip} ${view === name ? styles.chipOn : ''}`}
                  onClick={() => setView(name)}
                >
                  {VIEW_LABELS[name]}
                </button>
              ))}
            </div>

            <div className={styles.group}>
              {SPEEDS.map((speed, index) => (
                <button
                  key={speed.label}
                  type="button"
                  className={`${styles.chip} ${speedIndex === index ? styles.chipOn : ''}`}
                  onClick={() => selectSpeed(index)}
                >
                  {speed.label}
                </button>
              ))}
            </div>

            <button type="button" className={styles.ghost} onClick={replay}>
              Replay my life
            </button>
            <button type="button" className={styles.ghost} onClick={toggleSound}>
              {sound ? 'Sound on' : 'Sound off'}
            </button>
            <button type="button" className={styles.ghost} onClick={onEdit}>
              Change birthday
            </button>
            <span className={styles.hint}>drag to look · scroll to zoom</span>
          </div>
        </div>
      </div>
    </div>
  );
}
