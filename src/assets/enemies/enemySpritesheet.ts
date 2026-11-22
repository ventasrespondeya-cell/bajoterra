import { CHARACTER_VISUAL_PROFILES } from '../../game/characterArt';
import {
  drawSoftGlow,
  fillStrokeRoundRect,
  makeOffscreenCanvas,
  roundRectPath,
} from '../canvasUtils';
import {
  HD_BOSS_SPRITE_SIZE,
  HD_CHARACTER_SPRITE_SIZE,
  type CharacterAnimState,
  type CharacterFacingDir,
} from '../manifest';

/**
 * Pipeline HiDPI para Enemigos, Rivales, Mercenarios y los 5 Jefes de Bioma + Dr. Blakk.
 * 64×64 para rivales/soldados/Dr. Blakk y 80×80 para Jefes de Bioma con siluetas únicas.
 */

export type EnemySpriteId =
  | 'mercenary'
  | 'blakk_soldier'
  | 'red_hook'
  | 'twist'
  | 'dr_blakk'
  | 'comandante_blakk'
  | 'boss_acuaticas'
  | 'boss_aquatic'
  | 'boss_magma'
  | 'boss_heladas'
  | 'boss_ice'
  | 'boss_cristalinas'
  | 'boss_crystal'
  | 'boss_sombrias'
  | 'boss_shadow'
  | 'boss_blakk';

const enemyCache = new Map<string, HTMLCanvasElement>();
const MAX_ENEMY_CACHE = 480;

function setCached(key: string, canvas: HTMLCanvasElement): void {
  if (enemyCache.size >= MAX_ENEMY_CACHE) {
    const first = enemyCache.keys().next().value;
    if (first) enemyCache.delete(first);
  }
  enemyCache.set(key, canvas);
}

export function normalizeEnemySpriteId(id: string): EnemySpriteId {
  const low = id.toLowerCase();
  if (low === 'blakk_soldier' || low === 'mercenary' || low === 'mercenario') return 'mercenary';
  if (low === 'red_hook' || low === 'garfio_rojo') return 'red_hook';
  if (low === 'twist') return 'twist';
  if (low === 'dr_blakk' || low === 'blakk') return 'dr_blakk';
  if (low === 'comandante_blakk' || low === 'blakk_commander') return 'comandante_blakk';
  if (low.includes('acuat') || low.includes('aquat')) return 'boss_acuaticas';
  if (low.includes('magma')) return 'boss_magma';
  if (low.includes('helad') || low.includes('ice')) return 'boss_heladas';
  if (low.includes('cristal') || low.includes('crystal')) return 'boss_cristalinas';
  if (low.includes('somb') || low.includes('shadow')) return 'boss_sombrias';
  if (low.includes('boss_blakk')) return 'boss_blakk';
  return 'mercenary';
}

