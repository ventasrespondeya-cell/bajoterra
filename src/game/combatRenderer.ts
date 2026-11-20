import {
  ARENA_FLOOR_Y,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  PLAYER_MAX_X,
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
    // Subtle bounded camera shake on heavy impacts
    if (battle.cameraShake > 0.25) {
      const mag = Math.min(3.8, battle.cameraShake);
      const sx = (Math.random() - 0.5) * mag;
      const sy = (Math.random() - 0.5) * mag;
      ctx.translate(sx, sy);
    }

    // 1. Subterranean Cavern Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
    bgGrad.addColorStop(0, theme.skyTop);
    bgGrad.addColorStop(0.75, theme.skyBottom);
    bgGrad.addColorStop(1, '#04070d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    this.drawCavernBackdrop(ctx, theme, time, highLighting);

    // 2. Arena Walkable Plane & Mid-Arena Divider
    const floorGrad = ctx.createLinearGradient(0, ARENA_FLOOR_Y, 0, ARENA_HEIGHT);
    floorGrad.addColorStop(0, theme.floorTop);
    floorGrad.addColorStop(1, theme.floorBottom);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, ARENA_FLOOR_Y, ARENA_WIDTH, ARENA_HEIGHT - ARENA_FLOOR_Y);

    ctx.save();
    ctx.strokeStyle = theme.glowColor;
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((PLAYER_MAX_X + 490) / 2, 92);
    ctx.lineTo((PLAYER_MAX_X + 490) / 2, ARENA_FLOOR_Y);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = theme.glowColor;
    ctx.fillRect(0, ARENA_FLOOR_Y, ARENA_WIDTH, 3);
    ctx.restore();

    // 3. Interactive Obstacles & Biome Mechanisms
    for (const obs of battle.obstacles) {
      this.drawObstacle(ctx, obs, theme.glowColor, time, highLighting);
    }

    // 4. Predicted Blaster Aim Trajectory & Velocimorph Threshold Node
    if (battle.turn === 'duel') {
      const preview = combat.computeTrajectoryPreview(state);
      this.drawTrajectoryPreview(
        ctx,
        preview,
        allyElColor,
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

    // 7. Translucent Shockwaves & Transformation Rings (never block sprites)
    for (const sw of battle.shockwaves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(0.8, sw.alpha * 0.85));
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.kind === 'clash' || sw.kind === 'transform' ? 3 : 2.2;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (sw.kind === 'transform' || sw.kind === 'clash') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius * 0.68, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (sw.label) {
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(4,9,16,0.85)';
        ctx.fillText(sw.label, sw.x + 1, sw.y - sw.radius * 0.65 + 1);
        ctx.fillStyle = sw.color;
        ctx.fillText(sw.label, sw.x, sw.y - sw.radius * 0.65);
      }
      ctx.restore();
    }

    // 8. Floating Damage / Status Callouts
    const recentEffects = battle.effects.slice(-4);
    recentEffects.forEach((ef, idx) => {
      const ex = ef.x ?? (ef.target === 'enemy' ? battle.enemyDuelist.x : battle.playerDuelist.x);
      const ey = (ef.y ?? 200) - idx * 14;
      ctx.save();
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(3, 7, 14, 0.88)';
      ctx.fillText(ef.text, ex + 1.5, ey + 1.5);
      ctx.fillStyle = ef.color;
      ctx.fillText(ef.text, ex, ey);
      ctx.restore();
    });

    ctx.restore();
  }

  private drawCavernBackdrop(
    ctx: CanvasRenderingContext2D,
    theme: ReturnType<typeof buildArenaForBiome>,
    time: number,
    highLighting: boolean
  ): void {
    ctx.fillStyle = theme.caveMid;
    ctx.beginPath();
    ctx.moveTo(0, ARENA_FLOOR_Y);
    for (let x = 0; x <= ARENA_WIDTH; x += 46) {
      const h = 112 + Math.sin(x * 0.015 + 1.2) * 38 + Math.cos(x * 0.032) * 22;
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
      const spike = 22 + ((x * 17) % 30);
      ctx.lineTo(x, spike);
    }
    ctx.lineTo(ARENA_WIDTH, 0);
    ctx.closePath();
    ctx.fill();

    // Lightweight capped ambient motes
    const moteCount = highLighting ? 14 : 6;
    for (let i = 0; i < moteCount; i++) {
      const mx = ((i * 97 + time * (10 + (i % 4) * 4)) % (ARENA_WIDTH - 40)) + 20;
      const my = 80 + ((i * 53 + Math.sin(time * 1.4 + i) * 22 + 280) % 300);
      const r = 1.5 + (i % 3) * 0.8;
      ctx.save();
      ctx.globalAlpha = 0.22 + 0.16 * Math.sin(time * 2.2 + i);
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
      uGrad.addColorStop(0, 'rgba(251, 146, 60, 0.28)');
      uGrad.addColorStop(1, 'rgba(251, 146, 60, 0.02)');
      ctx.fillStyle = uGrad;
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeStyle = 'rgba(253, 186, 116, 0.48)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const cy = obs.y + obs.h - ((time * 68 + i * 75) % obs.h);
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
        ctx.globalAlpha = 0.25 + 0.1 * Math.sin(time * 4);
        ctx.fillStyle = '#2dd4bf';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx + 7, ry + 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 2.8;
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
    const tierColor =
      charge >= 0.78 ? '#5eead4' : charge >= 0.42 ? '#fde047' : elColor;
    for (let i = 1; i < preview.points.length; i++) {
      const pt = preview.points[i];
      const alpha = (1 - i / preview.points.length) * (charging ? 0.85 : 0.44);
      ctx.fillStyle = charging ? tierColor : elColor;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, charging ? 3 : 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (preview.transformPoint) {
      const tp = preview.transformPoint;
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 7.5, 0, Math.PI * 2);
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
    const moving = Math.hypot(pd.vx, pd.vy) > 15;
    const bob = moving ? Math.sin(time * 16) * 2.5 : Math.sin(time * 3.5) * 1.5;

    ctx.save();
    ctx.translate(pd.x, pd.y + bob);

    if (highLighting) {
      const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, 46);
      aura.addColorStop(0, `${elColor}3d`);
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shadow footprint beneath duelist
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 26 - bob, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lancer torso & scarf
    const flash = pd.hitFlash > 0;
    ctx.fillStyle = flash ? '#fca5a5' : '#0f172a';
    drawRoundedBar(ctx, -16, -12, 26, 33, 8);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Lancer head & glowing goggles
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-2, -21, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2dd4bf';
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, -24, 9, 4.5);

    // Articulated 360° Slug Blaster
    ctx.save();
    ctx.rotate(pd.aimAngle);
    const recoilOffset = -pd.recoil * 36;
    ctx.translate(recoilOffset, 0);

    // Blaster casing
    ctx.fillStyle = '#1e293b';
    drawRoundedBar(ctx, -4, -9, 36, 18, 5);
    ctx.fill();
    ctx.strokeStyle = mega ? '#fde047' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Transparent energy chamber with expressive loaded slug inside!
    ctx.fillStyle = 'rgba(8, 22, 36, 0.9)';
    ctx.beginPath();
    ctx.arc(11, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(11, 0);
    ctx.scale(0.55, 0.55);
    this.drawProtoformBody(ctx, speciesId, elColor, accentColor, time, pd.charging);
    ctx.restore();

    // Muzzle accelerator ring
    ctx.fillStyle = pd.charging ? accentColor : '#e2e8f0';
    ctx.fillRect(30, -5, 6, 10);
    ctx.restore();

    // 3-Tier Unified Charge Ring (Quick < 42% | Technique 1 42-78% | Technique 2 / Pulse >= 78%)
    if (pd.charging || pd.charge > 0.05) {
      const tier2 = pd.charge >= 0.78;
      const tier1 = pd.charge >= 0.42 && !tier2;
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 38, -Math.PI * 0.75, Math.PI * 0.75);
      ctx.stroke();

      // Technique threshold tick marks
      ctx.strokeStyle = tier2 ? '#5eead4' : tier1 ? '#fde047' : '#38bdf8';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, 38, -Math.PI * 0.75, -Math.PI * 0.75 + Math.PI * 1.5 * pd.charge);
      ctx.stroke();
    }

    // Blaster Shield Dome
    if (pd.guardTimer > 0 || battle.allyStatus.shieldTimer > 0) {
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(6, 0, 41, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }

    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(slugName, 0, 38);
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
    const bob = Math.sin(time * 4.2) * 3.5;

    ctx.save();
    ctx.translate(ed.x, ed.y + bob);

    if (highLighting) {
      const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, radius + 22);
      aura.addColorStop(0, `${elColor}44`);
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 22, 0, Math.PI * 2);
      ctx.fill();
    }

    if (enemy.telegraphing === 'heavy') {
      const pulseR = radius + 11 + Math.sin(time * 16) * 3;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.8;
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

      ctx.save();
      ctx.rotate(ed.aimAngle);
      ctx.translate(-ed.recoil * 30, 0);
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
      // Expressive Wild Slug Opponent scaled up cleanly
      ctx.save();
      ctx.scale(-1.65, 1.65);
      if (ed.hitFlash > 0) {
        ctx.fillStyle = '#fecaca';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        this.drawProtoformBody(ctx, enemy.id, sp.color, sp.accent, time, enemy.telegraphing === 'heavy');
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

    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fda4af';
    ctx.fillText(enemy.name, 0, radius + 18);
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

    // 1. Clean elemental ribbon trail (never obscures projectiles)
    for (let i = 0; i < p.trail.length; i++) {
      const pt = p.trail[i];
      const frac = (i + 1) / p.trail.length;
      ctx.save();
      ctx.globalAlpha = frac * (p.phase === 'transformed' ? 0.42 : 0.24);
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
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, p.radius * 2);
      glow.addColorStop(0, `${accent}66`);
      glow.addColorStop(0.5, `${color}38`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.phase === 'protoform') {
      this.drawProtoformBody(ctx, p.speciesId, color, accent, time, p.perfectRelease);
    } else {
      const scale = p.phase === 'transforming' ? 1.32 : p.mega ? 1.24 : 1.08;
      ctx.scale(scale, scale);
      this.drawTransformedSilhouette(ctx, profile.silhouette, color, accent, p.mega, time);
    }

    ctx.restore();
  }

  private drawProtoformBody(
    ctx: CanvasRenderingContext2D,
    speciesId: string,
    color: string,
    accent: string,
    time: number,
    energized: boolean
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

    // Main cute Bajoterra slug body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = energized ? '#ffffff' : accent;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Species-specific silhouette crest / antennae
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 1.6;
    if (speciesId === 'infurnus' || speciesId === 'flaringo' || speciesId === 'piroclasto') {
      // Flame crest
      ctx.beginPath();
      ctx.moveTo(-2, -6);
      ctx.lineTo(-7, -12);
      ctx.lineTo(3, -8);
      ctx.closePath();
      ctx.fill();
    } else if (speciesId === 'tazerling' || speciesId === 'voltrix') {
      // Lightning antennae
      ctx.beginPath();
      ctx.moveTo(2, -6);
      ctx.lineTo(-4, -12);
      ctx.lineTo(0, -12);
      ctx.lineTo(-5, -16);
      ctx.stroke();
    } else if (speciesId === 'frostcrawler' || speciesId === 'glaciomita') {
      // Crystal spikes
      ctx.beginPath();
      ctx.moveTo(-3, -7);
      ctx.lineTo(0, -13);
      ctx.lineTo(4, -7);
      ctx.fill();
    } else if (speciesId === 'musgacorn' || speciesId === 'lariat') {
      // Antlers / stone horn
      ctx.beginPath();
      ctx.moveTo(4, -6);
      ctx.lineTo(8, -12);
      ctx.moveTo(5, -6);
      ctx.lineTo(2, -11);
      ctx.stroke();
    } else if (speciesId === 'doc' || speciesId === 'aetherion') {
      // Radiant halo arc
      ctx.beginPath();
      ctx.arc(0, -9, 4.5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Expressive feelers
      ctx.beginPath();
      ctx.moveTo(4, -6);
      ctx.lineTo(7, -11);
      ctx.moveTo(2, -6);
      ctx.lineTo(3, -11);
      ctx.stroke();
    }

    // Expressive big eye
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
      // Distinct Megamorph twin gold crest & orbital aura
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-10, -16);
      ctx.lineTo(18, 0);
      ctx.lineTo(-10, 16);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(Math.cos(time * 12) * 16, Math.sin(time * 12) * 16, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    switch (silhouette) {
      case 'phoenix_flame':
      case 'crimson_falcon': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-7, -15 + flap);
        ctx.lineTo(-17, -5);
        ctx.lineTo(-11, 0);
        ctx.lineTo(-17, 5);
        ctx.lineTo(-7, 15 - flap);
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
        ctx.moveTo(25, 0);
        ctx.lineTo(-4, -12);
        ctx.lineTo(-17, -8);
        ctx.lineTo(-17, 8);
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
        ctx.moveTo(20, 0);
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
        ctx.moveTo(21, 0);
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
}
