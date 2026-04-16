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

## What's playable now (Demo v0.1)

The demo covers **Act 1, Chapter 1: Crash Site**. The complete playable sequence:

1. **Title screen** — ENTER to start
2. **Overworld** — navigate left/right between two locations
3. **Crash Site** → **Dialogue** (two-line narration sets the scene)
4. **Crash Site Map** — top-down exploration; walk to the stasis pod to trigger contact
5. **Dialogue** — Kael and Lyra find ARIEL; ARIEL joins the party
6. **Battle** — first encounter with a pack of Shadowbeasts
7. **Victory Dialogue** — party resolves to find a ship
8. Back to **Overworld** (crash site is now cleared)

## Project structure

```
src/
  engine/
    Game.ts           — Game loop, screen registry, GameContext
    InputManager.ts   — Keyboard input (isDown / wasPressed)
    types.ts          — Shared TypeScript interfaces
  screens/
    TitleScreen.ts    — Scrolling star field, press ENTER
    OverworldScreen.ts — Two-location map; manages all crash site flags
    CrashSiteMapScreen.ts — Top-down walkable area; player finds ARIEL
    DialogueScreen.ts — Typewriter dialogue with portraits and choices
    BattleScreen.ts   — Full turn-based combat
    MenuScreen.ts     — Status / Items / Equip tabs; out-of-combat item use
  ui/
    Panel.ts          — drawPanel() — retro sci-fi bordered box
    ProgressBar.ts    — drawProgressBar() — HP/TP bars with colour shift
  data/
    characters/party.json   — Kael, Lyra, ARIEL stats
    enemies/encounters.json — Enemy stats + formation table
    items/items.json        — All items (consumables, weapons, armour)
    dialogue/intro.json     — All dialogue nodes for Act 1 demo
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
