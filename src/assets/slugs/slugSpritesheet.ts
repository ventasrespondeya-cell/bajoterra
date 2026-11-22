import { SLUG_DESIGN_SHEETS, type SlugDesignSheet } from '../../game/slugArtDirection';
import { getSpecies } from '../../game/data';
import {
  drawSoftGlow,
  fillStrokeRoundRect,
  makeOffscreenCanvas,
  roundRectPath,
} from '../canvasUtils';
import { HD_SLUG_SPRITE_SIZE, type SlugAnimState } from '../manifest';

/**
 * Pipeline anatómico HiDPI (64×64) individualizado para todas las 20 especies de babosas.
 * Basado en las láminas de referencia:
 * - Cada especie cuenta con silueta propia, cabeza/ojos/dientes expresivos, placas o abdomen
 *   luminoso, apéndices característicos (cuernos, crestas de fuego, rayos, aletas, patas de
 *   araña, cúpulas de burbuja, hojas de musgo, capas espectrales) y alas venadas desplegables.
 * - Soporta estados Normal, Megamorph y Malvada (Ghoul).
 */

export type SlugVisualForm = 'normal' | 'megamorph' | 'ghoul';

const slugCache = new Map<string, HTMLCanvasElement>();
const MAX_SLUG_CACHE = 960;

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
  const c = makeOffscreenCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const sp = getSpecies(speciesId);
  const sheet = getSheetOrFallback(speciesId);
  const pal = sheet.palette;

  const primary = form === 'ghoul' ? (speciesId === 'darkfurnus' ? '#4c1d95' : '#311042') : pal.primary || sp.color;
  const secondary = form === 'ghoul' ? '#be123c' : pal.secondary || sp.accent;
  const belly = form === 'ghoul' ? '#1e1b2e' : pal.belly;
  const glowColor = form === 'megamorph' ? '#facc15' : form === 'ghoul' ? '#f43f5e' : pal.energyCore;

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

  // Ground contact shadow
  ctx.fillStyle = form === 'ghoul' ? 'rgba(88, 28, 135, 0.45)' : 'rgba(2, 6, 23, 0.46)';
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 1, isAerial ? 12 : 15, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Energy halo for special / Megamorph / Ghoul forms
  if (form !== 'normal' || pose === 'transform' || pose === 'charge' || pose === 'victory') {
    ctx.save();
    ctx.globalAlpha = pose === 'transform' ? 0.72 : 0.42;
    drawSoftGlow(ctx, cx, baseY - 18 + hopOffset, 27, glowColor);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, baseY - 14 + hopOffset);
  if (dir === 'left') ctx.scale(-1, 1);
  ctx.rotate(tilt);
  ctx.scale(
    squashX * Math.max(0.84, Math.min(1.24, sheet.bodyProportions.widthScale)),
    squashY * Math.max(0.86, Math.min(1.2, sheet.bodyProportions.heightScale))
  );

  // Articulated Veined Wings (Hoverbug sheet inspiration for aerial/transform/megamorph & winged species)
  const hasNaturalWings = speciesId === 'flaringo' || speciesId === 'darkfurnus' || speciesId === 'aetherion';
  if (isAerial || form === 'megamorph' || hasNaturalWings) {
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

      // Finely traced golden/cyan wing veins (Hoverbug ref)
      ctx.strokeStyle = form === 'ghoul' ? '#fda4af' : '#fef9c3';
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

  // Swim ripples
  if (pose === 'swim') {
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 14, 17, 4.5, 0, 0, Math.PI);
    ctx.stroke();
  }

  // Species-specific Tail / Glowing Abdomen
  ctx.strokeStyle = '#060a12';
  ctx.lineWidth = 2;
  if (speciesId === 'tazerling' || speciesId === 'voltrix') {
    // Forked lightning tail
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(-6, 9);
    ctx.lineTo(-17, 4);
    ctx.lineTo(-14, 9);
    ctx.lineTo(-21, 12);
    ctx.lineTo(-6, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'aquabeak' || speciesId === 'bubbaleone') {
    // Fan tail fin
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.moveTo(-6, 9);
    ctx.quadraticCurveTo(-18, 2, -21, 9);
    ctx.quadraticCurveTo(-18, 17, -6, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'frostcrawler' || speciesId === 'armashelt' || speciesId === 'rammstone') {
    // Heavy armored club tail
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.moveTo(-7, 9);
    ctx.lineTo(-19, 6);
    ctx.lineTo(-20, 13);
    ctx.lineTo(-7, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'umbrospect') {
    // Ragged spectral wisp tail
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.moveTo(-6, 11);
    ctx.lineTo(-18, 8);
    ctx.lineTo(-14, 12);
    ctx.lineTo(-20, 15);
    ctx.lineTo(-4, 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Translucent bioluminescent tail sac (Hoverbug / Infurnus ref)
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.moveTo(-7, 10);
    ctx.quadraticCurveTo(-17, 14, -20, 6);
    ctx.quadraticCurveTo(-13, 2, -5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Species-specific Body Torso Silhouette
  const bodyGrad = ctx.createRadialGradient(-4, -6, 3, 2, 2, 20);
  bodyGrad.addColorStop(0, pal.highlight || '#ffffff');
  bodyGrad.addColorStop(0.35, primary);
  bodyGrad.addColorStop(0.85, pal.shadow || '#0f172a');
  bodyGrad.addColorStop(1, '#060a12');
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = '#060a12';
  ctx.lineWidth = 2;

  if (speciesId === 'frostcrawler' || speciesId === 'armashelt' || speciesId === 'rammstone' || speciesId === 'lariat') {
    // Wide, stout hexagonal armored hull
    roundRectPath(ctx, -13.5, -15, 27, 31, [12, 12, 8, 8]);
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'bubbaleone' || speciesId === 'enigmo') {
    // Plump spherical body
    ctx.beginPath();
    ctx.ellipse(0, 0, 14.5, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'umbrospect') {
    // Floating ragged phantom shroud body
    ctx.beginPath();
    ctx.moveTo(-11, -14);
    ctx.bezierCurveTo(-12, -23, 12, -23, 11, -12);
    ctx.lineTo(13, 15);
    ctx.lineTo(7, 11);
    ctx.lineTo(1, 17);
    ctx.lineTo(-6, 11);
    ctx.lineTo(-13, 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'piroclasto' || speciesId === 'glaciomita') {
    // Crystalline angular facet body
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(12, -13);
    ctx.lineTo(13, 8);
    ctx.lineTo(7, 16);
    ctx.lineTo(-7, 16);
    ctx.lineTo(-13, 8);
    ctx.lineTo(-12, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Streamlined athletic Slugterra torso
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.bezierCurveTo(-12, -23, 12, -23, 11, -12);
    ctx.bezierCurveTo(13, 4, 12, 16, 0, 16);
    ctx.bezierCurveTo(-12, 16, -12, 4, -10, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Belly Scutes & Chest Armor / Gem Details
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(2.2, 4.8, 7.2, 9.6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (speciesId === 'armashelt' || speciesId === 'rammstone' || speciesId === 'frostcrawler' || speciesId === 'lariat') {
    // Segmented rocky/ice chest plates (Image 1 stone-armored slug!)
    fillStrokeRoundRect(ctx, -8.5, -1, 17, 10, 4, secondary, '#070b14', 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.lineTo(6, 4);
    ctx.stroke();
  } else if (speciesId === 'infurnus' || speciesId === 'darkfurnus' || speciesId === 'piroclasto' || speciesId === 'aetherion') {
    // Glowing chest/forehead gem diamond (Image 1 & 2 center gem!)
    ctx.fillStyle = glowColor;
    ctx.strokeStyle = '#060a12';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1, -19.5);
    ctx.lineTo(4.4, -15);
    ctx.lineTo(1, -10.5);
    ctx.lineTo(-2.4, -15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'doc') {
    // Healing cyan/emerald gill stripes
    ctx.strokeStyle = '#a7f3d0';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-2, 1.5);
    ctx.moveTo(-6, 4);
    ctx.lineTo(-2, 5.5);
    ctx.stroke();
  } else if (speciesId === 'bubbaleone') {
    // Translucent cheek/belly bubbles
    ctx.fillStyle = '#a5f3fc';
    ctx.beginPath();
    ctx.arc(-6.5, 1, 3, 0, Math.PI * 2);
    ctx.arc(8, 1, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Species-specific Limbs (Spider legs for Arachnet, flippers for Aquabeak, clawed stubs for others)
  ctx.fillStyle = primary;
  ctx.strokeStyle = '#060a12';
  ctx.lineWidth = 1.6;
  if (speciesId === 'arachnet') {
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(-18, -5);
    ctx.lineTo(-19, 4);
    ctx.moveTo(-9, 6);
    ctx.lineTo(-18, 6);
    ctx.lineTo(-17, 13);
    ctx.moveTo(9, 0);
    ctx.lineTo(18, -5);
    ctx.lineTo(19, 4);
    ctx.moveTo(9, 6);
    ctx.lineTo(18, 6);
    ctx.lineTo(17, 13);
    ctx.stroke();
  } else if (speciesId === 'aquabeak') {
    // Scalloped water wing-fins with glowing dot
    for (const s of [-1, 1]) {
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.moveTo(s * 9, 0);
      ctx.lineTo(s * 17, -4);
      ctx.lineTo(s * 14, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(-11.5, 3, 4.2, 2.5, 0.35, 0, Math.PI * 2);
    ctx.ellipse(12, 3, 4.2, 2.5, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Species-specific Head Crests, Horns & Appendages
  ctx.fillStyle = secondary;
  ctx.strokeStyle = '#060a12';
  ctx.lineWidth = 1.7;
  if (speciesId === 'infurnus' || speciesId === 'flaringo' || speciesId === 'piroclasto') {
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
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-5, -17);
    ctx.lineTo(-9, -22);
    ctx.lineTo(-5, -25);
    ctx.lineTo(-10, -29);
    ctx.moveTo(5, -17);
    ctx.lineTo(9, -22);
    ctx.lineTo(5, -25);
    ctx.lineTo(10, -29);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(-10, -29, 1.8, 0, Math.PI * 2);
    ctx.arc(10, -29, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (speciesId === 'armashelt' || speciesId === 'rammstone' || speciesId === 'lariat') {
    // Curved stone horns & brow helmet (Ref Image 1 left stone-armored slug!)
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(-11, -13);
    ctx.quadraticCurveTo(-17, -23, -10, -28);
    ctx.lineTo(-5, -18);
    ctx.closePath();
    ctx.moveTo(11, -13);
    ctx.quadraticCurveTo(17, -23, 10, -28);
    ctx.lineTo(5, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'frostcrawler' || speciesId === 'glaciomita') {
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.moveTo(-7, -15);
    ctx.lineTo(-8, -26);
    ctx.lineTo(-2, -19);
    ctx.lineTo(0, -28);
    ctx.lineTo(2, -19);
    ctx.lineTo(8, -26);
    ctx.lineTo(7, -15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'musgacorn') {
    // Sprouting forest stem + dual emerald leaves
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(0, -26);
    ctx.stroke();
    ctx.fillStyle = '#4ade80';
    ctx.strokeStyle = '#060a12';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(-5, -24, 4.5, 2.2, 0.3, 0, Math.PI * 2);
    ctx.ellipse(5, -25, 4.8, 2.3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'doc') {
    // Halo + glowing dual healer antennae (Ref Image 1 green cyclops healer!)
    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-3, -18);
    ctx.lineTo(-6, -27);
    ctx.moveTo(3, -18);
    ctx.lineTo(6, -27);
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(-6, -27, 2, 0, Math.PI * 2);
    ctx.arc(6, -27, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (speciesId === 'darkfurnus' || speciesId === 'umbrospect') {
    // Jagged curved Ghoul horns
    ctx.fillStyle = '#be123c';
    ctx.beginPath();
    ctx.moveTo(-7, -17);
    ctx.quadraticCurveTo(-15, -26, -10, -29);
    ctx.lineTo(-3, -19);
    ctx.closePath();
    ctx.moveTo(7, -17);
    ctx.quadraticCurveTo(15, -26, 10, -29);
    ctx.lineTo(3, -19);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'aetherion') {
    // Celestial halo ring & prism crest
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, -24, 9, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (speciesId === 'bubbaleone') {
    // Crown bubble sphere
    ctx.fillStyle = '#a5f3fc';
    ctx.beginPath();
    ctx.arc(0, -22, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (speciesId === 'aquabeak') {
    // Dorsal crest + golden beak protrusion
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.moveTo(-3, -17);
    ctx.lineTo(-8, -26);
    ctx.lineTo(4, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Curved feelers / antennae for remaining agile species (Fandango, Enigmo, Arachnet)
    ctx.beginPath();
    ctx.moveTo(-7, -16);
    ctx.quadraticCurveTo(-8, -26, -3, -24);
    ctx.lineTo(-2, -16);
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

  // Expressive Eyes & Mouths (Ref Image 1!)
  const blink = pose === 'sleep' || (pose === 'idle' && f === 3);
  const isFierce = form === 'ghoul' || pose === 'attack' || pose === 'fire' || pose === 'charge';

  if (speciesId === 'doc' || speciesId === 'fandango' || speciesId === 'enigmo') {
    // Expressive large central cyclops eye (Doc green healer Ref 1!)
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

        ctx.fillStyle = form === 'ghoul' ? '#09090b' : pal.eyeIris || '#0f172a';
        ctx.beginPath();
        ctx.arc(ex + 0.6, -9.3, 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 0.5, -10.8, 1, 0, Math.PI * 2);
        ctx.fill();

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
    ctx.beginPath();
    ctx.moveTo(-3.2, -3.2);
    ctx.quadraticCurveTo(1, -0.5, 4.8, -3.2);
    ctx.stroke();
  }

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
