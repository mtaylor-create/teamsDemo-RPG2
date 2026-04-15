import type { GameContext } from '../engine/Game.ts';
import type { InputManager } from '../engine/InputManager.ts';
import { drawPanel } from '../ui/Panel.ts';

interface Location {
  id: string;
  name: string;
  desc: string;
  x: number;
  y: number;
}

const LOCATIONS: Location[] = [
  { id: 'village',    name: 'Crestfall Village', desc: 'Your home. A dying town on a dying world.', x: 120, y: 160 },
  { id: 'crash_site', name: 'Crash Site',         desc: 'A starship from another age... and a destiny.', x: 400, y: 230 },
];

export class OverworldScreen {
  private gctx: GameContext;
  private cursor = 0;
  private time = 0;
  private notification = '';
  private notifTimer = 0;
  private stars: { x: number; y: number; b: number }[] = [];
  private menuOpen = false;

  constructor(gctx: GameContext) {
    this.gctx = gctx;
    const { width, height } = gctx.canvas;
    for (let i = 0; i < 80; i++) {
      this.stars.push({ x: Math.random() * width, y: Math.random() * height * 0.7, b: Math.random() });
    }
  }

  update(dt: number, input: InputManager): void {
    this.time += dt;
    if (this.notifTimer > 0) this.notifTimer -= dt;

    if (this.menuOpen) {
      if (input.wasPressed('Escape') || input.wasPressed('KeyX') || input.wasPressed('KeyM')) {
        this.menuOpen = false;
      }
      return;
    }

    if (input.wasPressed('ArrowLeft'))  this.cursor = (this.cursor - 1 + LOCATIONS.length) % LOCATIONS.length;
    if (input.wasPressed('ArrowRight')) this.cursor = (this.cursor + 1) % LOCATIONS.length;
    if (input.wasPressed('KeyM') || input.wasPressed('Escape')) {
      this.gctx.switchScreen('menu');
      return;
    }

    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      const loc = LOCATIONS[this.cursor];
      if (!loc) return;
      this.interact(loc.id);
    }
  }

  private interact(locId: string): void {
    if (locId === 'village') {
      this.notify("There's nothing more to do here. The crash site waits.");
      return;
    }

    if (locId === 'crash_site') {
      if (this.gctx.flags['crash_cleared']) {
        this.notify('The wreckage is quiet now. Your journey continues...');
        return;
      }

      if (!this.gctx.flags['intro_seen']) {
        // Trigger intro dialogue -> battle -> post-battle dialogue
        this.gctx.flags['intro_seen'] = true;
        this.gctx.switchScreen('dialogue', {
          startNode: 'scene_start',
          onComplete: () => {
            // After dialogue ends at battle_trigger choice, start battle
            const formation = this.gctx.formations.find(f => f.id === 'pack');
            const enemyTemplates = (formation?.enemyIds ?? []).map(id => this.gctx.allEnemies[id]).filter(Boolean);
            this.gctx.switchScreen('battle', {
              enemyTemplates,
              isBoss: false,
              onVictory: () => {
                this.gctx.flags['crash_cleared'] = true;
                this.gctx.switchScreen('dialogue', {
                  startNode: 'post_battle_01',
                  onComplete: () => this.gctx.switchScreen('overworld'),
                });
              },
              onDefeat: () => this.gctx.switchScreen('overworld'),
            });
          },
        });
      }
    }
  }

  private notify(msg: string): void {
    this.notification = msg;
    this.notifTimer = 3;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.gctx.canvas;

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.65);
    sky.addColorStop(0, '#00000a');
    sky.addColorStop(1, '#06091a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height * 0.65);

    // Stars
    for (const s of this.stars) {
      const alpha = 0.2 + s.b * 0.5 * (0.85 + 0.15 * Math.sin(this.time * 1.5 + s.x));
      ctx.fillStyle = `rgba(160,200,255,${alpha})`;
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
    }

    // Bane void blot — upper left
    const baneGrad = ctx.createRadialGradient(60, 50, 10, 60, 50, 150);
    baneGrad.addColorStop(0, 'rgba(0,0,0,0.95)');
    baneGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = baneGrad;
    ctx.fillRect(0, 0, width, height);

    // Ground
    const groundY = Math.floor(height * 0.6);
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, height);
    groundGrad.addColorStop(0, '#0a0c0f');
    groundGrad.addColorStop(1, '#050608');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, width, height - groundY);

    // Ground line
    ctx.strokeStyle = '#1a2030';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(width, groundY); ctx.stroke();

    // Path between locations (dotted)
    ctx.strokeStyle = 'rgba(60, 80, 100, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(LOCATIONS[0]!.x, groundY + 10);
    ctx.lineTo(LOCATIONS[1]!.x, groundY + 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw village
    this.renderVillage(ctx, LOCATIONS[0]!.x, groundY);

    // Draw crash site
    this.renderCrashSite(ctx, LOCATIONS[1]!.x, groundY);

    // Location cursor
    const loc = LOCATIONS[this.cursor]!;
    const cursorBlink = Math.sin(this.time * 4) > 0;
    if (cursorBlink) {
      ctx.fillStyle = '#fc0';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('◆', loc.x, groundY - 8);
    }

    // HUD
    this.renderHUD(ctx, width, height, groundY);
  }

  private renderVillage(ctx: CanvasRenderingContext2D, cx: number, groundY: number): void {
    const buildings = [
      { dx: -45, w: 28, h: 35 }, { dx: -12, w: 22, h: 28 },
      { dx: 16,  w: 30, h: 40 }, { dx: 52,  w: 20, h: 25 },
    ];
    for (const b of buildings) {
      ctx.fillStyle = '#1a1008';
      ctx.fillRect(cx + b.dx, groundY - b.h, b.w, b.h);
      // Warm window light
      const flicker = 0.4 + 0.3 * Math.sin(this.time * 2.3 + b.dx);
      ctx.fillStyle = `rgba(255, 180, 60, ${flicker})`;
      ctx.fillRect(cx + b.dx + 6, groundY - b.h + 8, 6, 6);
      // Roof
      ctx.fillStyle = '#100c06';
      ctx.beginPath();
      ctx.moveTo(cx + b.dx - 2, groundY - b.h);
      ctx.lineTo(cx + b.dx + b.w / 2, groundY - b.h - 12);
      ctx.lineTo(cx + b.dx + b.w + 2, groundY - b.h);
      ctx.closePath();
      ctx.fill();
    }

    const isSelected = LOCATIONS[this.cursor]?.id === 'village';
    ctx.fillStyle = isSelected ? '#fc0' : '#8ab';
    ctx.font = isSelected ? 'bold 12px monospace' : '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Crestfall', cx, groundY + 18);
  }

  private renderCrashSite(ctx: CanvasRenderingContext2D, cx: number, groundY: number): void {
    const cleared = this.gctx.flags['crash_cleared'] ?? false;

    // Debris field
    ctx.fillStyle = '#1a1510';
    ctx.fillRect(cx - 60, groundY - 10, 120, 12);

    // Ship hull — tilted
    ctx.save();
    ctx.translate(cx, groundY - 35);
    ctx.rotate(0.12);
    ctx.fillStyle = cleared ? '#1a2020' : '#1e2530';
    ctx.fillRect(-75, -22, 150, 38);
    ctx.fillStyle = '#0d1218';
    ctx.fillRect(-55, -38, 50, 20);

    if (!cleared) {
      // Amber emergency light
      const flicker = 0.5 + 0.5 * Math.sin(this.time * 4.7);
      ctx.fillStyle = `rgba(255, 150, 20, ${flicker})`;
      ctx.fillRect(40, -12, 7, 7);
    } else {
      // Dark/dead after cleared
      ctx.fillStyle = 'rgba(100,150,200,0.2)';
      ctx.fillRect(40, -12, 7, 7);
    }
    ctx.restore();

    const isSelected = LOCATIONS[this.cursor]?.id === 'crash_site';
    const nameColor = cleared ? '#4a8' : isSelected ? '#fc0' : '#8ab';
    ctx.fillStyle = nameColor;
    ctx.font = isSelected ? 'bold 12px monospace' : '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(cleared ? 'Crash Site ★' : 'Crash Site', cx, groundY + 18);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number, _groundY: number): void {
    // Top location panel
    drawPanel(ctx, 0, 0, width, 42);
    const loc = LOCATIONS[this.cursor]!;
    ctx.fillStyle = '#fc0';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(loc.name, 12, 18);
    ctx.fillStyle = '#899';
    ctx.font = '11px monospace';
    ctx.fillText(loc.desc, 12, 33);

    // Bottom controls
    drawPanel(ctx, 0, height - 28, width, 28);
    ctx.fillStyle = '#4af';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('◄► Move   ENTER: Interact   M: Menu', 12, height - 12);

    // Party HP mini-bar (bottom right)
    this.gctx.party.forEach((c, i) => {
      const bx = width - 130 + i * 42;
      const by = height - 26;
      ctx.fillStyle = c.hp <= 0 ? '#633' : '#344';
      ctx.fillRect(bx, by + 2, 38, 18);
      ctx.fillStyle = c.hp <= 0 ? '#844' : '#4f4';
      ctx.fillRect(bx, by + 2, Math.round(38 * c.hp / c.maxHp), 18);
      ctx.fillStyle = c.hp <= 0 ? '#f44' : '#dff';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.name.substring(0, 4), bx + 19, by + 14);
    });

    // Notification
    if (this.notifTimer > 0) {
      const alpha = Math.min(1, this.notifTimer);
      drawPanel(ctx, width / 2 - 200, height / 2 - 20, 400, 40);
      ctx.fillStyle = `rgba(220, 240, 255, ${alpha})`;
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.notification, width / 2, height / 2 + 4);
    }
  }
}