export function getHdEnemySprite(
  enemyId: string,
  dir: CharacterFacingDir = 'down',
  anim: CharacterAnimState = 'idle',
  frame = 0
): HTMLCanvasElement | null {
  const norm = normalizeEnemySpriteId(enemyId);
  if (norm.startsWith('boss_')) {
    return getHdBiomeBossSprite(norm, dir, anim, frame);
  }

  const f = Math.abs(Math.floor(frame)) % 4;
  const key = `en_${norm}_${dir}_${anim}_${f}`;
  const cached = enemyCache.get(key);
  if (cached) return cached;

  const S = HD_CHARACTER_SPRITE_SIZE; // 64
  const c = makeOffscreenCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const isUp = dir === 'up';
  const isSide = dir === 'left' || dir === 'right';
  const flip = dir === 'left' ? -1 : 1;
  const walkCycle = anim === 'walk' ? Math.sin((f / 4) * Math.PI * 2) : 0;
  const idleBob = anim === 'idle' ? Math.sin((f / 4) * Math.PI * 2) * 1.1 : 0;
  const stepLift = anim === 'walk' ? Math.abs(Math.cos((f / 4) * Math.PI * 2)) * 2.2 : 0;
  const hitTilt = anim === 'hit' ? -0.2 : 0;
  const combatLean = anim === 'combat' || anim === 'special' ? 0.1 : 0;

  const pal =
    norm === 'dr_blakk'
      ? CHARACTER_VISUAL_PROFILES.dr_blakk
      : norm === 'comandante_blakk'
      ? CHARACTER_VISUAL_PROFILES.comandante_blakk
      : norm === 'red_hook'
      ? CHARACTER_VISUAL_PROFILES.red_hook
      : norm === 'twist'
      ? CHARACTER_VISUAL_PROFILES.twist
      : {
          ...CHARACTER_VISUAL_PROFILES.comandante_blakk,
          outfitPrimary: '#111827',
          outfitSecondary: '#991b1b',
          accentColor: '#ef4444',
          blasterPrimary: '#581c87',
          blasterAccent: '#f43f5e',
        };

  const cx = S / 2;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.48)';
  ctx.beginPath();
  ctx.ellipse(cx, S - 7, 14, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, S - 9 - stepLift + idleBob);
  ctx.scale(flip, 1);
  ctx.rotate(hitTilt + combatLean);

  const isBlakk = norm === 'dr_blakk' || norm === 'comandante_blakk';
  const bodyW = isBlakk ? 19 : norm === 'red_hook' ? 18 : 16;
  const bodyH = isBlakk ? 25 : 22;

  // Cape / coat tail behind
  if (isBlakk || norm === 'twist' || norm === 'red_hook') {
    ctx.fillStyle = norm === 'dr_blakk' ? '#450a0a' : norm === 'twist' ? '#14532d' : norm === 'red_hook' ? '#7f1d1d' : '#3b0764';
    ctx.strokeStyle = '#070b14';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.56, -bodyH - 4);
    ctx.lineTo(bodyW * 0.56, -bodyH - 4);
    ctx.lineTo(bodyW * 0.78, -2 + walkCycle * 1.6);
    ctx.lineTo(-bodyW * 0.78, -2 - walkCycle * 1.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Boots / Legs
  const leftLegY = -8 + (isSide ? walkCycle * 4 : walkCycle * 3);
  const rightLegY = -8 - (isSide ? walkCycle * 4 : walkCycle * 3);
  fillStrokeRoundRect(ctx, isSide ? -5 : -bodyW * 0.36, leftLegY, 6.2, 9, 2.5, '#090d16', '#04070d', 1.9);
  fillStrokeRoundRect(ctx, isSide ? 1 : bodyW * 0.08, rightLegY, 6.2, 9, 2.5, '#090d16', '#04070d', 1.9);
  ctx.fillStyle = pal.outfitSecondary;
  ctx.fillRect(isSide ? -4.5 : -bodyW * 0.34, leftLegY + 4.5, 5.4, 2.4);
  ctx.fillRect(isSide ? 1.5 : bodyW * 0.1, rightLegY + 4.5, 5.4, 2.4);

  // Torso armor / coat
  const tW = isSide ? bodyW * 0.74 : bodyW;
  const torsoGrad = ctx.createLinearGradient(-tW * 0.5, -bodyH - 6, tW * 0.5, -6);
  torsoGrad.addColorStop(0, pal.outfitSecondary);
  torsoGrad.addColorStop(0.4, pal.outfitPrimary);
  torsoGrad.addColorStop(1, '#090d16');
  fillStrokeRoundRect(ctx, -tW * 0.5, -bodyH - 6, tW, bodyH, 5.5, torsoGrad, '#060a12', 2);

  // High collar & crimson bandolier for Blakk
  if (isBlakk) {
    ctx.fillStyle = '#b91c1c';
    ctx.strokeStyle = '#060a12';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-tW * 0.55, -bodyH - 4);
    ctx.lineTo(-tW * 0.78, -bodyH - 14);
    ctx.lineTo(0, -bodyH - 7);
    ctx.lineTo(tW * 0.78, -bodyH - 14);
    ctx.lineTo(tW * 0.55, -bodyH - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isUp) {
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-tW * 0.42, -bodyH - 4);
      ctx.lineTo(tW * 0.42, -9);
      ctx.stroke();
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(-1, -bodyH + 6, 2, 0, Math.PI * 2);
      ctx.arc(3.5, -bodyH + 10, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (norm === 'mercenary' && !isUp) {
    // Blakk trooper crimson X chest emblem
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-5, -bodyH - 2);
    ctx.lineTo(5, -12);
    ctx.moveTo(5, -bodyH - 2);
    ctx.lineTo(-5, -12);
    ctx.stroke();
  }

  // Up-facing tactical dark pack
  if (isUp) {
    fillStrokeRoundRect(ctx, -6, -bodyH - 3, 12, 13, 3, '#1f2937', '#05080f', 1.6);
    ctx.fillStyle = pal.accentColor;
    ctx.fillRect(-2, -bodyH + 1, 4, 5);
  }

  // Belt
  ctx.fillStyle = '#27272a';
  ctx.fillRect(-tW * 0.48, -11, tW * 0.96, 3.2);

  // Arms + Enemy Weapons
  const armSwing = anim === 'walk' ? -walkCycle * 3.5 : anim === 'combat' ? -4 : 0;
  if (!isSide) {
    fillStrokeRoundRect(ctx, -tW * 0.65, -bodyH - 1 - armSwing * 0.4, 5, 11, 2.5, pal.outfitPrimary, '#060a12', 1.7);
  }

  if (norm === 'red_hook' && !isSide) {
    // Iron hook left hand
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(-tW * 0.58, -bodyH + 12, 4, Math.PI * 0.15, Math.PI * 1.65);
    ctx.stroke();
  }

  const armX = isSide ? 1 : tW * 0.34;
  const armY = anim === 'interact' ? -bodyH - 4 : anim === 'combat' ? -bodyH - 1 : -bodyH + armSwing * 0.4;
  fillStrokeRoundRect(ctx, armX, armY, 5.4, 11, 2.5, pal.outfitPrimary, '#060a12', 1.7);

  // Ghoul Gatling / Tactical Blaster
  if (!isUp) {
    const wx = isSide ? 5 : tW * 0.36;
    const wy = anim === 'combat' || anim === 'special' ? -bodyH + 1 : -bodyH + 5 + armSwing * 0.35;
    const gunW = isBlakk ? 15 : 12;
    const gunH = isBlakk ? 6.6 : 5.2;
    fillStrokeRoundRect(ctx, wx, wy, gunW, gunH, 2.2, pal.blasterPrimary, '#060a12', 1.5);
    ctx.fillStyle = pal.blasterAccent;
    ctx.fillRect(wx + gunW - 3.6, wy + 1.2, 3.2, gunH - 2.4);

    if (anim === 'combat' || anim === 'special') {
      ctx.strokeStyle = pal.blasterAccent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(wx + gunW + 3, wy + gunH / 2, 3.8 + (f % 2), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Head
  const headY = -bodyH - 15;
  const headR = 10.2;
  ctx.strokeStyle = '#060a12';
  ctx.lineWidth = 2;

  if (norm === 'mercenary') {
    // Full Blakk helmet
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Crest fin
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-2, headY - headR - 3, 4, 8);
    if (!isUp) {
      const vx = isSide ? 1 : -7;
      const vw = isSide ? 9 : 14;
      fillStrokeRoundRect(ctx, vx, headY - 2.5, vw, 4.5, 2, '#ef4444', '#060a12', 1.4);
    }
  } else {
    const hg = ctx.createRadialGradient(-3, headY - 4, 2, 0, headY, headR + 2);
    hg.addColorStop(0, pal.skinTone);
    hg.addColorStop(1, norm === 'dr_blakk' ? '#64748b' : '#b8835e');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (norm === 'twist') {
      // Hooded cowl
      ctx.fillStyle = '#14532d';
      ctx.beginPath();
      ctx.arc(0, headY - 1, headR + 1.8, Math.PI * 0.85, Math.PI * 2.15);
      ctx.lineTo(headR + 1.5, headY + 4);
      ctx.lineTo(-headR - 1.5, headY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (norm === 'comandante_blakk') {
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(0, headY - 1, headR + 1.4, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!isUp) {
        fillStrokeRoundRect(ctx, isSide ? 0 : -7.5, headY - 3, isSide ? 10 : 15, 4.4, 2, '#f43f5e', '#060a12', 1.4);
      }
    } else {
      // Hair (Swept Dr. Blakk widows peak or pirate locks for Red Hook)
      ctx.fillStyle = pal.hairColor;
      ctx.beginPath();
      ctx.arc(0, headY - 2.5, headR + 0.8, Math.PI * 0.85, Math.PI * 2.15);
      ctx.lineTo(headR + 2, headY - 5);
      ctx.lineTo(4, headY - headR - 5);
      ctx.lineTo(0, headY - headR - 1);
      ctx.lineTo(-5, headY - headR - 5);
      ctx.lineTo(-headR - 2, headY - 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    if (!isUp && norm !== 'comandante_blakk') {
      const exOff = isSide ? 3.5 : 0;
      const lx = -3.8 + exOff;
      const rx = 3.8 + exOff;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (!isSide) ctx.ellipse(lx, headY - 1, 2.5, 2.8, 0, 0, Math.PI * 2);
      ctx.ellipse(rx, headY - 1, 2.5, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.eyeColor;
      ctx.beginPath();
      if (!isSide) ctx.arc(lx + 0.4, headY - 0.8, 1.5, 0, Math.PI * 2);
      ctx.arc(rx + 0.4, headY - 0.8, 1.5, 0, Math.PI * 2);
      ctx.fill();

      if (norm === 'red_hook') {
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.ellipse(lx, headY - 1, 3.1, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (norm === 'dr_blakk') {
        ctx.fillStyle = pal.hairColor;
        ctx.beginPath();
        ctx.moveTo(-2.5 + exOff, headY + 6.5);
        ctx.lineTo(2.5 + exOff, headY + 6.5);
        ctx.lineTo(exOff, headY + 11);
        ctx.closePath();
        ctx.fill();
      }
      // Villain scowl
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-2.5 + exOff, headY + 4.8);
      ctx.quadraticCurveTo(exOff, headY + 3.4, 2.5 + exOff, headY + 4.8);
      ctx.stroke();
    }
  }

  if (anim === 'hit') {
    ctx.fillStyle = 'rgba(254, 202, 202, 0.46)';
    ctx.fillRect(-S / 2, -S, S, S);
  } else if (anim === 'special') {
    ctx.strokeStyle = pal.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -18, 22 + (f % 2) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
  setCached(key, c);
  return c;
}

export function getHdBiomeBossSprite(
  bossId: string,
  dir: CharacterFacingDir = 'down',
  anim: CharacterAnimState = 'idle',
  frame = 0
): HTMLCanvasElement | null {
  const norm = normalizeEnemySpriteId(bossId);
  const f = Math.abs(Math.floor(frame)) % 4;
  const key = `boss_${norm}_${dir}_${anim}_${f}`;
  const cached = enemyCache.get(key);
  if (cached) return cached;

  const S = HD_BOSS_SPRITE_SIZE; // 80
  const c = makeOffscreenCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const hover = Math.sin((f / 4) * Math.PI * 2) * (anim === 'combat' || anim === 'special' ? 3.2 : 2.0);
  const cx = S / 2;
  const cy = S / 2 + 2 + hover;
  const flip = dir === 'left' ? -1 : 1;
  const isUp = dir === 'up';

  const isAquatic = norm === 'boss_acuaticas' || norm === 'boss_aquatic';
  const isMagma = norm === 'boss_magma';
  const isIce = norm === 'boss_heladas' || norm === 'boss_ice';
  const isCrystal = norm === 'boss_cristalinas' || norm === 'boss_crystal';

  const auraCol = isAquatic
    ? '#22d3ee'
    : isMagma
    ? '#fb923c'
    : isIce
    ? '#67e8f9'
    : isCrystal
    ? '#c084fc'
    : '#f43f5e';

  // Ground shadow + arcane boss ring
  ctx.fillStyle = 'rgba(2, 6, 23, 0.56)';
  ctx.beginPath();
  ctx.ellipse(cx, S - 7, 24, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = anim === 'special' ? 0.9 : 0.62;
  ctx.strokeStyle = auraCol;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(cx, S - 8, 27 + (f % 2) * 2.5, 8.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  drawSoftGlow(ctx, cx, cy, 36, `${auraCol}30`);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(flip, 1);
  if (anim === 'hit') ctx.rotate(-0.14);

  ctx.strokeStyle = '#050810';
  ctx.lineWidth = 2.2;

  if (isAquatic) {
    // Leviatán Abisal: tentacle cape, scalloped sea-king pauldrons, coral crown & trident spear
    ctx.fillStyle = '#082f49';
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.quadraticCurveTo(-30, 8, -24, 28 + (f % 2) * 2);
    ctx.lineTo(-10, 22);
    ctx.lineTo(0, 30 - (f % 2) * 2);
    ctx.lineTo(10, 22);
    ctx.lineTo(24, 28 + (f % 2) * 2);
    ctx.quadraticCurveTo(30, 8, 18, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Winged gill fins
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(-15, -14);
    ctx.lineTo(-32, -22);
    ctx.lineTo(-27, -6);
    ctx.lineTo(-14, -4);
    ctx.closePath();
    ctx.moveTo(15, -14);
    ctx.lineTo(32, -22);
    ctx.lineTo(27, -6);
    ctx.lineTo(14, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Torso scales
    fillStrokeRoundRect(ctx, -15, -10, 30, 32, 9, '#0284c7', '#050810', 2.2);
    fillStrokeRoundRect(ctx, -10, -4, 20, 18, 5, '#0f172a', '#22d3ee', 1.6);
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.arc(0, 5, 4.5 + (f % 2) * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Coral Trident Crown + Head
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(0, -18, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(-9, -23);
    ctx.lineTo(-12, -35);
    ctx.lineTo(-4, -27);
    ctx.lineTo(0, -37);
    ctx.lineTo(4, -27);
    ctx.lineTo(12, -35);
    ctx.lineTo(9, -23);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hydro Trident Staff on right
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(23, 26);
    ctx.lineTo(23, -26);
    ctx.stroke();
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(23, -36);
    ctx.lineTo(17, -23);
    ctx.lineTo(29, -23);
    ctx.closePath();
    ctx.fill();
  } else if (isMagma) {
    // Titán Piroclasto: broad volcanic obsidian hulking frame, glowing magma ribs, twin molten gauntlets & twin ram-volcano horns
    ctx.fillStyle = '#29120e';
    ctx.beginPath();
    ctx.moveTo(-25, -12);
    ctx.lineTo(-33, 6);
    ctx.lineTo(-22, 26);
    ctx.lineTo(22, 26);
    ctx.lineTo(33, 6);
    ctx.lineTo(25, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Heavy Obsidian Pauldrons with lava seams
    fillStrokeRoundRect(ctx, -28, -16, 15, 16, 5, '#431407', '#fb923c', 2);
    fillStrokeRoundRect(ctx, 13, -16, 15, 16, 5, '#431407', '#fb923c', 2);

    // Furnace Chest
    fillStrokeRoundRect(ctx, -16, -8, 32, 28, 7, '#1c100d', '#ea580c', 2.2);
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, 5, 6.2 + (f % 2) * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(-6, 4);
    ctx.moveTo(11, 0);
    ctx.lineTo(6, 4);
    ctx.stroke();

    // Volcanic horned head
    fillStrokeRoundRect(ctx, -12, -28, 24, 20, 6, '#3f1d14', '#050810', 2);
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(-11, -24);
    ctx.quadraticCurveTo(-24, -34, -18, -12);
    ctx.closePath();
    ctx.moveTo(11, -24);
    ctx.quadraticCurveTo(24, -34, 18, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (isIce) {
    // Reina Glaciomita: crystalline ice-cloak skirt, triple-spire tiara, frosty gauntlets & glacial scepter
    ctx.fillStyle = '#0e7490';
    ctx.beginPath();
    ctx.moveTo(-14, -10);
    ctx.lineTo(-27, 26);
    ctx.lineTo(-8, 29);
    ctx.lineTo(0, 24);
    ctx.lineTo(8, 29);
    ctx.lineTo(27, 26);
    ctx.lineTo(14, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Icicle Shoulder Crystals
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.moveTo(-12, -8);
    ctx.lineTo(-28, -20);
    ctx.lineTo(-18, 2);
    ctx.closePath();
    ctx.moveTo(12, -8);
    ctx.lineTo(28, -20);
    ctx.lineTo(18, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Frosted Bodice + Diamond Core
    fillStrokeRoundRect(ctx, -13, -10, 26, 26, 6, '#155e75', '#a5f3fc', 1.8);
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(6, 4);
    ctx.lineTo(0, 12);
    ctx.lineTo(-6, 4);
    ctx.closePath();
    ctx.fill();

    // Head + Tall Glacial Crown
    ctx.fillStyle = '#cffafe';
    ctx.beginPath();
    ctx.arc(0, -18, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.moveTo(-8, -24);
    ctx.lineTo(-10, -35);
    ctx.lineTo(-3, -28);
    ctx.lineTo(0, -39);
    ctx.lineTo(3, -28);
    ctx.lineTo(10, -35);
    ctx.lineTo(8, -24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (isCrystal) {
    // Oráculo Prisma: levitating crystal lotus mantle, 3 orbiting prism shards & mystic arcane mask
    const orbPhase = (f / 4) * Math.PI * 2;
    for (let i = 0; i < 3; i++) {
      const a = orbPhase + (i * Math.PI * 2) / 3;
      const sx = Math.cos(a) * 28;
      const sy = Math.sin(a) * 14 - 4;
      ctx.fillStyle = i === 0 ? '#67e8f9' : '#c084fc';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 7);
      ctx.lineTo(sx + 4.5, sy);
      ctx.lineTo(sx, sy + 7);
      ctx.lineTo(sx - 4.5, sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Lotus Robes
    ctx.fillStyle = '#312e81';
    ctx.beginPath();
    ctx.moveTo(-16, -12);
    ctx.lineTo(-24, 18);
    ctx.lineTo(0, 29);
    ctx.lineTo(24, 18);
    ctx.lineTo(16, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    fillStrokeRoundRect(ctx, -12, -10, 24, 24, 6, '#4338ca', '#a78bfa', 1.8);
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Oracle Prism Mask & Tall Halo Hood
    ctx.fillStyle = '#4c1d95';
    ctx.beginPath();
    ctx.moveTo(-13, -12);
    ctx.lineTo(-16, -28);
    ctx.lineTo(0, -36);
    ctx.lineTo(16, -28);
    ctx.lineTo(13, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    fillStrokeRoundRect(ctx, -8, -24, 16, 12, 4, '#e0e7ff', '#6366f1', 1.6);
  } else {
    // Espectro del Abismo / Boss Blakk: tattered shadow wings, horned skull helm & crimson ghoul reactor
    ctx.fillStyle = '#1e1b2e';
    ctx.beginPath();
    ctx.moveTo(-15, -10);
    ctx.lineTo(-34, -22);
    ctx.lineTo(-29, 2);
    ctx.lineTo(-22, 26);
    ctx.lineTo(-8, 19);
    ctx.lineTo(0, 28);
    ctx.lineTo(8, 19);
    ctx.lineTo(22, 26);
    ctx.lineTo(29, 2);
    ctx.lineTo(34, -22);
    ctx.lineTo(15, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    fillStrokeRoundRect(ctx, -15, -8, 30, 26, 7, '#09090b', '#be123c', 2);
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(0, 4, 5.5 + (f % 2) * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Horned abyss helm
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(0, -18, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#be123c';
    ctx.beginPath();
    ctx.moveTo(-9, -22);
    ctx.lineTo(-22, -36);
    ctx.lineTo(-4, -27);
    ctx.moveTo(9, -22);
    ctx.lineTo(22, -36);
    ctx.lineTo(4, -27);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Boss glowing eyes (hidden when facing north)
  if (!isUp) {
    ctx.fillStyle = isAquatic ? '#fef08a' : isMagma ? '#fde047' : isIce ? '#0f172a' : isCrystal ? '#67e8f9' : '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(-7, -20);
    ctx.lineTo(-2, -17.5);
    ctx.lineTo(-6, -15.5);
    ctx.closePath();
    ctx.moveTo(7, -20);
    ctx.lineTo(2, -17.5);
    ctx.lineTo(6, -15.5);
    ctx.closePath();
    ctx.fill();
  }

  if (anim === 'hit') {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(-S / 2, -S / 2, S, S);
  }

  ctx.restore();
  setCached(key, c);
  return c;
}
