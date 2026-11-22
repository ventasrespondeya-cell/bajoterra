import {
  ARENA_FLOOR_Y,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  PLAYER_MAX_X,
  buildArenaForBiome,
} from './combatArenas';
import { CombatManager } from './combat';
import { ELEMENT_CHART, getSpecies } from './data';
import { getSlugDesignSheet, sampleSlugAnimationFrame, type SlugAnimationState } from './slugArtDirection';
import { getSlugCombatProfile, type SlugCombatProfile, type TransformSilhouette } from './slugCombatProfiles';
import { getSlugDisplayName } from './progression';
import type {
  BattleState,
  BiomeId,
  DuelArenaObstacle,
  DuelProjectile,
  GameOptions,
  GameState,
} from './types';

interface ArenaParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'spark' | 'ring' | 'smoke' | 'star';
}

function drawRoundedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

export class DuelArenaRenderer {
  private particles: ArenaParticle[] = [];
  private seenProjectileIds = new Set<number>();
  private transformedProjectileIds = new Set<number>();
  private seenShockwaveIds = new Set<number>();
  private lastElapsed = 0;
  private lastBattleRef: BattleState | null = null;
  private endCelebrated = false;

  private resetTracking(battle: BattleState): void {
    this.particles = [];
    this.seenProjectileIds.clear();
    this.transformedProjectileIds.clear();
    this.seenShockwaveIds.clear();
    this.lastElapsed = battle.elapsedSec;
    this.lastBattleRef = battle;
    this.endCelebrated = false;
  }

