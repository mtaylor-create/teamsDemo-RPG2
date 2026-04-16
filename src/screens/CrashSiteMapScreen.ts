import type { GameContext } from '../engine/Game.ts';
import type { InputManager } from '../engine/InputManager.ts';
import { drawPanel } from '../ui/Panel.ts';

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// ---------------------------------------------------------------------------
// Map constants  (all coordinates in canvas-space, 640 × 480)
// ---------------------------------------------------------------------------

const CANVAS_W = 640;
const CANVAS_H = 480;
const GROUND_Y = 260; // horizon / ground-line

// Player configuration
const PLAYER_SIZE = 12;    // half-extent; player occupies a 12×12 hitbox
const PLAYER_SPEED = 130;  // px / s
const SPAWN_X = CANVAS_W / 2;
const SPAWN_Y = CANVAS_H - 50;

// ARIEL stasis pod — placed just below the hull obstacle so the player can reach it
const POD_X = 322;
const POD_Y = 195;
const POD_W = 44;
const POD_H = 22;
const POD_INTERACT_RADIUS = 50;

// Ship hull obstacle (rough bounding rect for collision; rendered with rotation
// so this is a conservative axis-aligned box that covers the painted area)
const SHIP_HULL_OBSTACLES: Rect[] = [
  // Main hull body
  { x: 220, y: 100, w: 260, h: 70 },
  // Upper cabin structure
  { x: 255, y: 60,  w: 110, h: 50 },
];

// Debris piles (impassable)
const DEBRIS: Rect[] = [
  { x: 80,  y: 210, w: 40,  h: 24 },
  { x: 530, y: 195, w: 36,  h: 20 },
  { x: 160, y: 165, w: 28,  h: 18 },
  { x: 480, y: 240, w: 32,  h: 16 },
  { x: 310, y: 230, w: 22,  h: 14 },
];

// All obstacles combined
const ALL_OBSTACLES: Rect[] = [...SHIP_HULL_OBSTACLES, ...DEBRIS];

// Star field seed (stable — generated once, deterministic)
interface Star { x: number; y: number; b: number }
const STARS: Star[] = (() => {
  // Simple LCG so the pattern is consistent without Math.random() at class level
  let seed = 0xdeadbeef;
  const lcg = (): number => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return ((seed >>> 0) / 0xffffffff);
  };
  const result: Star[] = [];
  for (let i = 0; i < 90; i++) {
    result.push({ x: lcg() * CANVAS_W, y: lcg() * GROUND_Y, b: lcg() });
  }
  return result;
})();

// ---------------------------------------------------------------------------
// CrashSiteMapScreen
// ---------------------------------------------------------------------------

export class CrashSiteMapScreen {
  private gctx: GameContext;
  private onBattleReady: () => void;

  // Player state
  private px: number = SPAWN_X;
  private py: number = SPAWN_Y;
  private facing: 'up' | 'down' | 'left' | 'right' = 'up';

  // Interaction state
  private nearPod = false;
  private podInteracted = false;

  // Animation clock
  private time = 0;

  constructor(gctx: GameContext, onBattleReady: () => void) {
    this.gctx = gctx;
    this.onBattleReady = onBattleReady;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt: number, input: InputManager): void {
    this.time += dt;

    if (this.podInteracted) return; // lock movement after triggering dialogue

    // --- Movement ---
    let dx = 0;
    let dy = 0;
    if (input.isDown('ArrowLeft')  || input.isDown('KeyA')) { dx -= 1; this.facing = 'left';  }
    if (input.isDown('ArrowRight') || input.isDown('KeyD')) { dx += 1; this.facing = 'right'; }
    if (input.isDown('ArrowUp')    || input.isDown('KeyW')) { dy -= 1; this.facing = 'up';    }
    if (input.isDown('ArrowDown')  || input.isDown('KeyS')) { dy += 1; this.facing = 'down';  }

    // Normalise diagonal movement
    if (dx !== 0 && dy !== 0) {
      const INV_SQRT2 = 0.7071;
      dx *= INV_SQRT2;
      dy *= INV_SQRT2;
    }

    const moveX = dx * PLAYER_SPEED * dt;
    const moveY = dy * PLAYER_SPEED * dt;

    // Attempt horizontal move, then vertical move (axis-split collision)
    this.tryMove(moveX, 0);
    this.tryMove(0, moveY);

    // Clamp to canvas
    const half = PLAYER_SIZE / 2;
    this.px = Math.max(half, Math.min(CANVAS_W - half, this.px));
    this.py = Math.max(30 + half, Math.min(CANVAS_H - half - 4, this.py));

    // --- Proximity check for stasis pod ---
    const podCx = POD_X + POD_W / 2;
    const podCy = POD_Y + POD_H / 2;
    const dist = Math.hypot(this.px - podCx, this.py - podCy);
    this.nearPod = dist <= POD_INTERACT_RADIUS;

    // --- Interaction ---
    if (this.nearPod && (input.wasPressed('Enter') || input.wasPressed('Space'))) {
      this.podInteracted = true;
      this.gctx.switchScreen('dialogue', {
        startNode: 'kael_lyra_01',
        onComplete: this.onBattleReady,
      });
    }
  }

