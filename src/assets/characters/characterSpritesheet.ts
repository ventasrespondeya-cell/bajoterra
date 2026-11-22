import { CHARACTER_VISUAL_PROFILES } from '../../game/characterArt';
import type { MechaTheme } from '../../game/types';
import {
  fillStrokeRoundRect,
  makeOffscreenCanvas,
  roundRectPath,
} from '../canvasUtils';
import { getHdBiomeBossSprite, getHdEnemySprite } from '../enemies/enemySpritesheet';
import {
  HD_CHARACTER_SPRITE_SIZE,
  type CharacterAnimState,
  type CharacterFacingDir,
} from '../manifest';

/**
 * Generador HiDPI (64×64 personajes / 72×72 Mecas) con estética cel-shaded.
 * Produce siluetas diferenciadas, armadura/ropa con iluminación superior-izquierda,
 * vistas reales de espalda ('up') y perfil ('left'/'right'), blásteres y estados
 * de animación completos: idle, walk, interact, combat, hit, special.
 * Los enemigos y jefes delegan a src/assets/enemies/enemySpritesheet.ts.
 */

export type CharacterSpriteId =
  | 'eli'
  | 'eli_shane'
  | 'pronto'
  | 'trixie'
  | 'kord'
  | 'will_shane'
  | 'merchant'
  | 'mercader_subterraneo'
  | 'trainer'
  | 'red_hook'
  | 'twist'
  | 'mercenary'
  | 'blakk_soldier'
  | 'dr_blakk'
  | 'comandante_blakk'
  | 'boss_acuaticas'
  | 'boss_magma'
  | 'boss_heladas'
  | 'boss_cristalinas'
  | 'boss_sombrias';

const spriteCache = new Map<string, HTMLCanvasElement>();
const MAX_CHAR_CACHE = 720;

function setCached(key: string, canvas: HTMLCanvasElement): void {
  if (spriteCache.size >= MAX_CHAR_CACHE) {
    const first = spriteCache.keys().next().value;
    if (first) spriteCache.delete(first);
  }
  spriteCache.set(key, canvas);
}

function normalizeCharId(id?: string): CharacterSpriteId {
  if (!id) return 'eli';
  const low = id.toLowerCase();
  if (low === 'eli_shane' || low === 'eli') return 'eli';
  if (low === 'mercader_subterraneo' || low === 'merchant') return 'merchant';
  if (low === 'comandante_blakk' || low === 'blakk_commander') return 'comandante_blakk';
  if (low === 'dr_blakk' || low === 'blakk') return 'dr_blakk';
  if (low === 'blakk_soldier' || low === 'mercenary') return 'mercenary';
  if (low in CHARACTER_VISUAL_PROFILES) return low as CharacterSpriteId;
  if (low.startsWith('boss_')) return low as CharacterSpriteId;
  if (low === 'trainer') return 'trainer';
  return 'eli';
}

function isEnemySpriteId(norm: CharacterSpriteId): boolean {
  return (
    norm === 'red_hook' ||
    norm === 'twist' ||
    norm === 'mercenary' ||
    norm === 'blakk_soldier' ||
    norm === 'dr_blakk' ||
    norm === 'comandante_blakk' ||
    norm.startsWith('boss_')
  );
}

function getPaletteForSprite(id: CharacterSpriteId) {
  switch (id) {
    case 'eli':
    case 'eli_shane':
      return CHARACTER_VISUAL_PROFILES.eli_shane;
    case 'merchant':
    case 'mercader_subterraneo':
      return CHARACTER_VISUAL_PROFILES.mercader_subterraneo;
    case 'trainer':
      return {
        ...CHARACTER_VISUAL_PROFILES.eli_shane,
        id: 'trainer',
        name: 'Entrenador',
        hairColor: '#312e81',
        hairHighlight: '#6366f1',
        outfitPrimary: '#1e293b',
        outfitSecondary: '#0ea5e9',
        accentColor: '#facc15',
        blasterPrimary: '#38bdf8',
        blasterAccent: '#facc15',
      };
    default: {
      const profileId = id.replace(/^boss_/, '');
      return CHARACTER_VISUAL_PROFILES[id] || CHARACTER_VISUAL_PROFILES[profileId] || CHARACTER_VISUAL_PROFILES.eli_shane;
    }
  }
}

