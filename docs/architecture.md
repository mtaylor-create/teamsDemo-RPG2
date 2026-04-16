# Architecture Reference

Technical internals for the Starfall Chronicles engine. Read this before touching any engine or screen file.

## Canvas and entry point

The game renders into a single `640×480` `<canvas>` element (`index.html`). `src/main.ts` creates a `Game` instance and calls `game.start()`. There are no frameworks, no DOM components, and no CSS beyond centering the canvas.

```
index.html  →  src/main.ts  →  Game  →  IScreen  →  Canvas 2D
```

## Game loop (`src/engine/Game.ts`)

`Game` owns the `requestAnimationFrame` loop. Each frame:

1. Compute `dt = (now - lastTime) / 1000`, capped at `0.05 s` (20 FPS minimum)
2. `screen.update(dt, input)` — game logic
3. Clear canvas with solid black fill
4. `screen.render(ctx)` — draw everything
5. `input.flush()` — clear single-frame key events

If `render` throws, the exception propagates out of `requestAnimationFrame` and the loop dies permanently. Guard all `createRadialGradient` / `addColorStop` calls — invalid CSS colour strings will throw and kill the loop with no recovery.

## IScreen interface

Every screen implements two methods:

```typescript
interface IScreen {
  update(dt: number, input: InputManager): void;
  render(ctx: CanvasRenderingContext2D): void;
}
```

Screens are plain classes. No base class, no lifecycle hooks beyond these two methods. Construction is the "mount" event.

## GameContext (`src/engine/Game.ts`)

`GameContext` is the shared mutable state object passed to every screen on construction. It is created once in `Game.buildContext()` and lives for the entire session (resets on page refresh — there is no save/load yet).

```typescript
interface GameContext {
  switchScreen: (name: string, data?: Record<string, any>) => void;
  party:        Character[];          // live HP — mutations persist across screens
  allEnemies:   Record<string, Enemy>;
  formations:   Array<{ id: string; enemyIds: string[]; isBoss: boolean }>;
  allItems:     Item[];
  dialogueNodes: Map<string, DialogueNode>;
  inventory:    InventorySlot[];      // mutable — items consumed in place
  flags:        Record<string, boolean>;  // general-purpose game state flags
  canvas:       HTMLCanvasElement;    // for width/height queries
}
```

**Never mutate `allEnemies` or `allItems`** — they are shared templates. Mutate `party[i].hp`, `inventory`, and `flags` freely.

## Screen registry and `switchScreen`

`Game.switchScreen(name, data)` is the only navigation mechanism. Screens call it via `gctx.switchScreen(...)`. The switch statement in `Game.ts` maps string names to constructors:

| Name | Class | Key `data` fields |
|---|---|---|
| `'title'` | `TitleScreen` | — |
| `'overworld'` | `OverworldScreen` | — |
| `'dialogue'` | `DialogueScreen` | `startNode: string`, `onComplete: () => void` |
| `'battle'` | `BattleScreen` | `enemyTemplates: Enemy[]`, `isBoss: boolean`, `onVictory: () => void`, `onDefeat: () => void` |
| `'crash_site_map'` | `CrashSiteMapScreen` | `onBattleReady: () => void` |
| `'menu'` | `MenuScreen` | — (returns to `prevScreenName` on close) |

The `'menu'` screen is special: `prevScreenName` is not updated when switching to menu, so closing the menu always returns to whichever screen was active before it was opened.

**Adding a new screen:** add a `case` to the switch in `Game.ts`, import the class, and register the name here.

## InputManager (`src/engine/InputManager.ts`)

Listens to `keydown` / `keyup` on `window`. Uses `e.code` (physical key, layout-independent), **not** `e.key`.

```typescript
input.isDown('ArrowLeft')   // true every frame the key is held
input.wasPressed('Enter')   // true only on the first frame after press
input.flush()               // called by Game after update — clears wasPressed
```

Always use `wasPressed` for menu selections and interactions. Use `isDown` only for continuous movement.

All keyboard events call `e.preventDefault()`. If the browser eats a key for another reason (e.g., focus on a form element), the game won't see it.

## Data loading

Game data lives in `src/data/` as typed JSON. Vite resolves these as ES module imports at build time:

```typescript
import partyDataRaw      from '../data/characters/party.json';
import encountersDataRaw from '../data/enemies/encounters.json';
import dialogueDataRaw   from '../data/dialogue/intro.json';
import itemsDataRaw      from '../data/items/items.json';
```

`party.json` is deep-cloned into `GameContext` so HP mutations don't touch the import cache. All other data is referenced directly (read-only by convention).

## Type system (`src/engine/types.ts`)

Core interfaces: `Character`, `Enemy`, `Item`, `ItemEffect`, `DialogueNode`, `DialogueChoice`, `InventorySlot`, `Equipment`, `Quest`, `SaveData`. See the file for full field lists. All game data files are typed against these interfaces.

## UI primitives (`src/ui/`)

Two shared drawing helpers used by every screen:

**`drawPanel(ctx, x, y, w, h, title?)`** — retro sci-fi bordered box: near-black fill, cyan `#4af` 2px border, `#8df` corner accent lines. Optional `title` renders a filled header strip.

**`drawProgressBar(ctx, x, y, w, h, current, max, color)`** — fills proportionally; colour shifts to `#fa2` below 50% and `#f42` below 25% regardless of the `color` argument.

Do not inline these drawing patterns in screens. Add shared patterns here if they appear in more than one file.

## Conventions

- All coordinates are canvas-space pixels (origin top-left, x right, y down).
- `dt` is always in **seconds** (not milliseconds). Cap any timer accumulation that feeds an animation or AI decision.
- Timers count **down** to zero (set to a positive value, subtract `dt` each frame, fire when `≤ 0`).
- `stateTimer` in BattleScreen counts **up** (set to 0, accumulate, fire when `≥ threshold`) — this is an inconsistency, noted in [known-issues.md](known-issues.md).
- Font: always `monospace`. Sizes used: 9, 10, 11, 12, 13, 14, 16, 20, 22, 28, 64 px.
- Colours: cyan `#4af` / `#8df` for UI chrome; gold `#fc0` for selected/highlight; `#ddf` / `#cef` for body text; `#899` / `#7ab` for secondary text; `#4f4` for HP/success; `#f44` for damage/KO.
