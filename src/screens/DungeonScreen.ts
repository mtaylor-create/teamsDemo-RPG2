/**
 * DungeonScreen — tile-based dungeon exploration with grid movement,
 * scrolling camera, random encounters, and hidden treasure chests.
 *
 * Designed to emulate the look and feel of classic 16-bit JRPGs like
 * Phantasy Star IV: maze-like areas on a grid of tiles that scroll
 * as the player moves.
 */

import type { GameContext } from '../engine/Game.ts';
import type { InputManager } from '../engine/InputManager.ts';
import type { Enemy } from '../engine/types.ts';
import { drawPanel } from '../ui/Panel.ts';
import { drawProgressBar } from '../ui/ProgressBar.ts';
import {
  TILE_SIZE, VIEW_COLS, VIEW_ROWS,
  isSolid, renderTile, renderPlayer,
  type TileId, type Facing,
} from '../world/TileEngine.ts';
import { parseLayout, ALL_MAPS, type MapDef, type TreasureDef } from '../world/maps.ts';

// ── Constants ───────────────────────────────────────────────────────────────

const MOVE_DURATION = 0.15; // seconds to glide between tiles

// ── DungeonScreen ───────────────────────────────────────────────────────────

export class DungeonScreen {
  private gctx: GameContext;
  private map: MapDef;
  private grid: TileId[][];
  private mapCols: number;
  private mapRows: number;

  // Callbacks
  private onComplete: () => void;
  private onDefeat: () => void;

  // Player grid position
  private playerCol: number;
  private playerRow: number;
  private facing: Facing = 'down';

  // Movement interpolation
  private moving = false;
  private moveFromCol = 0;
  private moveFromRow = 0;
  private moveToCol = 0;
  private moveToRow = 0;
  private moveTimer = 0;

  // Random encounters
  private stepsToEncounter: number;

  // Treasure tracking (which chests are opened, keyed by flag)
  private openedChests: Set<string>;

  // Notification system
  private notification = '';
  private notifTimer = 0;

  // Objective reached flag (to prevent double-trigger)
  private objectiveReached = false;

  // Animation clock
  private time = 0;

