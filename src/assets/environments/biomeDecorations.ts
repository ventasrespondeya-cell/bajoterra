import { BIOME_INFO } from '../../game/data';
import { TileType, type BiomeId } from '../../game/types';
import { drawSoftGlow, fillStrokeRoundRect, roundRectPath } from '../canvasUtils';

/**
 * Decoraciones orgánicas y geológicas por bioma (HiDPI 56×56 sobre celdas de 28px).
 * Inspiradas directamente en las referencias visuales:
 * - Hongos bioluminiscentes cian/violeta asentados sobre losas de piedra grisácea.
 * - Cascadas cian luminosas con cortinas de agua y bruma espumosa en la base.
 * - Cristales multifacetados con destellos internos, columnas hexagonales de basalto,
 *   algas fluorescentes y vetas minerales estilizadas.
 */

export function drawBiomeDecorationTile(
  ctx: CanvasRenderingContext2D,
  tile: TileType,
  biome: BiomeId,
  S: number,
  v: number
): boolean {
  const bInfo = BIOME_INFO[biome] || BIOME_INFO.Verdes;

  switch (tile) {
    case TileType.MUSHROOM:
    case TileType.NEON_MUSHROOM: {
      const isNeon = tile === TileType.NEON_MUSHROOM;
      const capMain = isNeon
        ? '#c084fc'
        : biome === 'Acuaticas'
        ? '#22d3ee'
        : biome === 'Sombrias'
        ? '#a855f7'
        : '#34d399';
      const capSub = isNeon ? '#38bdf8' : biome === 'Acuaticas' ? '#67e8f9' : '#2dd4bf';
      const capPink = '#e879f9';

      // Soft ground glow pool matching Reference Image 1
      drawSoftGlow(
        ctx,
        S * 0.5,
        S * 0.54,
        25,
        isNeon ? 'rgba(192,132,252,0.44)' : 'rgba(45,212,191,0.38)'
      );

      // Grey-slate rock slab base beneath mushroom cluster (Reference Image 1)
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(8, 41);
      ctx.lineTo(18, 34);
      ctx.lineTo(36, 33);
      ctx.lineTo(48, 40);
      ctx.lineTo(43, 49);
      ctx.lineTo(14, 48);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(203, 213, 225, 0.25)';
      ctx.beginPath();
      ctx.moveTo(12, 41);
      ctx.lineTo(20, 36);
      ctx.lineTo(34, 35);
      ctx.lineTo(31, 41);
      ctx.closePath();
      ctx.fill();

      // Grass/moss tuft tucked beside the slab
      ctx.fillStyle = biome === 'Sombrias' ? '#7e22ce' : '#22c55e';
      ctx.beginPath();
      ctx.moveTo(9, 43);
      ctx.lineTo(6, 34);
      ctx.lineTo(12, 39);
      ctx.lineTo(14, 33);
      ctx.lineTo(16, 43);
      ctx.closePath();
      ctx.fill();

      const drawShroom = (
        mx: number,
        my: number,
        r: number,
        stemH: number,
        col: string,
        lean = 0
      ) => {
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(lean);
        ctx.strokeStyle = '#060a12';
        ctx.lineWidth = 1.6;

        // Curved translucent stem
        fillStrokeRoundRect(
          ctx,
          -r * 0.24,
          -stemH * 0.12,
          r * 0.48,
          stemH,
          2.2,
          '#e2e8f0',
          '#060a12',
          1.4
        );

        // Glowing underside gill halo
        ctx.fillStyle = 'rgba(255,255,255,0.42)';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.85, r * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dome cap
        const cg = ctx.createRadialGradient(-r * 0.25, -r * 0.35, 1, 0, -r * 0.15, r * 1.05);
        cg.addColorStop(0, '#ecfeff');
        cg.addColorStop(0.45, col);
        cg.addColorStop(1, '#0f172a');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.68, 0, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Rim glow & spots
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.arc(-r * 0.34, -r * 0.28, r * 0.14, 0, Math.PI * 2);
        ctx.arc(r * 0.28, -r * 0.22, r * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      drawShroom(16, 31, 8.5, 11, v % 2 === 0 ? capPink : capSub, -0.14);
      drawShroom(40, 34, 7.5, 10, capSub, 0.16);
      drawShroom(28, 22, 13.5, 17, capMain, 0.02);
      drawShroom(21, 39, 5, 6, capSub, -0.08);
      return true;
    }

    case TileType.WATERFALL: {
      // Cavern cliff frame flanking the rushing cyan waterfall (Ref Image 3)
      ctx.fillStyle = bInfo.wall;
      ctx.fillRect(0, 0, 8, S);
      ctx.fillRect(S - 8, 0, 8, S);
      ctx.fillStyle = '#090d16';
      ctx.fillRect(7, 0, 2, S);
      ctx.fillRect(S - 9, 0, 2, S);

      const wg = ctx.createLinearGradient(0, 0, 0, S);
      wg.addColorStop(0, '#075985');
      wg.addColorStop(0.28, '#06b6d4');
      wg.addColorStop(0.78, '#67e8f9');
      wg.addColorStop(1, '#ecfeff');
      ctx.fillStyle = wg;
      ctx.fillRect(8, 0, S - 16, S - 4);

      // Animated look vertical foam ribbons
      ctx.fillStyle = 'rgba(255,255,255,0.62)';
      for (let rx = 11; rx < S - 12; rx += 7) {
        const yOff = ((rx * 3 + v * 7) % 12);
        ctx.fillRect(rx, yOff, 2.5, S - 18);
      }

      // Lush cyan splash mist pool at base
      drawSoftGlow(ctx, S / 2, S - 8, 22, 'rgba(103, 232, 249, 0.55)');
      ctx.fillStyle = '#ecfeff';
      ctx.beginPath();
      ctx.arc(14, S - 7, 7, 0, Math.PI * 2);
      ctx.arc(28, S - 5, 9.5, 0, Math.PI * 2);
      ctx.arc(42, S - 7, 7, 0, Math.PI * 2);
      ctx.fill();
      return true;
    }

    case TileType.ENERGY_CRYSTAL:
    case TileType.ICE_CRYSTAL:
    case TileType.BLUE_QUARTZ:
    case TileType.SHADOW_CRYSTAL:
    case TileType.CRYSTAL_SPIRE:
    case TileType.EVO_STONE_VEIN: {
      const col =
        tile === TileType.SHADOW_CRYSTAL
          ? '#a855f7'
          : tile === TileType.ICE_CRYSTAL
          ? '#e0f2fe'
          : tile === TileType.EVO_STONE_VEIN
          ? '#fde047'
          : tile === TileType.ENERGY_CRYSTAL
          ? '#2dd4bf'
          : tile === TileType.CRYSTAL_SPIRE
          ? '#818cf8'
          : '#38bdf8';

      drawSoftGlow(ctx, S / 2, S / 2 + 2, 26, `${col}66`);

      // Rocky socket pedestal
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#060a12';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(S / 2, S - 10, 17, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const drawShard = (sx: number, sy: number, h: number, w: number, tilt: number) => {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(tilt);
        const sg = ctx.createLinearGradient(-w, -h, w, 0);
        sg.addColorStop(0, '#ffffff');
        sg.addColorStop(0.35, col);
        sg.addColorStop(1, '#0f172a');
        ctx.fillStyle = sg;
        ctx.strokeStyle = '#060a12';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(0, -h);
        ctx.lineTo(w, -h * 0.28);
        ctx.lineTo(w * 0.72, 0);
        ctx.lineTo(-w * 0.72, 0);
        ctx.lineTo(-w, -h * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crisp left light facet
        ctx.fillStyle = 'rgba(255,255,255,0.52)';
        ctx.beginPath();
        ctx.moveTo(0, -h + 1);
        ctx.lineTo(-w + 1, -h * 0.28);
        ctx.lineTo(0, -1);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      drawShard(18, 44, 22, 6.5, -0.26);
      drawShard(38, 45, 20, 6, 0.28);
      drawShard(28, 46, tile === TileType.CRYSTAL_SPIRE ? 39 : 31, 8.8, v === 1 ? -0.05 : 0.04);
      return true;
    }

    case TileType.BASALT_COLUMN: {
      // Sculpted hexagonal volcanic basalt column with glowing magma fissure
      ctx.fillStyle = 'rgba(2,6,23,0.48)';
      ctx.beginPath();
      ctx.ellipse(S / 2, S - 6, 17, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#060a12';
      ctx.lineWidth = 1.8;
      // Front faces of hexagon prism
      ctx.fillStyle = '#2b1e1d';
      ctx.beginPath();
      ctx.moveTo(13, 16);
      ctx.lineTo(28, 21);
      ctx.lineTo(43, 16);
      ctx.lineTo(43, S - 9);
      ctx.lineTo(28, S - 4);
      ctx.lineTo(13, S - 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Lighter left bevel facet
      ctx.fillStyle = '#44302d';
      ctx.beginPath();
      ctx.moveTo(13, 16);
      ctx.lineTo(28, 21);
      ctx.lineTo(28, S - 4);
      ctx.lineTo(13, S - 9);
      ctx.closePath();
      ctx.fill();

      // Hexagonal top cap
      ctx.fillStyle = '#573b36';
      ctx.beginPath();
      ctx.moveTo(28, 6);
      ctx.lineTo(43, 12);
      ctx.lineTo(43, 17);
      ctx.lineTo(28, 22);
      ctx.lineTo(13, 17);
      ctx.lineTo(13, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing lava seam
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(28, 25);
      ctx.lineTo(25, 34);
      ctx.lineTo(31, 43);
      ctx.stroke();
      return true;
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
          ? '#c084fc'
          : '#38bdf8';

      ctx.fillStyle = 'rgba(2,6,23,0.4)';
      ctx.beginPath();
      ctx.ellipse(S / 2, S - 8, 19, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = tile === TileType.MAGMA_COAL ? '#261414' : '#334155';
      ctx.strokeStyle = '#060a12';
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.moveTo(11, 38);
      ctx.lineTo(15, 16);
      ctx.lineTo(29, 10);
      ctx.lineTo(43, 18);
      ctx.lineTo(46, 39);
      ctx.lineTo(28, 45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Embedded ore nuggets
      const nuggets: Array<[number, number, number]> = [
        [20, 23, 4.5],
        [33, 21, 3.8],
        [28, 33, 5],
      ];
      for (const [nx, ny, nr] of nuggets) {
        ctx.fillStyle = glint;
        ctx.beginPath();
        ctx.arc(nx, ny, nr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(nx - 1.5, ny - 2, 2, 2);
      }
      return true;
    }

    case TileType.KELP: {
      drawSoftGlow(ctx, S / 2, S * 0.55, 18, 'rgba(16, 185, 129, 0.26)');
      ctx.lineCap = 'round';
      for (const [kx, lean, h] of [
        [15, -6, 36],
        [28, 5, 42],
        [40, -4, 34],
      ] as Array<[number, number, number]>) {
        ctx.strokeStyle = '#052e16';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(kx, S - 5);
        ctx.quadraticCurveTo(kx + lean, S - h * 0.55, kx - lean * 0.5, S - h);
        ctx.stroke();

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(kx, S - 5);
        ctx.quadraticCurveTo(kx + lean, S - h * 0.55, kx - lean * 0.5, S - h);
        ctx.stroke();

        // Bioluminescent bulb tip
        ctx.fillStyle = '#6ee7b7';
        ctx.beginPath();
        ctx.arc(kx - lean * 0.5, S - h, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      return true;
    }

    default:
      return false;
  }
}

export function drawHabitatZoneOverlay(
  ctx: CanvasRenderingContext2D,
  hsx: number,
  hsy: number,
  tilePx: number,
  accentColor: string,
  floorTint: string,
  label: string
): void {
  const pad = 12;
  const rx = hsx - pad;
  const ry = hsy - pad;
  const rw = tilePx + pad * 2;
  const rh = tilePx + pad * 2;

  // Sculpted bevelled stone pad instead of a flat square rect
  ctx.save();
  fillStrokeRoundRect(ctx, rx, ry, rw, rh, 12, floorTint, accentColor, 1.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, rx + 3, ry + 3, rw - 6, rh - 6, 9);
  ctx.stroke();

  // Corner rune pins
  ctx.fillStyle = accentColor;
  for (const [px, py] of [
    [rx + 6, ry + 6],
    [rx + rw - 6, ry + 6],
    [rx + 6, ry + rh - 6],
    [rx + rw - 6, ry + rh - 6],
  ]) {
    ctx.beginPath();
    ctx.arc(px, py, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle habitat plaque
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(6, 13, 20, 0.8)';
  ctx.fillRect(hsx + tilePx / 2 - 26, ry - 6, 52, 10);
  ctx.fillStyle = accentColor;
  ctx.fillText(label.split(' ')[0], hsx + tilePx / 2, ry + 1.5);
  ctx.restore();
}
