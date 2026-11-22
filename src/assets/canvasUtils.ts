/**
 * Utilidades seguras de dibujo Canvas 2D para el pipeline de activos HiDPI de Bajoterra 4.0.
 * Todas las primitivas evitan APIs no soportadas en entornos headless/Node (como ctx.roundRect)
 * usando trazados explícitos compatibilizados con cualquier CanvasRenderingContext2D.
 */

export function makeOffscreenCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | [number, number, number, number]
): void {
  const [tlRaw, trRaw, brRaw, blRaw] = Array.isArray(radius)
    ? radius
    : [radius, radius, radius, radius];
  const maxR = Math.max(0, Math.min(Math.abs(w) / 2, Math.abs(h) / 2));
  const tl = Math.min(Math.max(0, tlRaw), maxR);
  const tr = Math.min(Math.max(0, trRaw), maxR);
  const br = Math.min(Math.max(0, brRaw), maxR);
  const bl = Math.min(Math.max(0, blRaw), maxR);

  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr > 0) ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  else ctx.lineTo(x + w, y);

  ctx.lineTo(x + w, y + h - br);
  if (br > 0) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  else ctx.lineTo(x + w, y + h);

  ctx.lineTo(x + bl, y + h);
  if (bl > 0) ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  else ctx.lineTo(x, y + h);

  ctx.lineTo(x, y + tl);
  if (tl > 0) ctx.quadraticCurveTo(x, y, x + tl, y);
  else ctx.lineTo(x, y);
  ctx.closePath();
}

export function fillStrokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | [number, number, number, number],
  fill?: string | CanvasGradient,
  stroke?: string,
  lineWidth = 1.6
): void {
  roundRectPath(ctx, x, y, w, h, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function drawSoftGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  innerColor: string,
  outerColor = 'rgba(0,0,0,0)'
): void {
  const g = ctx.createRadialGradient(cx, cy, Math.max(1, radius * 0.1), cx, cy, radius);
  g.addColorStop(0, innerColor);
  g.addColorStop(1, outerColor);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function detHash2D(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