  constructor(
    gctx: GameContext,
    mapId: string,
    onComplete: () => void,
    onDefeat: () => void,
    startCol?: number,
    startRow?: number,
  ) {
    this.gctx = gctx;
    this.map = ALL_MAPS[mapId] ?? ALL_MAPS['crash_site']!;
    this.grid = parseLayout(this.map.layout);
    this.mapRows = this.grid.length;
    this.mapCols = this.grid[0]?.length ?? 0;
    this.onComplete = onComplete;
    this.onDefeat = onDefeat;

    // Starting position
    this.playerCol = startCol ?? this.map.playerStart.col;
    this.playerRow = startRow ?? this.map.playerStart.row;

    // Random encounter step counter
    this.stepsToEncounter = this.rollEncounterSteps();

    // Track opened chests via gctx.flags
    this.openedChests = new Set<string>();
    for (const t of this.map.treasures) {
      if (gctx.flags[t.flag]) {
        this.openedChests.add(t.flag);
      }
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────

  update(dt: number, input: InputManager): void {
    this.time += dt;
    if (this.notifTimer > 0) this.notifTimer -= dt;

    // Process movement interpolation
    if (this.moving) {
      this.moveTimer += dt;
      if (this.moveTimer >= MOVE_DURATION) {
        // Movement complete — snap to target
        this.playerCol = this.moveToCol;
        this.playerRow = this.moveToRow;
        this.moving = false;
        this.moveTimer = 0;

        // Post-move checks
        this.onStepComplete();
      }
      return; // No new input while animating
    }

    // Menu — pass dungeon state so it can restore position on return
    if (input.wasPressed('KeyM') || input.wasPressed('Escape')) {
      this.gctx.switchScreen('menu', {
        returnTo: 'dungeon',
        returnData: {
          mapId: this.map.id,
          onComplete: this.onComplete,
          onDefeat: this.onDefeat,
          playerCol: this.playerCol,
          playerRow: this.playerRow,
        },
      });
      return;
    }

    // Grid movement — one tile at a time
    let dc = 0, dr = 0;
    if (input.wasPressed('ArrowUp')    || input.wasPressed('KeyW')) { dr = -1; this.facing = 'up'; }
    else if (input.wasPressed('ArrowDown')  || input.wasPressed('KeyS')) { dr =  1; this.facing = 'down'; }
    else if (input.wasPressed('ArrowLeft')  || input.wasPressed('KeyA')) { dc = -1; this.facing = 'left'; }
    else if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) { dc =  1; this.facing = 'right'; }

    if (dc !== 0 || dr !== 0) {
      const nc = this.playerCol + dc;
      const nr = this.playerRow + dr;
      if (this.canWalk(nc, nr)) {
        this.startMove(nc, nr);
      }
    }
  }

  private canWalk(col: number, row: number): boolean {
    if (col < 0 || col >= this.mapCols || row < 0 || row >= this.mapRows) return false;
    const tile = this.grid[row]![col]!;
    return !isSolid(tile);
  }

  private startMove(col: number, row: number): void {
    this.moveFromCol = this.playerCol;
    this.moveFromRow = this.playerRow;
    this.moveToCol = col;
    this.moveToRow = row;
    this.moveTimer = 0;
    this.moving = true;
  }

  private onStepComplete(): void {
    // Check treasure
    const treasure = this.findTreasureAt(this.playerCol, this.playerRow);
    if (treasure && !this.openedChests.has(treasure.flag)) {
      this.collectTreasure(treasure);
      return; // Don't trigger encounter on treasure tile
    }

    // Check objective
    if (
      this.playerCol === this.map.objective.col &&
      this.playerRow === this.map.objective.row &&
      !this.objectiveReached
    ) {
      this.objectiveReached = true;
      this.onComplete();
      return;
    }

    // Random encounter countdown
    this.stepsToEncounter--;
    if (this.stepsToEncounter <= 0) {
      this.triggerEncounter();
    }
  }

  // ── Treasure ────────────────────────────────────────────────────────────

  private findTreasureAt(col: number, row: number): TreasureDef | undefined {
    return this.map.treasures.find(t => t.col === col && t.row === row);
  }

  private collectTreasure(t: TreasureDef): void {
    this.openedChests.add(t.flag);
    this.gctx.flags[t.flag] = true;

    // Add item to inventory
    const slot = this.gctx.inventory.find(s => s.itemId === t.itemId);
    if (slot) {
      slot.quantity += t.quantity;
    } else {
      this.gctx.inventory.push({ itemId: t.itemId, quantity: t.quantity });
    }

    // Look up item name for notification
    const item = this.gctx.allItems.find(i => i.id === t.itemId);
    const name = item ? item.name : t.itemId;
    const qtyStr = t.quantity > 1 ? ` x${t.quantity}` : '';
    this.notify(`Found ${name}${qtyStr}!`);
  }

  // ── Random encounters ─────────────────────────────────────────────────

  private rollEncounterSteps(): number {
    const [min, max] = this.map.encounterRate;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  private triggerEncounter(): void {
    // Pick a random formation
    const formIds = this.map.encounterFormations;
    const formId = formIds[Math.floor(Math.random() * formIds.length)]!;
    const formation = this.gctx.formations.find(f => f.id === formId);
    if (!formation) {
      this.stepsToEncounter = this.rollEncounterSteps();
      return;
    }

    const enemyTemplates: Enemy[] = formation.enemyIds
      .map(id => this.gctx.allEnemies[id])
      .filter(Boolean) as Enemy[];

    // Save position for return
    const savedCol = this.playerCol;
    const savedRow = this.playerRow;
    const mapId = this.map.id;

    this.gctx.switchScreen('battle', {
      enemyTemplates,
      isBoss: formation.isBoss,
      onVictory: () => {
        // Return to dungeon at saved position
        this.gctx.switchScreen('dungeon', {
          mapId,
          onComplete: this.onComplete,
          onDefeat: this.onDefeat,
          playerCol: savedCol,
          playerRow: savedRow,
        });
      },
      onDefeat: () => {
        this.onDefeat();
      },
    });
  }

  // ── Notification ──────────────────────────────────────────────────────

  private notify(msg: string): void {
    this.notification = msg;
    this.notifTimer = 3;
  }

  // ── Render ────────────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.gctx.canvas.width;
    const H = this.gctx.canvas.height;

    // ── Camera ──
    // Player pixel position (with interpolation)
    const playerPx = this.getPlayerPixelX();
    const playerPy = this.getPlayerPixelY();

    // Camera centered on player, clamped to map bounds
    const mapPixelW = this.mapCols * TILE_SIZE;
    const mapPixelH = this.mapRows * TILE_SIZE;
    let camX = playerPx - W / 2 + TILE_SIZE / 2;
    let camY = playerPy - H / 2 + TILE_SIZE / 2;
    camX = Math.max(0, Math.min(mapPixelW - W, camX));
    camY = Math.max(0, Math.min(mapPixelH - H, camY));

    // ── Draw tiles ──
    // Only draw visible tiles (plus 1 tile border for partial visibility)
    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE));
    const endCol = Math.min(this.mapCols, startCol + VIEW_COLS + 2);
    const endRow = Math.min(this.mapRows, startRow + VIEW_ROWS + 2);

