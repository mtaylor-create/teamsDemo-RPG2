import type { GameContext } from '../engine/Game.ts';
import type { InputManager } from '../engine/InputManager.ts';

interface Star {
  x: number;
  y: number;
  speed: number;
  brightness: number;
  size: number;
}

export class TitleScreen {
  private stars: Star[] = [];
  private time = 0;
  private ctx: GameContext;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    const { width, height } = ctx.canvas;
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 0.3 + Math.random() * 1.2,
        brightness: 0.4 + Math.random() * 0.6,
        size: Math.random() < 0.15 ? 2 : 1,
      });
    }
  }

  update(dt: number, input: InputManager): void {
    this.time += dt;

    // Scroll stars
    const { height } = this.ctx.canvas;
    for (const s of this.stars) {
      s.y += s.speed;
      if (s.y > height) s.y = 0;
    }

    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      this.ctx.switchScreen('overworld');
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.ctx.canvas;

    // Deep space gradient — richer blues
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#040818');
    grad.addColorStop(0.5, '#081028');
    grad.addColorStop(1, '#040610');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Stars — brighter and more visible
    for (const s of this.stars) {
      const alpha = s.brightness * (0.75 + 0.25 * Math.sin(this.time * 2 + s.x));
      ctx.fillStyle = `rgba(200, 230, 255, ${alpha})`;
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
    }

    // Bane shadow effect — large dark blot in upper-left
    const baneGrad = ctx.createRadialGradient(80, 80, 20, 80, 80, 180);
    baneGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
    baneGrad.addColorStop(0.6, 'rgba(20,0,30,0.4)');
    baneGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = baneGrad;
    ctx.fillRect(0, 0, width, height);

    // Planet silhouette (Dezolis) — bottom right, with visible surface
    ctx.fillStyle = '#14222e';
    ctx.beginPath();
    ctx.arc(width + 60, height + 40, 220, 0, Math.PI * 2);
    ctx.fill();

    // Planet glow — more visible atmospheric rim
    const pgGrad = ctx.createRadialGradient(width + 60, height + 40, 200, width + 60, height + 40, 250);
    pgGrad.addColorStop(0, 'rgba(40, 100, 160, 0)');
    pgGrad.addColorStop(0.7, 'rgba(50, 140, 220, 0.15)');
    pgGrad.addColorStop(1, 'rgba(40, 120, 200, 0.06)');
    ctx.fillStyle = pgGrad;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // Glow behind title
    const titleGlow = ctx.createRadialGradient(cx, cy - 30, 10, cx, cy - 30, 220);
    titleGlow.addColorStop(0, 'rgba(50, 140, 255, 0.30)');
    titleGlow.addColorStop(0.5, 'rgba(30, 80, 180, 0.10)');
    titleGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = titleGlow;
    ctx.fillRect(0, 0, width, height);

    // "STARFALL"
    ctx.shadowBlur = 22;
    ctx.shadowColor = '#5bf';
    ctx.fillStyle = '#def';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STARFALL', cx, cy - 30);

    // "CHRONICLES"
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#39f';
    ctx.fillStyle = '#5bf';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('CHRONICLES', cx, cy + 14);

    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = 'rgba(170, 210, 240, 0.8)';
    ctx.font = '13px monospace';
    ctx.fillText('A Phantasy Star-Inspired Adventure', cx, cy + 46);

    // Decorative line
    ctx.strokeStyle = 'rgba(80, 180, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 220, cy + 60);
    ctx.lineTo(cx + 220, cy + 60);
    ctx.stroke();

    // Blinking prompt
    if (Math.floor(this.time / 0.55) % 2 === 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '14px monospace';
      ctx.fillText('[ Press ENTER to begin ]', cx, cy + 90);
    }

    // Version tag
    ctx.fillStyle = 'rgba(100,150,200,0.6)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('DEMO v0.2', width - 8, height - 6);
  }
}
