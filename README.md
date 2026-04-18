# Starfall Chronicles

A story-driven, turn-based RPG inspired by the classic Phantasy Star series. Blends science fiction and fantasy across multiple worlds. Built with TypeScript, HTML5 Canvas, and Vite — no external game engine or UI framework.

## Running the game

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build
npm run test      # run Vitest suite
npm run test:run  # run once (CI mode)
```

Open the URL in a browser. The game renders on a single `640×480` canvas element.

## What's playable now (Demo v0.3)

The demo covers **Act 1: Echoes of the Fallen Star** — from discovering ARIEL at the crash site to departing Dezolis aboard a pre-Collapse ship. All three areas feature tile-based dungeon exploration with scrolling maps, random encounters, and hidden treasure chests.

1. **Title screen** — ENTER to start
2. **Overworld** — navigate left/right between four locations
3. **Crash Site** → **Dialogue** (narration sets the scene)
4. **Dungeon** — tile-based maze exploration (stone tileset); random encounters with Shadowpups; hidden treasures
5. **Reach objective** → **Dialogue** — Kael and Lyra find ARIEL; ARIEL joins the party
6. **Battle** — first encounter with a pack of Shadowpups
7. **Victory Dialogue** — party resolves to find a ship
8. **Dezolis Wilds** (unlocked) → **Dialogue** → **Dungeon** (ice tileset); random encounters with Ice Crawlers, Shadowhounds, Void Stalkers; hidden treasures
9. **Reach objective** → **Battle** with Ice Crawlers / Shadowhounds
10. **Victory Dialogue** — party spots the spaceport
11. **Dezolis Spaceport** (unlocked) → **Dialogue** → **Dungeon** (metal tileset); random encounters; hidden treasures
12. **Reach objective** → **Boss Battle** with the Shadowwarden
13. **Victory Dialogue** — ARIEL finds a Landale-class ship; party departs Dezolis
14. **Act 1 Finale** — narration: "To be continued in Act 2"

## Project structure

```
src/
  engine/
    Game.ts           — Game loop, screen registry, GameContext
    InputManager.ts   — Keyboard input (isDown / wasPressed)
    types.ts          — Shared TypeScript interfaces
  screens/
    TitleScreen.ts    — Scrolling star field, press ENTER
    OverworldScreen.ts — Four-location map; manages all game progression flags
    DungeonScreen.ts  — Tile-based dungeon exploration with scrolling, encounters, treasures
    CrashSiteMapScreen.ts — (Legacy) top-down pixel-movement area
    DialogueScreen.ts — Typewriter dialogue with portraits and choices
    BattleScreen.ts   — Full turn-based combat
    MenuScreen.ts     — Status / Items / Equip tabs; out-of-combat item use
  world/
    TileEngine.ts     — Tile definitions, tileset palettes, procedural tile rendering
    maps.ts           — Map layouts for crash site, wilds, spaceport (28×20–28 grids)
  ui/
    Panel.ts          — drawPanel() — retro sci-fi bordered box
    ProgressBar.ts    — drawProgressBar() — HP/TP bars with colour shift
  data/
    characters/party.json   — Kael, Lyra, ARIEL stats
    enemies/encounters.json — Enemy stats + formation table (5 enemies, 6 formations)
    items/items.json        — All items (consumables, weapons, armour, 13 total)
    dialogue/intro.json     — All dialogue nodes for Act 1 (14 nodes incl. wilds + spaceport)
    story/acts.json         — Act structure (act1 demo, act2/3 planned)
  main.ts             — Entry point; creates Game, calls start()
assets/               — (empty) placeholder for future sprites/audio
docs/
  architecture.md     — Engine internals, patterns, conventions
  gameplay.md         — All systems, controls, formulas, content reference
  known-issues.md     — Deferred bugs and missing systems
.claude/
  agents/             — Specialist agent definitions (ux, story, qa, player-sim)
CLAUDE.md             — Project conventions and agent team guide
```

## Agent team

Four specialist agents assist with development. See [CLAUDE.md](CLAUDE.md) for the coordination model and [docs/architecture.md](docs/architecture.md) for technical context each agent needs.

| Agent | Primary focus |
|---|---|
| `ux-designer` | Screens, menus, input flow, visual layout |
| `story-writer` | Dialogue, world lore, quest design |
| `qa-tester` | Bug hunting, edge cases, test suites |
| `player-sim` | Simulates player archetypes, usability feedback |

## Documentation

| Doc | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Engine internals, screen registry, InputManager, GameContext, UI primitives |
| [docs/gameplay.md](docs/gameplay.md) | Full game flow, all systems and controls, characters, items, formulas |
| [docs/known-issues.md](docs/known-issues.md) | Open bugs, deferred work, missing systems |

**Keep docs current.** Any change to a system's behaviour, controls, data shape, or game flow must be reflected in the relevant doc before the work is considered complete. See [CLAUDE.md](CLAUDE.md) for the documentation maintenance rule.
