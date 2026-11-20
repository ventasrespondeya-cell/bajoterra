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

  playBlasterSelect(): void {
    this.tone(360, 620, 0.055, 'triangle', 0.55);
  }

  playBlasterFire(heavy = false, perfect = false): void {
    this.tone(heavy ? 185 : 270, heavy ? 85 : 130, heavy ? 0.14 : 0.09, 'sawtooth', heavy ? 1.05 : 0.85);
    setTimeout(() => this.tone(perfect ? 880 : 520, perfect ? 1320 : 280, 0.09, 'sine', 0.65), 25);
  }

  playPerfectRelease(): void {
    this.tone(740, 1180, 0.11, 'sine', 0.75);
  }

  playSlugTransform(element: string): void {
    const baseFreq =
      element === 'Electrico' || element === 'Luz'
        ? 580
        : element === 'Fuego'
        ? 440
        : element === 'Tierra' || element === 'Sombra'
        ? 300
        : 490;
    this.tone(baseFreq, baseFreq * 1.9, 0.14, 'triangle', 0.85);
    setTimeout(() => this.tone(baseFreq * 1.5, baseFreq * 2.2, 0.12, 'sine', 0.6), 45);
  }

  playClash(): void {
    this.tone(240, 95, 0.16, 'square', 1.15);
    setTimeout(() => this.tone(760, 420, 0.12, 'sawtooth', 0.85), 20);
  }

  playShieldBlock(perfect = false): void {
    this.tone(perfect ? 660 : 390, perfect ? 990 : 260, 0.12, 'triangle', 0.95);
  }

  private duelMusicTimer: ReturnType<typeof setInterval> | null = null;
  private duelStep = 0;

  startDuelMusic(): void {
    if (this.duelMusicTimer || typeof window === 'undefined') return;
    const bassNotes = [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83];
    this.duelStep = 0;
    this.duelMusicTimer = setInterval(() => {
      if (!this.enabled) return;
      const note = bassNotes[this.duelStep % bassNotes.length];
      this.tone(note, note * 0.98, 0.14, 'triangle', 0.22);
      if (this.duelStep % 2 === 0) {
        this.tone(note * 2, note * 2.02, 0.08, 'sine', 0.12);
      }
      this.duelStep++;
    }, 260);
  }

  stopDuelMusic(): void {
    if (this.duelMusicTimer !== null) {
      clearInterval(this.duelMusicTimer);
      this.duelMusicTimer = null;
    }
  }
}

export const sound = new SoundEngine();

