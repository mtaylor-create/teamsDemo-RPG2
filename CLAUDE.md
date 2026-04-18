# Starfall Chronicles — A Phantasy Star-Inspired RPG

## Project Vision
A story-driven, turn-based RPG inspired by the classic Phantasy Star series. Blends science fiction and fantasy in a multi-world setting with memorable characters, deep combat, and an epic narrative about heroes standing against a cosmic evil.

## Tech Stack
- **Engine**: Browser-based (HTML5 Canvas / TypeScript)
- **Language**: TypeScript
- **Build**: Vite
- **Testing**: Vitest
- **Data format**: JSON for game data (dialogue, quests, enemies, items)

## Project Structure
```
src/
  engine/       — Core game loop, rendering, input, GameContext, shared types
  ui/           — Shared drawing helpers (drawPanel, drawProgressBar)
  screens/      — All game screens (title, overworld, dungeon, dialogue, battle, menu)
  world/        — Tile engine, tileset palettes, map definitions
  data/         — Game data as typed JSON
    characters/ — Party member definitions (party.json)
    enemies/    — Enemy stats, formations, encounter tables (encounters.json)
    items/      — All item definitions (items.json)
    dialogue/   — Dialogue trees (intro.json; add actN.json for new acts)
    story/      — Act structure and story arc data (acts.json)
assets/         — Placeholder for future sprites and audio (currently empty)
docs/
  story/        — Story bible and lore documents
  architecture.md       — Engine internals, screen registry, conventions
  gameplay.md           — Full game systems, controls, formulas, content reference
  known-issues.md       — Deferred bugs and missing systems
  adding-a-chapter.md   — Guide for extending the game with new acts
```

## Agent Team

This project uses an agent team with four specialized roles:

| Agent | Role | Focus |
|-------|------|-------|
| `ux-designer` | UX/UI Designer | Game interface, menus, screens, input, player experience |
| `story-writer` | Narrative Designer | World, characters, dialogue, quests, story progression |
| `qa-tester` | QA Engineer | Bug hunting, test automation, edge cases, stability |
| `player-sim` | Player Simulator | Simulates player archetypes, provides realistic feedback |

### Coordination Model
- **UX + Story**: Collaborate on dialogue presentation, cutscene flow, and menu needs for quest/story systems
- **UX + Player Sim**: Player sim feedback drives UX improvements
- **Story + QA**: QA verifies quest triggers, dialogue flags, and story state correctness
- **QA + Player Sim**: Player sim discovers bugs during simulated playthroughs; QA formalizes them
- **All agents**: Refer to this CLAUDE.md and the story bible for shared context

## Key Design Decisions
- Turn-based combat (no action/real-time)
- First-person dungeon view for dungeons, top-down for overworld/towns
- 4-member active party
- "Techniques" instead of "magic" (Phantasy Star tradition)
- Sci-fi/fantasy hybrid setting across multiple planets
- Structured JSON data files for all game content (not hardcoded)

## Conventions
- All game data in `src/data/` as typed JSON with TypeScript interfaces
- UI components are modular and reusable
- Every system should have corresponding tests in `src/tests/`
- Use descriptive names: `calculatePhysicalDamage()` not `calcDmg()`
- Document complex formulas and game mechanics inline

## Documentation

The `docs/` folder contains the living reference for this project. Every agent **must** keep it current — stale docs are treated as a bug.

### Files

| File | Update when |
|---|---|
| `docs/architecture.md` | Engine internals change: new screen added to registry, GameContext fields added/removed, InputManager behaviour changes, new UI primitive, conventions change |
| `docs/gameplay.md` | Any change to: game flow or flag logic, screen controls, dialogue nodes, battle states/formulas, character/enemy/item data, starting inventory |
| `docs/known-issues.md` | A known bug is fixed (remove or mark resolved); a new confirmed bug is deferred; a missing system is implemented |
| `docs/story/story-bible.md` | New characters introduced, lore expanded, act outlines revised, tone guidance updated |
| `docs/adding-a-chapter.md` | Engine patterns change that affect the chapter-addition workflow |
| `README.md` | New commands, new demo content, project structure changes, new docs added |

### Rule

After completing any task that changes game behaviour, data, or engine structure, update the relevant doc(s) in the same work unit — not as a follow-up. A PR or changeset that touches code without updating affected docs is incomplete.

When a doc entry conflicts with the current code, **trust the code** and correct the doc.
