import { BIOME_INFO } from '../../game/data';
import { TileType, type BiomeId } from '../../game/types';
import { drawCaveArchitectureTile } from '../buildings/caveArchitecture';
import { detHash2D, fillStrokeRoundRect, makeOffscreenCanvas, roundRectPath } from '../canvasUtils';
import { HD_TILE_SPRITE_SIZE } from '../manifest';
import { drawBiomeDecorationTile } from './biomeDecorations';

/**
 * Generador de Tileset HiDPI (56×56 = 2x sobre celdas de 28px).
 * Implementa:
 * - Auto-tiling 4-bit (N, E, S, O) para acantilados estratificados y muros 2.5D con caída sur.
 * - Delegación limpia hacia biomeDecorations.ts y caveArchitecture.ts.
 * - Suelo cavernario con losas, guijarros, grietas de magma/hielo y adoquines con musgo.
 * - Abismos profundos con borde rocoso superior y lianas colgantes.
 */

const tileCache = new Map<string, HTMLCanvasElement>();
const MAX_HD_TILE_CACHE = 960;

function setCached(key: string, c: HTMLCanvasElement): void {
  if (tileCache.size >= MAX_HD_TILE_CACHE) {
    const first = tileCache.keys().next().value;
    if (first) tileCache.delete(first);
  }
  tileCache.set(key, c);
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
  const isAutotiled =
    tile === TileType.ROCK ||
    tile === TileType.WALL ||
    tile === TileType.ANCIENT_BRICK ||
    tile === TileType.VOLCANIC_ROCK ||
    tile === TileType.CRACKED_WALL ||
    tile === TileType.ICE ||
    tile === TileType.CHASM;
  const m = isAutotiled ? maskBits & 15 : 0;
  const key = `hdt_${tile}_${biome}_${v}_${m}`;
  const cached = tileCache.get(key);
  if (cached) return cached;

  const S = HD_TILE_SPRITE_SIZE; // 56
  const c = makeOffscreenCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const bInfo = BIOME_INFO[biome] || BIOME_INFO.Verdes;
  const hasN = (m & 1) !== 0;
  const hasE = (m & 2) !== 0;
  const hasS = (m & 4) !== 0;
  const hasW = (m & 8) !== 0;

  // Base cavern ground underneath walkable props & tiles
  const paintFloorBase = () => {
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, bInfo.floorA);
    g.addColorStop(1, bInfo.floorB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // Subtle organic strata & pebbles
    for (let i = 0; i < 6; i++) {
      const px = Math.floor(detHash2D(v * 17 + i, i * 11, 31) * (S - 10)) + 5;
      const py = Math.floor(detHash2D(i * 19, v * 23 + i, 59) * (S - 10)) + 5;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(2,6,23,0.18)';
      ctx.beginPath();
      ctx.ellipse(px, py, 2.2 + (i % 3), 1.4 + (i % 2) * 0.6, detHash2D(px, py, 7) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    if (biome === 'Verdes' && v >= 2) {
      // Soft mossy earth patches
      ctx.fillStyle = 'rgba(74, 222, 128, 0.14)';
      ctx.beginPath();
      ctx.arc(16, 40, 8, 0, Math.PI * 2);
      ctx.arc(42, 18, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (biome === 'Verdes' && v === 1) {
      // Flat warm tan stepping stone flagstone (Ref Image 1)
      fillStrokeRoundRect(ctx, 11, 16, 22, 14, 5, 'rgba(180, 150, 115, 0.25)', 'rgba(15, 23, 42, 0.22)', 1);
    } else if (biome === 'Magma' && v === 2) {
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.22)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(10, 18);
      ctx.lineTo(26, 24);
      ctx.lineTo(39, 19);
      ctx.stroke();
    } else if (biome === 'Cristalinas' && v === 1) {
      ctx.fillStyle = 'rgba(167, 139, 250, 0.16)';
      ctx.beginPath();
      ctx.moveTo(22, 18);
      ctx.lineTo(28, 24);
      ctx.lineTo(22, 30);
      ctx.lineTo(16, 24);
      ctx.closePath();
      ctx.fill();
    }
  };

  paintFloorBase();

  // Delegate biome decorations & cave architecture modules first
  if (drawBiomeDecorationTile(ctx, tile, biome, S, v)) {
    setCached(key, c);
    return c;
  }
  if (drawCaveArchitectureTile(ctx, tile, biome, S, v)) {
    setCached(key, c);
    return c;
  }

  switch (tile) {
    case TileType.FLOOR:
      break;

    case TileType.CHASM: {
      // Deep chasm void with top-lip rocky rim & hanging moss vines
      const chGrad = ctx.createLinearGradient(0, 0, 0, S);
      chGrad.addColorStop(0, '#02040a');
      chGrad.addColorStop(0.65, '#040914');
      chGrad.addColorStop(1, '#081326');
      ctx.fillStyle = chGrad;
      ctx.fillRect(0, 0, S, S);

      ctx.fillStyle =
        biome === 'Magma'
          ? 'rgba(234, 88, 12, 0.18)'
          : biome === 'Sombrias'
          ? 'rgba(147, 51, 234, 0.18)'
          : 'rgba(34, 211, 238, 0.12)';
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.65, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!hasN) {
        ctx.fillStyle = bInfo.wall;
        ctx.fillRect(0, 0, S, 13);
        ctx.fillStyle = 'rgba(2,6,23,0.48)';
        ctx.fillRect(0, 12, S, 5);
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

    case TileType.COBBLESTONE: {
      // Hand-fitted settlement plaza stones with subtle moss mortar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, S, S);
      const stones: Array<[number, number, number, number]> = [
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
        fillStrokeRoundRect(ctx, sx, sy, sw, sh, 4, tint, '#0f172a', 1.6);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(sx + 2, sy + 1.5, sw - 4, 2);
      });
      if (biome === 'Verdes' && v % 2 === 0) {
        ctx.fillStyle = 'rgba(74, 222, 128, 0.26)';
        ctx.fillRect(19, 18, 5, 4);
        ctx.fillRect(30, 37, 6, 3);
      }
      break;
    }

    case TileType.BUILT_FLOOR: {
      // Warm timber planks & carved slate floor
      ctx.fillStyle = '#4a3222';
      ctx.fillRect(0, 0, S, S);
      for (let py = 0; py < S; py += 14) {
        ctx.fillStyle = (py / 14 + v) % 2 === 0 ? '#6b4730' : '#5b3c28';
        ctx.fillRect(0, py, S, 13);
        ctx.fillStyle = 'rgba(253, 230, 138, 0.1)';
        ctx.fillRect(0, py + 1, S, 2);
        ctx.fillStyle = '#291a10';
        ctx.fillRect(0, py + 13, S, 1);
      }
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
    case TileType.CRACKED_WALL:
    case TileType.WALL: {
      const isIce = tile === TileType.ICE;
      const isVolc = tile === TileType.VOLCANIC_ROCK;
      const isRuin = tile === TileType.ANCIENT_BRICK;
      const isCracked = tile === TileType.CRACKED_WALL;
      const isTimber = tile === TileType.WALL;

      const topColor = isIce
        ? '#7dd3fc'
        : isVolc
        ? '#43201b'
        : isRuin || isCracked
        ? '#64748b'
        : isTimber
        ? '#854d0e'
        : bInfo.wall;
      const faceColor = isIce
        ? '#0e7490'
        : isVolc
        ? '#26100e'
        : isRuin || isCracked
        ? '#334155'
        : isTimber
        ? '#451a03'
        : '#1e293b';

      const southOpen = !hasS;
      const faceH = southOpen ? 20 : 0;

      ctx.fillStyle = topColor;
      ctx.fillRect(0, 0, S, S - faceH);

      if (isTimber) {
        ctx.fillStyle = '#a16207';
        ctx.fillRect(3, 3, S - 6, S - faceH - 6);
        ctx.strokeStyle = '#291a10';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, S - 4, S - faceH - 4);
      } else if (isRuin || isCracked) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, S - 2, S - faceH - 2);
        ctx.beginPath();
        ctx.moveTo(S / 2, 0);
        ctx.lineTo(S / 2, S - faceH);
        ctx.stroke();
        if (isCracked) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(14, 8);
          ctx.lineTo(26, 20);
          ctx.lineTo(20, 32);
          ctx.lineTo(36, 42);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        roundRectPath(ctx, 6, 5, S - 14, 12, 5);
        ctx.fill();
        ctx.fillStyle = 'rgba(2,6,23,0.18)';
        roundRectPath(ctx, 10, 18, S - 18, 9, 4);
        ctx.fill();
      }

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

      if (southOpen) {
        const fg = ctx.createLinearGradient(0, S - faceH, 0, S);
        fg.addColorStop(0, faceColor);
        fg.addColorStop(1, '#090d16');
        ctx.fillStyle = fg;
        ctx.fillRect(0, S - faceH, S, faceH);

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

      ctx.strokeStyle = isLava ? 'rgba(254, 240, 138, 0.55)' : 'rgba(186, 230, 253, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(16 + v * 4, 20, 9, 0.2, 2.5);
      ctx.moveTo(28, 38);
      ctx.quadraticCurveTo(38, 34, 48, 39);
      ctx.stroke();
      break;
    }

    default:
      break;
  }

  setCached(key, c);
  return c;
}
