import { SLUG_DESIGN_SHEETS, type SlugDesignSheet } from '../../game/slugArtDirection';
import { getSpecies } from '../../game/data';
import { HD_SLUG_SPRITE_SIZE, type SlugAnimState } from '../manifest';

/**
 * Pipeline anatómico HiDPI (64×64) para todas las 20 especies de babosas.
 * Basado en las láminas de referencia:
 * - Anatomía segmentada: cabeza expresiva, tórax/coraza, abdomen translúcido luminoso,
 *   extremidades con garras y alas venadas desplegables en vuelo/transformación.
 * - Tres variantes visuales diferenciadas: Normal, Megamorph y Malvada (Ghoul).
 */

export type SlugVisualForm = 'normal' | 'megamorph' | 'ghoul';

const slugCache = new Map<string, HTMLCanvasElement>();
const MAX_SLUG_CACHE = 900;

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function setCached(key: string, canvas: HTMLCanvasElement): void {
  if (slugCache.size >= MAX_SLUG_CACHE) {
    const first = slugCache.keys().next().value;
    if (first) slugCache.delete(first);
  }
  slugCache.set(key, canvas);
}

export function isGhoulSpeciesId(speciesId: string): boolean {
  return speciesId === 'darkfurnus' || speciesId === 'umbrospect';
}

export function resolveSlugVisualForm(speciesId: string, mega = false): SlugVisualForm {
  if (mega) return 'megamorph';
  if (isGhoulSpeciesId(speciesId)) return 'ghoul';
  return 'normal';
}

function getSheetOrFallback(speciesId: string): SlugDesignSheet {
  return SLUG_DESIGN_SHEETS[speciesId] || SLUG_DESIGN_SHEETS.infurnus;
}