  private emitBurst(
    x: number,
    y: number,
    color: string,
    count: number,
    speed: number,
    kind: ArenaParticle['kind'] = 'spark',
    maxParticles = 96
  ): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= maxParticles) {
        this.particles.shift();
      }
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.55;
      const spd = speed * (0.45 + Math.random() * 0.75);
      const maxLife = 0.25 + Math.random() * 0.35;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: maxLife,
        maxLife,
        size: kind === 'star' ? 3.5 + Math.random() * 2.5 : 2 + Math.random() * 2.5,
        color,
        kind,
      });
    }
  }

  private updateParticles(battle: BattleState, highLighting: boolean, reducedMotion = false): void {
    if (this.lastBattleRef !== battle || battle.elapsedSec < this.lastElapsed) {
      this.resetTracking(battle);
    }
    if (reducedMotion) {
      this.particles = [];
      this.lastElapsed = battle.elapsedSec;
      return;
    }
    const dt = Math.min(0.05, Math.max(0.001, battle.elapsedSec - this.lastElapsed || 0.016));
    this.lastElapsed = battle.elapsedSec;
    const maxP = highLighting ? 96 : 36;
    const density = highLighting ? 1 : 0.45;

    // Emit muzzle burst for newly fired projectiles
    for (const p of battle.projectiles) {
      if (!this.seenProjectileIds.has(p.id)) {
        this.seenProjectileIds.add(p.id);
        const col = ELEMENT_CHART[p.element]?.color || '#38bdf8';
        this.emitBurst(p.x, p.y, col, Math.max(3, Math.round(7 * density)), 140, 'spark', maxP);
      }
      if (p.phase !== 'protoform' && !this.transformedProjectileIds.has(p.id)) {
        this.transformedProjectileIds.add(p.id);
        const sp = getSpecies(p.speciesId);
        this.emitBurst(
          p.x,
          p.y,
          p.mega ? '#fde047' : sp.accent,
          Math.max(4, Math.round(12 * density)),
          190,
          'star',
          maxP
        );
      }
    }

    // Emit particle splashes for newly spawned shockwaves
    for (const sw of battle.shockwaves) {
      if (!this.seenShockwaveIds.has(sw.id)) {
        this.seenShockwaveIds.add(sw.id);
        const n = sw.kind === 'clash' || sw.kind === 'capture' ? 14 : 8;
        this.emitBurst(
          sw.x,
          sw.y,
          sw.color,
          Math.max(3, Math.round(n * density)),
          sw.kind === 'heal' ? 95 : 175,
          sw.kind === 'heal' || sw.kind === 'capture' ? 'star' : 'spark',
          maxP
        );
      }
    }

    // Prune seen ID sets to keep memory bounded
    if (this.seenProjectileIds.size > 160) {
      const activeIds = new Set(battle.projectiles.map((p) => p.id));
      for (const id of this.seenProjectileIds) {
        if (!activeIds.has(id)) {
          this.seenProjectileIds.delete(id);
          this.transformedProjectileIds.delete(id);
        }
      }
    }
    if (this.seenShockwaveIds.size > 120) {
      const activeSw = new Set(battle.shockwaves.map((s) => s.id));
      for (const id of this.seenShockwaveIds) {
        if (!activeSw.has(id)) this.seenShockwaveIds.delete(id);
      }
    }

    // End-of-battle celebration burst
    if (battle.turn === 'ended' && !this.endCelebrated) {
      this.endCelebrated = true;
      if (battle.outcome === 'victory' || battle.outcome === 'captured') {
        this.emitBurst(battle.playerDuelist.x, battle.playerDuelist.y - 20, '#5eead4', 18, 220, 'star', maxP);
        this.emitBurst(battle.enemyDuelist.x, battle.enemyDuelist.y - 10, '#fde047', 16, 200, 'star', maxP);
      } else if (battle.outcome === 'defeat') {
        this.emitBurst(battle.playerDuelist.x, battle.playerDuelist.y, '#f87171', 14, 130, 'smoke', maxP);
      }
    }

    // Step existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy = pt.vy * 0.94 + (pt.kind === 'spark' ? 95 * dt : -25 * dt);
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    battle: BattleState,
    state: GameState,
    combat: CombatManager,
    options: GameOptions
  ): void {
    const theme = buildArenaForBiome(battle.biome);
    const highLighting = options.lightingQuality !== 'eco';
    const reducedMotion =
      Boolean(options.reducedMotion) ||
      (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const time = reducedMotion ? 0 : battle.elapsedSec;
    const ally = state.party[state.activePartyIndex] || state.party[0];
    const allySpecies = getSpecies(ally.id);
    const allyElColor = ELEMENT_CHART[ally.type]?.color || '#38bdf8';
    const enemyElColor = ELEMENT_CHART[battle.enemy.type]?.color || '#f43f5e';

    this.updateParticles(battle, highLighting, reducedMotion);

    ctx.save();
    // Bounded camera shake on heavy impacts (disabled under reducedMotion or when screenShake === false)
    if (!reducedMotion && options.screenShake !== false && battle.cameraShake > 0.25) {
      const mag = Math.min(4.2, battle.cameraShake);
      const sx = (Math.random() - 0.5) * mag;
      const sy = (Math.random() - 0.5) * mag;
      ctx.translate(sx, sy);
    }

    // 1. Subterranean Cavern Backdrop (unique per biome)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
    bgGrad.addColorStop(0, theme.skyTop);
    bgGrad.addColorStop(0.75, theme.skyBottom);
    bgGrad.addColorStop(1, '#04070d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    this.drawCavernBackdrop(ctx, battle.biome, theme, time, highLighting);

    // 2. Arena Walkable Plane & Mid-Arena Divider
    const floorGrad = ctx.createLinearGradient(0, ARENA_FLOOR_Y, 0, ARENA_HEIGHT);
    floorGrad.addColorStop(0, theme.floorTop);
    floorGrad.addColorStop(1, theme.floorBottom);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, ARENA_FLOOR_Y, ARENA_WIDTH, ARENA_HEIGHT - ARENA_FLOOR_Y);

    this.drawFloorDetails(ctx, battle.biome, theme.glowColor, time, highLighting);

    ctx.save();
    ctx.strokeStyle = theme.glowColor;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((PLAYER_MAX_X + 490) / 2, 86);
    ctx.lineTo((PLAYER_MAX_X + 490) / 2, ARENA_FLOOR_Y);
    ctx.stroke();
    ctx.globalAlpha = 0.58;
    ctx.fillStyle = theme.glowColor;
    ctx.fillRect(0, ARENA_FLOOR_Y, ARENA_WIDTH, 3);
    ctx.restore();

    // 3. Interactive Obstacles & Biome Mechanisms
    for (const obs of battle.obstacles) {
      this.drawObstacle(ctx, battle.biome, obs, theme.glowColor, time, highLighting);
    }

    // 4. Predicted Blaster Aim Trajectory, Reticle & Velocimorph Node
    if (battle.turn === 'duel') {
      const preview = combat.computeTrajectoryPreview(state);
      const tierInfo = combat.getChargeTierInfo(state);
      this.drawTrajectoryPreview(
        ctx,
        preview,
        allyElColor,
        tierInfo.color,
        battle.playerDuelist.charging,
        battle.playerDuelist.charge
      );
    }

    // 5. Duelists & Articulated Blasters (with loaded slug visible in chamber)
    this.drawPlayerDuelist(
      ctx,
      battle,
      allySpecies.id,
      getSlugDisplayName(ally),
      allyElColor,
      allySpecies.accent,
      ally.mega,
      time,
      highLighting,
      reducedMotion
    );
    this.drawEnemyDuelist(ctx, battle, enemyElColor, time, highLighting, reducedMotion);

    // 6. Active Flying Projectiles (Protoforms -> Velocimorph Transformed -> Capsules)
    for (const proj of battle.projectiles) {
      this.drawProjectile(ctx, proj, time, highLighting);
    }

    // 7. Visual Particles (Muzzle, Transform, Impact, Victory)
    for (const pt of this.particles) {
      const alpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      if (pt.kind === 'star') {
        ctx.translate(pt.x, pt.y);
        ctx.rotate(time * 6 + pt.size);
        ctx.fillRect(-pt.size, -1.1, pt.size * 2, 2.2);
        ctx.fillRect(-1.1, -pt.size, 2.2, pt.size * 2);
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * (0.4 + alpha * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 8. Translucent Shockwaves & Transformation Rings
    for (const sw of battle.shockwaves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(0.85, sw.alpha * 0.85));
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.kind === 'clash' || sw.kind === 'transform' ? 3.2 : 2.3;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (sw.kind === 'transform' || sw.kind === 'clash') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius * 0.66, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (sw.label) {
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(4,9,16,0.9)';
        ctx.fillText(sw.label, sw.x + 1, sw.y - sw.radius * 0.68 + 1);
        ctx.fillStyle = sw.color;
        ctx.fillText(sw.label, sw.x, sw.y - sw.radius * 0.68);
      }
      ctx.restore();
    }

    // 9. Floating Damage / Status Callouts (with vertical anti-overlap separation)
    const recentEffects = battle.effects.slice(-4);
    const placedLabels: Array<{ x: number; y: number }> = [];
    recentEffects.forEach((ef) => {
      const ex = ef.x ?? (ef.target === 'enemy' ? battle.enemyDuelist.x : battle.playerDuelist.x);
      let ey = ef.y ?? 200;
      while (placedLabels.some((p) => Math.abs(p.x - ex) < 72 && Math.abs(p.y - ey) < 16)) {
        ey -= 16;
      }
      placedLabels.push({ x: ex, y: ey });
      ctx.save();
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(3, 7, 14, 0.9)';
      ctx.fillText(ef.text, ex + 1.5, ey + 1.5);
      ctx.fillStyle = ef.color;
      ctx.fillText(ef.text, ex, ey);
      ctx.restore();
    });

    // 10. Victory / Defeat / Capture Outcome Canvas Banner
    if (battle.turn === 'ended') {
      this.drawOutcomeBanner(ctx, battle, time);
    }

    ctx.restore();
  }

  private drawCavernBackdrop(
    ctx: CanvasRenderingContext2D,
    biome: BiomeId,
    theme: ReturnType<typeof buildArenaForBiome>,
    time: number,
    highLighting: boolean
  ): void {
    // Far ambient glow
    if (highLighting) {
      const centerGlow = ctx.createRadialGradient(
        ARENA_WIDTH * 0.5,
        ARENA_HEIGHT * 0.45,
        24,
        ARENA_WIDTH * 0.5,
        ARENA_HEIGHT * 0.45,
        420
      );
      centerGlow.addColorStop(0, `${theme.glowColor}20`);
      centerGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    }

    // Biome-specific mid-cavern silhouette
    ctx.fillStyle = theme.caveMid;
    ctx.beginPath();
    ctx.moveTo(0, ARENA_FLOOR_Y);
    for (let x = 0; x <= ARENA_WIDTH; x += 42) {
      const ridge =
        biome === 'Magma'
          ? 126 + Math.abs(Math.sin(x * 0.022)) * 52
          : biome === 'Heladas'
          ? 110 + Math.abs(Math.cos(x * 0.028)) * 58
          : biome === 'Cristalinas'
          ? 118 + Math.abs(Math.sin(x * 0.031)) * 64
          : biome === 'Acuaticas'
          ? 104 + Math.sin(x * 0.018) * 32 + Math.cos(x * 0.04) * 16
          : 112 + Math.sin(x * 0.015 + 1.2) * 36 + Math.cos(x * 0.032) * 20;
      ctx.lineTo(x, ARENA_FLOOR_Y - ridge);
    }
    ctx.lineTo(ARENA_WIDTH, ARENA_FLOOR_Y);
    ctx.closePath();
    ctx.fill();

    // Biome-specific background landmarks
    ctx.save();
    if (biome === 'Verdes') {
      // Giant bioluminescent background mushrooms & hanging vines
      const caps = [
        { x: 145, y: 318, r: 34 },
        { x: 385, y: 342, r: 24 },
        { x: 695, y: 326, r: 32 },
      ];
      for (const c of caps) {
        ctx.fillStyle = '#134e4a';
        ctx.fillRect(c.x - 5, c.y, 10, ARENA_FLOOR_Y - c.y);
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#4ade80';
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 2.2 + c.x);
        ctx.beginPath();
        ctx.arc(c.x - c.r * 0.3, c.y - c.r * 0.45, 4.5, 0, Math.PI * 2);
        ctx.arc(c.x + c.r * 0.25, c.y - c.r * 0.3, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else if (biome === 'Acuaticas') {
      // Cascading subterranean waterfalls & glowing caustic ribbons
      const falls = [150, 445, 735];
      for (let i = 0; i < falls.length; i++) {
        const fx = falls[i];
        const fw = i === 1 ? 46 : 32;
        const grad = ctx.createLinearGradient(fx, 40, fx, ARENA_FLOOR_Y);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
        grad.addColorStop(0.5, 'rgba(34, 211, 238, 0.26)');
        grad.addColorStop(1, 'rgba(165, 243, 252, 0.42)');
        ctx.fillStyle = grad;
        ctx.fillRect(fx - fw / 2, 42, fw, ARENA_FLOOR_Y - 42);
        ctx.strokeStyle = 'rgba(207, 250, 254, 0.45)';
        ctx.lineWidth = 1.6;
        for (let s = 0; s < 3; s++) {
          const sx = fx - fw * 0.25 + s * (fw * 0.25);
          const flowY = 54 + ((time * 95 + s * 65 + i * 40) % (ARENA_FLOOR_Y - 70));
          ctx.beginPath();
          ctx.moveTo(sx, flowY);
          ctx.lineTo(sx, Math.min(ARENA_FLOOR_Y, flowY + 38));
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(165, 243, 252, 0.32)';
        ctx.beginPath();
        ctx.ellipse(fx, ARENA_FLOOR_Y - 2, fw * 0.72, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (biome === 'Cristalinas') {
      // Towering faceted amethyst & cyan quartz spires in background
      const spires = [
        { x: 128, h: 155, w: 28, c: '#a855f7' },
        { x: 265, h: 112, w: 22, c: '#38bdf8' },
        { x: 465, h: 168, w: 32, c: '#c084fc' },
        { x: 645, h: 122, w: 24, c: '#22d3ee' },
        { x: 775, h: 148, w: 26, c: '#a855f7' },
      ];
      for (let i = 0; i < spires.length; i++) {
        const sp = spires[i];
        ctx.globalAlpha = 0.26 + 0.08 * Math.sin(time * 2 + i);
        ctx.fillStyle = sp.c;
        ctx.beginPath();
        ctx.moveTo(sp.x - sp.w / 2, ARENA_FLOOR_Y);
        ctx.lineTo(sp.x - sp.w * 0.34, ARENA_FLOOR_Y - sp.h * 0.72);
        ctx.lineTo(sp.x, ARENA_FLOOR_Y - sp.h);
        ctx.lineTo(sp.x + sp.w * 0.36, ARENA_FLOOR_Y - sp.h * 0.68);
        ctx.lineTo(sp.x + sp.w / 2, ARENA_FLOOR_Y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#f5d0fe';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sp.x, ARENA_FLOOR_Y - sp.h);
        ctx.lineTo(sp.x - 2, ARENA_FLOOR_Y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (biome === 'Magma') {
      // Glowing lava fissures in cavern wall
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(time * 3);
      for (let i = 0; i < 4; i++) {
        const vx = 130 + i * 210;
        ctx.beginPath();
        ctx.moveTo(vx, ARENA_FLOOR_Y);
        ctx.lineTo(vx - 12, ARENA_FLOOR_Y - 58);
        ctx.lineTo(vx + 8, ARENA_FLOOR_Y - 108);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (biome === 'Heladas') {
      // Aurora bands & faceted ice pillars
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 3; i++) {
        const ax = 170 + i * 280;
        ctx.fillStyle = i % 2 === 0 ? '#67e8f9' : '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(ax - 24, ARENA_FLOOR_Y);
        ctx.lineTo(ax - 10, ARENA_FLOOR_Y - 150);
        ctx.lineTo(ax + 16, ARENA_FLOOR_Y - 120);
        ctx.lineTo(ax + 26, ARENA_FLOOR_Y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (biome === 'Sombrias') {
      // Towering obsidian monoliths & floating rune circles
      ctx.fillStyle = '#1b1138';
      for (let i = 0; i < 4; i++) {
        const sx = 120 + i * 225;
        ctx.fillRect(sx - 14, ARENA_FLOOR_Y - 145, 28, 145);
        ctx.strokeStyle = '#a855f7';
        ctx.globalAlpha = 0.28 + 0.15 * Math.sin(time * 2.5 + i);
        ctx.beginPath();
        ctx.arc(sx, ARENA_FLOOR_Y - 95, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();

    // Ceiling stalactites (tinted per biome)
    ctx.fillStyle =
      biome === 'Heladas'
        ? '#0b2234'
        : biome === 'Magma'
        ? '#170705'
        : biome === 'Acuaticas'
        ? '#071b2d'
        : biome === 'Cristalinas'
        ? '#140c29'
        : '#070b14';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= ARENA_WIDTH; x += 36) {
      const spike = 20 + ((x * 17) % 32);
      ctx.lineTo(x, spike);
    }
    ctx.lineTo(ARENA_WIDTH, 0);
    ctx.closePath();
    ctx.fill();

    // Ambient biome particles (spores / rising embers / falling snow / astral wisps)
    const moteCount = highLighting ? 18 : 7;
    for (let i = 0; i < moteCount; i++) {
      let mx: number;
      let my: number;
      if (biome === 'Magma') {
        mx = ((i * 97 + Math.sin(time * 1.5 + i) * 18) % (ARENA_WIDTH - 40)) + 20;
        my = ARENA_FLOOR_Y - ((time * (26 + (i % 4) * 8) + i * 47) % 330);
      } else if (biome === 'Heladas') {
        mx = ((i * 89 + Math.sin(time * 1.2 + i) * 24) % (ARENA_WIDTH - 40)) + 20;
        my = 50 + ((time * (22 + (i % 3) * 9) + i * 51) % 360);
      } else {
        mx = ((i * 97 + time * (10 + (i % 4) * 4)) % (ARENA_WIDTH - 40)) + 20;
        my = 76 + ((i * 53 + Math.sin(time * 1.4 + i) * 22 + 280) % 310);
      }
      const r = 1.6 + (i % 3) * 0.8;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.18 * Math.sin(time * 2.4 + i);
      ctx.fillStyle = theme.ambientSparkColor;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawFloorDetails(
    ctx: CanvasRenderingContext2D,
    biome: BiomeId,
    glowColor: string,
    time: number,
    highLighting: boolean
  ): void {
    ctx.save();
    if (biome === 'Magma') {
      ctx.fillStyle = '#ea580c';
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 3.2);
      ctx.fillRect(0, ARENA_FLOOR_Y + 18, ARENA_WIDTH, 10);
    } else if (biome === 'Acuaticas') {
      ctx.fillStyle = '#0ea5e9';
      ctx.globalAlpha = 0.24 + 0.08 * Math.sin(time * 3.2);
      ctx.fillRect(0, ARENA_FLOOR_Y + 14, ARENA_WIDTH, 12);
      ctx.strokeStyle = '#a5f3fc';
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) {
        const rx = 95 + i * 165 + Math.sin(time * 2 + i) * 8;
        ctx.beginPath();
        ctx.ellipse(rx, ARENA_FLOOR_Y + 16, 26, 3.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (biome === 'Cristalinas') {
      ctx.strokeStyle = '#e879f9';
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(time * 2.5);
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) {
        const cx = 75 + i * 145;
        ctx.beginPath();
        ctx.moveTo(cx, ARENA_FLOOR_Y + 16);
        ctx.lineTo(cx + 18, ARENA_FLOOR_Y + 7);
        ctx.lineTo(cx + 36, ARENA_FLOOR_Y + 16);
        ctx.lineTo(cx + 18, ARENA_FLOOR_Y + 25);
        ctx.closePath();
        ctx.stroke();
      }
    } else if (biome === 'Heladas') {
      ctx.fillStyle = '#bae6fd';
      ctx.globalAlpha = 0.16;
      for (let i = 0; i < 6; i++) {
        const gx = 70 + i * 150;
        ctx.fillRect(gx, ARENA_FLOOR_Y + 8, 52, 4);
      }
    } else if (biome === 'Verdes') {
      ctx.fillStyle = glowColor;
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.ellipse(90 + i * 128, ARENA_FLOOR_Y + 12, 34, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (highLighting) {
      ctx.strokeStyle = glowColor;
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 6; i++) {
        ctx.strokeRect(80 + i * 145, ARENA_FLOOR_Y + 10, 40, 14);
      }
    }
    ctx.restore();
  }

  private drawObstacle(
    ctx: CanvasRenderingContext2D,
    biome: BiomeId,
    obs: DuelArenaObstacle,
    biomeGlow: string,
    time: number,
    highLighting: boolean
  ): void {
    ctx.save();
    if (obs.kind === 'cover') {
      const grad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.w, obs.y + obs.h);
      if (biome === 'Magma') {
        grad.addColorStop(0, '#57322b');
        grad.addColorStop(1, '#291512');
      } else if (biome === 'Heladas') {
        grad.addColorStop(0, '#67e8f9');
        grad.addColorStop(1, '#1e4e68');
      } else if (biome === 'Acuaticas') {
        grad.addColorStop(0, '#14b8a6');
        grad.addColorStop(1, '#0f3c5c');
      } else if (biome === 'Cristalinas') {
        grad.addColorStop(0, '#c084fc');
        grad.addColorStop(1, '#311b59');
      } else if (biome === 'Sombrias') {
        grad.addColorStop(0, '#3b2466');
        grad.addColorStop(1, '#150d28');
      } else {
        grad.addColorStop(0, '#3e5c4d');
        grad.addColorStop(1, '#1b2e26');
      }
      ctx.fillStyle = grad;
      drawRoundedBar(ctx, obs.x, obs.y, obs.w, obs.h, 8);
      ctx.fill();
      ctx.strokeStyle = biomeGlow;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.strokeStyle = biomeGlow;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(obs.x + 8, obs.y + 18);
      ctx.lineTo(obs.x + obs.w * 0.55, obs.y + 38);
      ctx.lineTo(obs.x + obs.w - 10, obs.y + 56);
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (obs.hp !== undefined && obs.maxHp && obs.hp < obs.maxHp) {
        const pct = Math.max(0, obs.hp / obs.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(obs.x + 4, obs.y - 9, obs.w - 8, 5);
        ctx.fillStyle = pct > 0.45 ? '#38bdf8' : '#f59e0b';
        ctx.fillRect(obs.x + 4, obs.y - 9, (obs.w - 8) * pct, 5);
      }
    } else if (obs.kind === 'reflector') {
      const rGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.w, obs.y);
      if (biome === 'Verdes') {
        rGrad.addColorStop(0, '#16a34a');
        rGrad.addColorStop(0.5, '#86efac');
        rGrad.addColorStop(1, '#16a34a');
      } else if (biome === 'Cristalinas') {
        rGrad.addColorStop(0, '#9333ea');
        rGrad.addColorStop(0.5, '#f0abfc');
        rGrad.addColorStop(1, '#38bdf8');
      } else if (biome === 'Acuaticas') {
        rGrad.addColorStop(0, '#0284c7');
        rGrad.addColorStop(0.5, '#a5f3fc');
        rGrad.addColorStop(1, '#14b8a6');
      } else if (biome === 'Sombrias') {
        rGrad.addColorStop(0, '#7e22ce');
        rGrad.addColorStop(0.5, '#e9d5ff');
        rGrad.addColorStop(1, '#7e22ce');
      } else {
        rGrad.addColorStop(0, '#0ea5e9');
        rGrad.addColorStop(0.5, '#67e8f9');
        rGrad.addColorStop(1, '#0ea5e9');
      }
      ctx.fillStyle = rGrad;
      drawRoundedBar(ctx, obs.x, obs.y, obs.w, obs.h, 10);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else if (obs.kind === 'updraft') {
      const uGrad = ctx.createLinearGradient(obs.x, obs.y + obs.h, obs.x, obs.y);
      uGrad.addColorStop(0, 'rgba(251, 146, 60, 0.34)');
      uGrad.addColorStop(1, 'rgba(251, 146, 60, 0.02)');
      ctx.fillStyle = uGrad;
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeStyle = 'rgba(253, 186, 116, 0.58)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        const cy = obs.y + obs.h - ((time * 74 + i * 58) % obs.h);
        ctx.beginPath();
        ctx.moveTo(obs.x + 12, cy + 8);
        ctx.lineTo(obs.x + obs.w / 2, cy - 5);
        ctx.lineTo(obs.x + obs.w - 12, cy + 8);
        ctx.stroke();
      }
    } else if (obs.kind === 'boost_ring') {
      const cx = obs.x + obs.w / 2;
      const cy = obs.y + obs.h / 2;
      const rx = obs.w * 0.45;
      const ry = obs.h * 0.46;
      if (highLighting) {
        ctx.globalAlpha = 0.28 + 0.12 * Math.sin(time * 4.5);
        ctx.fillStyle = biomeGlow;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx + 8, ry + 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = biomeGlow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Inner spinning energy node
      const orbX = cx + Math.cos(time * 5) * rx;
      const orbY = cy + Math.sin(time * 5) * ry;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(orbX, orbY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawTrajectoryPreview(
    ctx: CanvasRenderingContext2D,
    preview: { points: Array<{ x: number; y: number }>; transformPoint: { x: number; y: number } | null },
    elColor: string,
    tierColor: string,
    charging: boolean,
    charge: number
  ): void {
    if (preview.points.length < 2) return;
    ctx.save();
    const activeColor = charging ? tierColor : elColor;
    for (let i = 1; i < preview.points.length; i++) {
      const pt = preview.points[i];
      const alpha = (1 - i / preview.points.length) * (charging ? 0.88 : 0.48);
      ctx.fillStyle = activeColor;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, charging ? 3.2 : 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crisp aim reticle near preview mid-end
    const reticlePt = preview.points[Math.min(preview.points.length - 1, 8)];
    ctx.globalAlpha = charging ? 0.92 : 0.6;
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(reticlePt.x, reticlePt.y, charging ? 7 + charge * 3 : 6, 0, Math.PI * 2);
    ctx.stroke();

    if (preview.transformPoint) {
      const tp = preview.transformPoint;
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('V', tp.x, tp.y + 3);
    }
    ctx.restore();
  }

  private drawPlayerDuelist(
    ctx: CanvasRenderingContext2D,
    battle: BattleState,
    speciesId: string,
    slugName: string,
    elColor: string,
    accentColor: string,
    mega: boolean,
    time: number,
    highLighting: boolean,
    reducedMotion = false
  ): void {
    const pd = battle.playerDuelist;
    const speedMag = Math.hypot(pd.vx, pd.vy);
    const moving = speedMag > 15;
    const bob = moving ? Math.sin(time * 17) * 3 : Math.sin(time * 3.5) * 1.5;
    const lean = moving ? Math.max(-0.14, Math.min(0.14, pd.vx * 0.0005)) : 0;

    ctx.save();
    ctx.translate(pd.x, pd.y + bob);

    if (highLighting) {
      const auraR = pd.charging ? 48 + pd.charge * 14 : 44;
      const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, auraR);
      aura.addColorStop(0, `${elColor}44`);
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, auraR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shadow footprint beneath duelist
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(0, 27 - bob, 19, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(lean);

    // Animated legs + dark knee pads & boots (Eli Shane Ref 3)
    const stride = moving ? Math.sin(time * 18) * 6.5 : 0;
    ctx.fillStyle = '#334155';
    ctx.fillRect(-11 + stride * 0.5, 16, 6.5, 11);
    ctx.fillRect(0 - stride * 0.5, 16, 6.5, 11);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-12 + stride * 0.5, 24, 8, 4.5);
    ctx.fillRect(-1 - stride * 0.5, 24, 8, 4.5);

    // Eli Shane armored vest with orange shoulder pauldrons & twin cyan chest canisters
    const flash = pd.hitFlash > 0;
    ctx.fillStyle = flash ? '#fca5a5' : '#1e293b';
    drawRoundedBar(ctx, -16, -12, 26, 30, 7);
    ctx.fill();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Left & right orange shoulder pauldrons
    ctx.fillStyle = '#7c2d12';
    drawRoundedBar(ctx, -19, -13, 10, 9, 4);
    ctx.fill();
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawRoundedBar(ctx, 3, -13, 10, 9, 4);
    ctx.fill();
    ctx.stroke();

    // Orange Shane star badge on shoulder + glowing cyan dual canisters on chest
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(-11, -4, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#67e8f9';
    drawRoundedBar(ctx, -7, -6, 4.2, 11, 2);
    ctx.fill();
    drawRoundedBar(ctx, -1, -6, 4.2, 11, 2);
    ctx.fill();
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 1.1;
    ctx.strokeRect(-7, -6, 10.2, 11);

    // Eli Shane head: fair skin, expressive anime brow + confident smile, spiky indigo-navy hair
    ctx.fillStyle = '#fde2c4';
    ctx.beginPath();
    ctx.arc(-2, -21, 11.5, 0, Math.PI * 2);
    ctx.fill();

    // Spiky indigo-navy hair silhouette (Ref 3)
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.moveTo(-14, -18);
    ctx.lineTo(-16, -26);
    ctx.lineTo(-9, -33);
    ctx.lineTo(-1, -35);
    ctx.lineTo(8, -32);
    ctx.lineTo(13, -23);
    ctx.lineTo(7, -25);
    ctx.lineTo(2, -23);
    ctx.lineTo(-5, -26);
    ctx.lineTo(-11, -18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#312e81';
    ctx.beginPath();
    ctx.moveTo(-8, -31);
    ctx.lineTo(1, -34);
    ctx.lineTo(6, -28);
    ctx.closePath();
    ctx.fill();

    // Determined anime eyes & grin
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(3.5, -20.5, 3.6, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.arc(4.4, -20.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(5, -21.2, 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(7.5, -23);
    ctx.stroke();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(3, -15.5, 3.2, 0.1, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();

    // Articulated 360° Shane Star Slug Blaster (Orange/Silver sleek frame Ref 3)
    ctx.save();
    ctx.rotate(pd.aimAngle);
    const recoilOffset = -pd.recoil * 42;
    ctx.translate(recoilOffset, 0);

    // Silver grip & receiver
    ctx.fillStyle = '#94a3b8';
    drawRoundedBar(ctx, -6, -7.5, 16, 15, 4);
    ctx.fill();
    // Orange/gold blaster barrel + accelerator rails
    ctx.fillStyle = '#f97316';
    drawRoundedBar(ctx, 4, -9.5, 29, 19, 5);
    ctx.fill();
    ctx.strokeStyle = mega ? '#fde047' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Blue star badge on Shane blaster rear
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(-1, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Energy coils glowing with charge
    if (pd.charging) {
      ctx.fillStyle = pd.charge >= 0.78 ? '#5eead4' : pd.charge >= 0.42 ? '#fde047' : accentColor;
      ctx.fillRect(19, -8, 4, 16);
      ctx.fillRect(25, -7, 4, 14);
    }

    // Transparent energy chamber with expressive loaded slug inside
    ctx.fillStyle = 'rgba(6, 18, 32, 0.92)';
    ctx.beginPath();
    ctx.arc(10, 0, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(10, 0);
    const chamberAnimState: SlugAnimationState = pd.charging
      ? 'charge'
      : pd.recoil > 0.04
      ? 'fire'
      : battle.turn === 'ended' && (battle.outcome === 'victory' || battle.outcome === 'captured')
      ? 'victory'
      : pd.hitFlash > 0
      ? 'hit'
      : 'idle';
    const chamberAnim = sampleSlugAnimationFrame(speciesId, chamberAnimState, time, reducedMotion);
    const chamberPulse =
      !reducedMotion && pd.charging ? 0.56 + Math.sin(time * 24) * 0.07 * pd.charge : 0.55;
    ctx.rotate((chamberAnim.tiltDeg * Math.PI) / 180);
    ctx.scale(chamberPulse * chamberAnim.scaleX, chamberPulse * chamberAnim.scaleY);
    this.drawProtoformBody(ctx, speciesId, elColor, accentColor, time, pd.charging, mega, chamberAnimState);
    ctx.restore();

    // Charge energy arcs converging into blaster muzzle
    if (pd.charging && highLighting) {
      ctx.strokeStyle = pd.charge >= 0.78 ? '#5eead4' : accentColor;
      ctx.lineWidth = 1.6;
      const arcPhase = time * 14;
      for (let i = 0; i < 3; i++) {
        const a = arcPhase + (i * Math.PI * 2) / 3;
        const r = 16 * (1 - (pd.charge * 0.4));
        ctx.beginPath();
        ctx.arc(32, 0, r, a, a + 0.8);
        ctx.stroke();
      }
    }

    // Muzzle flash on recoil
    if (pd.recoil > 0.09) {
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(35, 0);
      ctx.lineTo(52, -9);
      ctx.lineTo(44, 0);
      ctx.lineTo(52, 9);
      ctx.closePath();
      ctx.fill();
    }

    // Muzzle accelerator ring
    ctx.fillStyle = pd.charging ? accentColor : '#e2e8f0';
    ctx.fillRect(31, -5.5, 6, 11);
    ctx.restore();

    // 3-Tier Unified Charge Ring
    if (pd.charging || pd.charge > 0.05) {
      const tier2 = pd.charge >= 0.78;
      const tier1 = pd.charge >= 0.42 && !tier2;
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 39, -Math.PI * 0.75, Math.PI * 0.75);
      ctx.stroke();

      ctx.strokeStyle = tier2 ? '#5eead4' : tier1 ? '#fde047' : '#38bdf8';
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.arc(0, 0, 39, -Math.PI * 0.75, -Math.PI * 0.75 + Math.PI * 1.5 * pd.charge);
      ctx.stroke();
    }

    // Blaster Shield Dome
    if (pd.guardTimer > 0 || battle.allyStatus.shieldTimer > 0) {
      ctx.strokeStyle = '#5eead4';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.17)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(4, 0, 42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }

    // Active status visuals on player
    this.drawStatusAura(ctx, battle.allyStatus.burnTimer, battle.allyStatus.chillTimer, battle.allyStatus.stunTimer, time);

    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(slugName, 0, 40);
    ctx.restore();
  }

  private drawEnemyDuelist(
    ctx: CanvasRenderingContext2D,
    battle: BattleState,
    elColor: string,
    time: number,
    highLighting: boolean,
    reducedMotion = false
  ): void {
    const ed = battle.enemyDuelist;
    const enemy = battle.enemy;
    const sp = getSpecies(enemy.id);
    const isBoss = Boolean(enemy.isBoss);
    const isMerc = Boolean(enemy.isMercenary);
    const radius = isBoss ? 34 : 25;
    const defeated = battle.turn === 'ended' && (battle.outcome === 'victory' || battle.outcome === 'captured');
    const bob = defeated ? 8 : Math.sin(time * 4.2) * 3.5;

    ctx.save();
    ctx.translate(ed.x, ed.y + bob);
    if (defeated) {
      ctx.globalAlpha = battle.outcome === 'captured' ? 0.3 : 0.65;
    }

    if (highLighting) {
      const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, radius + 24);
      aura.addColorStop(0, `${elColor}48`);
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 24, 0, Math.PI * 2);
      ctx.fill();
    }

    if (enemy.telegraphing === 'heavy') {
      const pulseR = radius + 12 + Math.sin(time * 16) * 3;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2 * Math.max(0.1, ed.telegraphProgress));
      ctx.stroke();
    }

    if (isMerc || isBoss) {
      const lowerName = enemy.name.toLowerCase();
      const bossKey = enemy.bossId || '';
      const isBlakkArchetype =
        bossKey === 'boss_blakk' || lowerName.includes('blakk') || lowerName.includes('somb');
      const isRedHook = lowerName.includes('garfio') || lowerName.includes('hook');
      const isTwist = lowerName.includes('twist');
      const isKord = lowerName.includes('kord');
      const isAquaticLord = bossKey === 'boss_aquatic' || lowerName.includes('leviat');
      const isCrystalOracle = bossKey === 'boss_crystal' || lowerName.includes('oráculo') || lowerName.includes('prisma');

      const hitTint = ed.hitFlash > 0;
      const isMagmaTitan = bossKey === 'boss_magma' || lowerName.includes('piroclasto') || lowerName.includes('titán');
      const isIceQueen = bossKey === 'boss_ice' || lowerName.includes('glaciomita') || lowerName.includes('reina');
      const isShadowBoss = bossKey === 'boss_shadow' || lowerName.includes('espectro') || lowerName.includes('abismo');

      const bodyFill = hitTint
        ? '#fecaca'
        : isBlakkArchetype || isShadowBoss
        ? '#18181b'
        : isRedHook
        ? '#451a03'
        : isTwist
        ? '#064e3b'
        : isKord
        ? '#1d4ed8'
        : isAquaticLord
        ? '#0c4a6e'
        : isMagmaTitan
        ? '#29120e'
        : isIceQueen
        ? '#155e75'
        : isCrystalOracle
        ? '#312e81'
        : '#1e293b';
      const trimColor = isBlakkArchetype || isShadowBoss
        ? '#ef4444'
        : isRedHook
        ? '#f59e0b'
        : isTwist
        ? '#34d399'
        : isKord
        ? '#f97316'
        : isAquaticLord
        ? '#22d3ee'
        : isMagmaTitan
        ? '#fb923c'
        : isIceQueen
        ? '#a5f3fc'
        : isCrystalOracle
        ? '#c084fc'
        : '#f43f5e';

      // Boss / Villain Silhouette Mantle or Wings behind torso
      if (isBoss) {
        ctx.fillStyle = isAquaticLord
          ? '#082f49'
          : isMagmaTitan
          ? '#431407'
          : isIceQueen
          ? '#0e7490'
          : isCrystalOracle
          ? '#4c1d95'
          : '#09090b';
        ctx.strokeStyle = '#05080f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-18, -18);
        ctx.lineTo(-34, isIceQueen ? 26 : -4);
        ctx.lineTo(-24, 28);
        ctx.lineTo(24, 28);
        ctx.lineTo(34, isIceQueen ? 26 : -4);
        ctx.lineTo(18, -18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Sculpted Armor / Coat Torso
      ctx.fillStyle = bodyFill;
      ctx.beginPath();
      ctx.moveTo(-19, -18);
      ctx.lineTo(19, -18);
      ctx.lineTo(isBoss ? 17 : 14, 22);
      ctx.lineTo(isBoss ? -17 : -14, 22);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = trimColor;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Chest Core / Emblem
      if (isBoss) {
        ctx.fillStyle = trimColor;
        ctx.beginPath();
        ctx.arc(0, 2, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Diagonal crimson bandolier & high collar for Dr. Blakk (Ref 3)
      if (isBlakkArchetype) {
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-14, -18);
        ctx.lineTo(14, 16);
        ctx.stroke();
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.moveTo(-16, -15);
        ctx.lineTo(-19, -31);
        ctx.lineTo(0, -18);
        ctx.lineTo(19, -31);
        ctx.lineTo(16, -15);
        ctx.closePath();
        ctx.fill();
      }

      // Head & Distinctive Hair / Crown / Helm
      const skinColor = isBlakkArchetype
        ? '#b5c299'
        : isKord
        ? '#60a5fa'
        : isAquaticLord
        ? '#38bdf8'
        : isMagmaTitan
        ? '#7c2d12'
        : isIceQueen
        ? '#cffafe'
        : isCrystalOracle
        ? '#e0e7ff'
        : isShadowBoss
        ? '#64748b'
        : '#fde2c4';
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(0, -26, isBoss ? 13 : 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#05080f';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      if (isAquaticLord) {
        // Coral crown + fin crest
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(-10, -33);
        ctx.lineTo(-14, -45);
        ctx.lineTo(-4, -37);
        ctx.lineTo(0, -47);
        ctx.lineTo(4, -37);
        ctx.lineTo(14, -45);
        ctx.lineTo(10, -33);
        ctx.closePath();
        ctx.fill();
      } else if (isMagmaTitan) {
        // Curved magma horns
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(-11, -30);
        ctx.quadraticCurveTo(-24, -42, -16, -20);
        ctx.moveTo(11, -30);
        ctx.quadraticCurveTo(24, -42, 16, -20);
        ctx.fill();
      } else if (isIceQueen) {
        // Triple ice spire tiara
        ctx.fillStyle = '#67e8f9';
        ctx.beginPath();
        ctx.moveTo(-9, -34);
        ctx.lineTo(-12, -46);
        ctx.lineTo(-3, -38);
        ctx.lineTo(0, -49);
        ctx.lineTo(3, -38);
        ctx.lineTo(12, -46);
        ctx.lineTo(9, -34);
        ctx.closePath();
        ctx.fill();
      } else if (isCrystalOracle) {
        // Orbiting prism diamond halo
        for (let i = 0; i < 3; i++) {
          const a = time * 2.4 + (i * Math.PI * 2) / 3;
          const sx = Math.cos(a) * 26;
          const sy = -22 + Math.sin(a) * 10;
          ctx.fillStyle = i === 0 ? '#67e8f9' : '#c084fc';
          ctx.beginPath();
          ctx.moveTo(sx, sy - 6);
          ctx.lineTo(sx + 4, sy);
          ctx.lineTo(sx, sy + 6);
          ctx.lineTo(sx - 4, sy);
          ctx.closePath();
          ctx.fill();
        }
      } else if (isBlakkArchetype || isShadowBoss) {
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.moveTo(-12, -26);
        ctx.lineTo(-14, -40);
        ctx.lineTo(0, -45);
        ctx.lineTo(14, -40);
        ctx.lineTo(11, -26);
        ctx.lineTo(4, -31);
        ctx.lineTo(-4, -31);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-9, -28, 7, 3.5);
        ctx.fillRect(1, -28, 7, 3.5);
      } else {
        ctx.fillStyle = trimColor;
        ctx.fillRect(-11, -34, 22, 6);
        ctx.fillStyle = isRedHook ? '#09090b' : '#fde047';
        ctx.fillRect(-9, -28, 7, 4);
      }

      // Articulated Heavy Blaster (Blakk purple/crimson Ghoul gatling Ref 3)
      ctx.save();
      ctx.rotate(ed.aimAngle);
      ctx.translate(-ed.recoil * 34, 0);
      if (isBlakkArchetype) {
        ctx.fillStyle = '#4c1d95';
        drawRoundedBar(ctx, -6, -11, 40, 22, 5);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(12, -7, 15, 4);
        ctx.fillRect(12, 3, 15, 4);
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.arc(4, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#0f172a';
        drawRoundedBar(ctx, -4, -8.5, 34, 17, 4);
        ctx.fill();
        ctx.strokeStyle = elColor;
        ctx.stroke();
        ctx.fillStyle = elColor;
        ctx.beginPath();
        ctx.arc(10, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      const enemyAnimState: SlugAnimationState = defeated
        ? 'ko'
        : ed.hitFlash > 0
        ? 'hit'
        : enemy.telegraphing === 'heavy'
        ? 'charge'
        : ed.recoil > 0.04
        ? 'fire'
        : 'idle';
      const enemyAnim = sampleSlugAnimationFrame(enemy.id, enemyAnimState, time, reducedMotion);
      ctx.save();
      ctx.translate(enemyAnim.offsetX, enemyAnim.offsetY);
      ctx.rotate((-enemyAnim.tiltDeg * Math.PI) / 180);
      ctx.scale(-1.76 * enemyAnim.scaleX, 1.76 * enemyAnim.scaleY);
      this.drawProtoformBody(
        ctx,
        enemy.id,
        sp.color,
        sp.accent,
        time,
        enemy.telegraphing === 'heavy',
        enemy.mega,
        enemyAnimState
      );
      if (ed.hitFlash > 0) {
        ctx.fillStyle = 'rgba(254, 202, 202, 0.55)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (enemy.telegraphing === 'heavy' && highLighting) {
        ctx.save();
        ctx.strokeStyle = sp.accent;
        ctx.lineWidth = 1.8;
        const a = time * 12;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 7, a, a + 1.1);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (ed.guardTimer > 0 || (enemy.shieldTimer || 0) > 0) {
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(-6, 0, radius + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }

    this.drawStatusAura(ctx, enemy.burnTimer || 0, enemy.chillTimer || 0, enemy.stunTimer || 0, time);

    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fda4af';
    ctx.fillText(enemy.name, 0, radius + 18);
    ctx.restore();
  }

  private drawStatusAura(
    ctx: CanvasRenderingContext2D,
    burn: number,
    chill: number,
    stun: number,
    time: number
  ): void {
    if (burn > 0) {
      ctx.fillStyle = '#fb923c';
      for (let i = 0; i < 3; i++) {
        const fx = Math.sin(time * 8 + i * 2) * 14;
        const fy = 10 - ((time * 30 + i * 14) % 36);
        ctx.beginPath();
        ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (chill > 0) {
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        const a = time * 2.5 + (i * Math.PI * 2) / 3;
        const cx = Math.cos(a) * 26;
        const cy = Math.sin(a) * 22;
        ctx.strokeRect(cx - 2.5, cy - 2.5, 5, 5);
      }
    }
    if (stun > 0) {
      ctx.fillStyle = '#facc15';
      for (let i = 0; i < 3; i++) {
        const a = time * 10 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 18, -32 + Math.sin(a) * 4, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawProjectile(
    ctx: CanvasRenderingContext2D,
    p: DuelProjectile,
    time: number,
    highLighting: boolean
  ): void {
    const sp = getSpecies(p.speciesId);
    const profile = getSlugCombatProfile(sp);
    const color = p.mode === 'capsule' ? (p.mega ? '#c084fc' : '#38bdf8') : sp.color;
    const accent = p.mode === 'capsule' ? '#e0f2fe' : sp.accent;

    // 1. Species-specific elemental trail
    this.drawSpeciesTrail(ctx, p, profile.trailStyle, color, accent, time);

    const angle = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);

    if (p.mode === 'capsule') {
      ctx.rotate(time * 12);
      ctx.fillStyle = p.mega ? '#7e22ce' : '#0284c7';
      drawRoundedBar(ctx, -12, -7, 24, 14, 6);
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (highLighting && p.phase !== 'protoform') {
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, p.radius * 2.2);
      glow.addColorStop(0, `${accent}72`);
      glow.addColorStop(0.5, `${color}3a`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.phase === 'protoform') {
      const accelScale = 1 + Math.min(0.18, p.distanceTraveled / Math.max(60, p.transformDist) * 0.14);
      ctx.scale(accelScale, 1 / Math.sqrt(accelScale));
      this.drawProtoformBody(ctx, p.speciesId, color, accent, time, p.perfectRelease, p.mega, 'flight');
    } else if (p.phase === 'transforming') {
      // Dramatic Kinetic Velocimorph Metamorphosis: stretch -> shockwave chrysalis -> creature unfold
      const prog = Math.max(0, Math.min(1, (p.distanceTraveled - p.transformDist) / 56));
      const morphScale = 1.0 + prog * 0.44;
      ctx.save();
      // Kinetic speed lines
      ctx.strokeStyle = p.mega ? '#fde047' : '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-26, -10);
      ctx.lineTo(-4, -5);
      ctx.moveTo(-28, 10);
      ctx.lineTo(-4, 5);
      ctx.stroke();

      // Metamorphosis energy ring
      ctx.strokeStyle = p.mega ? '#fde047' : accent;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * (1.25 + prog * 0.45), 0, Math.PI * 2);
      ctx.stroke();

      ctx.scale(morphScale, morphScale);
      if (prog < 0.42) {
        this.drawProtoformBody(ctx, p.speciesId, color, accent, time, true, p.mega);
      } else {
        this.drawTransformedSilhouette(ctx, profile.silhouette, color, accent, p.mega, time);
      }
      ctx.restore();
    } else {
      const scale = p.mega ? 1.28 : p.mode === 'pulse' ? 1.22 : 1.1;
      ctx.scale(scale, scale);
      this.drawTransformedSilhouette(ctx, profile.silhouette, color, accent, p.mega, time);
    }

    ctx.restore();
  }

  private drawSpeciesTrail(
    ctx: CanvasRenderingContext2D,
    p: DuelProjectile,
    trailStyle: SlugCombatProfile['trailStyle'],
    color: string,
    accent: string,
    time: number
  ): void {
    for (let i = 0; i < p.trail.length; i++) {
      const pt = p.trail[i];
      const frac = (i + 1) / p.trail.length;
      ctx.save();
      ctx.globalAlpha = frac * (p.phase === 'transformed' ? 0.62 : 0.34);
      ctx.fillStyle = p.perfectRelease && p.mode !== 'capsule' ? accent : color;
      ctx.strokeStyle = accent;

      if (trailStyle === 'sparks' && i > 0) {
        const prev = p.trail[i - 1];
        const jag = (i % 2 === 0 ? 1 : -1) * 5.2;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo((prev.x + pt.x) * 0.5, (prev.y + pt.y) * 0.5 + jag);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1.5, pt.r * frac * 0.45), 0, Math.PI * 2);
        ctx.fill();
      } else if (trailStyle === 'embers') {
        const r = Math.max(2.2, pt.r * frac * 0.95);
        ctx.fillStyle = i % 2 === 0 ? color : accent;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y - (1 - frac) * 4, r, 0, Math.PI * 2);
        ctx.fill();
        if (i % 2 === 1) {
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y - (1 - frac) * 5, r * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (trailStyle === 'bubbles') {
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(2.5, pt.r * frac * 0.9), 0, Math.PI * 2);
        ctx.stroke();
      } else if (trailStyle === 'halos') {
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(3, pt.r * frac * 1.05), 0, Math.PI * 2);
        ctx.stroke();
      } else if (trailStyle === 'snowflakes' || trailStyle === 'shards') {
        ctx.translate(pt.x, pt.y);
        ctx.rotate(time * 8 + i);
        const s = Math.max(2.6, pt.r * frac * 0.9);
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-s, 0);
        ctx.lineTo(s, 0);
        ctx.moveTo(0, -s);
        ctx.lineTo(0, s);
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.fillRect(-s * 0.45, -s * 0.45, s * 0.9, s * 0.9);
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(2, pt.r * frac), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawProtoformBody(
    ctx: CanvasRenderingContext2D,
    speciesId: string,
    color: string,
    accent: string,
    time: number,
    energized: boolean,
    mega = false,
    mood: SlugAnimationState = 'idle'
  ): void {
    const sheet = getSlugDesignSheet(speciesId);
    const rx = 11.5 * sheet.bodyProportions.widthScale;
    const ry = 7.4 * sheet.bodyProportions.heightScale;
    const wiggle = Math.sin(time * (speciesId === 'tazerling' ? 28 : 22)) * 1.5;
    const outline = energized ? '#ffffff' : mega ? '#fde047' : '#060c14';

    // Priority Trio handcrafted anatomical silhouettes (Infurnus, Frostcrawler, Tazerling)
    if (speciesId === 'infurnus' || speciesId === 'frostcrawler' || speciesId === 'tazerling') {
      if (speciesId === 'infurnus') {
        // Sweeping ember tail
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(-8, 1);
        ctx.quadraticCurveTo(-18, -3 + wiggle, -21, -7 + wiggle);
        ctx.quadraticCurveTo(-17, 1 + wiggle * 0.4, -20, 4 + wiggle);
        ctx.quadraticCurveTo(-13, 6, -7, 4);
        ctx.closePath();
        ctx.fill();

        // Agile tapered body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.quadraticCurveTo(8.5, -8.5, -1, -7.2);
        ctx.quadraticCurveTo(-10, -5.0, -10.5, 2);
        ctx.quadraticCurveTo(-8.5, 7.6, 5, 6.8);
        ctx.quadraticCurveTo(10.8, 5.5, 11, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = outline;
        ctx.lineWidth = mega ? 2.1 : 1.7;
        ctx.stroke();

        // Golden underbelly & rim specular
        ctx.fillStyle = sheet.palette.belly;
        ctx.beginPath();
        ctx.ellipse(2, 3.6, 6.8, 2.7, 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = sheet.palette.highlight;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.ellipse(-1, -4.4, 5.2, 1.8, -0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Stubby grounded feet
        ctx.fillStyle = sheet.palette.secondary;
        ctx.beginPath();
        ctx.ellipse(-4.5, 6.8, 2.6, 1.5, 0, 0, Math.PI * 2);
        ctx.ellipse(5.5, 6.5, 2.7, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3-tongue flickering flame crest
        const fTip = Math.sin(time * 20) * 1.4;
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.moveTo(-4, -6.5);
        ctx.lineTo(-9, -15 + fTip);
        ctx.lineTo(-2, -10.5);
        ctx.lineTo(1.5, -16.5 - fTip * 0.6);
        ctx.lineTo(4.5, -10.2);
        ctx.lineTo(8.5, -13.8 + fTip * 0.5);
        ctx.lineTo(6.5, -5.8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(-1, -6.5);
        ctx.lineTo(1.2, -12.8 - fTip * 0.4);
        ctx.lineTo(4.2, -6.4);
        ctx.closePath();
        ctx.fill();
      } else if (speciesId === 'frostcrawler') {
        // Armored mace tail
        ctx.fillStyle = '#7dd3fc';
        ctx.beginPath();
        ctx.moveTo(-11, 2);
        ctx.lineTo(-19, 1 + wiggle * 0.35);
        ctx.lineTo(-20, 5.5 + wiggle * 0.35);
        ctx.lineTo(-10, 6);
        ctx.closePath();
        ctx.fill();

        // Low, wide hexagonal beetle hull
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(13, 1.5);
        ctx.lineTo(10, -5.5);
        ctx.lineTo(1, -8);
        ctx.lineTo(-9, -6.5);
        ctx.lineTo(-13.5, 1);
        ctx.lineTo(-10.5, 6.6);
        ctx.lineTo(8.5, 6.8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = outline;
        ctx.lineWidth = mega ? 2.1 : 1.75;
        ctx.stroke();

        // Dorsal frost plate & carapace rim
        ctx.fillStyle = sheet.palette.secondary;
        ctx.beginPath();
        ctx.moveTo(7, -4.5);
        ctx.lineTo(0, -7.2);
        ctx.lineTo(-8, -5.4);
        ctx.lineTo(-5, -1.5);
        ctx.lineTo(4, -1.5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = sheet.palette.belly;
        ctx.beginPath();
        ctx.ellipse(0, 4.2, 8.2, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Triple glacial horns
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.moveTo(-4, -7);
        ctx.lineTo(-7, -12.5);
        ctx.lineTo(-1, -7.2);
        ctx.lineTo(1.5, -15.5);
        ctx.lineTo(4.8, -6.8);
        ctx.lineTo(8.5, -11.5);
        ctx.lineTo(7, -5.5);
        ctx.closePath();
        ctx.fill();

        // Heavy clawed legs
        ctx.fillStyle = '#1e40af';
        ctx.fillRect(-7.5, 5.6, 3.8, 2.5);
        ctx.fillRect(3.2, 5.6, 3.8, 2.5);
      } else {
        // Tazerling: forked crackling lightning tail
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(-7, 2);
        ctx.lineTo(-15, -2.5 + wiggle * 0.6);
        ctx.lineTo(-12.5, 1.5);
        ctx.lineTo(-18.5, 4.5 + wiggle * 0.6);
        ctx.lineTo(-7.5, 5);
        ctx.closePath();
        ctx.fill();

        // Lean forward sprinter body with puffed cheek sac
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 9.8, 6.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = outline;
        ctx.lineWidth = mega ? 2.1 : 1.7;
        ctx.stroke();

        // Oversized electric cyan cheek capacitor & bright belly
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(3.8, 2.2, 3.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = sheet.palette.belly;
        ctx.beginPath();
        ctx.ellipse(0.5, 4.0, 5.2, 2.0, 0, 0, Math.PI * 2);
        ctx.fill();

        // Stubby sprinter legs
        ctx.fillStyle = sheet.palette.secondary;
        ctx.beginPath();
        ctx.ellipse(-4.0, 6.3, 2.3, 1.4, 0, 0, Math.PI * 2);
        ctx.ellipse(4.4, 6.3, 2.3, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Twin 3-bend zigzag speed antennae
        const z = Math.sin(time * 28) * 1.1;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(2, -6.5);
        ctx.lineTo(-2.5, -10.5);
        ctx.lineTo(1.5, -12.5);
        ctx.lineTo(-2.5, -16 + z);
        ctx.moveTo(5.5, -5.8);
        ctx.lineTo(2.5, -9.8);
        ctx.lineTo(6, -11.6);
        ctx.lineTo(3, -15 - z);
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(-2.5, -16 + z, 1.5, 0, Math.PI * 2);
        ctx.arc(3, -15 - z, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Megamorph crown
      if (mega) {
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(4, -7.5);
        ctx.lineTo(11, -13);
        ctx.lineTo(7, -5);
        ctx.closePath();
        ctx.fill();
      }

      // Expressive species eye + mood pupil + determined brow / reaction mouth
      const eyeX = speciesId === 'frostcrawler' ? 5.6 : 4.5;
      const eyeY = speciesId === 'frostcrawler' ? -1.4 : -1.8;
      if (mood === 'hit') {
        ctx.strokeStyle = '#060c14';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(eyeX - 2, eyeY - 2);
        ctx.lineTo(eyeX + 2, eyeY + 2);
        ctx.moveTo(eyeX + 2, eyeY - 2);
        ctx.lineTo(eyeX - 2, eyeY + 2);
        ctx.stroke();
      } else if (mood === 'ko') {
        ctx.strokeStyle = '#060c14';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(eyeX - 2.3, eyeY);
        ctx.lineTo(eyeX + 2.3, eyeY);
        ctx.stroke();
      } else {
        ctx.fillStyle = speciesId === 'frostcrawler' ? '#fde047' : '#ffffff';
        ctx.beginPath();
        ctx.ellipse(eyeX, eyeY, speciesId === 'tazerling' ? 3.1 : 2.7, speciesId === 'frostcrawler' ? 2.0 : 2.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#060c14';
        if (speciesId === 'frostcrawler') {
          ctx.fillRect(eyeX + 0.2, eyeY - 1.4, 1.1, 2.8);
        } else {
          ctx.beginPath();
          ctx.arc(eyeX + 0.7, eyeY, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        // Fierce charging brow
        if (energized || mood === 'charge' || mood === 'fire' || mood === 'flight') {
          ctx.strokeStyle = '#060c14';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(eyeX - 2.5, eyeY - 3.6);
          ctx.lineTo(eyeX + 2.5, eyeY - 2.0);
          ctx.stroke();
        }
      }
      return;
    }

    // Tail silhouette per species anatomy
    ctx.fillStyle = accent;
    ctx.beginPath();
    if (speciesId === 'aquabeak' || speciesId === 'bubbaleone') {
      ctx.moveTo(-rx + 2, 0);
      ctx.quadraticCurveTo(-rx - 9, -6 + wiggle * 0.4, -rx - 10, 0);
      ctx.quadraticCurveTo(-rx - 9, 6 + wiggle * 0.4, -rx + 2, 2);
    } else if (speciesId === 'voltrix') {
      ctx.moveTo(-rx + 2, 0);
      ctx.lineTo(-rx - 9, -5 + wiggle * 0.6);
      ctx.lineTo(-rx - 5, 0);
      ctx.lineTo(-rx - 10, 5 + wiggle * 0.6);
    } else if (speciesId === 'armashelt' || speciesId === 'rammstone' || speciesId === 'piroclasto') {
      ctx.moveTo(-rx + 2, -2);
      ctx.lineTo(-rx - 8, -3);
      ctx.lineTo(-rx - 9, 4);
      ctx.lineTo(-rx + 2, 4);
    } else {
      ctx.moveTo(-rx + 2, 0);
      ctx.lineTo(-rx - 7, -4 + wiggle);
      ctx.lineTo(-rx - 7, 4 + wiggle);
    }
    ctx.closePath();
    ctx.fill();

    // Distinct anatomical hull shapes (no generic single oval!)
    ctx.fillStyle = color;
    ctx.strokeStyle = outline;
    ctx.lineWidth = mega ? 2.1 : 1.7;
    if (speciesId === 'armashelt' || speciesId === 'rammstone' || speciesId === 'lariat') {
      drawRoundedBar(ctx, -rx, -ry, rx * 2, ry * 2, 5.5);
      ctx.fill();
      ctx.stroke();
      // Armor seam
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-1, -ry + 1);
      ctx.lineTo(-1, ry - 1);
      ctx.stroke();
    } else if (speciesId === 'piroclasto' || speciesId === 'glaciomita') {
      ctx.beginPath();
      ctx.moveTo(rx + 1, 0);
      ctx.lineTo(rx * 0.45, -ry);
      ctx.lineTo(-rx * 0.65, -ry * 0.85);
      ctx.lineTo(-rx, 0);
      ctx.lineTo(-rx * 0.65, ry * 0.85);
      ctx.lineTo(rx * 0.45, ry);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (speciesId === 'umbrospect') {
      ctx.beginPath();
      ctx.ellipse(1, -0.5, rx * 0.92, ry * 0.96, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Contrasting belly stripe + rim highlight
    ctx.fillStyle = sheet.palette.belly;
    ctx.beginPath();
    ctx.ellipse(1, ry * 0.45, rx * 0.62, ry * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = sheet.palette.highlight;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(-rx * 0.2, -ry * 0.45, rx * 0.45, ry * 0.22, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 1.6;
    switch (speciesId) {
      case 'flaringo':
        ctx.beginPath();
        ctx.moveTo(0, -ry);
        ctx.lineTo(-6, -ry - 8);
        ctx.lineTo(5, -ry - 4);
        ctx.closePath();
        ctx.fill();
        break;
      case 'piroclasto':
        ctx.beginPath();
        ctx.moveTo(-7, -ry + 1);
        ctx.lineTo(-4, -ry - 6);
        ctx.lineTo(3, -ry - 6);
        ctx.lineTo(6, -ry + 1);
        ctx.closePath();
        ctx.fill();
        break;
      case 'aquabeak':
        ctx.beginPath();
        ctx.moveTo(-2, -ry);
        ctx.lineTo(-9, -ry - 6);
        ctx.lineTo(2, -ry + 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(rx - 1, -1);
        ctx.lineTo(rx + 5, 1);
        ctx.lineTo(rx - 1, 3);
        ctx.closePath();
        ctx.fill();
        break;
      case 'voltrix':
        ctx.beginPath();
        ctx.moveTo(4, -ry);
        ctx.lineTo(8, -ry - 7);
        ctx.moveTo(0, -ry);
        ctx.lineTo(-4, -ry - 7);
        ctx.stroke();
        break;
      case 'glaciomita':
        ctx.beginPath();
        ctx.moveTo(-5, -ry + 1);
        ctx.lineTo(-2, -ry - 7);
        ctx.lineTo(2, -ry);
        ctx.lineTo(6, -ry - 6);
        ctx.lineTo(8, -ry + 1);
        ctx.stroke();
        break;
      case 'doc':
        ctx.beginPath();
        ctx.arc(0, -ry - 4, 4.4, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'aetherion':
        ctx.beginPath();
        ctx.arc(0, -ry - 4, 4.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillRect(-1.5, -ry - 9, 3, 3);
        break;
      case 'darkfurnus':
        ctx.beginPath();
        ctx.moveTo(-3, -ry + 1);
        ctx.lineTo(-8, -ry - 7);
        ctx.moveTo(3, -ry + 1);
        ctx.lineTo(8, -ry - 7);
        ctx.stroke();
        break;
      case 'umbrospect':
        ctx.beginPath();
        ctx.arc(2, -ry + 2, 3.2, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'lariat':
        ctx.beginPath();
        ctx.moveTo(4, -ry + 1);
        ctx.lineTo(rx + 2, -ry - 5);
        ctx.lineTo(7, -ry + 2);
        ctx.closePath();
        ctx.fill();
        break;
      case 'musgacorn':
        ctx.beginPath();
        ctx.moveTo(2, -ry + 1);
        ctx.lineTo(6, -ry - 6);
        ctx.moveTo(5, -ry - 3);
        ctx.lineTo(10, -ry - 4);
        ctx.stroke();
        break;
      case 'arachnet':
        ctx.beginPath();
        ctx.moveTo(-4, -ry);
        ctx.lineTo(-9, -ry - 6);
        ctx.moveTo(4, -ry);
        ctx.lineTo(9, -ry - 6);
        ctx.moveTo(-4, ry);
        ctx.lineTo(-9, ry + 5);
        ctx.moveTo(4, ry);
        ctx.lineTo(9, ry + 5);
        ctx.stroke();
        break;
      case 'bubbaleone':
        ctx.beginPath();
        ctx.arc(0, -ry - 3, 4.2, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'rammstone':
        ctx.beginPath();
        ctx.arc(4, -ry - 1, 5.2, Math.PI, Math.PI * 2);
        ctx.stroke();
        break;
      case 'fandango':
        ctx.beginPath();
        ctx.moveTo(2, -ry);
        ctx.lineTo(6, -ry - 7);
        ctx.lineTo(9, -ry);
        ctx.closePath();
        ctx.fill();
        break;
      case 'armashelt':
        ctx.beginPath();
        ctx.arc(0, -1, rx + 1.4, Math.PI, 0);
        ctx.stroke();
        break;
      case 'enigmo':
      default:
        ctx.beginPath();
        ctx.moveTo(3, -ry + 1);
        ctx.lineTo(6, -ry - 6);
        ctx.moveTo(-1, -ry + 1);
        ctx.lineTo(-3, -ry - 6);
        ctx.stroke();
        break;
    }

    if (mega) {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(5, -ry);
      ctx.lineTo(12, -ry - 5);
      ctx.lineTo(8, -ry + 2);
      ctx.closePath();
      ctx.fill();
    }

    // Eye & Ghoul Fangs
    const isGhoul = speciesId === 'darkfurnus' || speciesId === 'umbrospect';
    ctx.fillStyle = isGhoul ? '#ef4444' : '#ffffff';
    ctx.beginPath();
    ctx.arc(rx * 0.42, -2, speciesId === 'doc' || speciesId === 'enigmo' ? 3.4 : 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = sheet.palette.eyeIris === '#fef08a' ? '#0f172a' : '#060c14';
    ctx.beginPath();
    ctx.arc(rx * 0.48, -2, 1.4, 0, Math.PI * 2);
    ctx.fill();
    if (isGhoul) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(rx * 0.45, 2);
      ctx.lineTo(rx * 0.55, 5);
      ctx.lineTo(rx * 0.65, 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawTransformedSilhouette(
    ctx: CanvasRenderingContext2D,
    silhouette: TransformSilhouette,
    color: string,
    accent: string,
    mega: boolean,
    time: number
  ): void {
    const flap = Math.sin(time * 26) * 4.5;

    if (mega) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-12, -17);
      ctx.lineTo(22, 0);
      ctx.lineTo(-12, 17);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(Math.cos(time * 12) * 18, Math.sin(time * 12) * 18, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    switch (silhouette) {
      case 'phoenix_flame': {
        // Infurnus Velocimorph (Ref 1): arched fire drake with curved ram horns, flared flame wings & clawed legs
        const plume = Math.sin(time * 28) * 3;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(28, -2);
        ctx.quadraticCurveTo(14, -14, -4, -22 + flap);
        ctx.lineTo(-17, -14 + flap * 0.5);
        ctx.lineTo(-27, -6 + plume);
        ctx.lineTo(-19, 1);
        ctx.lineTo(-27, 8 - plume);
        ctx.lineTo(-15, 13 - flap * 0.4);
        ctx.lineTo(-2, 20 - flap);
        ctx.quadraticCurveTo(15, 11, 28, -2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        // Curved golden ram horns & clawed forelimbs
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(13, -7, 6, Math.PI * 0.9, Math.PI * 2.1);
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-3, -11 + flap * 0.5);
        ctx.lineTo(-14, 0);
        ctx.lineTo(-3, 11 - flap * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.ellipse(6, 0, 7.5, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'crimson_falcon': {
        // Flaringo: fiery crested raptor with trailing ember pinions & sharp beak
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.lineTo(7, -8);
        ctx.lineTo(-4, -18 + flap * 0.8);
        ctx.lineTo(-22, -6);
        ctx.lineTo(-12, 0);
        ctx.lineTo(-22, 6);
        ctx.lineTo(-4, 18 - flap * 0.8);
        ctx.lineTo(7, 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.lineTo(16, -4);
        ctx.lineTo(16, 4);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'hydro_serpent': {
        // Aquabeak (Ref 1): streamlined sea serpent with dual glowing pink/cyan wing-fins & hooked foreclaw
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.quadraticCurveTo(6, -15, -22, -7);
        ctx.lineTo(-14, 0);
        ctx.lineTo(-22, 7);
        ctx.quadraticCurveTo(6, 15, 26, 0);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        // Fin spots + sharp beak + claw
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(-8, -7 + flap * 0.3, 2.4, 0, Math.PI * 2);
        ctx.arc(-8, 7 - flap * 0.3, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.lineTo(17, -4);
        ctx.lineTo(17, 4);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'volt_bolt': {
        // Tazerling Velocimorph (Ref 1): crackling lightning creature with spiked fin crest & bright plasma arcs
        const zap = Math.sin(time * 32) * 2.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(28, 0);
        ctx.lineTo(8, -14);
        ctx.lineTo(11, -5);
        ctx.lineTo(-10, -17 + zap * 0.4);
        ctx.lineTo(-14, -5);
        ctx.lineTo(-26, -11 - zap);
        ctx.lineTo(-15, 0);
        ctx.lineTo(-26, 11 + zap);
        ctx.lineTo(-14, 5);
        ctx.lineTo(-10, 17 - zap * 0.4);
        ctx.lineTo(11, 5);
        ctx.lineTo(8, 14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.ellipse(5, 0, 8.5, 3.8, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'rail_viper': {
        // Voltrix: sleek twin-prong plasma viper
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(28, 0);
        ctx.lineTo(5, -8);
        ctx.lineTo(-20, -11);
        ctx.lineTo(-12, 0);
        ctx.lineTo(-20, 11);
        ctx.lineTo(5, 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = '#93c5fd';
        ctx.beginPath();
        ctx.arc(-2, 0, 9.5, -1.2, 1.2);
        ctx.stroke();
        break;
      }
      case 'cryo_drill': {
        // Frostcrawler Velocimorph (Ref 1): armored ice beast with serrated dorsal spines & spiral drill jaw
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(29, 0);
        ctx.lineTo(4, -13);
        ctx.lineTo(-11, -17);
        ctx.lineTo(-20, -10);
        ctx.lineTo(-20, 10);
        ctx.lineTo(-11, 17);
        ctx.lineTo(4, 13);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.fillStyle = '#1e40af';
        ctx.beginPath();
        ctx.ellipse(-6, 0, 8.5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 1.9;
        const fluteShift = Math.sin(time * 24) * 3;
        ctx.beginPath();
        ctx.moveTo(19, -4 + fluteShift * 0.25);
        ctx.lineTo(12, 5 + fluteShift * 0.25);
        ctx.moveTo(10, -7 + fluteShift * 0.25);
        ctx.lineTo(3, 8 + fluteShift * 0.25);
        ctx.moveTo(1, -9 + fluteShift * 0.25);
        ctx.lineTo(-5, 9 + fluteShift * 0.25);
        ctx.stroke();
        break;
      }
      case 'glacier_lance': {
        // Glaciomita: razor faceted crystal lance
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(29, 0);
        ctx.lineTo(1, -11);
        ctx.lineTo(-19, -6);
        ctx.lineTo(-14, 0);
        ctx.lineTo(-19, 6);
        ctx.lineTo(1, 11);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
      case 'seraph_prism': {
        // Doc: 4-winged luminous healing seraph
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(0, -18 + flap * 0.5);
        ctx.lineTo(-17, -7);
        ctx.lineTo(-17, 7);
        ctx.lineTo(0, 18 - flap * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.strokeStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(-6, 0, 12.5, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'celestial_nova': {
        // Aetherion: harmonic star core with orbital aura ring
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(23, 0);
        ctx.lineTo(2, -15);
        ctx.lineTo(-16, -8);
        ctx.lineTo(-16, 8);
        ctx.lineTo(2, 15);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.strokeStyle = '#5eead4';
        ctx.beginPath();
        ctx.ellipse(0, 0, 19, 7.5, time * 4, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'terra_rhino': {
        // Lariat: heavy basalt horned ram
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(-1, 0, 14.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.moveTo(26, -2);
        ctx.lineTo(10, -9);
        ctx.lineTo(10, 5);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'magma_meteor': {
        // Piroclasto: volcanic obsidian boulder comet with glowing magma seams
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(10, -14);
        ctx.lineTo(-12, -15);
        ctx.lineTo(-18, 0);
        ctx.lineTo(-12, 15);
        ctx.lineTo(10, 14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        break;
      }
      case 'abyss_wyvern': {
        // Darkfurnus (Ref 1 Ghoul wyvern): horned shadow drake with jagged crimson wings, bared fangs & smoky trail
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(25, 1);
        ctx.lineTo(12, -11);
        ctx.lineTo(1, -17);
        ctx.lineTo(-21, -12 + flap * 0.65);
        ctx.lineTo(-12, 0);
        ctx.lineTo(-21, 12 - flap * 0.65);
        ctx.lineTo(1, 17);
        ctx.lineTo(14, 9);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.1;
        ctx.stroke();
        // Bared Ghoul fangs
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(19, 3);
        ctx.lineTo(16, 7);
        ctx.lineTo(13, 3);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'void_wraith': {
        // Umbrospect (Ref 1 Ghoul wraith): glowing green-teal ectoplasm spines + ragged phantom cloak
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(0, -14);
        ctx.lineTo(-21, -9 + flap * 0.55);
        ctx.lineTo(-14, -3);
        ctx.lineTo(-22, 0);
        ctx.lineTo(-14, 3);
        ctx.lineTo(-21, 9 - flap * 0.55);
        ctx.lineTo(0, 14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2dd4bf';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
      case 'astral_eye': {
        // Enigmo: psychic orb with hovering tri-tentacles
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(3, 0, 14.5, 11.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-10, -7);
        ctx.lineTo(-24, -13 + flap * 0.4);
        ctx.moveTo(-11, 0);
        ctx.lineTo(-25, flap * 0.2);
        ctx.moveTo(-10, 7);
        ctx.lineTo(-24, 13 - flap * 0.4);
        ctx.stroke();
        break;
      }
      case 'arachnid_spinner': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(2, 0, 12.5, 9.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, -7);
        ctx.lineTo(-4, -18 + flap * 0.4);
        ctx.moveTo(-4, -7);
        ctx.lineTo(-15, -17 - flap * 0.3);
        ctx.moveTo(4, 7);
        ctx.lineTo(-4, 18 - flap * 0.4);
        ctx.moveTo(-4, 7);
        ctx.lineTo(-15, 17 + flap * 0.3);
        ctx.stroke();
        break;
      }
      case 'bubble_dome': {
        ctx.fillStyle = `${color}aa`;
        ctx.beginPath();
        ctx.arc(0, 0, 16.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#cffafe';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-5, -6, 3.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'granite_ram': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(25, 0);
        ctx.lineTo(10, -15);
        ctx.lineTo(-15, -13);
        ctx.lineTo(-19, 0);
        ctx.lineTo(-15, 13);
        ctx.lineTo(10, 15);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 2.3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(10, -11, 7.5, Math.PI * 0.6, Math.PI * 1.9);
        ctx.stroke();
        break;
      }
      case 'kinetic_orb': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(23, 0);
        ctx.lineTo(4, -11.5);
        ctx.lineTo(-17, -6);
        ctx.lineTo(-17, 6);
        ctx.lineTo(4, 11.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(4, 0, 5.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'armored_shell': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(25, 0);
        ctx.lineTo(12, -13.5);
        ctx.lineTo(-13, -14.5);
        ctx.lineTo(-21, 0);
        ctx.lineTo(-13, 14.5);
        ctx.lineTo(12, 13.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fed7aa';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(2, -13.5);
        ctx.lineTo(2, 13.5);
        ctx.moveTo(-7, -12.5);
        ctx.lineTo(-7, 12.5);
        ctx.stroke();
        break;
      }
      case 'thorn_stag':
      default: {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(2, 0, 14.5, 10.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, -8);
        ctx.lineTo(15, -16);
        ctx.moveTo(11, -12);
        ctx.lineTo(19, -12);
        ctx.moveTo(8, 8);
        ctx.lineTo(15, 16);
        ctx.stroke();
        break;
      }
    }

    // Glowing transformed eye (red iris on Ghoul silhouettes)
    const isGhoulForm = silhouette === 'abyss_wyvern' || silhouette === 'void_wraith';
    ctx.fillStyle = isGhoulForm ? '#ef4444' : '#ffffff';
    ctx.beginPath();
    ctx.arc(10, -2, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawOutcomeBanner(
    ctx: CanvasRenderingContext2D,
    battle: BattleState,
    time: number
  ): void {
    const title =
      battle.outcome === 'victory'
        ? '¡VICTORIA EN EL DUELO!'
        : battle.outcome === 'captured'
        ? '¡BABOSA CAPTURADA!'
        : battle.outcome === 'escaped'
        ? 'RETIRADA SEGURA'
        : 'EQUIPO RETIRADO AL REFUGIO';
    const color =
      battle.outcome === 'victory'
        ? '#5eead4'
        : battle.outcome === 'captured'
        ? '#4ade80'
        : battle.outcome === 'escaped'
        ? '#38bdf8'
        : '#f87171';

    ctx.save();
    ctx.fillStyle = 'rgba(4, 9, 16, 0.56)';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    const pulse = 1 + Math.sin(time * 5) * 0.025;
    ctx.translate(ARENA_WIDTH / 2, ARENA_HEIGHT * 0.44);
    ctx.scale(pulse, pulse);

    ctx.fillStyle = 'rgba(10, 22, 36, 0.92)';
    drawRoundedBar(ctx, -230, -42, 460, 84, 16);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = '900 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(title, 0, -2);

    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = '#e2f1f6';
    ctx.fillText(battle.subtitle, 0, 24);
    ctx.restore();
  }
}
