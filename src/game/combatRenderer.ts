import {
  ARENA_FLOOR_Y,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  buildArenaForBiome,
} from './combatArenas';
import { CombatManager } from './combat';
import { ELEMENT_CHART, getSpecies } from './data';
import { getSlugCombatProfile, type TransformSilhouette } from './slugCombatProfiles';
import type {
  BattleState,
  DuelArenaObstacle,
  DuelProjectile,
  GameOptions,
  GameState,
} from './types';

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

    ctx.save();
    // Subtle camera shake on big collisions
    if (battle.cameraShake > 0.2) {
      const sx = (Math.random() - 0.5) * battle.cameraShake;
      const sy = (Math.random() - 0.5) * battle.cameraShake;
      ctx.translate(sx, sy);
    }

    // 1. Background sky & subterranean cavern layers
    const bgGrad = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
    bgGrad.addColorStop(0, theme.skyTop);
    bgGrad.addColorStop(0.75, theme.skyBottom);
    bgGrad.addColorStop(1, '#05080f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Parallax cave arches & stalactites
    this.drawCavernBackdrop(ctx, theme, time, highLighting);

    // 2. Arena Floor
    const floorGrad = ctx.createLinearGradient(0, ARENA_FLOOR_Y, 0, ARENA_HEIGHT);
    floorGrad.addColorStop(0, theme.floorTop);
    floorGrad.addColorStop(1, theme.floorBottom);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, ARENA_FLOOR_Y, ARENA_WIDTH, ARENA_HEIGHT - ARENA_FLOOR_Y);
    ctx.fillStyle = theme.glowColor;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(0, ARENA_FLOOR_Y, ARENA_WIDTH, 3);
    ctx.globalAlpha = 1;

    // 3. Interactive Obstacles & Biome Mechanisms
    for (const obs of battle.obstacles) {
      this.drawObstacle(ctx, obs, theme.glowColor, time, highLighting);
    }

    // 4. Predicted Blaster Aim Trajectory & Transform Threshold Node
    if (battle.turn === 'duel') {
      const preview = combat.computeTrajectoryPreview(state);
      this.drawTrajectoryPreview(ctx, preview, allyElColor, battle.playerDuelist.charging, battle.playerDuelist.charge);
    }

    // 5. Duelists & Blasters
    this.drawPlayerDuelist(ctx, battle, ally.name, allyElColor, ally.mega, time, highLighting);
    this.drawEnemyDuelist(ctx, battle, enemyElColor, time, highLighting);

    // 6. Active Flying Projectiles (Protoform -> Velocimorph Transformed Slugs -> Capsules)
    for (const proj of battle.projectiles) {
      this.drawProjectile(ctx, proj, time, highLighting);
    }

    // 7. Shockwaves & Transformation Rings
    for (const sw of battle.shockwaves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, sw.alpha));
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.kind === 'clash' || sw.kind === 'transform' ? 3.5 : 2.5;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (sw.kind === 'transform' || sw.kind === 'clash') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius * 0.72, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (sw.label) {
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#040910';
        ctx.fillText(sw.label, sw.x + 1, sw.y - sw.radius * 0.65 + 1);
        ctx.fillStyle = sw.color;
        ctx.fillText(sw.label, sw.x, sw.y - sw.radius * 0.65);
      }
      ctx.restore();
    }

    // 8. Floating Damage / Status Callouts
    const recentEffects = battle.effects.slice(-5);
    recentEffects.forEach((ef, idx) => {
      const ex = ef.x ?? (ef.target === 'enemy' ? battle.enemyDuelist.x : battle.playerDuelist.x);
      const ey = (ef.y ?? 210) - idx * 14;
      ctx.save();
      ctx.font = '800 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(3, 7, 14, 0.85)';
      ctx.fillText(ef.text, ex + 1.5, ey + 1.5);
      ctx.fillStyle = ef.color;
      ctx.fillText(ef.text, ex, ey);
      ctx.restore();
    });

    // Subtle biome title pill in top-center of stage
    ctx.save();
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
    ctx.fillText(
      `${theme.title.toUpperCase()} · ${allySpecies.name.toUpperCase()} VS ${battle.enemy.name.toUpperCase()}`,
      ARENA_WIDTH / 2,
      24
    );
    ctx.restore();

    ctx.restore();
  }

  private drawCavernBackdrop(
    ctx: CanvasRenderingContext2D,
    theme: ReturnType<typeof buildArenaForBiome>,
    time: number,
    highLighting: boolean
  ): void {
    // Back cavern ridge
    ctx.fillStyle = theme.caveMid;
    ctx.beginPath();
    ctx.moveTo(0, ARENA_FLOOR_Y);
    for (let x = 0; x <= ARENA_WIDTH; x += 46) {
      const h = 110 + Math.sin(x * 0.015 + 1.2) * 42 + Math.cos(x * 0.032) * 24;
      ctx.lineTo(x, ARENA_FLOOR_Y - h);
    }
    ctx.lineTo(ARENA_WIDTH, ARENA_FLOOR_Y);
    ctx.closePath();
    ctx.fill();

    // Ceiling stalactites
    ctx.fillStyle = '#070b14';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= ARENA_WIDTH; x += 38) {
      const spike = 24 + ((x * 17) % 34);
      ctx.lineTo(x, spike);
    }
    ctx.lineTo(ARENA_WIDTH, 0);
    ctx.closePath();
    ctx.fill();

    // Ambient glowing biome motes
    const moteCount = highLighting ? 18 : 7;
    for (let i = 0; i < moteCount; i++) {
      const mx = ((i * 97 + time * (12 + (i % 4) * 5)) % (ARENA_WIDTH - 40)) + 20;
      const my = 80 + ((i * 53 + Math.sin(time * 1.4 + i) * 24 + 280) % 310);
      const r = 1.6 + (i % 3) * 0.9;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 2.5 + i);
      ctx.fillStyle = theme.ambientSparkColor;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawObstacle(
    ctx: CanvasRenderingContext2D,
    obs: DuelArenaObstacle,
    biomeGlow: string,
    time: number,
    highLighting: boolean
  ): void {
    ctx.save();
    if (obs.kind === 'cover') {
      const grad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.w, obs.y + obs.h);
      grad.addColorStop(0, '#475569');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      drawRoundedBar(ctx, obs.x, obs.y, obs.w, obs.h, 8);
      ctx.fill();
      ctx.strokeStyle = biomeGlow;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Integrity bar if damaged
      if (obs.hp !== undefined && obs.maxHp && obs.hp < obs.maxHp) {
        const pct = Math.max(0, obs.hp / obs.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(obs.x + 4, obs.y - 9, obs.w - 8, 5);
        ctx.fillStyle = pct > 0.45 ? '#38bdf8' : '#f59e0b';
        ctx.fillRect(obs.x + 4, obs.y - 9, (obs.w - 8) * pct, 5);
      }
    } else if (obs.kind === 'reflector') {
      const rGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.w, obs.y);
      rGrad.addColorStop(0, '#0ea5e9');
      rGrad.addColorStop(0.5, '#67e8f9');
      rGrad.addColorStop(1, '#0ea5e9');
      ctx.fillStyle = rGrad;
      drawRoundedBar(ctx, obs.x, obs.y, obs.w, obs.h, 10);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (obs.kind === 'updraft') {
      const uGrad = ctx.createLinearGradient(obs.x, obs.y + obs.h, obs.x, obs.y);
      uGrad.addColorStop(0, 'rgba(251, 146, 60, 0.34)');
      uGrad.addColorStop(1, 'rgba(251, 146, 60, 0.02)');
      ctx.fillStyle = uGrad;
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeStyle = 'rgba(253, 186, 116, 0.55)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const cy = obs.y + obs.h - (((time * 68 + i * 75) % obs.h));
        ctx.beginPath();
        ctx.moveTo(obs.x + 14, cy + 8);
        ctx.lineTo(obs.x + obs.w / 2, cy - 4);
        ctx.lineTo(obs.x + obs.w - 14, cy + 8);
        ctx.stroke();
      }
    } else if (obs.kind === 'boost_ring') {
      const cx = obs.x + obs.w / 2;
      const cy = obs.y + obs.h / 2;
      const rx = obs.w * 0.45;
      const ry = obs.h * 0.46;
      if (highLighting) {
        ctx.globalAlpha = 0.28 + 0.12 * Math.sin(time * 4);
        ctx.fillStyle = '#2dd4bf';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx + 8, ry + 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTrajectoryPreview(
    ctx: CanvasRenderingContext2D,
    preview: { points: Array<{ x: number; y: number }>; transformPoint: { x: number; y: number } | null },
    elColor: string,
    charging: boolean,
    charge: number
  ): void {
    if (preview.points.length < 2) return;
    ctx.save();
    for (let i = 1; i < preview.points.length; i++) {
      const pt = preview.points[i];
      const alpha = (1 - i / preview.points.length) * (charging ? 0.85 : 0.48);
      ctx.fillStyle = charging && charge >= 0.62 && charge <= 0.88 ? '#fde047' : elColor;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, charging ? 3.2 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (preview.transformPoint) {
      const tp = preview.transformPoint;
      ctx.globalAlpha = 0.92;
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
    slugName: string,
    elColor: string,
    mega: boolean,
    time: number,
    highLighting: boolean
  ): void {
    const pd = battle.playerDuelist;
    ctx.save();
    ctx.translate(pd.x, pd.y);

    // Hit flash tint
    const flash = pd.hitFlash > 0;
    // Lancer platform glow
    if (highLighting) {
      const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, 48);
      aura.addColorStop(0, `${elColor}44`);
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lancer torso & goggles silhouette
    ctx.fillStyle = flash ? '#fca5a5' : '#0f172a';
    drawRoundedBar(ctx, -18, -14, 28, 36, 9);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Lancer helmet / goggles
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-4, -22, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2dd4bf';
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-1, -26, 10, 5);

    // Articulated Slug Blaster rotating toward aimAngle
    ctx.save();
    ctx.rotate(pd.aimAngle);
    const recoilOffset = -pd.recoil * 44;
    ctx.translate(recoilOffset, 0);

    // Blaster body & barrel
    ctx.fillStyle = '#1e293b';
    drawRoundedBar(ctx, -4, -9, 34, 18, 5);
    ctx.fill();
    ctx.strokeStyle = mega ? '#fde047' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Loaded slug energy chamber
    ctx.fillStyle = elColor;
    ctx.beginPath();
    ctx.arc(10, 0, 5.5 + (pd.charging ? Math.sin(time * 22) * 1.4 : 0), 0, Math.PI * 2);
    ctx.fill();

    // Muzzle tip
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(28, -5, 7, 10);
    ctx.restore();

    // Circular Blaster Charge + Sweet Spot Ring
    if (pd.charging || pd.charge > 0.05) {
      const sweet = pd.charge >= 0.62 && pd.charge <= 0.88;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 38, -Math.PI * 0.75, Math.PI * 0.75);
      ctx.stroke();

      // Sweet-spot indicator arc
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 38, -Math.PI * 0.75 + Math.PI * 1.5 * 0.62, -Math.PI * 0.75 + Math.PI * 1.5 * 0.88);
      ctx.stroke();

      ctx.strokeStyle = sweet ? '#fde047' : '#2dd4bf';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 38, -Math.PI * 0.75, -Math.PI * 0.75 + Math.PI * 1.5 * pd.charge);
      ctx.stroke();
    }

    // Blaster Shield Dome
    if (pd.guardTimer > 0 || battle.allyStatus.shieldTimer > 0) {
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(10, 0, 42, -Math.PI * 0.58, Math.PI * 0.58);
      ctx.stroke();
      ctx.fill();
    }

    // Active slug nameplate under feet
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(slugName, 0, 36);
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
    const isBoss = Boolean(enemy.isBoss);
    const isMerc = Boolean(enemy.isMercenary);
    const radius = isBoss ? 34 : 25;

    ctx.save();
    ctx.translate(ed.x, ed.y);

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
      const pulseR = radius + 12 + Math.sin(time * 18) * 4;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2 * Math.max(0.1, ed.telegraphProgress));
      ctx.stroke();
    }

    if (isMerc || isBoss) {
      // Rival Lancer / Blakk / Biome Guardian figure with rival blaster
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

      // Rival Blaster pointing left
      ctx.save();
      ctx.rotate(ed.aimAngle);
      ctx.translate(-ed.recoil * 36, 0);
      ctx.fillStyle = '#0f172a';
      drawRoundedBar(ctx, -4, -8, 32, 16, 4);
      ctx.fill();
      ctx.strokeStyle = elColor;
      ctx.stroke();
      ctx.fillStyle = elColor;
      ctx.beginPath();
      ctx.arc(10, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Wild Slug Opponent floating & bobbing
      const bob = Math.sin(time * 4.5) * 4;
      ctx.translate(0, bob);
      ctx.fillStyle = ed.hitFlash > 0 ? '#fecaca' : elColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Eyes & antennae
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-9, -4, 3.6, 0, Math.PI * 2);
      ctx.arc(-2, -6, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-10, -5, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (ed.guardTimer > 0 || (enemy.shieldTimer || 0) > 0) {
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(-10, 0, radius + 14, Math.PI * 0.42, Math.PI * 1.58);
      ctx.stroke();
      ctx.fill();
    }

    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fda4af';
    ctx.fillText(enemy.name, 0, radius + 16);
    ctx.restore();
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

    // 1. Speed trail
    for (let i = 0; i < p.trail.length; i++) {
      const pt = p.trail[i];
      const frac = (i + 1) / p.trail.length;
      ctx.save();
      ctx.globalAlpha = frac * (p.phase === 'transformed' ? 0.48 : 0.28);
      ctx.fillStyle = p.perfectRelease && p.mode !== 'capsule' ? accent : color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, Math.max(2, pt.r * frac), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const angle = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);

    if (p.mode === 'capsule') {
      // Bajoterra Slug Capture Cylinder
      ctx.rotate(time * 12);
      ctx.fillStyle = p.mega ? '#7e22ce' : '#0284c7';
      drawRoundedBar(ctx, -12, -7, 24, 14, 6);
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (highLighting && p.phase === 'transformed') {
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, p.radius * 2.1);
      glow.addColorStop(0, `${accent}77`);
      glow.addColorStop(0.5, `${color}44`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.phase === 'protoform') {
      // Compact speeding Protoform slug
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // Little antennae & eye
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(5, -2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Full Velocimorph Transformed Species Silhouette!
      const scale = p.phase === 'transforming' ? 1.35 : p.mega ? 1.24 : 1.05;
      ctx.scale(scale, scale);
      this.drawTransformedSilhouette(ctx, profile.silhouette, color, accent, p.mega, time);
    }

    ctx.restore();
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
      // Megamorph golden crest aura
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -14);
      ctx.lineTo(14, 0);
      ctx.lineTo(-8, 14);
      ctx.stroke();
    }

    switch (silhouette) {
      case 'phoenix_flame':
      case 'crimson_falcon': {
        // Winged fire predator
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-8, -14 + flap);
        ctx.lineTo(-16, -4);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-16, 4);
        ctx.lineTo(-8, 14 - flap);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        break;
      }
      case 'hydro_serpent': {
        // Sleek finned water torpedo
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.quadraticCurveTo(4, -12, -18, -6);
        ctx.lineTo(-12, 0);
        ctx.lineTo(-18, 6);
        ctx.quadraticCurveTo(4, 12, 22, 0);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        break;
      }
      case 'volt_bolt':
      case 'rail_viper': {
        // Jagged electric lightning creature
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(24, 0);
        ctx.lineTo(4, -10);
        ctx.lineTo(8, -4);
        ctx.lineTo(-18, -12);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-18, 12);
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
        // Armored crystal drill / ice spear
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(24, 0);
        ctx.lineTo(-4, -12);
        ctx.lineTo(-16, -8);
        ctx.lineTo(-16, 8);
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
        // Multi-winged luminous prism
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-2, -16 + flap * 0.5);
        ctx.lineTo(-14, -6);
        ctx.lineTo(-14, 6);
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
        // Heavy horned boulder / volcanic comet
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        // Horn
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(22, -2);
        ctx.lineTo(10, -8);
        ctx.lineTo(10, 4);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'abyss_wyvern':
      case 'void_wraith': {
        // Horned shadow phantom
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(0, -14);
        ctx.lineTo(-18, -10 + flap * 0.6);
        ctx.lineTo(-11, 0);
        ctx.lineTo(-18, 10 - flap * 0.6);
        ctx.lineTo(0, 14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#f5d0fe';
        ctx.lineWidth = 1.7;
        ctx.stroke();
        break;
      }
      case 'astral_eye':
      case 'thorn_stag':
      default: {
        // Astral tentacled / antlered creature
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

    // Glowing fierce eye on transformed slug
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(8, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