    // Background (void color for areas outside map)
    ctx.fillStyle = '#040608';
    ctx.fillRect(0, 0, W, H);

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const tile = this.grid[r]![c]!;
        const px = c * TILE_SIZE - camX;
        const py = r * TILE_SIZE - camY;

        // Check if this chest is opened
        const treasure = this.findTreasureAt(c, r);
        const chestOpened = treasure ? this.openedChests.has(treasure.flag) : false;

        renderTile(ctx, tile, this.map.tileset, px, py, this.time, chestOpened);
      }
    }

    // ── Draw player ──
    const ppx = playerPx - camX;
    const ppy = playerPy - camY;
    renderPlayer(ctx, ppx, ppy, this.facing, this.time, this.moving);

    // ── HUD overlay ──
    this.renderHUD(ctx, W, H);
  }

  private getPlayerPixelX(): number {
    if (!this.moving) return this.playerCol * TILE_SIZE;
    const t = Math.min(1, this.moveTimer / MOVE_DURATION);
    return (this.moveFromCol + (this.moveToCol - this.moveFromCol) * t) * TILE_SIZE;
  }

  private getPlayerPixelY(): number {
    if (!this.moving) return this.playerRow * TILE_SIZE;
    const t = Math.min(1, this.moveTimer / MOVE_DURATION);
    return (this.moveFromRow + (this.moveToRow - this.moveFromRow) * t) * TILE_SIZE;
  }

  private renderHUD(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    // Location + objective panel (top)
    drawPanel(ctx, 0, 0, W, 42);
    ctx.fillStyle = '#fc0';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(this.map.name, 12, 16);
    ctx.fillStyle = '#8cf';
    ctx.font = '11px monospace';
    ctx.fillText(this.map.objectiveLabel, 12, 33);

    // Party HP bars (bottom-left)
    const barW = 120;
    const barH = 12;
    const partyPanelH = 4 + this.gctx.party.length * 20 + 4;
    const panelY = H - partyPanelH - 4;
    drawPanel(ctx, 4, panelY, barW + 16, partyPanelH);

    this.gctx.party.forEach((c, i) => {
      const bx = 12;
      const by = panelY + 6 + i * 20;
      // Name
      ctx.fillStyle = c.hp <= 0 ? '#f44' : '#cef';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(c.name.substring(0, 5), bx, by + 8);
      // HP bar
      const barColor = c.hp <= 0 ? '#633' : '#4f4';
      drawProgressBar(ctx, bx + 36, by, barW - 36, barH, c.hp, c.maxHp, barColor);
    });

    // Controls (bottom-right)
    drawPanel(ctx, W - 240, H - 24, 236, 20);
    ctx.fillStyle = '#5bf';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ARROWS: Move  M: Menu', W - 232, H - 11);

    // Notification (centered)
    if (this.notifTimer > 0) {
      const alpha = Math.min(1, this.notifTimer);
      const nw = 320;
      drawPanel(ctx, W / 2 - nw / 2, H / 2 - 18, nw, 36);
      ctx.fillStyle = `rgba(255, 220, 80, ${alpha.toFixed(3)})`;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.notification, W / 2, H / 2 + 4);
    }
  }
}
