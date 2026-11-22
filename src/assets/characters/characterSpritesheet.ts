import { CHARACTER_VISUAL_PROFILES } from '../../game/characterArt';
import type { MechaTheme } from '../../game/types';
import {
  HD_BOSS_SPRITE_SIZE,
  HD_CHARACTER_SPRITE_SIZE,
  type CharacterAnimState,
  type CharacterFacingDir,
} from '../manifest';

/**
 * Generador HiDPI (64×64 personajes / 80×80 jefes) con estética cel-shaded.
 * Produce siluetas diferenciadas, armadura/ropa con iluminación superior-izquierda,
 * blásteres detallados, accesorios icónicos y estados de animación fluidos.
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

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

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
    case 'mercenary':
    case 'blakk_soldier':
      return {
        ...CHARACTER_VISUAL_PROFILES.comandante_blakk,
        id: 'mercenary',
        name: 'Soldado de Blakk',
        outfitPrimary: '#111827',
        outfitSecondary: '#991b1b',
        accentColor: '#ef4444',
        blasterPrimary: '#581c87',
        blasterAccent: '#f43f5e',
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
    return getHdBossSprite(norm, anim, frame);
  }

  const f = Math.abs(Math.floor(frame)) % 4;
  const key = `ch_${norm}_${dir}_${anim}_${f}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const S = HD_CHARACTER_SPRITE_SIZE; // 64
  const c = makeCanvas(S, S);
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
  const stepLift = anim === 'walk' ? Math.abs(Math.cos((f / 4) * Math.PI * 2)) * 2.2 : 0;
  const hitTilt = anim === 'hit' ? -0.18 : 0;
  const combatLean = anim === 'combat' || anim === 'special' ? 0.08 : 0;

  // Ground shadow
  ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, S - 7, 14, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, S - 9 - stepLift + idleBob);
  ctx.scale(flip, 1);
  ctx.rotate(hitTilt + combatLean);

  const isTroll = norm === 'kord';
  const isMolenoid = norm === 'pronto';
  const isBlakk = norm === 'dr_blakk' || norm === 'comandante_blakk';
  const bodyW = isTroll ? 22 : isMolenoid ? 17 : isBlakk ? 19 : 16;
  const bodyH = isTroll ? 23 : isBlakk ? 25 : 21;

  // Legs / boots
  const leftLegY = -8 + walkCycle * 3.5;
  const rightLegY = -8 - walkCycle * 3.5;
  ctx.strokeStyle = '#070b14';
  ctx.lineWidth = 2;

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(-bodyW * 0.36, leftLegY, 6.2, 9, 2.5);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(bodyW * 0.08, rightLegY, 6.2, 9, 2.5);
  ctx.fill();
  ctx.stroke();

  // Boot cuffs
  ctx.fillStyle = pal.outfitSecondary;
  ctx.fillRect(-bodyW * 0.35, leftLegY + 4.5, 5.8, 2.4);
  ctx.fillRect(bodyW * 0.09, rightLegY + 4.5, 5.8, 2.4);

  // Flowing cloak / explorer backpack (Merchant, Will Shane, Pronto, Twist)
  if (norm === 'merchant' || norm === 'will_shane' || norm === 'twist') {
    ctx.fillStyle = norm === 'will_shane' ? '#0369a1' : norm === 'twist' ? '#14532d' : '#065f46';
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.6, -bodyH - 4);
    ctx.lineTo(bodyW * 0.6, -bodyH - 4);
    ctx.lineTo(bodyW * 0.72, -3);
    ctx.lineTo(-bodyW * 0.72, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Torso jacket / armor with cel-shaded gradient
  const torsoGrad = ctx.createLinearGradient(-bodyW * 0.5, -bodyH - 6, bodyW * 0.5, -6);
  torsoGrad.addColorStop(0, pal.outfitSecondary);
  torsoGrad.addColorStop(0.35, pal.outfitPrimary);
  torsoGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.roundRect(-bodyW * 0.5, -bodyH - 6, bodyW, bodyH, 5.5);
  ctx.fill();
  ctx.stroke();

  // High collar for Dr. Blakk / Comandante
  if (isBlakk) {
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.54, -bodyH - 4);
    ctx.lineTo(-bodyW * 0.72, -bodyH - 13);
    ctx.lineTo(-2, -bodyH - 6);
    ctx.lineTo(bodyW * 0.72, -bodyH - 13);
    ctx.lineTo(bodyW * 0.54, -bodyH - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Shoulder pauldrons (Eli orange armor, Kord harness, Will Shane crest)
  if (!isUp && (norm === 'eli' || norm === 'will_shane' || norm === 'kord' || norm === 'mercenary')) {
    ctx.fillStyle = pal.outfitSecondary;
    ctx.beginPath();
    ctx.roundRect(-bodyW * 0.62, -bodyH - 6, 6.5, 8.5, 3);
    ctx.roundRect(bodyW * 0.62 - 6.5, -bodyH - 6, 6.5, 8.5, 3);
    ctx.fill();
    ctx.stroke();
  }

  // Belt & Slug Canisters (Eli iconic twin cyan tubes on chest / waist)
  ctx.fillStyle = '#334155';
  ctx.fillRect(-bodyW * 0.48, -11, bodyW * 0.96, 3.2);
  if (!isUp) {
    if (norm === 'eli' || norm === 'will_shane' || norm === 'trainer') {
      // Diagonal bandolier + dual slug canisters
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-bodyW * 0.44, -bodyH - 5);
      ctx.lineTo(bodyW * 0.42, -10);
      ctx.stroke();

      ctx.strokeStyle = '#070b14';
      ctx.lineWidth = 1.4;
      ctx.fillStyle = pal.accentColor;
      ctx.beginPath();
      ctx.roundRect(-5, -bodyH + 1, 3.8, 7.5, 1.5);
      ctx.roundRect(0.2, -bodyH + 2.5, 3.8, 7.5, 1.5);
      ctx.fill();
      ctx.stroke();
    } else if (norm === 'kord') {
      // Kord wrench emblem & heavy orange X-harness
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(-3.5, -bodyH - 3, 7, 13);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-2, -14, 4, 3);
    } else if (norm === 'merchant') {
      // Turquoise lantern orb hanging from belt
      ctx.fillStyle = '#2dd4bf';
      ctx.beginPath();
      ctx.arc(bodyW * 0.35, -10, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Arms & Weapon / Accessory (Blaster, Hook, Chromecorder, Lantern Staff)
  const armSwing = anim === 'walk' ? -walkCycle * 3.5 : anim === 'combat' ? -4 : 0;
  // Back / Left arm
  ctx.fillStyle = pal.skinTone;
  ctx.strokeStyle = '#070b14';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-bodyW * 0.65, -bodyH - 1 - armSwing * 0.4, 5, 11, 2.5);
  ctx.fill();
  ctx.stroke();

  if (norm === 'red_hook') {
    // Gleaming iron pirate hook on left arm
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(-bodyW * 0.56, -bodyH + 12, 3.5, Math.PI * 0.2, Math.PI * 1.6);
    ctx.stroke();
  }

  // Front / Blaster arm
  const weaponX = isSide ? bodyW * 0.45 : bodyW * 0.36;
  const weaponY = anim === 'combat' || anim === 'special' ? -bodyH + 1 : -bodyH + 5 + armSwing * 0.4;
  ctx.fillStyle = pal.outfitPrimary;
  ctx.strokeStyle = '#070b14';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(bodyW * 0.36, -bodyH - 1 + armSwing * 0.4, 5.4, 11, 2.5);
  ctx.fill();
  ctx.stroke();

  // Character-specific hand item / Blaster
  if (norm === 'merchant') {
    // Wooden staff with glowing crystal lantern
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(weaponX + 4, -2);
    ctx.lineTo(weaponX + 4, -bodyH - 12);
    ctx.stroke();
    ctx.fillStyle = '#5eead4';
    ctx.beginPath();
    ctx.arc(weaponX + 4, -bodyH - 14, 4.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (norm === 'trixie' && anim !== 'combat') {
    // Teal Chromecorder scanner
    ctx.fillStyle = '#14b8a6';
    ctx.strokeStyle = '#070b14';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(weaponX + 1, weaponY - 2, 7, 5, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(weaponX + 5.5, weaponY - 1, 2.2, 2.6);
  } else {
    // Detailed Slugterra Blaster (Eli orange/cyan or Blakk purple/crimson gatling)
    ctx.fillStyle = pal.blasterPrimary;
    ctx.strokeStyle = '#070b14';
    ctx.lineWidth = 1.6;
    const gunW = isBlakk ? 14 : 11;
    const gunH = isBlakk ? 6.2 : 5;
    ctx.beginPath();
    ctx.roundRect(weaponX, weaponY, gunW, gunH, 2);
    ctx.fill();
    ctx.stroke();
    // Slug barrel glow core
    ctx.fillStyle = pal.blasterAccent;
    ctx.fillRect(weaponX + gunW - 3.5, weaponY + 1.2, 3, gunH - 2.4);

    if (anim === 'combat' || anim === 'special') {
      // Muzzle accelerator ring flash
      ctx.strokeStyle = pal.blasterAccent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(weaponX + gunW + 3, weaponY + gunH / 2, 3.8 + (f % 2), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Head & Neck
  const headY = -bodyH - 15;
  const headR = isTroll ? 11.5 : isMolenoid ? 9.5 : 10.2;

  ctx.strokeStyle = '#070b14';
  ctx.lineWidth = 2;

  if (norm === 'mercenary' || norm === 'blakk_soldier') {
    // Tactical Blakk Helmet
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!isUp) {
      // Glowing crimson visor
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(-7, headY - 2.5, 14, 4.5, 2);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    // Head base
    const headGrad = ctx.createRadialGradient(-3, headY - 4, 2, 0, headY, headR + 2);
    headGrad.addColorStop(0, pal.skinTone);
    headGrad.addColorStop(1, isTroll ? '#2f536b' : isMolenoid ? '#4d7c0f' : '#c08c68');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Kord horns
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

    // Molenoid snout
    if (isMolenoid && !isUp) {
      ctx.fillStyle = '#84cc16';
      ctx.beginPath();
      ctx.ellipse(isSide ? 8 : 0, headY + 2.5, 4.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(isSide ? 11 : 0, headY + 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hair / Hood
    if (norm === 'merchant' || norm === 'twist') {
      ctx.fillStyle = norm === 'twist' ? '#1f2937' : '#064e3b';
      ctx.beginPath();
      ctx.arc(0, headY - 1, headR + 1.5, Math.PI * 0.85, Math.PI * 2.15);
      ctx.lineTo(headR + 1, headY + 4);
      ctx.lineTo(-headR - 1, headY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = pal.hairColor;
      ctx.beginPath();
      ctx.arc(0, headY - 2.5, headR + 0.8, Math.PI * 0.9, Math.PI * 2.1);
      // Spiky hair locks (Eli / Blakk / Will)
      ctx.lineTo(headR + 3, headY - 4);
      ctx.lineTo(headR - 1, headY - 10);
      ctx.lineTo(4, headY - headR - 5);
      ctx.lineTo(-1, headY - headR - 2);
      ctx.lineTo(-6, headY - headR - 5);
      ctx.lineTo(-headR - 3, headY - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Hair highlight streak
      ctx.fillStyle = pal.hairHighlight;
      ctx.beginPath();
      ctx.moveTo(-4, headY - headR - 1);
      ctx.lineTo(1, headY - headR - 4);
      ctx.lineTo(3, headY - headR + 2);
      ctx.closePath();
      ctx.fill();
    }

    // Headgear (Trixie green headband, Pronto/Kord goggles, Red Hook pirate patch)
    if (norm === 'trixie') {
      ctx.fillStyle = '#10b981';
      ctx.fillRect(-headR, headY - 6.5, headR * 2, 3.2);
    }
    if ((norm === 'pronto' || norm === 'kord') && !isUp) {
      ctx.fillStyle = '#ca8a04';
      ctx.strokeStyle = '#070b14';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(-4.2, headY - 5.5, 3.5, 0, Math.PI * 2);
      ctx.arc(4.2, headY - 5.5, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(-4.2, headY - 5.5, 2, 0, Math.PI * 2);
      ctx.arc(4.2, headY - 5.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Face details (eyes + expression)
    if (!isUp) {
      const eyeOffsetX = isSide ? 3.5 : 0;
      const blink = anim === 'idle' && f === 3;

      if (blink) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-5.5 + eyeOffsetX, headY - 1);
        ctx.lineTo(-1.8 + eyeOffsetX, headY - 1);
        ctx.moveTo(1.8 + eyeOffsetX, headY - 1);
        ctx.lineTo(5.5 + eyeOffsetX, headY - 1);
        ctx.stroke();
      } else {
        // Expressive anime/cartoon eye whites + iris
        const leftX = -3.8 + eyeOffsetX;
        const rightX = 3.8 + eyeOffsetX;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        if (!isSide) {
          ctx.ellipse(leftX, headY - 1, 2.5, 3, 0, 0, Math.PI * 2);
        }
        ctx.ellipse(rightX, headY - 1, 2.5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = pal.eyeColor;
        ctx.beginPath();
        if (!isSide) ctx.arc(leftX + 0.4, headY - 0.8, 1.5, 0, Math.PI * 2);
        ctx.arc(rightX + 0.4, headY - 0.8, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Eye glint
        ctx.fillStyle = '#ffffff';
        if (!isSide) ctx.fillRect(leftX - 0.6, headY - 2.3, 1.1, 1.1);
        ctx.fillRect(rightX - 0.6, headY - 2.3, 1.1, 1.1);
      }

      // Red Hook eyepatch
      if (norm === 'red_hook') {
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.ellipse(-3.6 + eyeOffsetX, headY - 1, 3.1, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#09090b';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-headR, headY - 4);
        ctx.lineTo(headR, headY + 1);
        ctx.stroke();
      }

      // Blakk Goatee & Scowl
      if (pal.hasGoatee) {
        ctx.fillStyle = pal.hairColor;
        ctx.beginPath();
        ctx.moveTo(-2.5, headY + 6.5);
        ctx.lineTo(2.5, headY + 6.5);
        ctx.lineTo(0, headY + 11.2);
        ctx.closePath();
        ctx.fill();
      }

      // Determined mouth / grin
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
  }

  // Will Shane Holographic Shimmer Rim
  if (norm === 'will_shane') {
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.72)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, headY, headR + 2.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Hit / Special aura overlay
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
  const f = Math.abs(Math.floor(frame)) % 4;
  const key = `boss_${bossId}_${anim}_${f}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const S = HD_BOSS_SPRITE_SIZE; // 80
  const c = makeCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const hover = Math.sin((f / 4) * Math.PI * 2) * 2.5;
  const cx = S / 2;
  const cy = S / 2 + hover;

  const theme =
    bossId.includes('acuaticas')
      ? { body: '#0284c7', armor: '#0f172a', glow: '#22d3ee', eyes: '#fef08a' }
      : bossId.includes('magma')
      ? { body: '#dc2626', armor: '#451a03', glow: '#fb923c', eyes: '#fde047' }
      : bossId.includes('heladas')
      ? { body: '#0891b2', armor: '#e0f2fe', glow: '#67e8f9', eyes: '#0f172a' }
      : bossId.includes('cristalinas')
      ? { body: '#6366f1', armor: '#c7d2fe', glow: '#a78bfa', eyes: '#fde047' }
      : { body: '#581c87', armor: '#09090b', glow: '#f43f5e', eyes: '#ef4444' };

  // Boss shadow & menacing elemental ring
  ctx.fillStyle = 'rgba(2, 6, 23, 0.52)';
  ctx.beginPath();
  ctx.ellipse(cx, S - 8, 22, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = theme.glow;
  ctx.lineWidth = 2.2;
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.ellipse(cx, S - 9, 24 + (f % 2) * 2, 8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(cx, cy);

  // Armored Boss Torso + Spiked Pauldrons / Crown
  const grad = ctx.createRadialGradient(-6, -8, 4, 0, 0, 26);
  grad.addColorStop(0, theme.glow);
  grad.addColorStop(0.45, theme.body);
  grad.addColorStop(1, '#090d16');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#050810';
  ctx.lineWidth = 2.4;

  // Horns / Wing Spires
  ctx.beginPath();
  ctx.moveTo(-22, -4);
  ctx.lineTo(-31, -24);
  ctx.lineTo(-10, -14);
  ctx.lineTo(0, -30);
  ctx.lineTo(10, -14);
  ctx.lineTo(31, -24);
  ctx.lineTo(22, -4);
  ctx.lineTo(18, 22);
  ctx.lineTo(-18, 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Chest Core Plate
  ctx.fillStyle = theme.armor;
  ctx.beginPath();
  ctx.roundRect(-14, -4, 28, 18, 6);
  ctx.fill();
  ctx.stroke();

  // Elemental Chest Reactor
  ctx.fillStyle = theme.glow;
  ctx.beginPath();
  ctx.arc(0, 5, 5.2 + (f % 2) * 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Menacing Boss Visor / Eyes
  ctx.fillStyle = theme.eyes;
  ctx.beginPath();
  ctx.moveTo(-11, -14);
  ctx.lineTo(-3, -11);
  ctx.lineTo(-9, -8);
  ctx.closePath();
  ctx.moveTo(11, -14);
  ctx.lineTo(3, -11);
  ctx.lineTo(9, -8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  setCached(key, c);
  return c;
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
  const c = makeCanvas(S, S);
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

  // Articulated Mecha Legs (4-legged Strider silhouette)
  ctx.fillStyle = palette.metal;
  ctx.beginPath();
  ctx.roundRect(-18, -14 + stride, 8, 16, 3);
  ctx.roundRect(10, -14 - stride, 8, 16, 3);
  ctx.fill();
  ctx.stroke();

  // Rear / Tier 2-3 stabilizer thrusters
  if (tier >= 2) {
    ctx.fillStyle = palette.glow;
    ctx.beginPath();
    ctx.arc(-15, -24, 4, 0, Math.PI * 2);
    ctx.arc(15, -24, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chassis cockpit armor
  const bodyGrad = ctx.createLinearGradient(-15, -34, 15, -10);
  bodyGrad.addColorStop(0, palette.primary);
  bodyGrad.addColorStop(1, palette.metal);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(-15, -33, 30, 22, 6);
  ctx.fill();
  ctx.stroke();

  // Visor windshield & Shane Emblem
  ctx.fillStyle = palette.glow;
  ctx.beginPath();
  ctx.roundRect(-9, -29, 18, 6, 3);
  ctx.fill();
  ctx.stroke();

  // Eli helmet riding in cockpit!
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.arc(0, -39, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(-8, -34, 16, 3);

  // Tier 3 Accelerator wing blades
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
