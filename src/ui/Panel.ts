/** Draws a styled retro sci-fi panel with cyan border and optional title */
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title?: string
): void {
  // Background
  ctx.fillStyle = 'rgba(0, 4, 12, 0.95)';
  ctx.fillRect(x, y, w, h);

  // Main border
  ctx.strokeStyle = '#4af';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  // Corner accents
  const c = 8;
  ctx.strokeStyle = '#8df';
  ctx.lineWidth = 1;
  ctx.beginPath();
  // Top-left
  ctx.moveTo(x + c, y); ctx.lineTo(x, y + c);
  // Top-right
  ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y + c);
  // Bottom-left
  ctx.moveTo(x, y + h - c); ctx.lineTo(x + c, y + h);
  // Bottom-right
  ctx.moveTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h);
  ctx.stroke();

  if (title) {
    // Title background strip
    ctx.fillStyle = '#4af';
    ctx.fillRect(x + 2, y + 2, w - 4, 18);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 8, y + 14);
  }
}
