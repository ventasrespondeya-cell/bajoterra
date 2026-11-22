import { BIOME_INFO } from '../../game/data';
import { TileType, type BiomeId } from '../../game/types';
import { HD_TILE_SPRITE_SIZE } from '../manifest';

/**
 * Generador de Tileset HiDPI (56×56 = 2x sobre celdas de 28px).
 * Implementa:
 * - Auto-tiling 4-bit (N, E, S, O) para acantilados estratificados y muros 2.5D con caída sur.
 * - Puentes colgantes de cuerda, escaleras de madera, adoquines con musgo, pilares en ruinas.
 * - Hongos luminosos bioluminiscentes, cascadas cian con bruma, basalto hexagonal y hogueras.
 * - Señalización visual clara para objetos interactivos (cofres, altares, estaciones, puertas).
 */

const tileCache = new Map<string, HTMLCanvasElement>();
const MAX_HD_TILE_CACHE = 960;

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function setCached(key: string, c: HTMLCanvasElement): void {
  if (tileCache.size >= MAX_HD_TILE_CACHE) {
    const first = tileCache.keys().next().value;
    if (first) tileCache.delete(first);
  }
  tileCache.set(key, c);
}

function detHash(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface AutoTileMask {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}

export function encodeAutoTileMask(mask?: AutoTileMask): number {
  if (!mask) return 0;
  return (mask.n ? 1 : 0) | (mask.e ? 2 : 0) | (mask.s ? 4 : 0) | (mask.w ? 8 : 0);
}

export function getHdTileSprite(
  tile: TileType,
  biome: BiomeId,
  variant = 0,
  maskBits = 0
): HTMLCanvasElement | null {
  const v = Math.abs(variant) % 4;
  const m = tile === TileType.ROCK || tile === TileType.WALL || tile === TileType.ANCIENT_BRICK || tile === TileType.VOLCANIC_ROCK || tile === TileType.ICE || tile === TileType.CHASM
    ? maskBits & 15
    : 0;
  const key = `hdt_${tile}_${biome}_${v}_${m}`;
  const cached = tileCache.get(key);
  if (cached) return cached;

  const S = HD_TILE_SPRITE_SIZE; // 56
  const c = makeCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const bInfo = BIOME_INFO[biome] || BIOME_INFO.Verdes;
  const hasN = (m & 1) !== 0;
  const hasE = (m & 2) !== 0;
  const hasS = (m & 4) !== 0;
  const hasW = (m & 8) !== 0;

  // Base Floor Paint (used by floor & underneath transparent overlay objects)
  const paintFloorBase = () => {
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, bInfo.floorA);
    g.addColorStop(1, bInfo.floorB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // Subtle organic pebbles, moss tufts or strata cracks
    for (let i = 0; i < 6; i++) {
      const px = Math.floor(detHash(v * 17 + i, i * 11, 31) * (S - 8)) + 4;
      const py = Math.floor(detHash(i * 19, v * 23 + i, 59) * (S - 8)) + 4;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(2,6,23,0.16)';
      ctx.beginPath();
      ctx.ellipse(px, py, 2 + (i % 3), 1.4 + (i % 2) * 0.6, detHash(px, py, 7) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    if (biome === 'Verdes' && v === 2) {
      ctx.fillStyle = 'rgba(74, 222, 128, 0.14)';
      ctx.beginPath();
      ctx.arc(16, 40, 8, 0, Math.PI * 2);
      ctx.arc(42, 18, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (biome === 'Cristalinas' && v === 1) {
      ctx.fillStyle = 'rgba(167, 139, 250, 0.16)';
      ctx.fillRect(18, 22, 5, 5);
    }
  };

  paintFloorBase();

  switch (tile) {
    case TileType.FLOOR:
      break;

    case TileType.CHASM: {
      // Deep chasm void with top-lip rocky rim when bordered by solid ground on North
      const chGrad = ctx.createLinearGradient(0, 0, 0, S);
      chGrad.addColorStop(0, '#02040a');
      chGrad.addColorStop(0.65, '#040914');
      chGrad.addColorStop(1, '#081326');
      ctx.fillStyle = chGrad;
      ctx.fillRect(0, 0, S, S);

      // Subtle chasm mist streaks
      ctx.fillStyle =
        biome === 'Magma'
          ? 'rgba(234, 88, 12, 0.16)'
          : biome === 'Sombrias'
          ? 'rgba(147, 51, 234, 0.18)'
          : 'rgba(34, 211, 238, 0.12)';
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.65, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // North edge rocky cliff overhang into chasm
      if (!hasN) {
        ctx.fillStyle = bInfo.wall;
        ctx.fillRect(0, 0, S, 13);
        ctx.fillStyle = 'rgba(2,6,23,0.45)';
        ctx.fillRect(0, 12, S, 5);
        // Hanging moss vines from rim (Reference 1!)
        ctx.strokeStyle = biome === 'Verdes' ? '#4ade80' : bInfo.accent;
        ctx.lineWidth = 2;
        for (let vx = 8; vx < S - 6; vx += 14) {
          ctx.beginPath();
          ctx.moveTo(vx, 12);
          ctx.lineTo(vx + 2, 22 + ((vx + v) % 7));
          ctx.stroke();
        }
      }
      if (!hasW) {
        ctx.fillStyle = 'rgba(15,23,42,0.75)';
        ctx.fillRect(0, 0, 6, S);
      }
      if (!hasE) {
        ctx.fillStyle = 'rgba(15,23,42,0.75)';
        ctx.fillRect(S - 6, 0, 6, S);
      }
      break;
    }

    case TileType.ROPE_BRIDGE: {
      // Abyssal shadow underneath + sturdy timber plank bridge with hemp ropes!
      ctx.fillStyle = '#030711';
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.1)';
      ctx.fillRect(0, 16, S, S - 32);

      // Bridge shadow on chasm
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 14, S, S - 22);

      // Side rope cords
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 9);
      ctx.lineTo(S, 9);
      ctx.moveTo(0, S - 9);
      ctx.lineTo(S, S - 9);
      ctx.stroke();

      // Timber bridge planks with wood grain & iron rivets
      for (let px = 2; px < S; px += 9) {
        const shade = (px / 9 + v) % 2 === 0 ? '#92400e' : '#78350f';
        ctx.fillStyle = shade;
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(px, 11, 7.5, S - 22, 1.5);
        ctx.fill();
        ctx.stroke();

        // Top highlight on plank
        ctx.fillStyle = 'rgba(253, 230, 138, 0.22)';
        ctx.fillRect(px + 1, 12, 5.5, 2.5);
      }

      // Anchor wooden posts on corners
      if (v === 0 || v === 3) {
        for (const py of [7, S - 11]) {
          ctx.fillStyle = '#451a03';
          ctx.strokeStyle = '#090d16';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(4, py, 6, 6, 2);
          ctx.roundRect(S - 10, py, 6, 6, 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      break;
    }

    case TileType.WOOD_STAIRS: {
      // Stepped wooden cavern staircase/ladder
      ctx.fillStyle = 'rgba(2,6,23,0.35)';
      ctx.fillRect(6, 4, S - 12, S - 8);
      ctx.fillStyle = '#5c2c0e';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.6;
      ctx.fillRect(8, 0, 6, S);
      ctx.strokeRect(8, 0, 6, S);
      ctx.fillRect(S - 14, 0, 6, S);
      ctx.strokeRect(S - 14, 0, 6, S);

      for (let sy = 4; sy < S - 4; sy += 10) {
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.roundRect(10, sy, S - 20, 6, 1.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(254, 240, 138, 0.28)';
        ctx.fillRect(11, sy + 1, S - 22, 2);
      }
      break;
    }

    case TileType.COBBLESTONE: {
      // Hand-fitted settlement plaza stones with subtle moss mortar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, S, S);
      const stones = [
        [2, 2, 24, 15],
        [28, 2, 26, 17],
        [2, 19, 17, 17],
        [21, 21, 18, 15],
        [41, 21, 13, 17],
        [2, 38, 28, 16],
        [32, 39, 22, 15],
      ];
      stones.forEach(([sx, sy, sw, sh], i) => {
        const tint = (i + v) % 3 === 0 ? '#475569' : (i + v) % 3 === 1 ? '#334155' : '#3f4c5e';
        ctx.fillStyle = tint;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(sx + 2, sy + 1.5, sw - 4, 2);
      });
      if (biome === 'Verdes' && v % 2 === 0) {
        ctx.fillStyle = 'rgba(74, 222, 128, 0.25)';
        ctx.fillRect(19, 18, 5, 4);
        ctx.fillRect(30, 37, 6, 3);
      }
      break;
    }

    case TileType.BUILT_FLOOR: {
      // Warm timber planks & carved slate floor (reference building interiors)
      ctx.fillStyle = '#4a3222';
      ctx.fillRect(0, 0, S, S);
      for (let py = 0; py < S; py += 14) {
        ctx.fillStyle = ((py / 14 + v) % 2 === 0) ? '#6b4730' : '#5b3c28';
        ctx.fillRect(0, py, S, 13);
        ctx.fillStyle = 'rgba(253, 230, 138, 0.1)';
        ctx.fillRect(0, py + 1, S, 2);
        ctx.fillStyle = '#291a10';
        ctx.fillRect(0, py + 13, S, 1);
      }
      // Subtle board seams
      ctx.fillStyle = '#291a10';
      ctx.fillRect(v * 12 + 10, 0, 2, 14);
      ctx.fillRect(((v + 2) * 14) % 44 + 6, 28, 2, 14);
      break;
    }

    case TileType.ICE_FLOOR: {
      const ig = ctx.createLinearGradient(0, 0, S, S);
      ig.addColorStop(0, '#5ea8d4');
      ig.addColorStop(1, '#3b7fa8');
      ctx.fillStyle = ig;
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(6, 14);
      ctx.lineTo(22, 6);
      ctx.moveTo(32, 42);
      ctx.lineTo(48, 28);
      ctx.stroke();
      break;
    }

    case TileType.ROCK:
    case TileType.VOLCANIC_ROCK:
    case TileType.ICE:
    case TileType.ANCIENT_BRICK:
    case TileType.WALL: {
      // Autotiled 2.5D Cliff / Ruin / Timber-Stone Wall with Stratified South Face!
      const isIce = tile === TileType.ICE;
      const isVolc = tile === TileType.VOLCANIC_ROCK;
      const isRuin = tile === TileType.ANCIENT_BRICK;
      const isTimber = tile === TileType.WALL;

      const topColor = isIce
        ? '#7dd3fc'
        : isVolc
        ? '#43201b'
        : isRuin
        ? '#64748b'
        : isTimber
        ? '#854d0e'
        : bInfo.wall;
      const faceColor = isIce
        ? '#0e7490'
        : isVolc
        ? '#26100e'
        : isRuin
        ? '#334155'
        : isTimber
        ? '#451a03'
        : '#1e293b';

      const southOpen = !hasS;
      const faceH = southOpen ? 20 : 0;

      // Top plateau
      ctx.fillStyle = topColor;
      ctx.fillRect(0, 0, S, S - faceH);

      // Stone strata / timber trim texture on top
      if (isTimber) {
        ctx.fillStyle = '#a16207';
        ctx.fillRect(3, 3, S - 6, S - faceH - 6);
        ctx.strokeStyle = '#291a10';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, S - 4, S - faceH - 4);
      } else if (isRuin) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, S - 2, S - faceH - 2);
        ctx.beginPath();
        ctx.moveTo(S / 2, 0);
        ctx.lineTo(S / 2, S - faceH);
        ctx.stroke();
      } else {
        // Stratified rock shelf crevices
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.roundRect(6, 5, S - 14, 12, 5);
        ctx.fill();
        ctx.fillStyle = 'rgba(2,6,23,0.18)';
        ctx.beginPath();
        ctx.roundRect(10, 18, S - 18, 9, 4);
        ctx.fill();
      }

      // Exposed cliff / wall edges (highlight top/west, shadow east)
      if (!hasN) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(0, 0, S, 4);
      }
      if (!hasW) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fillRect(0, 0, 4, S);
      }
      if (!hasE) {
        ctx.fillStyle = 'rgba(2,6,23,0.34)';
        ctx.fillRect(S - 4, 0, 4, S);
      }

      // South vertical cliff face (adds massive 2.5D depth!)
      if (southOpen) {
        const fg = ctx.createLinearGradient(0, S - faceH, 0, S);
        fg.addColorStop(0, faceColor);
        fg.addColorStop(1, '#090d16');
        ctx.fillStyle = fg;
        ctx.fillRect(0, S - faceH, S, faceH);

        // Strata horizontal cracks + hanging moss vines (Ref image 1)
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(0, S - faceH, S, 3);
        ctx.fillStyle = 'rgba(2,6,23,0.35)';
        ctx.fillRect(6, S - 11, 18, 2.5);
        ctx.fillRect(30, S - 7, 16, 2.5);

        if ((biome === 'Verdes' || isRuin) && v % 2 === 0) {
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.moveTo(10, S - faceH);
          ctx.lineTo(13, S - 5);
          ctx.lineTo(17, S - faceH);
          ctx.moveTo(38, S - faceH);
          ctx.lineTo(41, S - 7);
          ctx.lineTo(44, S - faceH);
          ctx.fill();
        }
      }
      break;
    }

    case TileType.WATER:
    case TileType.LAVA: {
      const isLava = tile === TileType.LAVA;
      const grad = ctx.createRadialGradient(S * 0.4, S * 0.4, 4, S * 0.5, S * 0.5, S * 0.75);
      if (isLava) {
        grad.addColorStop(0, '#fde047');
        grad.addColorStop(0.35, '#f97316');
        grad.addColorStop(1, '#991b1b');
      } else {
        grad.addColorStop(0, biome === 'Acuaticas' ? '#22d3ee' : '#38bdf8');
        grad.addColorStop(0.55, '#0284c7');
        grad.addColorStop(1, '#0c4a6e');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, S, S);

      // Ripples / magma crust blobs
      ctx.strokeStyle = isLava ? 'rgba(254, 240, 138, 0.55)' : 'rgba(186, 230, 253, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(16 + v * 4, 20, 9, 0.2, 2.5);
      ctx.moveTo(28, 38);
      ctx.quadraticCurveTo(38, 34, 48, 39);
      ctx.stroke();
      break;
    }

    case TileType.WATERFALL: {
      // Cascading glowing cyan waterfall sheet + foamy mist base (Reference Image 3!)
      const wg = ctx.createLinearGradient(0, 0, 0, S);
      wg.addColorStop(0, '#0c4a6e');
      wg.addColorStop(0.25, '#22d3ee');
      wg.addColorStop(0.85, '#67e8f9');
      wg.addColorStop(1, '#ecfeff');
      ctx.fillStyle = wg;
      ctx.fillRect(4, 0, S - 8, S);

      // Vertical rush streaks
      ctx.fillStyle = 'rgba(255,255,255,0.58)';
      for (let rx = 10; rx < S - 10; rx += 9) {
        ctx.fillRect(rx, ((rx + v * 5) % 10), 3, S - 14);
      }

      // Foaming splash clouds at bottom
      ctx.fillStyle = '#ecfeff';
      ctx.beginPath();
      ctx.arc(14, S - 7, 8, 0, Math.PI * 2);
      ctx.arc(28, S - 5, 10, 0, Math.PI * 2);
      ctx.arc(42, S - 7, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case TileType.MUSHROOM:
    case TileType.NEON_MUSHROOM: {
      // Cluster of bioluminescent cyan / violet / emerald mushrooms (Reference Image 1!)
      const isNeon = tile === TileType.NEON_MUSHROOM;
      const capA = isNeon ? '#a855f7' : biome === 'Acuaticas' ? '#22d3ee' : '#34d399';
      const capB = isNeon ? '#22d3ee' : '#2dd4bf';

      // Soft ground glow pool
      const halo = ctx.createRadialGradient(S / 2, S / 2 + 2, 2, S / 2, S / 2 + 2, 24);
      halo.addColorStop(0, isNeon ? 'rgba(168,85,247,0.38)' : 'rgba(45,212,191,0.34)');
      halo.addColorStop(1, 'transparent');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, S, S);

      // Draws a cluster of 3 mushrooms
      const drawShroom = (mx: number, my: number, r: number, col: string) => {
        ctx.strokeStyle = '#060a12';
        ctx.lineWidth = 1.8;
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.roundRect(mx - r * 0.28, my - 2, r * 0.56, r * 0.9, 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(mx, my - 2, r, r * 0.62, 0, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(mx - r * 0.35, my - r * 0.28, r * 0.16, 0, Math.PI * 2);
        ctx.arc(mx + r * 0.3, my - r * 0.22, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      };

      drawShroom(18, 34, 9, capB);
      drawShroom(38, 38, 8, capB);
      drawShroom(28, 26, 13, capA);
      break;
    }

    case TileType.CAMPFIRE: {
      // Crackling stone-ring campfire with warm radial ember glow
      const warm = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, 26);
      warm.addColorStop(0, 'rgba(251, 146, 60, 0.55)');
      warm.addColorStop(1, 'transparent');
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, S, S);

      // Ring of river stones
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.fillStyle = i % 2 === 0 ? '#64748b' : '#475569';
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(S / 2 + Math.cos(a) * 14, S / 2 + 4 + Math.sin(a) * 10, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Crossed logs
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(16, 36);
      ctx.lineTo(40, 28);
      ctx.moveTo(16, 28);
      ctx.lineTo(40, 36);
      ctx.stroke();

      // Flame core
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(18, 32);
      ctx.quadraticCurveTo(28, 6, 38, 32);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(22, 32);
      ctx.quadraticCurveTo(28, 15, 34, 32);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case TileType.RUIN_PILLAR:
    case TileType.WOOD_PILLAR:
    case TileType.BASALT_COLUMN: {
      // Vertical sculpted pillar / hexagonal basalt / ancient carved column
      const isWood = tile === TileType.WOOD_PILLAR;
      const isBasalt = tile === TileType.BASALT_COLUMN;
      ctx.fillStyle = 'rgba(2,6,23,0.42)';
      ctx.beginPath();
      ctx.ellipse(S / 2, S - 7, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#060a12';
      ctx.lineWidth = 2;
      ctx.fillStyle = isWood ? '#78350f' : isBasalt ? '#3f2e2c' : '#64748b';
      ctx.beginPath();
      ctx.roundRect(14, 10, S - 28, S - 18, 5);
      ctx.fill();
      ctx.stroke();

      // Pillar top cap (octagonal/hexagonal)
      ctx.fillStyle = isWood ? '#a16207' : isBasalt ? '#7c2d12' : '#94a3b8';
      ctx.beginPath();
      ctx.roundRect(11, 6, S - 22, 13, 4);
      ctx.fill();
      ctx.stroke();

      if (isWood && biome === 'Verdes') {
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(20, 12, 5, 0, Math.PI * 2);
        ctx.arc(35, 11, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (!isWood) {
        // Glowing ancient rune or magma crack
        ctx.fillStyle = isBasalt ? '#fb923c' : '#38bdf8';
        ctx.fillRect(S / 2 - 2, 24, 4, 14);
      }
      break;
    }

    case TileType.ENERGY_CRYSTAL:
    case TileType.ICE_CRYSTAL:
    case TileType.BLUE_QUARTZ:
    case TileType.SHADOW_CRYSTAL:
    case TileType.CRYSTAL_SPIRE:
    case TileType.EVO_STONE_VEIN: {
      // Multi-shard faceted crystals with specular highlights & soft aura
      const col =
        tile === TileType.SHADOW_CRYSTAL
          ? '#a855f7'
          : tile === TileType.ICE_CRYSTAL
          ? '#e0f2fe'
          : tile === TileType.EVO_STONE_VEIN
          ? '#fde047'
          : tile === TileType.ENERGY_CRYSTAL
          ? '#2dd4bf'
          : '#38bdf8';
      const glow = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, 25);
      glow.addColorStop(0, `${col}55`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, S, S);

      const drawShard = (sx: number, sy: number, h: number, w: number, tiltAngle: number) => {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(tiltAngle);
        ctx.fillStyle = col;
        ctx.strokeStyle = '#060a12';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -h);
        ctx.lineTo(w, -h * 0.25);
        ctx.lineTo(w * 0.7, 0);
        ctx.lineTo(-w * 0.7, 0);
        ctx.lineTo(-w, -h * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Facet highlight
        ctx.fillStyle = 'rgba(255,255,255,0.48)';
        ctx.beginPath();
        ctx.moveTo(0, -h);
        ctx.lineTo(-w, -h * 0.25);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      drawShard(20, 44, 24, 7, -0.22);
      drawShard(37, 45, 22, 6.5, 0.25);
      drawShard(28, 46, tile === TileType.CRYSTAL_SPIRE ? 38 : 30, 8.5, 0);
      break;
    }

    case TileType.CHEST_CLOSED:
    case TileType.CHEST_OPEN: {
      // Unmistakable interactive treasure chest with gold trim & jewel latch!
      const isOpen = tile === TileType.CHEST_OPEN;
      if (!isOpen) {
        const aura = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, 24);
        aura.addColorStop(0, 'rgba(250, 204, 21, 0.42)');
        aura.addColorStop(1, 'transparent');
        ctx.fillStyle = aura;
        ctx.fillRect(0, 0, S, S);
      }

      ctx.fillStyle = 'rgba(2,6,23,0.45)';
      ctx.beginPath();
      ctx.ellipse(S / 2, S - 9, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#060a12';
      ctx.lineWidth = 2;
      // Chest wooden body
      ctx.fillStyle = isOpen ? '#78350f' : '#b45309';
      ctx.beginPath();
      ctx.roundRect(12, 20, S - 24, 24, 4);
      ctx.fill();
      ctx.stroke();

      // Turquoise / gold iron bands
      ctx.fillStyle = isOpen ? '#64748b' : '#facc15';
      ctx.fillRect(15, 20, 5, 24);
      ctx.fillRect(S - 20, 20, 5, 24);

      if (isOpen) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(16, 17, S - 32, 9);
      } else {
        // Lid dome
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.roundRect(11, 13, S - 22, 12, 4);
        ctx.fill();
        ctx.stroke();
        // Glowing cyan lock jewel (Reference Image 1!)
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(S / 2, 25, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }

    case TileType.ALTAR: {
      // Carved Crystal Rune Shrine (Reference Image 2 center rune plaza!)
      const glow = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, 26);
      glow.addColorStop(0, 'rgba(56, 189, 248, 0.52)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, S, S);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(S / 2, S / 2 + 2, 19, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#060a12';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(14, 16, S - 28, S - 26, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(S / 2, 11);
      ctx.lineTo(S / 2 + 8, 25);
      ctx.lineTo(S / 2, 37);
      ctx.lineTo(S / 2 - 8, 25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }

    case TileType.RECHARGE_STATION: {
      // High-tech cyan & amber Shane Slug Recharge Station
      const glow = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, 25);
      glow.addColorStop(0, 'rgba(34, 211, 238, 0.45)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, S, S);

      ctx.strokeStyle = '#060a12';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(12, 10, S - 24, S - 18, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.roundRect(17, 15, S - 34, 18, 4);
      ctx.fill();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(S / 2, 40, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case TileType.TORCH: {
      const aura = ctx.createRadialGradient(S / 2, S / 2 - 4, 2, S / 2, S / 2 - 4, 22);
      aura.addColorStop(0, 'rgba(251, 146, 60, 0.48)');
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, S, S);

      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#060a12';
      ctx.lineWidth = 1.6;
      ctx.fillRect(S / 2 - 3, 24, 6, 22);
      ctx.strokeRect(S / 2 - 3, 24, 6, 22);

      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(S / 2, 20, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(S / 2, 20, 3.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case TileType.DOOR_CLOSED:
    case TileType.DOOR_OPEN: {
      const open = tile === TileType.DOOR_OPEN;
      ctx.strokeStyle = '#060a12';
      ctx.lineWidth = 2;
      if (open) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(2, 6, 10, S - 12);
        ctx.strokeRect(2, 6, 10, S - 12);
        ctx.fillRect(S - 12, 6, 10, S - 12);
        ctx.strokeRect(S - 12, 6, 10, S - 12);
      } else {
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.roundRect(4, 8, S - 8, S - 16, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(S - 14, S / 2, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case TileType.ORE:
    case TileType.MAGMA_COAL:
    case TileType.THERMAL_COPPER:
    case TileType.DARK_IRON: {
      const glint =
        tile === TileType.THERMAL_COPPER
          ? '#fb923c'
          : tile === TileType.MAGMA_COAL
          ? '#ef4444'
          : tile === TileType.DARK_IRON
          ? '#a855f7'
          : '#38bdf8';
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#060a12';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(10, 12, S - 20, S - 22, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = glint;
      ctx.fillRect(16, 20, 7, 7);
      ctx.fillRect(30, 27, 8, 6);
      break;
    }

    case TileType.KELP: {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3.2;
      for (const kx of [16, 28, 40]) {
        ctx.beginPath();
        ctx.moveTo(kx, S - 6);
        ctx.quadraticCurveTo(kx - 6, 28, kx + 4, 12);
        ctx.stroke();
      }
      break;
    }

    default:
      break;
  }

  setCached(key, c);
  return c;
}
