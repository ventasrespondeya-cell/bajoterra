import { TileType, type BiomeId } from '../../game/types';
import { drawSoftGlow, fillStrokeRoundRect } from '../canvasUtils';

/**
 * Activos arquitectónicos y estructuras de caverna (HiDPI 56×56 sobre celdas de 28px).
 * Incluye puentes colgantes con cabos de cuerda y postes, escaleras de madera con traviesas,
 * hogueras de campamento con sacos/cajas, cofres con cierre de cristal, altares rúnicos,
 * estaciones de recarga Shane, pilares, puertas y superposiciones de cúpula/círculo rúnico.
 */

export function drawCaveArchitectureTile(
  ctx: CanvasRenderingContext2D,
  tile: TileType,
  biome: BiomeId,
  S: number,
  v: number
): boolean {
  switch (tile) {
    case TileType.ROPE_BRIDGE: {
      // Deep chasm shadow below timber rope bridge (Reference Image 1!)
      ctx.fillStyle = '#02050d';
      ctx.fillRect(0, 0, S, S);
      drawSoftGlow(
        ctx,
        S / 2,
        S / 2,
        24,
        biome === 'Magma' ? 'rgba(234, 88, 12, 0.22)' : 'rgba(34, 211, 238, 0.14)'
      );

      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 14, S, S - 22);

      // Thick braided side ropes
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.moveTo(0, 9);
      ctx.lineTo(S, 9);
      ctx.moveTo(0, S - 9);
      ctx.lineTo(S, S - 9);
      ctx.stroke();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, 8.2);
      ctx.lineTo(S, 8.2);
      ctx.moveTo(0, S - 9.8);
      ctx.lineTo(S, S - 9.8);
      ctx.stroke();

      // Hand-hewn timber planks with slight natural offset
      for (let px = 2; px < S; px += 9) {
        const yJit = ((px / 9 + v) % 2 === 0 ? 0 : 1);
        const shade = (px / 9 + v) % 2 === 0 ? '#92400e' : '#78350f';
        fillStrokeRoundRect(ctx, px, 11 + yJit, 7.6, S - 22, 1.5, shade, '#1c1917', 1.4);
        ctx.fillStyle = 'rgba(253, 230, 138, 0.22)';
        ctx.fillRect(px + 1, 12 + yJit, 5.4, 2.2);
        // Rope tie lashings top & bottom
        ctx.fillStyle = '#d97706';
        ctx.fillRect(px + 2.5, 10, 2.5, 3);
        ctx.fillRect(px + 2.5, S - 13, 2.5, 3);
      }

      if (v === 0 || v === 3) {
        for (const py of [6, S - 12]) {
          fillStrokeRoundRect(ctx, 3, py, 6.5, 6.5, 2, '#451a03', '#090d16', 1.4);
          fillStrokeRoundRect(ctx, S - 9.5, py, 6.5, 6.5, 2, '#451a03', '#090d16', 1.4);
        }
      }
      return true;
    }

    case TileType.WOOD_STAIRS: {
      // Cavern stepped timber staircase descending cliff ledge (Reference Image 1!)
      ctx.fillStyle = 'rgba(2, 6, 23, 0.44)';
      ctx.fillRect(6, 2, S - 12, S - 4);
      fillStrokeRoundRect(ctx, 8, 0, 6.5, S, 1.5, '#5c2c0e', '#090d16', 1.5);
      fillStrokeRoundRect(ctx, S - 14.5, 0, 6.5, S, 1.5, '#5c2c0e', '#090d16', 1.5);

      for (let sy = 4; sy < S - 4; sy += 10) {
        fillStrokeRoundRect(ctx, 10, sy, S - 20, 6.4, 1.6, '#b45309', '#090d16', 1.4);
        ctx.fillStyle = 'rgba(254, 240, 138, 0.28)';
        ctx.fillRect(11.5, sy + 1, S - 23, 2);
      }

      // Corner rope cap posts
      fillStrokeRoundRect(ctx, 6, 2, 8, 7, 2, '#78350f', '#090d16', 1.4);
      fillStrokeRoundRect(ctx, S - 14, 2, 8, 7, 2, '#78350f', '#090d16', 1.4);
      return true;
    }

    case TileType.CAMPFIRE: {
      // Campfire clearing with warm radial glow, stone ring, bedroll/crate vignette (Ref Image 1!)
      drawSoftGlow(ctx, S / 2, S / 2, 27, 'rgba(251, 146, 60, 0.56)');

      // Rolled green adventurer tarp / supply crate tucked at upper edge
      fillStrokeRoundRect(ctx, 10, 6, 15, 7, 2.5, '#15803d', '#060a12', 1.3);
      fillStrokeRoundRect(ctx, 32, 6, 12, 9, 2, '#92400e', '#060a12', 1.3);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(34, 8, 8, 1.8);

      // Ring of river stones
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.fillStyle = i % 2 === 0 ? '#64748b' : '#475569';
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(S / 2 + Math.cos(a) * 13.5, S / 2 + 7 + Math.sin(a) * 8.5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Crossed logs
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(16, 40);
      ctx.lineTo(40, 32);
      ctx.moveTo(16, 32);
      ctx.lineTo(40, 40);
      ctx.stroke();

      // Vibrant stylized campfire flame
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(19, 36);
      ctx.quadraticCurveTo(28, 11, 37, 36);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(23, 36);
      ctx.quadraticCurveTo(28, 20, 33, 36);
      ctx.closePath();
      ctx.fill();
      return true;
    }

    case TileType.RUIN_PILLAR:
    case TileType.WOOD_PILLAR: {
      const isWood = tile === TileType.WOOD_PILLAR;
      ctx.fillStyle = 'rgba(2, 6, 23, 0.44)';
      ctx.beginPath();
      ctx.ellipse(S / 2, S - 7, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      fillStrokeRoundRect(
        ctx,
        14,
        11,
        S - 28,
        S - 19,
        5,
        isWood ? '#78350f' : '#64748b',
        '#060a12',
        1.9
      );
      fillStrokeRoundRect(
        ctx,
        11,
        6,
        S - 22,
        13,
        4,
        isWood ? '#a16207' : '#94a3b8',
        '#060a12',
        1.9
      );

      if (isWood && biome === 'Verdes') {
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(20, 12, 4.8, 0, Math.PI * 2);
        ctx.arc(35, 11, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (!isWood) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(S / 2 - 2, 24, 4, 14);
        ctx.fillStyle = 'rgba(186,230,253,0.6)';
        ctx.fillRect(S / 2 - 1, 25, 2, 12);
      }
      return true;
    }

    case TileType.CHEST_CLOSED:
    case TileType.CHEST_OPEN: {
      const isOpen = tile === TileType.CHEST_OPEN;
      if (!isOpen) {
        drawSoftGlow(ctx, S / 2, S / 2, 24, 'rgba(250, 204, 21, 0.44)');
      }

      ctx.fillStyle = 'rgba(2,6,23,0.45)';
      ctx.beginPath();
      ctx.ellipse(S / 2, S - 9, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      fillStrokeRoundRect(
        ctx,
        12,
        20,
        S - 24,
        24,
        4,
        isOpen ? '#78350f' : '#b45309',
        '#060a12',
        2
      );

      ctx.fillStyle = isOpen ? '#64748b' : '#facc15';
      ctx.fillRect(15, 20, 5, 24);
      ctx.fillRect(S - 20, 20, 5, 24);

      if (isOpen) {
        fillStrokeRoundRect(ctx, 15, 16, S - 30, 9, 2, '#0f172a', '#060a12', 1.4);
      } else {
        fillStrokeRoundRect(ctx, 11, 13, S - 22, 12, 4, '#d97706', '#060a12', 2);
        ctx.fillStyle = '#22d3ee';
        ctx.strokeStyle = '#060a12';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(S / 2, 25, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      return true;
    }

    case TileType.ALTAR: {
      // Luminous carved rune shrine inspired by Reference Image 2
      drawSoftGlow(ctx, S / 2, S / 2, 27, 'rgba(56, 189, 248, 0.56)');

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(S / 2, S / 2 + 2, 20, 0, Math.PI * 2);
      ctx.stroke();

      fillStrokeRoundRect(ctx, 13, 17, S - 26, S - 26, 6, '#334155', '#060a12', 2);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(18, 22, S - 36, S - 36);

      // Glowing floating diamond rune crystal
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#060a12';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(S / 2, 10);
      ctx.lineTo(S / 2 + 8.5, 25);
      ctx.lineTo(S / 2, 38);
      ctx.lineTo(S / 2 - 8.5, 25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(S / 2, 14);
      ctx.lineTo(S / 2 - 4, 24);
      ctx.lineTo(S / 2, 31);
      ctx.closePath();
      ctx.fill();
      return true;
    }

    case TileType.RECHARGE_STATION: {
      drawSoftGlow(ctx, S / 2, S / 2, 26, 'rgba(34, 211, 238, 0.48)');
      fillStrokeRoundRect(ctx, 12, 10, S - 24, S - 18, 7, '#0f172a', '#060a12', 2);
      fillStrokeRoundRect(ctx, 17, 15, S - 34, 18, 4, '#22d3ee');
      ctx.fillStyle = '#ecfeff';
      ctx.fillRect(20, 18, S - 40, 3);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(S / 2, 40, 4, 0, Math.PI * 2);
      ctx.fill();
      return true;
    }

    case TileType.TORCH: {
      drawSoftGlow(ctx, S / 2, S / 2 - 4, 22, 'rgba(251, 146, 60, 0.52)');
      fillStrokeRoundRect(ctx, S / 2 - 3, 24, 6, 22, 1.5, '#78350f', '#060a12', 1.6);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(S / 2, 20, 7.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(S / 2, 20, 3.8, 0, Math.PI * 2);
      ctx.fill();
      return true;
    }

    case TileType.DOOR_CLOSED:
    case TileType.DOOR_OPEN: {
      const open = tile === TileType.DOOR_OPEN;
      if (open) {
        fillStrokeRoundRect(ctx, 2, 6, 10, S - 12, 2, '#78350f', '#060a12', 2);
        fillStrokeRoundRect(ctx, S - 12, 6, 10, S - 12, 2, '#78350f', '#060a12', 2);
      } else {
        fillStrokeRoundRect(ctx, 4, 8, S - 8, S - 16, 4, '#92400e', '#060a12', 2);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(8, 14, S - 16, 3);
        ctx.fillRect(8, S - 17, S - 16, 3);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(S - 14, S / 2, 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
      return true;
    }

    default:
      return false;
  }
}

/**
 * Superposición arquitectónica de cúpula tecnológica hundida para el Refugio Shane (Ref Image 3).
 */
export function drawRefugioShaneDomeOverlay(
  ctx: CanvasRenderingContext2D,
  centerPxX: number,
  centerPxY: number,
  timeSec: number,
  reduced: boolean
): void {
  ctx.save();
  const pulse = reduced ? 0 : Math.sin(timeSec * 2.5) * 0.1;

  // Sunken octagonal cyan-and-brass tech ring around (160, 160)
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.36)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerPxX, centerPxY, 34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(34, 211, 238, ${0.42 + pulse})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(centerPxX, centerPxY, 27, 0, Math.PI * 2);
  ctx.stroke();

  // Four radial Shane conduit struts
  ctx.strokeStyle = 'rgba(249, 115, 22, 0.32)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(centerPxX + Math.cos(a) * 16, centerPxY + Math.sin(a) * 16);
    ctx.lineTo(centerPxX + Math.cos(a) * 33, centerPxY + Math.sin(a) * 33);
    ctx.stroke();
  }

  // Translucent cyan core sigil under Eli's feet
  ctx.fillStyle = 'rgba(34, 211, 238, 0.08)';
  ctx.beginPath();
  ctx.arc(centerPxX, centerPxY, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Superposición de círculo rúnico antiguo brillante bajo altares secretos (Ref Image 2).
 */
export function drawRuneCircleOverlay(
  ctx: CanvasRenderingContext2D,
  centerPxX: number,
  centerPxY: number,
  timeSec: number,
  reduced: boolean
): void {
  ctx.save();
  const rot = reduced ? 0 : timeSec * 0.45;
  ctx.translate(centerPxX, centerPxY);
  ctx.rotate(rot);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.stroke();

  // Inscribed square runes
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
  ctx.strokeRect(-14, -14, 28, 28);
  ctx.rotate(Math.PI / 4);
  ctx.strokeRect(-14, -14, 28, 28);
  ctx.restore();
}
