class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;
  public volume = 0.35;

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainMult = 1
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
    }
    const peak = Math.max(0.01, Math.min(0.45, this.volume * 0.25 * gainMult));
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playMine(): void {
    this.tone(240, 110, 0.09, 'square', 0.8);
    setTimeout(() => this.tone(420, 260, 0.07, 'triangle', 0.5), 35);
  }

  playPlace(): void {
    this.tone(180, 290, 0.08, 'triangle', 0.9);
  }

  playPickup(): void {
    this.tone(520, 780, 0.12, 'sine', 0.9);
  }

  playTorch(): void {
    this.tone(310, 620, 0.14, 'sine', 0.7);
  }

  playPulse(): void {
    this.tone(330, 880, 0.22, 'sine', 1.1);
    setTimeout(() => this.tone(660, 1120, 0.16, 'triangle', 0.8), 70);
  }

  playHit(crit = false): void {
    this.tone(crit ? 280 : 190, 55, crit ? 0.18 : 0.12, 'sawtooth', crit ? 1.3 : 1);
  }

  playHeal(): void {
    this.tone(440, 660, 0.15, 'sine', 0.9);
    setTimeout(() => this.tone(660, 880, 0.16, 'sine', 0.8), 90);
  }

  playVictory(): void {
    [440, 554, 659, 880].forEach((f, idx) => {
      setTimeout(() => this.tone(f, f * 1.02, 0.16, 'triangle', 0.9), idx * 95);
    });
  }

  playCapture(): void {
    [523, 659, 784, 1046].forEach((f, idx) => {
      setTimeout(() => this.tone(f, f, 0.14, 'sine', 1), idx * 85);
    });
  }

  playUi(): void {
    this.tone(480, 560, 0.05, 'sine', 0.45);
  }
}

export const sound = new SoundEngine();
