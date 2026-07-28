/**
 * Tiny WebAudio synth for Jo Simulator — every sound is generated, so the game
 * ships no audio files. The context is created lazily on the first play so we
 * never touch audio before a user gesture.
 */

export type Sfx =
  | 'bark'
  | 'pickup'
  | 'deliver'
  | 'golden'
  | 'throw'
  | 'bounce'
  | 'steal'
  | 'count'
  | 'start'
  | 'over';

type Ctor = typeof AudioContext;

function audioContextCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class SfxPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private failed = false;
  muted = false;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  /** Creates (or resumes) the context. Safe to call from any user gesture. */
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
        this.master.gain.value = 0.5;
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
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  close(): void {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.noise = null;
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    return this.noise;
  }

  /** One shaped oscillator note. */
  private tone(
    at: number,
    opts: {
      freq: number;
      to?: number;
      dur: number;
      gain?: number;
      type?: OscillatorType;
      attack?: number;
    }
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const peak = opts.gain ?? 0.3;
    const attack = opts.attack ?? 0.008;
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(opts.freq, at);
    if (opts.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), at + opts.dur);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + opts.dur + 0.02);
  }

  /** One shaped burst of filtered noise. */
  private hiss(
    at: number,
    opts: { freq: number; to?: number; dur: number; gain?: number; q?: number }
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = opts.q ?? 1.2;
    filter.frequency.setValueAtTime(opts.freq, at);
    if (opts.to !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), at + opts.dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(opts.gain ?? 0.2, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(at);
    src.stop(at + opts.dur + 0.02);
  }

  play(name: Sfx): void {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + 0.001;

    switch (name) {
      // Two clipped yaps — a small poodle, not a shepherd.
      case 'bark':
        this.tone(t, { freq: 620, to: 260, dur: 0.09, gain: 0.26, type: 'square' });
        this.hiss(t, { freq: 1500, to: 700, dur: 0.09, gain: 0.12 });
        this.tone(t + 0.13, { freq: 680, to: 300, dur: 0.08, gain: 0.2, type: 'square' });
        break;
      case 'pickup':
        this.tone(t, { freq: 720, to: 1180, dur: 0.11, gain: 0.16, type: 'sine' });
        this.hiss(t, { freq: 2600, dur: 0.05, gain: 0.05, q: 3 });
        break;
      // Rising major triad — the "good dog" chime.
      case 'deliver':
        this.tone(t, { freq: 523, dur: 0.16, gain: 0.16, type: 'triangle' });
        this.tone(t + 0.07, { freq: 659, dur: 0.18, gain: 0.15, type: 'triangle' });
        this.tone(t + 0.14, { freq: 784, dur: 0.28, gain: 0.16, type: 'triangle' });
        break;
      case 'golden':
        this.tone(t, { freq: 659, dur: 0.14, gain: 0.15, type: 'triangle' });
        this.tone(t + 0.06, { freq: 880, dur: 0.16, gain: 0.15, type: 'triangle' });
        this.tone(t + 0.12, { freq: 1047, dur: 0.18, gain: 0.15, type: 'triangle' });
        this.tone(t + 0.19, { freq: 1319, dur: 0.4, gain: 0.14, type: 'sine' });
        break;
      case 'throw':
        this.hiss(t, { freq: 420, to: 1500, dur: 0.22, gain: 0.1, q: 0.8 });
        break;
      case 'bounce':
        this.tone(t, { freq: 260, to: 150, dur: 0.07, gain: 0.1, type: 'sine' });
        break;
      case 'steal':
        this.tone(t, { freq: 440, to: 150, dur: 0.32, gain: 0.16, type: 'sawtooth' });
        this.hiss(t, { freq: 900, to: 300, dur: 0.3, gain: 0.07 });
        break;
      case 'count':
        this.tone(t, { freq: 440, dur: 0.12, gain: 0.13, type: 'sine' });
        break;
      case 'start':
        this.tone(t, { freq: 660, dur: 0.14, gain: 0.16, type: 'sine' });
        this.tone(t + 0.1, { freq: 990, dur: 0.3, gain: 0.16, type: 'sine' });
        break;
      case 'over':
        this.tone(t, { freq: 660, to: 620, dur: 0.22, gain: 0.14, type: 'triangle' });
        this.tone(t + 0.18, { freq: 520, to: 490, dur: 0.24, gain: 0.14, type: 'triangle' });
        this.tone(t + 0.38, { freq: 392, to: 300, dur: 0.6, gain: 0.14, type: 'triangle' });
        break;
    }
  }
}
