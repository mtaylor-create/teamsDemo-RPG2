# Adding a New Chapter (Act) to Starfall Chronicles

This guide walks through everything needed to extend the game with a new act. Use Act 2 ("The Void Between Worlds") as the running example.

Before writing any code, read:
- `docs/architecture.md` — engine internals and screen registry
- `docs/gameplay.md` — flag system, existing flow, content reference
- `docs/story/story-bible.md` — narrative context, characters, act outlines

---

## What makes up an act

Each act consists of:
1. **Overworld** — a screen listing locations the player can visit (may be a new planet/area)
2. **Dialogue nodes** — story scenes (arrival, boss trigger, victory, finale)
3. **Dungeon maps** — tile-based areas to explore with random encounters and treasures
4. **Enemies and formations** — new enemy types for the act
5. **Game flags** — boolean state tracking progress through the act

Act 1 covers all of this for Dezolis. Act 2 begins the moment `gctx.flags['spaceport_cleared']` is true.

---

## Step 1: Update the story data

Mark the act as in-progress in `src/data/story/acts.json`:

```json
{ "id": "act2", "status": "demo" }
```

Add any new characters or update `src/data/characters/party.json` if new members join.

---

## Step 2: Add dialogue nodes

All dialogue lives in `src/data/dialogue/intro.json` for Act 1. For a new act, **create a separate file** to keep things manageable:

1. Create `src/data/dialogue/act2.json` following the same format as `intro.json`
2. Import and merge it in `Game.ts`'s `buildContext()`:

```typescript
import act2DialogueRaw from '../data/dialogue/act2.json';

// Inside buildContext(), after the Act 1 loop:
for (const node of act2DialogueRaw as DialogueNode[]) {
  dialogueNodes.set(node.id, node);
}
```

See `docs/gameplay.md` → "Dialogue Screen" for the full node format. Use `"end"` as the terminal `next` value.

**Name nodes with an act prefix** (e.g., `act2_void_transit`, `act2_motavia_arrival`) to avoid collisions.

---

## Step 3: Add enemies and formations

Edit `src/data/enemies/encounters.json`. Add entries to `"enemies"` and `"formations"`:

```json
"enemies": {
  "void_wraith": { "id": "void_wraith", "hp": 45, "attack": 14, ... }
},
"formations": [
  { "id": "void_pack", "enemyIds": ["void_wraith", "void_wraith"], "isBoss": false }
]
```

See `docs/gameplay.md` → "Enemies" for the full field list. Add enemy colours and sizes to `BattleScreen.ts`'s `ENEMY_COLORS` and `ENEMY_SIZE` maps.

---

## Step 4: Add dungeon maps

Edit `src/world/maps.ts`. Add a new entry to the `MAPS` record:

```typescript
motavia_ruins: {
  tileset: 'stone',          // 'stone' | 'ice' | 'metal'
  rows: [
    '############################',
    '#..........................#',
    // ... (each char = one tile; see TILE_CHARS in TileEngine.ts)
  ],
  objective: { col: 14, row: 18 },
  treasures: [
    { col: 5, row: 3, itemId: 'monomate', quantity: 2, flag: 'chest_motavia_1' },
  ],
  encounters: {
    formations: ['void_pack', 'stalker_ambush'],
    stepRange:  [10, 18],
  },
  name: 'Motavia Ruins',
  objectiveLabel: 'Find the Archive entrance',
},
```

**Tile characters** (defined in `TileEngine.ts`):
| Char | Tile |
|---|---|
| `#` | WALL |
| `.` | FLOOR |
| `~` | FLOOR_ALT |
| `o` | PILLAR |
| `*` | DEBRIS |
| `T` | CHEST |
| `O` | OBJECTIVE |

All rows must have the same length (validated at import time in dev mode). Maps render on a 32px grid; the viewport is 20×15 tiles (640×480).

---

## Step 5: Create a new overworld screen (new planet)

Act 2 takes place on Motavia — a new planet requires a new overworld screen.

1. Create `src/screens/MotaviaOverworldScreen.ts` modelling it on `OverworldScreen.ts`
2. Define `LOCATIONS` for the new area (e.g., Motavia Desert, Archive Approach, Bane Rift)
3. Implement `interact()`, `enterDungeon()`, and `onDungeonComplete()` following the same pattern
4. Register the screen in `Game.ts`:

```typescript
import { MotaviaOverworldScreen } from '../screens/MotaviaOverworldScreen.ts';

// In switchScreen():
case 'motavia_overworld':
  this.screen = new MotaviaOverworldScreen(this.gctx);
  break;
```

5. Add the entry to the screen registry table in `docs/architecture.md`

**Connecting Act 1 → Act 2:** In `OverworldScreen.ts`, change the spaceport's `spaceport_cleared` branch from a dead-end notify to a transition:

```typescript
if (this.gctx.flags['spaceport_cleared']) {
  if (!this.gctx.flags['act2_started']) {
    this.gctx.switchScreen('dialogue', {
      startNode: 'act2_void_transit',
      onComplete: () => {
        this.gctx.flags['act2_started'] = true;
        this.gctx.switchScreen('motavia_overworld');
      },
    });
  } else {
    this.gctx.switchScreen('motavia_overworld');
  }
  return;
}
```

---

## Step 6: Define flags

Use an `act2_` prefix for all new flags. Document them in `docs/gameplay.md` → "Demo flow and game flags":

| Flag | Set when | Effect |
|---|---|---|
| `act2_started` | Void transit dialogue completes | Skip void transit on re-entry |
| `act2_ruins_entered` | First ruins arrival dialogue | Skip arrival on re-entry |
| `act2_ruins_cleared` | Ruins boss victory | Ruins show cleared state |

---

## Step 7: Update documentation

After implementing, update these files **in the same commit**:

| File | What to add |
|---|---|
| `docs/gameplay.md` | New flags table rows, new locations section, new enemies/formations, new items |
| `docs/architecture.md` | New screen in the registry table |
| `docs/known-issues.md` | Any deferred work or missing systems for the new act |
| `README.md` | Update "What's playable now" and version number |

---

## Checklist

- [ ] `src/data/story/acts.json` — mark act as `"demo"`
- [ ] `src/data/dialogue/actN.json` — all story scenes written
- [ ] `Game.ts` — new dialogue file imported and merged into `dialogueNodes`
- [ ] `src/data/enemies/encounters.json` — new enemies and formations added
- [ ] `BattleScreen.ts` — `ENEMY_COLORS` and `ENEMY_SIZE` entries for new enemies
- [ ] `src/world/maps.ts` — new dungeon map(s) defined
- [ ] New overworld screen created and registered in `Game.ts`
- [ ] Transition from previous act wired up (flag check → dialogue → new screen)
- [ ] All new flags documented in `docs/gameplay.md`
- [ ] `docs/architecture.md` updated with new screen
- [ ] `README.md` updated
