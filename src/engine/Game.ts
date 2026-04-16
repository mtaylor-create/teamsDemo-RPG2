import { InputManager } from './InputManager.ts';
import type { Character, Enemy, Item, DialogueNode, InventorySlot } from './types.ts';

// Static data imports (Vite resolves these at build time)
import partyDataRaw from '../data/characters/party.json';
import encountersDataRaw from '../data/enemies/encounters.json';
import dialogueDataRaw from '../data/dialogue/intro.json';
import itemsDataRaw from '../data/items/items.json';

// Screen imports (lazy-ish — all loaded at startup, small enough)
import { TitleScreen } from '../screens/TitleScreen.ts';
import { DialogueScreen } from '../screens/DialogueScreen.ts';
import { BattleScreen } from '../screens/BattleScreen.ts';
import { OverworldScreen } from '../screens/OverworldScreen.ts';
import { MenuScreen } from '../screens/MenuScreen.ts';
import { CrashSiteMapScreen } from '../screens/CrashSiteMapScreen.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScreenData = Record<string, any>;

/** Shared game state passed to every screen */
export interface GameContext {
  // Navigation
  switchScreen: (name: string, data?: ScreenData) => void;
  // Game state
  party: Character[];
  allEnemies: Record<string, Enemy>;
  formations: Array<{ id: string; enemyIds: string[]; isBoss: boolean }>;
  allItems: Item[];
  dialogueNodes: Map<string, DialogueNode>;
  inventory: InventorySlot[];
  flags: Record<string, boolean>;
  // Canvas access
  canvas: HTMLCanvasElement;
}

/** All screens implement this interface */
interface IScreen {
  update(dt: number, input: InputManager): void;
  render(ctx: CanvasRenderingContext2D): void;
}

// ----- Legacy export so main.ts doesn't need to change -----
export type GameScreen = 'title' | 'overworld' | 'battle' | 'menu' | 'dialogue';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private input: InputManager;
  private screen: IScreen | null = null;
  private running = false;
  private lastTime = 0;
  private gctx!: GameContext;
  private prevScreenName = 'title';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D rendering context');
    this.ctx2d = ctx;
    this.input = new InputManager();
    this.buildContext();
  }

  private buildContext(): void {
    // Deep-clone party so HP mutations don't touch the import cache
    const party = JSON.parse(JSON.stringify(partyDataRaw)) as Character[];

    // Enemy lookup map
    const allEnemies = (encountersDataRaw as { enemies: Record<string, Enemy> }).enemies;

    // Formation list
    const formations = (encountersDataRaw as {
      formations: Array<{ id: string; enemyIds: string[]; isBoss: boolean }>;
    }).formations;

    // Dialogue node map
    const dialogueNodes = new Map<string, DialogueNode>();
    for (const node of dialogueDataRaw as DialogueNode[]) {
      dialogueNodes.set(node.id, node);
    }

    // Starting inventory: a handful of consumables
    const inventory: InventorySlot[] = [
      { itemId: 'monomate', quantity: 3 },
      { itemId: 'dimate',   quantity: 1 },
    ];

    this.gctx = {
      switchScreen: (name, data) => this.switchScreen(name, data),
      party,
      allEnemies,
      formations,
      allItems: itemsDataRaw as Item[],
      dialogueNodes,
      inventory,
      flags: {},
      canvas: this.canvas,
    };
  }

  private switchScreen(name: string, data: ScreenData = {}): void {
    this.prevScreenName = name === 'menu' ? this.prevScreenName : name;

    switch (name) {
      // ── Title ────────────────────────────────────────────────────────────
      case 'title':
        this.screen = new TitleScreen(this.gctx);
        break;

      // ── Dialogue ─────────────────────────────────────────────────────────
      case 'dialogue': {
        const startNode  = (data['startNode']  as string)   ?? 'scene_start';
        const onComplete = (data['onComplete'] as () => void) ?? (() => this.switchScreen('overworld'));
        this.screen = new DialogueScreen(
          this.gctx,
          this.gctx.dialogueNodes,
          startNode,
          onComplete
        );
        break;
      }

      // ── Battle ───────────────────────────────────────────────────────────
      case 'battle': {
        const templates  = (data['enemyTemplates'] as Enemy[])    ?? [];
        const isBoss     = (data['isBoss']         as boolean)    ?? false;
        const onVictory  = (data['onVictory']      as () => void) ?? (() => this.switchScreen('overworld'));
        const onDefeat   = (data['onDefeat']       as () => void) ?? (() => this.switchScreen('title'));
        this.screen = new BattleScreen(this.gctx, templates, isBoss, onVictory, onDefeat);
        break;
      }

      // ── Overworld ────────────────────────────────────────────────────────
      case 'overworld':
        this.screen = new OverworldScreen(this.gctx);
        break;

      // ── Crash Site Map ───────────────────────────────────────────────────
      case 'crash_site_map': {
        const onBattleReady = (data['onBattleReady'] as () => void) ?? (() => this.switchScreen('overworld'));
        this.screen = new CrashSiteMapScreen(this.gctx, onBattleReady);
        break;
      }

      // ── Menu (overlay — returns to previous screen) ──────────────────────
      case 'menu':
        this.screen = new MenuScreen(
          this.gctx,
          () => this.switchScreen(this.prevScreenName)
        );
        break;

      default:
        console.warn(`Unknown screen: ${name}`);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.input.attach();
    this.switchScreen('title');
    requestAnimationFrame(t => this.loop(t));
  }

  stop(): void {
    this.running = false;
    this.input.detach();
  }

  /** @deprecated Use switchScreen via GameContext instead */
  setScreen(screen: GameScreen): void { this.switchScreen(screen); }
  getScreen(): GameScreen { return this.prevScreenName as GameScreen; }

  // ── Game loop ─────────────────────────────────────────────────────────────
  private loop(time: number): void {
    if (!this.running) return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.05); // cap at 50ms
    this.lastTime = time;
    this.update(dt);
    this.render();
    requestAnimationFrame(t => this.loop(t));
  }

  private update(dt: number): void {
    this.screen?.update(dt, this.input);
    this.input.flush();
  }

  private render(): void {
    this.ctx2d.fillStyle = '#000';
    this.ctx2d.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.screen?.render(this.ctx2d);
  }
}