  // Attempt a move along one axis; reject if it would overlap any obstacle.
  private tryMove(dx: number, dy: number): void {
    const nx = this.px + dx;
    const ny = this.py + dy;
    const half = PLAYER_SIZE / 2;
    const playerRect: Rect = { x: nx - half, y: ny - half, w: PLAYER_SIZE, h: PLAYER_SIZE };

    for (const obs of ALL_OBSTACLES) {
      if (rectsOverlap(playerRect, obs)) return; // blocked
    }
    this.px = nx;
    this.py = ny;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D): void {
    this.drawSky(ctx);
    this.drawGround(ctx);
    this.drawShipHull(ctx);
    this.drawDebris(ctx);
    this.drawStasisPod(ctx);
    this.drawPlayer(ctx);
    this.drawHUD(ctx);
  }

  // ---------------------------------------------------------------------------
  // Draw routines
  // ---------------------------------------------------------------------------

  private drawSky(ctx: CanvasRenderingContext2D): void {
    // Deep space gradient — richer blues
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#060a20');
    sky.addColorStop(1, '#101840');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, GROUND_Y);

    // Stars — brighter
    for (const s of STARS) {
      const alpha = 0.4 + s.b * 0.6 * (0.85 + 0.15 * Math.sin(this.time * 1.3 + s.x * 0.05));
      ctx.fillStyle = `rgba(200,230,255,${alpha.toFixed(3)})`;
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
    }
  }

  private drawGround(ctx: CanvasRenderingContext2D): void {
    // Ground fill — brighter terrain
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_H);
    groundGrad.addColorStop(0, '#1a2230');
    groundGrad.addColorStop(1, '#10151e');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);

    // Horizon line
    ctx.strokeStyle = '#4a6888';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_W, GROUND_Y);
    ctx.stroke();

    // Subtle grid texture (perspective lines receding from bottom)
    ctx.strokeStyle = 'rgba(60, 90, 130, 0.55)';
    ctx.lineWidth = 1;
    const vanishX = CANVAS_W / 2;
    const vanishY = GROUND_Y;
    const gridSteps = 10;
    for (let i = 1; i <= gridSteps; i++) {
      const bx = (i / (gridSteps + 1)) * CANVAS_W;
      ctx.beginPath();
      ctx.moveTo(vanishX + (bx - vanishX) * 0, vanishY);
      ctx.lineTo(bx, CANVAS_H);
      ctx.stroke();
    }
    // Horizontal grid lines
    ctx.strokeStyle = 'rgba(60, 90, 130, 0.40)';
    const hSteps = 5;
    for (let i = 1; i <= hSteps; i++) {
      const gy = GROUND_Y + (i / hSteps) * (CANVAS_H - GROUND_Y);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(CANVAS_W, gy);
      ctx.stroke();
    }
  }

  private drawShipHull(ctx: CanvasRenderingContext2D): void {
    // Tilted crashed hull in upper-centre, consistent with DialogueScreen and OverworldScreen
    ctx.save();
    ctx.translate(355, 148);
    ctx.rotate(0.10);

    // Main hull body — brighter metallic
    ctx.fillStyle = '#3a5578';
    ctx.fillRect(-130, -28, 260, 56);

    // Darker upper cabin/bridge
    ctx.fillStyle = '#253a55';
    ctx.fillRect(-105, -52, 100, 30);

    // Hull detail strip — lighter accent
    ctx.fillStyle = '#4a6a90';
    ctx.fillRect(-130, -6, 260, 4);

    // Scorch marks / damage patches
    ctx.fillStyle = '#141e2e';
    ctx.fillRect(-90, -24, 30, 12);
    ctx.fillRect(60, 10, 40, 14);

    // Wing strut (left)
    ctx.fillStyle = '#304a68';
    ctx.fillRect(-180, 14, 60, 12);

    // Wing strut (right)
    ctx.fillRect(120, 14, 55, 12);

    // Amber emergency light — flickers using Math.sin per spec
    const flickerAlpha = 0.4 + 0.6 * Math.max(0, Math.sin(this.time * 4.7));
    ctx.fillStyle = `rgba(255, 150, 20, ${flickerAlpha.toFixed(3)})`;
    ctx.fillRect(82, -18, 10, 10);

    // Faint amber glow halo behind the light
    const haloAlpha = flickerAlpha * 0.25;
    const haloGrad = ctx.createRadialGradient(87, -13, 0, 87, -13, 22);
    haloGrad.addColorStop(0, `rgba(255, 160, 20, ${haloAlpha.toFixed(3)})`);
    haloGrad.addColorStop(1, 'rgba(255, 160, 20, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(87, -13, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawDebris(ctx: CanvasRenderingContext2D): void {
    // Small scattered debris fragments (visual matches collision rects)
    for (const d of DEBRIS) {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(d.x + 2, d.y + 3, d.w, d.h);

      // Main fragment — brighter
      ctx.fillStyle = '#385570';
      ctx.fillRect(d.x, d.y, d.w, d.h);

      // Lighter top edge — gives depth
      ctx.fillStyle = '#4a6a88';
      ctx.fillRect(d.x, d.y, d.w, 3);
    }

    // Extra small loose fragments (purely decorative, no collision)
    const fragments = [
      { x: 118, y: 230, w: 8, h: 5  },
      { x: 420, y: 250, w: 6, h: 4  },
      { x: 200, y: 285, w: 10, h: 4 },
      { x: 565, y: 270, w: 8, h: 5  },
      { x: 68,  y: 295, w: 7, h: 4  },
    ];
    ctx.fillStyle = '#304558';
    for (const f of fragments) {
      ctx.fillRect(f.x, f.y, f.w, f.h);
    }
  }

  private drawStasisPod(ctx: CanvasRenderingContext2D): void {
    const px = POD_X;
    const py = POD_Y;
    const pw = POD_W;
    const ph = POD_H;

    // Pulse animation — two layered sine waves for an organic glow
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.2);
    const pulse2 = 0.5 + 0.5 * Math.sin(this.time * 3.1 + 1.0);

    // Outer glow
    const glowRadius = 28 + pulse * 8;
    const podCx = px + pw / 2;
    const podCy = py + ph / 2;
    const glowGrad = ctx.createRadialGradient(podCx, podCy, 0, podCx, podCy, glowRadius);
    const glowAlpha = (0.30 + 0.20 * pulse).toFixed(3);
    glowGrad.addColorStop(0, `rgba(80, 220, 180, ${glowAlpha})`);
    glowGrad.addColorStop(1, 'rgba(80, 220, 180, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(podCx, podCy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Pod casing shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(px + 2, py + 3, pw, ph);

    // Pod casing body
    ctx.fillStyle = '#1a3830';
    ctx.fillRect(px, py, pw, ph);

    // Pod border
    const borderAlpha = (0.6 + 0.4 * pulse2).toFixed(3);
    ctx.strokeStyle = `rgba(80, 220, 180, ${borderAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 0.75, py + 0.75, pw - 1.5, ph - 1.5);

    // Inner lit panel
    const panelAlpha = (0.2 + 0.15 * pulse).toFixed(3);
    ctx.fillStyle = `rgba(80, 220, 180, ${panelAlpha})`;
    ctx.fillRect(px + 4, py + 4, pw - 8, ph - 8);

    // Central indicator light (bright core)
    const dotAlpha = (0.7 + 0.3 * pulse2).toFixed(3);
    ctx.fillStyle = `rgba(160, 255, 220, ${dotAlpha})`;
    ctx.beginPath();
    ctx.arc(podCx, podCy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Interact prompt — shown when player is in range
    if (this.nearPod && !this.podInteracted) {
      const promptY = py - 18;
      const promptX = podCx;
      const blink = Math.sin(this.time * 5.0) > 0;

      // Prompt background tag
      ctx.fillStyle = 'rgba(0, 4, 12, 0.88)';
      ctx.fillRect(promptX - 70, promptY - 13, 140, 18);
      ctx.strokeStyle = blink ? '#4af' : '#2a6080';
      ctx.lineWidth = 1;
      ctx.strokeRect(promptX - 70, promptY - 13, 140, 18);

      // Prompt text
      ctx.fillStyle = blink ? '#fc0' : '#4af';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[ ENTER ]  Investigate', promptX, promptY);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const half = PLAYER_SIZE / 2;
    const cx = this.px;
    const cy = this.py;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + half, half + 1, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body — diamond shape rotated 45 deg (classic top-down sprite feel)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#4af';
    ctx.fillRect(-half, -half, PLAYER_SIZE, PLAYER_SIZE);
    ctx.restore();

    // Direction indicator — small bright nub pointing in facing direction
    const indicatorLength = half + 4;
    let ix = cx;
    let iy = cy;
    switch (this.facing) {
      case 'up':    iy -= indicatorLength; break;
      case 'down':  iy += indicatorLength; break;
      case 'left':  ix -= indicatorLength; break;
      case 'right': ix += indicatorLength; break;
    }

    ctx.fillStyle = '#cef';
    ctx.beginPath();
    ctx.arc(ix, iy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    // Objective panel — top-left
    const objective = this.nearPod
      ? 'Stasis pod detected'
      : 'Find the source of the signal';

    const panelW = 260;
    const panelH = 32;
    drawPanel(ctx, 8, 8, panelW, panelH);

    // Objective label
    ctx.fillStyle = '#4af';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('OBJECTIVE', 18, 22);

    // Objective text (with highlighted colour when pod detected)
    ctx.fillStyle = this.nearPod ? '#fc0' : '#cef';
    ctx.font = '11px monospace';
    ctx.fillText(objective, 90, 22);

    // Minimap area label (bottom-left corner, subtle)
    ctx.fillStyle = 'rgba(100, 140, 180, 0.45)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CRASH SITE', 12, CANVAS_H - 8);

    // Controls hint (bottom-right)
    ctx.fillStyle = 'rgba(100, 140, 180, 0.55)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('ARROWS / WASD: Move   ENTER / SPACE: Interact', CANVAS_W - 10, CANVAS_H - 8);
  }
}
