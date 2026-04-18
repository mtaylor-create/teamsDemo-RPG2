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
  { id: 'village',    name: 'Crestfall Village', desc: 'Your home. A dying town on a dying world.',               x: 80,  y: 160 },
  { id: 'crash_site', name: 'Crash Site',         desc: 'A starship from another age... and a destiny.',           x: 240, y: 230 },
  { id: 'wilds',      name: 'Dezolis Wilds',      desc: 'Frozen wasteland between the village and the spaceport.', x: 400, y: 200 },
  { id: 'spaceport',  name: 'Dezolis Spaceport',  desc: 'An abandoned port from before the Collapse.',             x: 560, y: 240 },
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
      if (!this.gctx.flags['crash_cleared']) {
        this.notify("There's nothing more to do here. The crash site waits.");
      } else {
        this.notify('Crestfall grows dimmer. Time to move forward.');
      }
      return;
    }

    if (locId === 'crash_site') {
      if (this.gctx.flags['crash_cleared']) {
        this.notify('The wreckage is quiet now. Your journey continues...');
        return;
      }

      if (this.gctx.flags['ariel_found']) {
        this.startCrashBattle();
      } else if (!this.gctx.flags['intro_seen']) {
        this.gctx.switchScreen('dialogue', {
          startNode: 'scene_start',
          onComplete: () => {
            this.gctx.flags['intro_seen'] = true;
            this.enterDungeon('crash_site');
          },
        });
      } else {
        this.enterDungeon('crash_site');
      }
      return;
    }

    if (locId === 'wilds') {
      if (!this.gctx.flags['crash_cleared']) {
        this.notify('The wilds are too dangerous without the full party.');
        return;
      }
      if (this.gctx.flags['wilds_cleared']) {
        this.notify('The path through the wilds is clear. The spaceport lies ahead.');
        return;
      }

      if (!this.gctx.flags['wilds_entered']) {
        this.gctx.switchScreen('dialogue', {
          startNode: 'wilds_approach',
          onComplete: () => {
            this.gctx.flags['wilds_entered'] = true;
            this.enterDungeon('wilds');
          },
        });
      } else {
        this.enterDungeon('wilds');
      }
      return;
    }

    if (locId === 'spaceport') {
      if (!this.gctx.flags['wilds_cleared']) {
        this.notify('You must cross the Dezolis Wilds first.');
        return;
      }
      if (this.gctx.flags['spaceport_cleared']) {
        this.notify('The ship is ready. Act 2 awaits...');
        return;
      }

      if (!this.gctx.flags['spaceport_entered']) {
        this.gctx.switchScreen('dialogue', {
          startNode: 'spaceport_arrival',
          onComplete: () => {
            this.gctx.flags['spaceport_entered'] = true;
            this.enterDungeon('spaceport');
          },
        });
      } else {
        this.enterDungeon('spaceport');
      }
      return;
    }
  }

  // ── Dungeon entry helpers ───────────────────────────────────────────────

  /**
   * Enter a tile-based dungeon. When the player reaches the objective tile,
   * the appropriate dialogue + battle sequence fires.
   */
  private enterDungeon(mapId: string): void {
    this.gctx.switchScreen('dungeon', {
      mapId,
      onComplete: () => this.onDungeonComplete(mapId),
      onDefeat: () => this.gctx.switchScreen('overworld'),
    });
  }

  /** Fired when the player reaches a dungeon's objective tile. */
  private onDungeonComplete(mapId: string): void {
    switch (mapId) {
      case 'crash_site':
        // Found the stasis pod → dialogue → battle
        this.gctx.flags['ariel_found'] = true;
        this.gctx.switchScreen('dialogue', {
          startNode: 'kael_lyra_01',
          onComplete: () => this.startCrashBattle(),
        });
        break;

      case 'wilds':
        // Reached the far side → battle trigger dialogue → battle
        this.gctx.switchScreen('dialogue', {
          startNode: 'wilds_battle_trigger',
          onComplete: () => this.startWildsBattle(),
        });
        break;

      case 'spaceport':
        // Reached the hangar → boss trigger dialogue → boss battle
        this.gctx.switchScreen('dialogue', {
          startNode: 'spaceport_boss_trigger',
          onComplete: () => this.startSpaceportBoss(),
        });
        break;

      default:
        this.gctx.switchScreen('overworld');
    }
  }

  /** Restore party HP/TP after a zone is cleared */
  private restoreParty(): void {
    for (const c of this.gctx.party) {
      c.hp = c.maxHp;
      c.tp = c.maxTp;
    }
  }

  private startCrashBattle(): void {
    const formation = this.gctx.formations.find(f => f.id === 'pack');
    const enemyTemplates = (formation?.enemyIds ?? []).map(id => this.gctx.allEnemies[id]).filter(Boolean);
    this.gctx.switchScreen('battle', {
      enemyTemplates,
      isBoss: false,
      onVictory: () => {
        this.gctx.flags['crash_cleared'] = true;
        this.restoreParty();
        this.gctx.switchScreen('dialogue', {
          startNode: 'post_battle_01',
          onComplete: () => this.gctx.switchScreen('overworld'),
        });
      },
      onDefeat: () => this.gctx.switchScreen('overworld'),
    });
  }

  private startWildsBattle(): void {
    const formId = this.gctx.flags['wilds_fight_alt'] ? 'wilds_mixed' : 'wilds_crawlers';
    const formation = this.gctx.formations.find(f => f.id === formId);
    const enemyTemplates = (formation?.enemyIds ?? []).map(id => this.gctx.allEnemies[id]).filter(Boolean);
    this.gctx.switchScreen('battle', {
      enemyTemplates,
      isBoss: false,
      onVictory: () => {
        this.gctx.flags['wilds_cleared'] = true;
        this.gctx.flags['wilds_fight_alt'] = !this.gctx.flags['wilds_fight_alt'];
        this.restoreParty();
        const existing = this.gctx.inventory.find(s => s.itemId === 'monomate');
        if (existing) existing.quantity += 2;
        else this.gctx.inventory.push({ itemId: 'monomate', quantity: 2 });
        this.gctx.switchScreen('dialogue', {
          startNode: 'wilds_cleared',
          onComplete: () => this.gctx.switchScreen('overworld'),
        });
      },
      onDefeat: () => this.gctx.switchScreen('overworld'),
    });
  }

  private startSpaceportBoss(): void {
    const formation = this.gctx.formations.find(f => f.id === 'warden');
    const enemyTemplates = (formation?.enemyIds ?? []).map(id => this.gctx.allEnemies[id]).filter(Boolean);
    this.gctx.switchScreen('battle', {
      enemyTemplates,
      isBoss: true,
      onVictory: () => {
        this.gctx.flags['spaceport_cleared'] = true;
        this.gctx.switchScreen('dialogue', {
          startNode: 'spaceport_victory',
          onComplete: () => this.gctx.switchScreen('overworld'),
        });
      },
      onDefeat: () => this.gctx.switchScreen('overworld'),
    });
  }

  private notify(msg: string): void {
    this.notification = msg;
    this.notifTimer = 3;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.gctx.canvas;

    // Sky gradient — richer, more visible blues
    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.65);
    sky.addColorStop(0, '#050a1a');
    sky.addColorStop(1, '#0c1428');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height * 0.65);

    // Stars — brighter
    for (const s of this.stars) {
      const alpha = 0.3 + s.b * 0.6 * (0.85 + 0.15 * Math.sin(this.time * 1.5 + s.x));
      ctx.fillStyle = `rgba(190,220,255,${alpha})`;
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
    }

    // Bane void blot — upper left with purple tint
    const baneGrad = ctx.createRadialGradient(60, 50, 10, 60, 50, 150);
    baneGrad.addColorStop(0, 'rgba(0,0,0,0.9)');
    baneGrad.addColorStop(0.5, 'rgba(15,0,25,0.5)');
    baneGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = baneGrad;
    ctx.fillRect(0, 0, width, height);

    // Ground — visible terrain
    const groundY = Math.floor(height * 0.6);
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, height);
    groundGrad.addColorStop(0, '#141a24');
    groundGrad.addColorStop(1, '#0a0e16');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, width, height - groundY);

    // Ground line — brighter horizon
    ctx.strokeStyle = '#2a3a55';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(width, groundY); ctx.stroke();

    // Path between locations (dotted) — connects all locations
    ctx.strokeStyle = 'rgba(70, 100, 140, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    const sortedLocs = [...LOCATIONS].sort((a, b) => a.x - b.x);
    ctx.moveTo(sortedLocs[0]!.x, groundY + 10);
    for (let i = 1; i < sortedLocs.length; i++) {
      ctx.lineTo(sortedLocs[i]!.x, groundY + 10);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw each location
    this.renderVillage(ctx, LOCATIONS[0]!.x, groundY);
    this.renderCrashSite(ctx, LOCATIONS[1]!.x, groundY);
    this.renderWilds(ctx, LOCATIONS[2]!.x, groundY);
    this.renderSpaceport(ctx, LOCATIONS[3]!.x, groundY);

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
      ctx.fillStyle = '#24180e';
      ctx.fillRect(cx + b.dx, groundY - b.h, b.w, b.h);
      // Wall detail
      ctx.fillStyle = '#2e2014';
      ctx.fillRect(cx + b.dx + 2, groundY - b.h + 2, b.w - 4, b.h - 2);
      // Warm window light
      const flicker = 0.5 + 0.4 * Math.sin(this.time * 2.3 + b.dx);
      ctx.fillStyle = `rgba(255, 200, 80, ${flicker})`;
      ctx.fillRect(cx + b.dx + 6, groundY - b.h + 8, 6, 6);
      if (b.w > 24) {
        ctx.fillRect(cx + b.dx + b.w - 12, groundY - b.h + 10, 5, 5);
      }
      // Roof
      ctx.fillStyle = '#1a1208';
      ctx.beginPath();
      ctx.moveTo(cx + b.dx - 2, groundY - b.h);
      ctx.lineTo(cx + b.dx + b.w / 2, groundY - b.h - 12);
      ctx.lineTo(cx + b.dx + b.w + 2, groundY - b.h);
      ctx.closePath();
      ctx.fill();
    }

    const isSelected = LOCATIONS[this.cursor]?.id === 'village';
    ctx.fillStyle = isSelected ? '#fc0' : '#9bc';
    ctx.font = isSelected ? 'bold 12px monospace' : '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Crestfall', cx, groundY + 18);
  }

  private renderCrashSite(ctx: CanvasRenderingContext2D, cx: number, groundY: number): void {
    const cleared = this.gctx.flags['crash_cleared'] ?? false;

    // Debris field
    ctx.fillStyle = '#261e14';
    ctx.fillRect(cx - 60, groundY - 10, 120, 12);

    // Ship hull — tilted
    ctx.save();
    ctx.translate(cx, groundY - 35);
    ctx.rotate(0.12);
    ctx.fillStyle = cleared ? '#253535' : '#2a3848';
    ctx.fillRect(-75, -22, 150, 38);
    // Hull detail strip
    ctx.fillStyle = cleared ? '#1e2a2a' : '#344a60';
    ctx.fillRect(-75, -8, 150, 4);
    ctx.fillStyle = '#141e2a';
    ctx.fillRect(-55, -38, 50, 20);

    if (!cleared) {
      // Amber emergency light
      const flicker = 0.5 + 0.5 * Math.sin(this.time * 4.7);
      ctx.fillStyle = `rgba(255, 170, 30, ${flicker})`;
      ctx.fillRect(40, -12, 7, 7);
    } else {
      // Dim blue after cleared
      ctx.fillStyle = 'rgba(120,180,220,0.25)';
      ctx.fillRect(40, -12, 7, 7);
    }
    ctx.restore();

    const isSelected = LOCATIONS[this.cursor]?.id === 'crash_site';
    const nameColor = cleared ? '#5b9' : isSelected ? '#fc0' : '#9bc';
    ctx.fillStyle = nameColor;
    ctx.font = isSelected ? 'bold 12px monospace' : '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(cleared ? 'Crash Site ★' : 'Crash Site', cx, groundY + 18);
  }

  private renderWilds(ctx: CanvasRenderingContext2D, cx: number, groundY: number): void {
    const locked = !(this.gctx.flags['crash_cleared'] ?? false);
    const cleared = this.gctx.flags['wilds_cleared'] ?? false;

    // Frozen dead trees
    const treePositions = [-35, -10, 15, 40];
    for (const dx of treePositions) {
      const h = 20 + Math.abs(dx) * 0.4;
      ctx.fillStyle = locked ? '#181e24' : cleared ? '#1e3028' : '#1a2428';
      ctx.fillRect(cx + dx - 2, groundY - h, 4, h);
      // Bare branches
      ctx.strokeStyle = locked ? '#1e2830' : cleared ? '#2a4038' : '#222e34';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + dx, groundY - h + 4);
      ctx.lineTo(cx + dx - 8, groundY - h - 6);
      ctx.moveTo(cx + dx, groundY - h + 4);
      ctx.lineTo(cx + dx + 7, groundY - h - 5);
      ctx.stroke();
    }

    // Ice/snow patches on the ground
    if (!locked) {
      ctx.fillStyle = 'rgba(140, 180, 220, 0.15)';
      ctx.fillRect(cx - 40, groundY - 2, 80, 4);
    }

    // Wind particles when active
    if (!locked && !cleared) {
      const windAlpha = 0.3 + 0.2 * Math.sin(this.time * 3);
      ctx.fillStyle = `rgba(180, 220, 255, ${windAlpha})`;
      const wx = cx - 30 + ((this.time * 40) % 80);
      ctx.fillRect(wx, groundY - 12, 6, 1);
      ctx.fillRect(wx - 15, groundY - 18, 4, 1);
    }

    const isSelected = LOCATIONS[this.cursor]?.id === 'wilds';
    const nameColor = locked ? '#556' : cleared ? '#5b9' : isSelected ? '#fc0' : '#9bc';
    ctx.fillStyle = nameColor;
    ctx.font = isSelected ? 'bold 12px monospace' : '11px monospace';
    ctx.textAlign = 'center';
    const label = locked ? 'Dezolis Wilds [X]' : cleared ? 'Dezolis Wilds *' : 'Dezolis Wilds';
    ctx.fillText(label, cx, groundY + 18);
  }

  private renderSpaceport(ctx: CanvasRenderingContext2D, cx: number, groundY: number): void {
    const locked = !(this.gctx.flags['wilds_cleared'] ?? false);
    const cleared = this.gctx.flags['spaceport_cleared'] ?? false;

    // Landing pad base
    ctx.fillStyle = locked ? '#161a20' : '#1e2838';
    ctx.fillRect(cx - 50, groundY - 4, 100, 6);

    // Control tower
    ctx.fillStyle = locked ? '#141820' : cleared ? '#253848' : '#1e2e42';
    ctx.fillRect(cx - 8, groundY - 45, 16, 45);
    // Tower top
    ctx.fillStyle = locked ? '#181e28' : cleared ? '#2e4858' : '#243a52';
    ctx.fillRect(cx - 14, groundY - 50, 28, 8);

    // Hangar building
    ctx.fillStyle = locked ? '#141820' : cleared ? '#253848' : '#1e2e42';
    ctx.fillRect(cx + 18, groundY - 28, 35, 28);
    // Hangar door
    ctx.fillStyle = locked ? '#101418' : cleared ? '#1e3040' : '#162230';
    ctx.fillRect(cx + 22, groundY - 20, 26, 20);

    // Antenna dish
    ctx.strokeStyle = locked ? '#1e2430' : '#3a5068';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 6, groundY - 50);
    ctx.lineTo(cx - 6, groundY - 60);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 6, groundY - 62, 5, Math.PI, 0);
    ctx.stroke();

    // Beacon light
    if (!locked) {
      const blink = Math.sin(this.time * 3.5) > 0;
      const beaconColor = cleared ? 'rgba(80, 220, 120, 0.8)' : blink ? 'rgba(255, 60, 60, 0.8)' : 'rgba(255, 60, 60, 0.2)';
      ctx.fillStyle = beaconColor;
      ctx.fillRect(cx - 2, groundY - 53, 4, 4);
    }

    const isSelected = LOCATIONS[this.cursor]?.id === 'spaceport';
    const nameColor = locked ? '#556' : cleared ? '#5b9' : isSelected ? '#fc0' : '#9bc';
    ctx.fillStyle = nameColor;
    ctx.font = isSelected ? 'bold 12px monospace' : '11px monospace';
    ctx.textAlign = 'center';
    const label = locked ? 'Spaceport [X]' : cleared ? 'Spaceport *' : 'Spaceport';
    ctx.fillText(label, cx, groundY + 18);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number, _groundY: number): void {
    // Top location panel
    drawPanel(ctx, 0, 0, width, 42);
    const loc = LOCATIONS[this.cursor]!;
    ctx.fillStyle = '#fc0';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(loc.name, 12, 18);
    ctx.fillStyle = '#9ab';
    ctx.font = '11px monospace';
    ctx.fillText(loc.desc, 12, 33);

    // Bottom controls
    drawPanel(ctx, 0, height - 28, width, 28);
    ctx.fillStyle = '#5bf';
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
