/** Draws a filled progress bar */
export function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  current: number,
  max: number,
  color: string
): void {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;

  // Background
  ctx.fillStyle = '#111';
  ctx.fillRect(x, y, w, h);

  // Fill
  if (ratio > 0) {
    // Color shifts red when low
    const fillColor = ratio < 0.25 ? '#f42' : ratio < 0.5 ? '#fa2' : color;
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, Math.floor(w * ratio), h);
  }

  // Border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}
