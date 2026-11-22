import type { AudioCueMood } from './cinematicEvents';
import type { BiomeId } from './types';

export type MusicTrackId =
  | 'none'
  | 'biome_Verdes'
  | 'biome_Acuaticas'
  | 'biome_Magma'
  | 'biome_Heladas'
  | 'biome_Cristalinas'
  | 'biome_Sombrias'
  | 'duel_normal'
  | 'duel_boss';

interface TrackConfig {
  intervalMs: number;
  notes: number[];
  bassNotes: number[];
  wave: OscillatorType;
  harmonyWave: OscillatorType;
  gainScale: number;
}

const TRACK_CONFIGS: Record<Exclude<MusicTrackId, 'none'>, TrackConfig> = {
  biome_Verdes: {
    intervalMs: 580,
    notes: [196, 220, 261.63, 293.66, 329.63, 293.66, 261.63, 220],
    bassNotes: [98, 98, 130.81, 130.81],
    wave: 'sine',
    harmonyWave: 'triangle',
    gainScale: 0.24,
  },
  biome_Acuaticas: {
    intervalMs: 520,
    notes: [261.63, 329.63, 392, 493.88, 392, 329.63, 293.66, 392],
    bassNotes: [130.81, 130.81, 146.83, 164.81],
    wave: 'sine',
    harmonyWave: 'sine',
    gainScale: 0.23,
  },
  biome_Magma: {
    intervalMs: 440,
    notes: [146.83, 174.61, 220, 196, 146.83, 233.08, 220, 164.81],
    bassNotes: [73.42, 73.42, 87.31, 82.41],
    wave: 'triangle',
    harmonyWave: 'sawtooth',
    gainScale: 0.25,
  },
  biome_Heladas: {
    intervalMs: 540,
    notes: [329.63, 493.88, 587.33, 440, 392, 587.33, 659.25, 493.88],
    bassNotes: [164.81, 164.81, 196, 146.83],
    wave: 'sine',
    harmonyWave: 'sine',
    gainScale: 0.22,
  },
  biome_Cristalinas: {
    intervalMs: 490,
    notes: [392, 523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 440],
    bassNotes: [196, 196, 220, 261.63],
    wave: 'triangle',
    harmonyWave: 'sine',
    gainScale: 0.22,
  },
  biome_Sombrias: {
    intervalMs: 650,
    notes: [130.81, 155.56, 185, 196, 155.56, 130.81, 123.47, 155.56],
    bassNotes: [65.41, 65.41, 77.78, 61.74],
    wave: 'sine',
    harmonyWave: 'triangle',
    gainScale: 0.24,
  },
  duel_normal: {
    intervalMs: 250,
    notes: [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83],
    bassNotes: [110, 130.81, 146.83, 164.81],
    wave: 'triangle',
    harmonyWave: 'sine',
    gainScale: 0.34,
  },
  duel_boss: {
    intervalMs: 195,
    notes: [98, 98, 116.54, 146.83, 103.83, 98, 138.59, 146.83],
    bassNotes: [73.42, 87.31, 98, 110],
    wave: 'sawtooth',
    harmonyWave: 'triangle',
    gainScale: 0.36,
  },
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private _enabled = true;
  private _volume = 0.35;
  private userUnlocked = false;
  private unlockBound = false;

  // Dynamic music state machine (strict single active track)
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicFadeTimer: ReturnType<typeof setTimeout> | null = null;
  private musicDuckTimer: ReturnType<typeof setTimeout> | null = null;
  private musicStep = 0;
  private activeTrack: MusicTrackId = 'none';
  private desiredExplorationActive = false;
  private ambientBiome: BiomeId = 'Verdes';
  private inCombat = false;
  private combatIsBoss = false;
  private cueHistory: AudioCueMood[] = [];

  constructor() {
    this.bindGestureUnlock();
  }

  public get enabled(): boolean {
    return this._enabled;
  }

  public set enabled(val: boolean) {
    this._enabled = Boolean(val);
    this.syncActiveMusicTrack(true);
  }

  public get volume(): number {
    return this._volume;
  }

  public set volume(val: number) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(val) ? val : 0.35));
    this._volume = clamped;
    if (this.musicGain && this.ctx && this._enabled) {
      try {
        this.musicGain.gain.setTargetAtTime(this.getTargetMusicGain(), this.ctx.currentTime, 0.08);
      } catch {
        // Ignore headless context errors
      }
    }
  }

  private hasWebAudioSupport(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    );
  }

  private bindGestureUnlock(): void {
    if (this.unlockBound || typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }
    this.unlockBound = true;
    const onUnlock = () => {
      this.unlockAudio();
    };
    window.addEventListener('pointerdown', onUnlock, { passive: true });
    window.addEventListener('keydown', onUnlock, { passive: true });
    window.addEventListener('touchstart', onUnlock, { passive: true });
  }

  public unlockAudio(): void {
    this.userUnlocked = true;
    if (!this._enabled || !this.hasWebAudioSupport()) return;
    const ctx = this.ensureContext(true);
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.syncActiveMusicTrack(false);
  }

  private getTargetMusicGain(): number {
    return Math.max(0.001, Math.min(0.32, this._volume * 0.42));
  }

  private ensureContext(fromUserAction = false): AudioContext | null {
    if (!this._enabled || !this.hasWebAudioSupport()) return null;
    if (!fromUserAction && !this.userUnlocked && !this.ctx) {
      // Respect browser autoplay policies until user has interacted
      return null;
    }
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && !this.musicGain && typeof this.ctx.createGain === 'function') {
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      this.musicGain.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended' && (this.userUnlocked || fromUserAction)) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainMult = 1,
    channel: 'sfx' | 'music' = 'sfx'
  ): void {
    const ctx = this.ensureContext(channel === 'sfx');
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
    }
    const baseScale = channel === 'music' ? 0.32 : 0.25;
    const peak = Math.max(0.006, Math.min(0.45, this._volume * baseScale * gainMult));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + Math.min(0.02, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(gain);
    if (channel === 'music' && this.musicGain) {
      gain.connect(this.musicGain);
    } else {
      gain.connect(ctx.destination);
    }
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  // ---- Sound Effects ----

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
    this.duckMusicBriefly(1100);
    [440, 554.37, 659.25, 880].forEach((f, idx) => {
      setTimeout(() => this.tone(f, f * 1.02, 0.18, 'triangle', 0.95), idx * 95);
    });
  }

  playCapture(isNewSpecies = true): void {
    this.duckMusicBriefly(isNewSpecies ? 1500 : 900);
    const notes = isNewSpecies
      ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
      : [440, 554.37, 659.25];
    notes.forEach((f, idx) => {
      setTimeout(() => this.tone(f, f * 1.01, isNewSpecies ? 0.17 : 0.13, 'sine', 1.05), idx * 95);
    });
  }

  playDiscovery(isBiome = false): void {
    this.duckMusicBriefly(isBiome ? 1300 : 750);
    const notes = isBiome
      ? [293.66, 369.99, 440, 587.33, 739.99]
      : [493.88, 659.25, 783.99];
    notes.forEach((f, idx) => {
      setTimeout(() => this.tone(f, f * 1.01, isBiome ? 0.22 : 0.14, 'triangle', 0.88), idx * 85);
    });
  }

  playMegamorphFanfare(): void {
    this.duckMusicBriefly(1900);
    this.tone(220, 880, 0.34, 'sawtooth', 0.85);
    [392, 493.88, 587.33, 783.99, 987.77].forEach((f, idx) => {
      setTimeout(() => this.tone(f, f * 1.03, 0.24, 'triangle', 1.08), 160 + idx * 105);
    });
  }

  playDuelIntro(isBoss = false): void {
    if (isBoss) {
      this.tone(110, 55, 0.42, 'sawtooth', 1.1);
      setTimeout(() => this.tone(164.81, 146.83, 0.3, 'triangle', 0.9), 150);
    } else {
      this.tone(260, 520, 0.16, 'triangle', 0.9);
      setTimeout(() => this.tone(440, 660, 0.14, 'sine', 0.8), 90);
    }
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

  // ---- Dynamic Music & Cues ----

  private duckMusicBriefly(durationMs: number): void {
    if (!this.musicGain || !this.ctx || !this._enabled) return;
    if (this.musicDuckTimer !== null) {
      clearTimeout(this.musicDuckTimer);
      this.musicDuckTimer = null;
    }
    try {
      const target = this.getTargetMusicGain();
      this.musicGain.gain.setTargetAtTime(Math.max(0.001, target * 0.24), this.ctx.currentTime, 0.06);
      this.musicDuckTimer = setTimeout(() => {
        this.musicDuckTimer = null;
        if (this.musicGain && this.ctx && this._enabled) {
          this.musicGain.gain.setTargetAtTime(this.getTargetMusicGain(), this.ctx.currentTime, 0.22);
        }
      }, durationMs);
    } catch {
      // Ignore headless audio errors
    }
  }

  private resolveDesiredTrack(): MusicTrackId {
    if (!this._enabled) return 'none';
    if (this.inCombat) {
      return this.combatIsBoss ? 'duel_boss' : 'duel_normal';
    }
    if (!this.desiredExplorationActive) {
      return 'none';
    }
    return `biome_${this.ambientBiome}` as MusicTrackId;
  }

  private stopMusicLoopOnly(): void {
    if (this.musicFadeTimer !== null) {
      clearTimeout(this.musicFadeTimer);
      this.musicFadeTimer = null;
    }
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private startTrackLoop(track: Exclude<MusicTrackId, 'none'>): void {
    this.stopMusicLoopOnly();
    this.activeTrack = track;
    if (!this._enabled || !this.hasWebAudioSupport()) return;
    if (!this.userUnlocked && !this.ctx) return;

    const cfg = TRACK_CONFIGS[track];
    this.musicStep = 0;

    // Smooth fade in
    if (this.musicGain && this.ctx) {
      try {
        this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.musicGain.gain.setTargetAtTime(this.getTargetMusicGain(), this.ctx.currentTime, 0.18);
      } catch {
        // Ignore headless errors
      }
    }

    const triggerStep = () => {
      if (!this._enabled || this.activeTrack !== track) return;
      const note = cfg.notes[this.musicStep % cfg.notes.length];
      this.tone(note, note * 0.99, Math.min(0.45, cfg.intervalMs / 1100), cfg.wave, cfg.gainScale, 'music');
      if (this.musicStep % 2 === 0) {
        const bass = cfg.bassNotes[(this.musicStep >> 1) % cfg.bassNotes.length];
        this.tone(
          bass,
          bass * 0.995,
          Math.min(0.65, (cfg.intervalMs * 1.6) / 1000),
          cfg.harmonyWave,
          cfg.gainScale * 0.65,
          'music'
        );
      }
      this.musicStep++;
    };

    triggerStep();
    this.musicTimer = setInterval(triggerStep, cfg.intervalMs);
  }

  private syncActiveMusicTrack(immediate = false): void {
    const desired = this.resolveDesiredTrack();
    if (desired === 'none') {
      this.activeTrack = 'none';
      this.stopMusicLoopOnly();
      if (this.musicGain && this.ctx) {
        try {
          this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
        } catch {
          // Ignore
        }
      }
      return;
    }

    if (this.activeTrack === desired && (this.musicTimer !== null || !this.hasWebAudioSupport() || !this.userUnlocked)) {
      return;
    }

    if (this.musicFadeTimer !== null) {
      clearTimeout(this.musicFadeTimer);
      this.musicFadeTimer = null;
    }

    // Soft crossfade when switching tracks during live WebAudio playback
    if (!immediate && this.activeTrack !== 'none' && this.musicGain && this.ctx && this.hasWebAudioSupport()) {
      try {
        this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.06);
      } catch {
        // Ignore
      }
      this.activeTrack = desired;
      this.musicFadeTimer = setTimeout(() => {
        this.musicFadeTimer = null;
        if (this.resolveDesiredTrack() === desired) {
          this.startTrackLoop(desired);
        }
      }, 160);
      return;
    }

    this.startTrackLoop(desired);
  }

  public setAmbientBiome(biome: BiomeId, explorationActive = true): void {
    this.ambientBiome = biome;
    this.desiredExplorationActive = explorationActive;
    // Combat and boss music maintain priority over ambient biome changes
    if (!this.inCombat) {
      this.syncActiveMusicTrack(false);
    }
  }

  public stopAmbientMusic(): void {
    this.desiredExplorationActive = false;
    if (!this.inCombat) {
      this.syncActiveMusicTrack(true);
    }
  }

  public startDuelMusic(isBoss = false): void {
    this.inCombat = true;
    this.combatIsBoss = isBoss;
    this.syncActiveMusicTrack(true);
  }

  public stopDuelMusic(): void {
    this.inCombat = false;
    this.combatIsBoss = false;
    this.syncActiveMusicTrack(false);
  }

  public stopAllMusic(): void {
    this.inCombat = false;
    this.combatIsBoss = false;
    this.desiredExplorationActive = false;
    this.syncActiveMusicTrack(true);
  }

  public playCue(
    cue: AudioCueMood,
    opts?: { isNewSpecies?: boolean; isBoss?: boolean; biome?: BiomeId }
  ): void {
    this.cueHistory.push(cue);
    if (this.cueHistory.length > 24) this.cueHistory.shift();
    if (opts?.biome) {
      this.ambientBiome = opts.biome;
    }

    switch (cue) {
      case 'exploration_calm':
        if (this.inCombat) {
          this.stopDuelMusic();
        } else {
          this.desiredExplorationActive = true;
          this.syncActiveMusicTrack(false);
        }
        break;
      case 'discovery_wonder':
        this.playDiscovery(Boolean(opts?.biome));
        break;
      case 'duel_tension':
        this.playDuelIntro(false);
        this.startDuelMusic(false);
        break;
      case 'boss_ominous':
        this.playDuelIntro(true);
        this.startDuelMusic(true);
        break;
      case 'victory_fanfare':
        this.playVictory();
        break;
      case 'capture_chime':
        this.playCapture(opts?.isNewSpecies ?? true);
        break;
      case 'megamorph_fanfare':
        this.playMegamorphFanfare();
        break;
    }
  }

  public getMusicState(): {
    activeTrack: MusicTrackId;
    desiredTrack: MusicTrackId;
    ambientBiome: BiomeId;
    inCombat: boolean;
    combatIsBoss: boolean;
    enabled: boolean;
    volume: number;
    cueHistory: AudioCueMood[];
  } {
    return {
      activeTrack: this.activeTrack,
      desiredTrack: this.resolveDesiredTrack(),
      ambientBiome: this.ambientBiome,
      inCombat: this.inCombat,
      combatIsBoss: this.combatIsBoss,
      enabled: this._enabled,
      volume: this._volume,
      cueHistory: [...this.cueHistory],
    };
  }
}

export const sound = new SoundEngine();