export function getHdCharacterSprite(
  characterId: string,
  dir: CharacterFacingDir = 'down',
  anim: CharacterAnimState = 'idle',
  frame = 0
): HTMLCanvasElement | null {
  const norm = normalizeCharId(characterId);
  if (norm.startsWith('boss_')) {
    return getHdBiomeBossSprite(norm, dir, anim, frame);
  }
  if (isEnemySpriteId(norm)) {
    return getHdEnemySprite(norm, dir, anim, frame);
  }

  const f = Math.abs(Math.floor(frame)) % 4;
  const key = `ch_${norm}_${dir}_${anim}_${f}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const S = HD_CHARACTER_SPRITE_SIZE; // 64
  const c = makeOffscreenCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const pal = getPaletteForSprite(norm);
  const cx = S / 2;
  const isSide = dir === 'left' || dir === 'right';
  const flip = dir === 'left' ? -1 : 1;
  const isUp = dir === 'up';

  const walkCycle = anim === 'walk' ? Math.sin((f / 4) * Math.PI * 2) : 0;
  const idleBob = anim === 'idle' ? Math.sin((f / 4) * Math.PI * 2) * 1.1 : 0;
  const stepLift = anim === 'walk' ? Math.abs(Math.cos((f / 4) * Math.PI * 2)) * 2.4 : 0;
  const hitTilt = anim === 'hit' ? -0.18 : 0;
  const combatLean = anim === 'combat' || anim === 'special' ? 0.09 : anim === 'interact' ? 0.05 : 0;

  // Ground shadow
  ctx.fillStyle = 'rgba(2, 6, 23, 0.46)';
  ctx.beginPath();
  ctx.ellipse(cx, S - 7, 14, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, S - 9 - stepLift + idleBob);
  ctx.scale(flip, 1);
  ctx.rotate(hitTilt + combatLean);

  const isTroll = norm === 'kord';
  const isMolenoid = norm === 'pronto';
  const bodyW = (isTroll ? 22 : isMolenoid ? 17 : 16) * (isSide ? 0.78 : 1);
  const bodyH = isTroll ? 23 : isMolenoid ? 18 : 21;

  // Legs / boots (staggered stride in side profile!)
  const strideA = isSide ? walkCycle * 4.2 : walkCycle * 3.2;
  const leftLegX = isSide ? -5 + strideA * 0.65 : -bodyW * 0.36;
  const rightLegX = isSide ? 0 - strideA * 0.65 : bodyW * 0.08;
  const leftLegY = -8 + (isSide ? 0 : strideA);
  const rightLegY = -8 - (isSide ? 0 : strideA);

  fillStrokeRoundRect(ctx, leftLegX, leftLegY, 6.2, 9, 2.5, '#0f172a', '#070b14', 2);
  fillStrokeRoundRect(ctx, rightLegX, rightLegY, 6.2, 9, 2.5, '#0f172a', '#070b14', 2);
  ctx.fillStyle = pal.outfitSecondary;
  ctx.fillRect(leftLegX + 0.3, leftLegY + 4.5, 5.6, 2.4);
  ctx.fillRect(rightLegX + 0.3, rightLegY + 4.5, 5.6, 2.4);

  // Flowing cloak / shawl (Merchant, Will Shane)
  if (norm === 'merchant' || norm === 'will_shane') {
    ctx.fillStyle = norm === 'will_shane' ? '#0369a1' : '#065f46';
    ctx.strokeStyle = '#070b14';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.62, -bodyH - 4);
    ctx.lineTo(bodyW * 0.62, -bodyH - 4);
    ctx.lineTo(bodyW * 0.76, -3 + walkCycle * 1.4);
    ctx.lineTo(-bodyW * 0.76, -3 - walkCycle * 1.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Torso jacket / armor with -45° cel-shaded gradient
  const torsoGrad = ctx.createLinearGradient(-bodyW * 0.5, -bodyH - 6, bodyW * 0.5, -6);
  torsoGrad.addColorStop(0, pal.outfitSecondary);
  torsoGrad.addColorStop(0.38, pal.outfitPrimary);
  torsoGrad.addColorStop(1, '#090d16');
  fillStrokeRoundRect(ctx, -bodyW * 0.5, -bodyH - 6, bodyW, bodyH, 5.5, torsoGrad, '#070b14', 2);

  // Up-direction backpack / crystal pack / quiver (so facing up looks genuinely turned away!)
  if (isUp) {
    fillStrokeRoundRect(
      ctx,
      -bodyW * 0.42,
      -bodyH - 3,
      bodyW * 0.84,
      14,
      3.5,
      norm === 'eli' ? '#ea580c' : norm === 'kord' ? '#b45309' : '#0f766e',
      '#060a12',
      1.7
    );
    ctx.fillStyle = pal.accentColor;
    ctx.beginPath();
    ctx.arc(0, -bodyH + 4, 2.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (norm === 'eli' || norm === 'will_shane' || norm === 'kord') {
    // Shoulder pauldrons
    fillStrokeRoundRect(ctx, -bodyW * 0.65, -bodyH - 6, 6.2, 8.2, 3, pal.outfitSecondary, '#070b14', 1.7);
    if (!isSide) {
      fillStrokeRoundRect(ctx, bodyW * 0.65 - 6.2, -bodyH - 6, 6.2, 8.2, 3, pal.outfitSecondary, '#070b14', 1.7);
    }
  }

  // Belt & Chest gear (Eli dual glowing slug canisters Ref 3)
  ctx.fillStyle = '#334155';
  ctx.fillRect(-bodyW * 0.48, -11, bodyW * 0.96, 3.2);
  if (!isUp) {
    if (norm === 'eli' || norm === 'will_shane' || norm === 'trainer') {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-bodyW * 0.42, -bodyH - 5);
      ctx.lineTo(bodyW * 0.4, -10);
      ctx.stroke();

      fillStrokeRoundRect(ctx, -4.8, -bodyH + 1, 3.8, 7.5, 1.5, pal.accentColor, '#070b14', 1.3);
      fillStrokeRoundRect(ctx, 0.4, -bodyH + 2.5, 3.8, 7.5, 1.5, pal.accentColor, '#070b14', 1.3);
    } else if (norm === 'kord') {
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(-3.5, -bodyH - 3, 7, 13);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-2, -14, 4, 3);
    } else if (norm === 'merchant') {
      ctx.fillStyle = '#2dd4bf';
      ctx.beginPath();
      ctx.arc(bodyW * 0.35, -10, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Arms + Equipment
  const armSwing = anim === 'walk' ? -walkCycle * 3.5 : anim === 'combat' ? -4 : anim === 'interact' ? -5 : 0;
  if (!isSide) {
    fillStrokeRoundRect(ctx, -bodyW * 0.68, -bodyH - 1 - armSwing * 0.4, 5, 11, 2.5, pal.skinTone, '#070b14', 1.7);
  }

  const weaponX = isSide ? 3 : bodyW * 0.36;
  const weaponY =
    anim === 'combat' || anim === 'special'
      ? -bodyH + 1
      : anim === 'interact'
      ? -bodyH - 2
      : -bodyH + 5 + armSwing * 0.4;
  fillStrokeRoundRect(
    ctx,
    isSide ? 1 : bodyW * 0.36,
    anim === 'interact' ? -bodyH - 5 : -bodyH - 1 + armSwing * 0.4,
    5.4,
    11,
    2.5,
    pal.outfitPrimary,
    '#070b14',
    1.7
  );

  if (!isUp) {
    if (norm === 'merchant') {
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(weaponX + 4, -2);
      ctx.lineTo(weaponX + 4, -bodyH - 12);
      ctx.stroke();
      ctx.fillStyle = '#5eead4';
      ctx.beginPath();
      ctx.arc(weaponX + 4, -bodyH - 14, 4.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (norm === 'trixie' && anim !== 'combat') {
      fillStrokeRoundRect(ctx, weaponX + 1, weaponY - 2, 7.5, 5.2, 1.5, '#14b8a6', '#070b14', 1.4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(weaponX + 5.6, weaponY - 0.8, 2.2, 2.6);
    } else {
      const gunW = 11.5;
      const gunH = 5.2;
      fillStrokeRoundRect(ctx, weaponX, weaponY, gunW, gunH, 2, pal.blasterPrimary, '#070b14', 1.5);
      ctx.fillStyle = pal.blasterAccent;
      ctx.fillRect(weaponX + gunW - 3.5, weaponY + 1.2, 3, gunH - 2.4);

      if (anim === 'combat' || anim === 'special') {
        ctx.strokeStyle = pal.blasterAccent;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(weaponX + gunW + 3, weaponY + gunH / 2, 3.8 + (f % 2), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Head & Neck
  const headY = -bodyH - 15;
  const headR = isTroll ? 11.4 : isMolenoid ? 9.4 : 10.2;
  ctx.strokeStyle = '#070b14';
  ctx.lineWidth = 2;

  const headGrad = ctx.createRadialGradient(-3, headY - 4, 2, 0, headY, headR + 2);
  headGrad.addColorStop(0, pal.skinTone);
  headGrad.addColorStop(1, isTroll ? '#2f536b' : isMolenoid ? '#4d7c0f' : '#c08c68');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (isTroll) {
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(-7, headY - 6);
    ctx.lineTo(-10, headY - 14);
    ctx.lineTo(-3, headY - 9);
    ctx.closePath();
    ctx.moveTo(7, headY - 6);
    ctx.lineTo(10, headY - 14);
    ctx.lineTo(3, headY - 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (isMolenoid && !isUp) {
    ctx.fillStyle = '#84cc16';
    ctx.beginPath();
    ctx.ellipse(isSide ? 8.5 : 0, headY + 2.5, 4.6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(isSide ? 11.5 : 0, headY + 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hair / Hood (full back cover when facing 'up')
  if (norm === 'merchant') {
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(0, headY - 1, headR + 1.5, isUp ? 0 : Math.PI * 0.85, isUp ? Math.PI * 2 : Math.PI * 2.15);
    if (!isUp) {
      ctx.lineTo(headR + 1, headY + 4);
      ctx.lineTo(-headR - 1, headY + 4);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = pal.hairColor;
    ctx.beginPath();
    if (isUp) {
      ctx.arc(0, headY - 1, headR + 1.2, 0, Math.PI * 2);
    } else {
      ctx.arc(0, headY - 2.5, headR + 0.8, Math.PI * 0.9, Math.PI * 2.1);
      ctx.lineTo(headR + 3, headY - 4);
      ctx.lineTo(headR - 1, headY - 10);
      ctx.lineTo(4, headY - headR - 5);
      ctx.lineTo(-1, headY - headR - 2);
      ctx.lineTo(-6, headY - headR - 5);
      ctx.lineTo(-headR - 3, headY - 4);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = pal.hairHighlight;
    ctx.beginPath();
    ctx.moveTo(-4, headY - headR - 1);
    ctx.lineTo(1, headY - headR - 4);
    ctx.lineTo(3, headY - headR + 2);
    ctx.closePath();
    ctx.fill();
  }

  if (norm === 'trixie') {
    ctx.fillStyle = '#10b981';
    ctx.fillRect(-headR, headY - 6.5, headR * 2, 3.2);
  }
  if ((norm === 'pronto' || norm === 'kord') && !isUp) {
    ctx.fillStyle = '#ca8a04';
    ctx.strokeStyle = '#070b14';
    ctx.lineWidth = 1.4;
    const gxOff = isSide ? 3 : 0;
    ctx.beginPath();
    if (!isSide) ctx.arc(-4.2 + gxOff, headY - 5.5, 3.5, 0, Math.PI * 2);
    ctx.arc(4.2 + gxOff, headY - 5.5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    if (!isSide) ctx.arc(-4.2 + gxOff, headY - 5.5, 2, 0, Math.PI * 2);
    ctx.arc(4.2 + gxOff, headY - 5.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!isUp) {
    const eyeOffsetX = isSide ? 4 : 0;
    const blink = anim === 'idle' && f === 3;
    if (blink) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (!isSide) {
        ctx.moveTo(-5.5 + eyeOffsetX, headY - 1);
        ctx.lineTo(-1.8 + eyeOffsetX, headY - 1);
      }
      ctx.moveTo(1.8 + eyeOffsetX, headY - 1);
      ctx.lineTo(5.5 + eyeOffsetX, headY - 1);
      ctx.stroke();
    } else {
      const leftX = -3.8 + eyeOffsetX;
      const rightX = 3.8 + eyeOffsetX;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (!isSide) ctx.ellipse(leftX, headY - 1, 2.5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(rightX, headY - 1, 2.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = pal.eyeColor;
      ctx.beginPath();
      if (!isSide) ctx.arc(leftX + 0.4, headY - 0.8, 1.5, 0, Math.PI * 2);
      ctx.arc(rightX + 0.4, headY - 0.8, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      if (!isSide) ctx.fillRect(leftX - 0.6, headY - 2.3, 1.1, 1.1);
      ctx.fillRect(rightX - 0.6, headY - 2.3, 1.1, 1.1);
    }

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    if (anim === 'combat' || anim === 'special') {
      ctx.arc(eyeOffsetX, headY + 4.5, 2.5, 0.1, Math.PI - 0.1);
    } else {
      ctx.moveTo(-2.2 + eyeOffsetX, headY + 4.4);
      ctx.quadraticCurveTo(eyeOffsetX, headY + 5.6, 2.6 + eyeOffsetX, headY + 4.1);
    }
    ctx.stroke();
  }

  if (norm === 'will_shane') {
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.72)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, headY, headR + 2.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (anim === 'hit') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
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

export function getHdBossSprite(
  bossId: string,
  anim: CharacterAnimState = 'idle',
  frame = 0
): HTMLCanvasElement | null {
  return getHdBiomeBossSprite(bossId, 'down', anim, frame);
}

export function getHdMechaSprite(
  tier: 1 | 2 | 3,
  theme: MechaTheme = 'shane_blue',
  dir: CharacterFacingDir = 'down',
  anim: CharacterAnimState = 'idle',
  frame = 0
): HTMLCanvasElement | null {
  const f = Math.abs(Math.floor(frame)) % 4;
  const key = `mecha_${tier}_${theme}_${dir}_${anim}_${f}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const S = HD_CHARACTER_SPRITE_SIZE + 8; // 72×72 Mecha chassis
  const c = makeOffscreenCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const palette =
    theme === 'molten_core'
      ? { primary: '#ea580c', metal: '#431407', glow: '#facc15' }
      : theme === 'frost_pulse'
      ? { primary: '#0891b2', metal: '#083344', glow: '#67e8f9' }
      : theme === 'shadow_stealth'
      ? { primary: '#7e22ce', metal: '#1e1b2e', glow: '#f43f5e' }
      : { primary: '#0284c7', metal: '#0f172a', glow: '#38bdf8' };

  const stride = anim === 'walk' ? Math.sin((f / 4) * Math.PI * 2) * 3.5 : 0;
  const cx = S / 2;

  ctx.fillStyle = 'rgba(2, 6, 23, 0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, S - 7, 19, 6.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, S - 10 - Math.abs(stride) * 0.6);
  if (dir === 'left') ctx.scale(-1, 1);

  ctx.strokeStyle = '#070b14';
  ctx.lineWidth = 2;

  // Articulated Mecha Legs (safe roundRectPath)
  ctx.fillStyle = palette.metal;
  roundRectPath(ctx, -18, -14 + stride, 8, 16, 3);
  ctx.fill();
  ctx.stroke();
  roundRectPath(ctx, 10, -14 - stride, 8, 16, 3);
  ctx.fill();
  ctx.stroke();

  if (tier >= 2) {
    ctx.fillStyle = palette.glow;
    ctx.beginPath();
    ctx.arc(-15, -24, 4, 0, Math.PI * 2);
    ctx.arc(15, -24, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const bodyGrad = ctx.createLinearGradient(-15, -34, 15, -10);
  bodyGrad.addColorStop(0, palette.primary);
  bodyGrad.addColorStop(1, palette.metal);
  fillStrokeRoundRect(ctx, -15, -33, 30, 22, 6, bodyGrad, '#070b14', 2);

  fillStrokeRoundRect(ctx, -9, -29, 18, 6, 3, palette.glow, '#070b14', 1.6);

  // Eli riding in cockpit
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.arc(0, -39, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(-8, -34, 16, 3);

  if (tier === 3) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(-15, -28);
    ctx.lineTo(-27, -37);
    ctx.lineTo(-17, -20);
    ctx.closePath();
    ctx.moveTo(15, -28);
    ctx.lineTo(27, -37);
    ctx.lineTo(17, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
  setCached(key, c);
  return c;
}
