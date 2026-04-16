/** Draws a styled retro sci-fi panel with cyan border and optional title */
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title?: string
): void {
  // Background — dark navy with visible depth
  ctx.fillStyle = 'rgba(6, 14, 30, 0.96)';
  ctx.fillRect(x, y, w, h);

  // Inner bevel highlight (top/left edges)
  ctx.strokeStyle = 'rgba(60, 130, 200, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + h - 2);
  ctx.lineTo(x + 2, y + 2);
  ctx.lineTo(x + w - 2, y + 2);
  ctx.stroke();

  // Main border
  ctx.strokeStyle = '#5bf';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  // Corner accents
  const c = 8;
  ctx.strokeStyle = '#9ef';
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
    ctx.fillStyle = '#5bf';
    ctx.fillRect(x + 2, y + 2, w - 4, 18);
    ctx.fillStyle = '#001';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 8, y + 14);
  }
}
