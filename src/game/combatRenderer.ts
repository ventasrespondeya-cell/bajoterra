import {
  ARENA_FLOOR_Y,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  PLAYER_MAX_X,
  buildArenaForBiome,
} from './combatArenas';
import { CombatManager } from './combat';
import { ELEMENT_CHART, getSpecies } from './data';
import { getSlugCombatProfile, type SlugCombatProfile, type TransformSilhouette } from './slugCombatProfiles';
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

  private updateParticles(battle: BattleState, highLighting: boolean): void {
    if (this.lastBattleRef !== battle || battle.elapsedSec < this.lastElapsed) {
      this.resetTracking(battle);
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
    const time = battle.elapsedSec;
    const ally = state.party[state.activePartyIndex] || state.party[0];
    const allySpecies = getSpecies(ally.id);
    const allyElColor = ELEMENT_CHART[ally.type]?.color || '#38bdf8';
    const enemyElColor = ELEMENT_CHART[battle.enemy.type]?.color || '#f43f5e';

    this.updateParticles(battle, highLighting);

    ctx.save();
    // Bounded camera shake on heavy impacts
    if (battle.cameraShake > 0.25) {
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
      ally.name,
      allyElColor,
      allySpecies.accent,
      ally.mega,
      time,
      highLighting
    );
    this.drawEnemyDuelist(ctx, battle, enemyElColor, time, highLighting);

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

    // 9. Floating Damage / Status Callouts
    const recentEffects = battle.effects.slice(-4);
    recentEffects.forEach((ef, idx) => {
      const ex = ef.x ?? (ef.target === 'enemy' ? battle.enemyDuelist.x : battle.playerDuelist.x);
      const ey = (ef.y ?? 200) - idx * 14;
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
    ctx.fillStyle = biome === 'Heladas' ? '#0b2234' : biome === 'Magma' ? '#170705' : '#070b14';
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
      // Glowing molten lava pools under floor edge
      ctx.fillStyle = '#ea580c';
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 3.2);
      ctx.fillRect(0, ARENA_FLOOR_Y + 18, ARENA_WIDTH, 10);
    } else if (biome === 'Heladas') {
      // Specular ice gleam stripes
      ctx.fillStyle = '#bae6fd';
      ctx.globalAlpha = 0.16;
      for (let i = 0; i < 6; i++) {
        const gx = 70 + i * 150;
        ctx.fillRect(gx, ARENA_FLOOR_Y + 8, 52, 4);
      }
    } else if (biome === 'Verdes') {
      // Glowing moss patches
      ctx.fillStyle = glowColor;
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.ellipse(90 + i * 128, ARENA_FLOOR_Y + 12, 34, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (highLighting) {
      // Shadow rune tiles
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

      // Biome detail on cover pillar
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
    highLighting: boolean
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

    // Flowing Lancer scarf behind shoulders
    const scarfWave = Math.sin(time * (moving ? 18 : 5)) * (moving ? 6 : 2.5);
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.moveTo(-12, -11);
    ctx.lineTo(-27 - (moving ? 6 : 0), -8 + scarfWave);
    ctx.lineTo(-24 - (moving ? 5 : 0), -1 + scarfWave);
    ctx.lineTo(-12, -4);
    ctx.closePath();
    ctx.fill();

    // Animated legs when moving
    const stride = moving ? Math.sin(time * 18) * 6 : 0;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-10 + stride * 0.5, 18, 6, 9);
    ctx.fillRect(0 - stride * 0.5, 18, 6, 9);

    // Lancer torso
    const flash = pd.hitFlash > 0;
    ctx.fillStyle = flash ? '#fca5a5' : '#0f172a';
    drawRoundedBar(ctx, -16, -12, 26, 32, 8);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Chest core emblem
    ctx.fillStyle = elColor;
    ctx.beginPath();
    ctx.arc(-3, 2, 3.8, 0, Math.PI * 2);
    ctx.fill();

    // Lancer head & glowing goggles
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-2, -21, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2dd4bf';
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, -24, 10, 4.5);
    ctx.restore();

    // Articulated 360° Slug Blaster
    ctx.save();
    ctx.rotate(pd.aimAngle);
    const recoilOffset = -pd.recoil * 42;
    ctx.translate(recoilOffset, 0);

    // Blaster casing & twin accelerator rails
    ctx.fillStyle = '#1e293b';
    drawRoundedBar(ctx, -5, -9.5, 38, 19, 5);
    ctx.fill();
    ctx.strokeStyle = mega ? '#fde047' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

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
    const chamberPulse = pd.charging ? 0.56 + Math.sin(time * 24) * 0.08 * pd.charge : 0.55;
    ctx.scale(chamberPulse, chamberPulse);
    this.drawProtoformBody(ctx, speciesId, elColor, accentColor, time, pd.charging, mega);
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
    highLighting: boolean
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
      ctx.fillStyle = ed.hitFlash > 0 ? '#fecaca' : isBoss ? '#3b0764' : '#1f1635';
      drawRoundedBar(ctx, -18, -20, 36, 44, 10);
      ctx.fill();
      ctx.strokeStyle = isBoss ? '#f43f5e' : '#c084fc';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      ctx.fillStyle = isBoss ? '#fb7185' : '#a855f7';
      ctx.beginPath();
      ctx.arc(0, -26, isBoss ? 14 : 11, 0, Math.PI * 2);
      ctx.fill();

      // Visor eyes
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-10, -28, 8, 4);

      ctx.save();
      ctx.rotate(ed.aimAngle);
      ctx.translate(-ed.recoil * 34, 0);
      ctx.fillStyle = '#0f172a';
      drawRoundedBar(ctx, -4, -8.5, 34, 17, 4);
      ctx.fill();
      ctx.strokeStyle = elColor;
      ctx.stroke();
      ctx.fillStyle = elColor;
      ctx.beginPath();
      ctx.arc(10, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      const squash = 1 + Math.sin(time * 6) * 0.04;
      ctx.scale(-1.72 * squash, 1.72 / squash);
      if (ed.hitFlash > 0) {
        ctx.fillStyle = '#fecaca';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        this.drawProtoformBody(ctx, enemy.id, sp.color, sp.accent, time, enemy.telegraphing === 'heavy', enemy.mega);
      }
      ctx.restore();
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
      this.drawProtoformBody(ctx, p.speciesId, color, accent, time, p.perfectRelease, p.mega);
    } else if (p.phase === 'transforming') {
      // Dramatic Velocimorph metamorphosis flash
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 1.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.scale(1.36, 1.36);
      this.drawTransformedSilhouette(ctx, profile.silhouette, color, accent, p.mega, time);
      ctx.restore();
    } else {
      const scale = p.mega ? 1.26 : p.mode === 'pulse' ? 1.22 : 1.08;
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
      ctx.globalAlpha = frac * (p.phase === 'transformed' ? 0.54 : 0.28);
      ctx.fillStyle = p.perfectRelease && p.mode !== 'capsule' ? accent : color;
      ctx.strokeStyle = accent;

      if (trailStyle === 'sparks' && i > 0) {
        const prev = p.trail[i - 1];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y + ((i % 2 === 0 ? 1 : -1) * 4));
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
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
        const s = Math.max(2.5, pt.r * frac * 0.85);
        ctx.fillRect(-s, -s * 0.5, s * 2, s);
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
    mega = false
  ): void {
    const wiggle = Math.sin(time * 24) * 1.4;
    // Expressive tail
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-16, -4 + wiggle);
    ctx.lineTo(-16, 4 + wiggle);
    ctx.closePath();
    ctx.fill();

    // Main Bajoterra slug body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = energized ? '#ffffff' : mega ? '#fde047' : accent;
    ctx.lineWidth = mega ? 2 : 1.6;
    ctx.stroke();

    // Distinct anatomical features for ALL 15 species
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 1.6;
    switch (speciesId) {
      case 'infurnus':
        ctx.beginPath();
        ctx.moveTo(-2, -6);
        ctx.lineTo(-8, -13);
        ctx.lineTo(3, -8);
        ctx.closePath();
        ctx.fill();
        break;
      case 'flaringo':
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(-5, -13);
        ctx.lineTo(5, -10);
        ctx.closePath();
        ctx.fill();
        break;
      case 'piroclasto':
        ctx.beginPath();
        ctx.moveTo(-6, -6);
        ctx.lineTo(-3, -12);
        ctx.lineTo(2, -12);
        ctx.lineTo(5, -6);
        ctx.closePath();
        ctx.fill();
        break;
      case 'aquabeak':
        ctx.beginPath();
        ctx.moveTo(-2, -7);
        ctx.lineTo(-9, -12);
        ctx.lineTo(-6, -5);
        ctx.closePath();
        ctx.fill();
        break;
      case 'tazerling':
        ctx.beginPath();
        ctx.moveTo(2, -6);
        ctx.lineTo(-4, -12);
        ctx.lineTo(0, -12);
        ctx.lineTo(-5, -16);
        ctx.stroke();
        break;
      case 'voltrix':
        ctx.beginPath();
        ctx.moveTo(4, -6);
        ctx.lineTo(8, -13);
        ctx.moveTo(1, -6);
        ctx.lineTo(-3, -13);
        ctx.stroke();
        break;
      case 'frostcrawler':
        ctx.beginPath();
        ctx.moveTo(-3, -7);
        ctx.lineTo(0, -14);
        ctx.lineTo(4, -7);
        ctx.fill();
        break;
      case 'glaciomita':
        ctx.beginPath();
        ctx.moveTo(-4, -6);
        ctx.lineTo(-1, -13);
        ctx.lineTo(2, -7);
        ctx.lineTo(6, -12);
        ctx.lineTo(7, -6);
        ctx.stroke();
        break;
      case 'doc':
        ctx.beginPath();
        ctx.arc(0, -10, 4.2, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'aetherion':
        ctx.beginPath();
        ctx.arc(0, -10, 4.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillRect(-1.5, -15, 3, 3);
        break;
      case 'darkfurnus':
        ctx.beginPath();
        ctx.moveTo(-3, -6);
        ctx.lineTo(-7, -13);
        ctx.moveTo(3, -6);
        ctx.lineTo(7, -13);
        ctx.stroke();
        break;
      case 'umbrospect':
        ctx.beginPath();
        ctx.arc(0, -2, 3.2, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'lariat':
        ctx.beginPath();
        ctx.moveTo(4, -6);
        ctx.lineTo(11, -11);
        ctx.lineTo(7, -5);
        ctx.closePath();
        ctx.fill();
        break;
      case 'musgacorn':
        ctx.beginPath();
        ctx.moveTo(3, -6);
        ctx.lineTo(7, -12);
        ctx.moveTo(5, -9);
        ctx.lineTo(9, -10);
        ctx.stroke();
        break;
      case 'enigmo':
      default:
        ctx.beginPath();
        ctx.moveTo(3, -6);
        ctx.lineTo(6, -12);
        ctx.moveTo(-1, -6);
        ctx.lineTo(-3, -12);
        ctx.stroke();
        break;
    }

    // Megamorph golden brow crest
    if (mega) {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(6, -7);
      ctx.lineTo(12, -11);
      ctx.lineTo(9, -5);
      ctx.closePath();
      ctx.fill();
    }

    // Expressive eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(5, -2, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(5.8, -2, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawTransformedSilhouette(
    ctx: CanvasRenderingContext2D,
    silhouette: TransformSilhouette,
    color: string,
    accent: string,
    mega: boolean,
    time: number
  ): void {
    const flap = Math.sin(time * 26) * 4;

    if (mega) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-10, -16);
      ctx.lineTo(19, 0);
      ctx.lineTo(-10, 16);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(Math.cos(time * 12) * 16, Math.sin(time * 12) * 16, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    switch (silhouette) {
      case 'phoenix_flame':
      case 'crimson_falcon': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(23, 0);
        ctx.lineTo(-7, -16 + flap);
        ctx.lineTo(-18, -5);
        ctx.lineTo(-11, 0);
        ctx.lineTo(-18, 5);
        ctx.lineTo(-7, 16 - flap);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
      case 'hydro_serpent': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(23, 0);
        ctx.quadraticCurveTo(4, -13, -19, -6);
        ctx.lineTo(-12, 0);
        ctx.lineTo(-19, 6);
        ctx.quadraticCurveTo(4, 13, 23, 0);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        break;
      }
      case 'volt_bolt':
      case 'rail_viper': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(25, 0);
        ctx.lineTo(4, -10);
        ctx.lineTo(8, -4);
        ctx.lineTo(-19, -12);
        ctx.lineTo(-11, 0);
        ctx.lineTo(-19, 12);
        ctx.lineTo(8, 4);
        ctx.lineTo(4, 10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
      case 'cryo_drill':
      case 'glacier_lance': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.lineTo(-4, -12);
        ctx.lineTo(-18, -8);
        ctx.lineTo(-18, 8);
        ctx.lineTo(-4, 12);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        break;
      }
      case 'seraph_prism':
      case 'celestial_nova': {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(21, 0);
        ctx.lineTo(-2, -16 + flap * 0.5);
        ctx.lineTo(-15, -6);
        ctx.lineTo(-15, 6);
        ctx.lineTo(-2, 16 - flap * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        break;
      }
      case 'terra_rhino':
      case 'magma_meteor': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(23, -2);
        ctx.lineTo(10, -8);
        ctx.lineTo(10, 4);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'abyss_wyvern':
      case 'void_wraith': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(0, -14);
        ctx.lineTo(-18, -10 + flap * 0.6);
        ctx.lineTo(-11, 0);
        ctx.lineTo(-18, 10 - flap * 0.6);
        ctx.lineTo(0, 14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#f5d0fe';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        break;
      }
      case 'astral_eye':
      case 'thorn_stag':
      default: {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(2, 0, 15, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-10, -7);
        ctx.lineTo(-22, -13);
        ctx.moveTo(-10, 7);
        ctx.lineTo(-22, 13);
        ctx.stroke();
        break;
      }
    }

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(9, -2, 2.6, 0, Math.PI * 2);
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