export function getHdSlugSprite(
  speciesId: string,
  mega = false,
  pose: SlugAnimState = 'idle',
  frame = 0,
  dir: 'right' | 'left' = 'right'
): HTMLCanvasElement | null {
  const f = Math.abs(Math.floor(frame)) % 4;
  const form = resolveSlugVisualForm(speciesId, mega);
  const key = `hdslug_${speciesId}_${form}_${pose}_${f}_${dir}`;
  const existing = slugCache.get(key);
  if (existing) return existing;

  const S = HD_SLUG_SPRITE_SIZE; // 64×64
  const c = makeCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const sp = getSpecies(speciesId);
  const sheet = getSheetOrFallback(speciesId);
  const pal = sheet.palette;

  const primary = form === 'ghoul' ? '#4c1d95' : pal.primary || sp.color;
  const secondary = form === 'ghoul' ? '#be123c' : pal.secondary || sp.accent;
  const belly = form === 'ghoul' ? '#1e1b2e' : pal.belly;
  const glowColor = form === 'megamorph' ? '#facc15' : form === 'ghoul' ? '#f43f5e' : pal.energyCore;

  // Dynamic motion transforms per animation state
  const phase = (f / 4) * Math.PI * 2;
  const isAerial =
    pose === 'wing_flap' ||
    pose === 'float' ||
    pose === 'fire' ||
    pose === 'transform' ||
    pose === 'attack' ||
    pose === 'victory';
  const hopOffset =
    pose === 'hop' || pose === 'walk'
      ? -Math.abs(Math.sin(phase)) * 6.5
      : isAerial
      ? -5 + Math.sin(phase) * 3
      : Math.sin(phase) * 1.4;
  const squashX = pose === 'hop' ? (f % 2 === 0 ? 1.1 : 0.92) : pose === 'charge' ? 1.12 : 1;
  const squashY = pose === 'hop' ? (f % 2 === 0 ? 0.9 : 1.1) : pose === 'charge' ? 0.88 : 1;
  const tilt =
    pose === 'fire' || pose === 'attack'
      ? 0.24
      : pose === 'hit'
      ? -0.28
      : pose === 'transform'
      ? -0.14
      : pose === 'sleep'
      ? 0.1
      : 0;

  const cx = S / 2;
  const baseY = S - 10;

  // Drop shadow on floor
  ctx.fillStyle = form === 'ghoul' ? 'rgba(88, 28, 135, 0.45)' : 'rgba(2, 6, 23, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 1, isAerial ? 12 : 15, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Energy aura for Megamorph / Ghoul / Transform / Charge
  if (form !== 'normal' || pose === 'transform' || pose === 'charge' || pose === 'victory') {
    ctx.save();
    ctx.globalAlpha = pose === 'transform' ? 0.72 : 0.44;
    const aura = ctx.createRadialGradient(cx, baseY - 18 + hopOffset, 4, cx, baseY - 18 + hopOffset, 27);
    aura.addColorStop(0, glowColor);
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, baseY - 18 + hopOffset, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, baseY - 14 + hopOffset);
  if (dir === 'left') ctx.scale(-1, 1);
  ctx.rotate(tilt);
  ctx.scale(
    squashX * Math.max(0.86, Math.min(1.22, sheet.bodyProportions.widthScale)),
    squashY * Math.max(0.88, Math.min(1.18, sheet.bodyProportions.heightScale))
  );

  // Articulated Veined Flight Wings (inspired by Hoverbug sheet in aerial/megamorph/transform)
  if (isAerial || form === 'megamorph') {
    const wingAngle = -0.35 + Math.sin(phase * 2) * 0.42;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 6, -4);
      ctx.rotate(side * wingAngle);

      const wingGrad = ctx.createLinearGradient(0, 0, side * 19, -18);
      wingGrad.addColorStop(0, secondary);
      wingGrad.addColorStop(0.55, glowColor);
      wingGrad.addColorStop(1, 'rgba(255,255,255,0.45)');
      ctx.fillStyle = wingGrad;
      ctx.strokeStyle = '#070b14';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * 12, -19, side * 22, -13);
      ctx.quadraticCurveTo(side * 16, -2, side * 8, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Golden/cyan membrane veins
      ctx.strokeStyle = '#fef9c3';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(side * 2, -2);
      ctx.lineTo(side * 17, -11);
      ctx.moveTo(side * 2, -1);
      ctx.lineTo(side * 13, -4);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Swim ripples if in swim pose
  if (pose === 'swim') {
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 14, 17, 4.5, 0, 0, Math.PI);
    ctx.stroke();
  }

  // Tail / Glowing Translucent Abdomen
  ctx.strokeStyle = '#060a12';
  ctx.lineWidth = 2;
  ctx.fillStyle = glowColor;
  ctx.beginPath();
  ctx.moveTo(-7, 10);
  ctx.quadraticCurveTo(-17, 14, -20, 6);
  ctx.quadraticCurveTo(-13, 2, -5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Body Core (Cel-shaded volumetric slug torso)
  const bodyGrad = ctx.createRadialGradient(-4, -6, 3, 2, 2, 19);
  bodyGrad.addColorStop(0, pal.highlight || '#ffffff');
  bodyGrad.addColorStop(0.35, primary);
  bodyGrad.addColorStop(0.85, pal.shadow || '#0f172a');
  bodyGrad.addColorStop(1, '#060a12');
  ctx.fillStyle = bodyGrad;

  ctx.beginPath();
  if (sheet.anatomyClass === 'armored_crawler' || sheet.anatomyClass === 'armored_mortar' || sheet.anatomyClass === 'heavy_rhino') {
    // Broad armored carapace shape (Armashelt / Frostcrawler / Rammstone)
    ctx.roundRect(-13, -15, 26, 31, [12, 12, 8, 8]);
  } else if (sheet.anatomyClass === 'bubble_orb' || sheet.anatomyClass === 'psychic_orb') {
    // Plump round orb (Bubbaleone / Enigmo)
    ctx.ellipse(0, 0, 14, 16, 0, 0, Math.PI * 2);
  } else {
    // Classic tapered Slugterra body
    ctx.moveTo(-10, -14);
    ctx.bezierCurveTo(-12, -23, 12, -23, 11, -12);
    ctx.bezierCurveTo(13, 4, 12, 16, 0, 16);
    ctx.bezierCurveTo(-12, 16, -12, 4, -10, -14);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  // Belly Scutes / Pattern (reference striped chest & abdomen)
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(2.2, 4.5, 7.2, 9.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Armored Plates / Chest Diamond / Thorax Stripes
  if (speciesId === 'armashelt' || speciesId === 'rammstone' || speciesId === 'frostcrawler') {
    ctx.fillStyle = secondary;
    ctx.strokeStyle = '#070b14';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-8, -2, 16, 10, 4);
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'infurnus' || speciesId === 'darkfurnus' || speciesId === 'piroclasto') {
    // Glowing diamond emblem on forehead
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.moveTo(1, -19);
    ctx.lineTo(4.2, -15);
    ctx.lineTo(1, -11);
    ctx.lineTo(-2.2, -15);
    ctx.closePath();
    ctx.fill();
  }

  // Clawed stubby arms
  ctx.fillStyle = primary;
  ctx.strokeStyle = '#060a12';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(-11.5, 3, 4, 2.4, 0.35, 0, Math.PI * 2);
  ctx.ellipse(12, 3, 4, 2.4, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Species-specific Head Appendages (Crests, Horns, Ears, Feathers)
  ctx.fillStyle = secondary;
  ctx.strokeStyle = '#060a12';
  ctx.lineWidth = 1.7;
  if (speciesId === 'infurnus' || speciesId === 'flaringo' || speciesId === 'piroclasto') {
    // Flame crest tongues
    ctx.beginPath();
    ctx.moveTo(-7, -17);
    ctx.lineTo(-9, -27 - (f % 2));
    ctx.lineTo(-2, -21);
    ctx.lineTo(1, -29 + (f % 2));
    ctx.lineTo(5, -21);
    ctx.lineTo(10, -26);
    ctx.lineTo(7, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'tazerling' || speciesId === 'voltrix') {
    // Zigzag lightning antennae
    ctx.beginPath();
    ctx.moveTo(-5, -17);
    ctx.lineTo(-10, -27);
    ctx.lineTo(-3, -23);
    ctx.moveTo(5, -17);
    ctx.lineTo(11, -27);
    ctx.lineTo(4, -23);
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'armashelt' || speciesId === 'rammstone' || speciesId === 'lariat') {
    // Heavy twin horns + brow helmet
    ctx.beginPath();
    ctx.moveTo(-11, -12);
    ctx.lineTo(-14, -24);
    ctx.lineTo(-4, -17);
    ctx.moveTo(11, -12);
    ctx.lineTo(14, -24);
    ctx.lineTo(4, -17);
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'frostcrawler' || speciesId === 'glaciomita') {
    // Triple ice-crystal crown
    ctx.beginPath();
    ctx.moveTo(-6, -16);
    ctx.lineTo(-7, -25);
    ctx.lineTo(-2, -19);
    ctx.lineTo(0, -27);
    ctx.lineTo(2, -19);
    ctx.lineTo(7, -25);
    ctx.lineTo(6, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'musgacorn' || speciesId === 'arachnet') {
    // Leafy / silk crest horns
    ctx.beginPath();
    ctx.ellipse(-5, -21, 3.2, 6, -0.35, 0, Math.PI * 2);
    ctx.ellipse(5, -21, 3.2, 6, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // Classic curved dual slug feelers / fins
    ctx.beginPath();
    ctx.quadraticCurveTo(-8, -26, -3, -24);
    ctx.lineTo(-2, -16);
    ctx.lineTo(-7, -16);
    ctx.closePath();
    ctx.moveTo(7, -16);
    ctx.quadraticCurveTo(9, -26, 3, -24);
    ctx.lineTo(2, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Megamorph Golden Vane Crown
  if (form === 'megamorph') {
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-12, -10);
    ctx.lineTo(-17, -18);
    ctx.lineTo(-10, -16);
    ctx.moveTo(12, -10);
    ctx.lineTo(17, -18);
    ctx.lineTo(10, -16);
    ctx.fill();
    ctx.stroke();
  }

  // Expressive Eyes & Mouths (matching Image 2 reference sheets!)
  const blink = pose === 'sleep' || (pose === 'idle' && f === 3);
  const isFierce = form === 'ghoul' || pose === 'attack' || pose === 'fire' || pose === 'charge';

  if (speciesId === 'fandango' || speciesId === 'enigmo') {
    // Expressive large central cyclops / cosmic optic eye
    ctx.fillStyle = blink ? '#1e293b' : form === 'ghoul' ? '#ef4444' : '#ffffff';
    ctx.strokeStyle = '#060a12';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(1, -10, 5.8, blink ? 1.3 : 5.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!blink) {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(2, -10, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0.8, -11.5, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Twin expressive anime/Slugterra eyes
    for (const ex of [-4.2, 5.2]) {
      if (blink) {
        ctx.strokeStyle = '#060a12';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(ex - 2.6, -9);
        ctx.lineTo(ex + 2.6, -9);
        ctx.stroke();
      } else {
        ctx.fillStyle = form === 'ghoul' ? '#dc2626' : '#ffffff';
        ctx.strokeStyle = '#060a12';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(ex, -9.5, 3.2, isFierce ? 2.6 : 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pupil + gleam
        ctx.fillStyle = form === 'ghoul' ? '#09090b' : pal.eyeIris || '#0f172a';
        ctx.beginPath();
        ctx.arc(ex + 0.6, -9.3, 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 0.5, -10.8, 1, 0, Math.PI * 2);
        ctx.fill();

        // Fierce slanted brow for combat/ghoul
        if (isFierce) {
          ctx.strokeStyle = '#060a12';
          ctx.lineWidth = 1.9;
          ctx.beginPath();
          ctx.moveTo(ex - 3.2, ex < 0 ? -13.2 : -11.4);
          ctx.lineTo(ex + 3.2, ex < 0 ? -11.4 : -13.2);
          ctx.stroke();
        }
      }
    }
  }

  // Expressive Mouth & Fangs
  ctx.strokeStyle = '#060a12';
  ctx.lineWidth = 1.4;
  if (isFierce || pose === 'eat' || pose === 'victory') {
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.ellipse(1, -2.5, 4.6, 2.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Sharp cute/fierce fangs
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-2.4, -4.2);
    ctx.lineTo(-1.2, -1.5);
    ctx.lineTo(0, -4.2);
    ctx.moveTo(2, -4.2);
    ctx.lineTo(3.2, -1.5);
    ctx.lineTo(4.4, -4.2);
    ctx.fill();
  } else if (pose === 'sleep') {
    ctx.beginPath();
    ctx.arc(1, -2.5, 1.5, 0, Math.PI);
    ctx.stroke();
  } else {
    // Cheerful smile
    ctx.beginPath();
    ctx.moveTo(-3.2, -3.2);
    ctx.quadraticCurveTo(1, -0.5, 4.8, -3.2);
    ctx.stroke();
  }

  // Eat food nibble
  if (pose === 'eat') {
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(6.5, -1.5, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  setCached(key, c);
  return c;
}
