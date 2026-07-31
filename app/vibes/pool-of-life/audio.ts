/**
 * Every drip is synthesised, so the page ships no audio files. The context is
 * created lazily on a user gesture, and drips are rate-limited — twenty a
 * second would be noise, not a pool.
 */

type Ctor = typeof AudioContext;

function audioContextCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

const MIN_INTERVAL_MS = 110;

export class PoolAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private failed = false;
  private lastDrip = 0;
  muted: boolean;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  /** Creates or resumes the context. Safe to call from any user gesture. */
  unlock(): void {
    if (this.failed) return;
    if (!this.ctx) {
      const Ctx = audioContextCtor();
      if (!Ctx) {
        this.failed = true;
        return;
      }
      try {
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.32;
        this.master.connect(this.ctx.destination);
      } catch {
        this.failed = true;
        return;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!muted) this.unlock();
  }

  /**
   * A drop hitting water: a fast downward pitch bend with a click on the front.
   * Ignored if one played too recently, so a downpour still sounds like a pool.
   */
  drip(): void {
    if (this.muted || this.failed) return;
    const now = performance.now();
    if (now - this.lastDrip < MIN_INTERVAL_MS) return;
    this.lastDrip = now;

    this.unlock();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const t = ctx.currentTime;
    const top = 760 + Math.random() * 700;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(top, t);
    osc.frequency.exponentialRampToValueAtTime(top * 0.32, t + 0.075);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25 + Math.random() * 0.12, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  dispose(): void {
    try {
      void this.ctx?.close();
    } catch {
      // Nothing to clean up if the context never opened.
    }
    this.ctx = null;
    this.master = null;
  }
}
