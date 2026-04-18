# Gameplay Reference

Complete reference for all implemented game systems, content, and controls. Updated with every change.

---

## Demo flow and game flags

The demo follows a linear sequence gated by flags in `gctx.flags`:

| Flag | Set when | Effect |
|---|---|---|
| `intro_seen` | Narration dialogue completes on first crash site visit | Skips narration on re-entry; goes straight to map |
| `ariel_found` | Player interacts with the stasis pod on the map | Skips map on re-entry; goes straight to battle |
| `crash_cleared` | Crash site battle victory dialogue completes | Crash site shows cleared state; unlocks Dezolis Wilds |
| `wilds_entered` | First wilds approach dialogue completes | Skips approach dialogue on re-entry |
| `wilds_cleared` | Wilds battle victory dialogue completes | Wilds shows cleared state; unlocks Spaceport |
| `spaceport_entered` | First spaceport arrival dialogue completes | Skips arrival dialogue on re-entry |
| `spaceport_cleared` | Spaceport boss victory dialogue completes | Spaceport shows cleared state; Act 1 complete |
| `chest_crash_1` | Collect treasure chest in crash site | Chest renders as opened (2× Monomate) |
| `chest_crash_2` | Collect treasure chest in crash site | Chest renders as opened (1× Antidote) |
| `chest_wilds_1` | Collect treasure chest in wilds | Chest renders as opened (1× Dimate) |
| `chest_wilds_2` | Collect treasure chest in wilds | Chest renders as opened (1× Star Atomizer) |
| `chest_port_1` | Collect treasure chest in spaceport | Chest renders as opened (1× Moon Atomizer) |
| `chest_port_2` | Collect treasure chest in spaceport | Chest renders as opened (1× Trimate) |

### Full sequence (no flags set)

```
Title → Overworld (4 locations)
  → [interact Crash Site]
    → Dialogue (scene_start → end)          sets intro_seen
    → DungeonScreen (crash_site map)
      → [random encounters with pack/patrol formations while exploring]
      → [hidden treasures: 2× Monomate, 1× Antidote]
      → [reach objective]
        → Dialogue (kael_lyra_01 → ariel_awakens → battle_trigger → end)
          sets ariel_found, triggers battle
        → BattleScreen (formation: pack)
          → Victory → Dialogue (post_battle_01 → crash_site_resolved → end)
            sets crash_cleared, full HP/TP restore
            → Overworld
          → Defeat → Overworld

  → [interact Dezolis Wilds] (requires crash_cleared)
    → Dialogue (wilds_approach → end)       sets wilds_entered
    → DungeonScreen (wilds map)
      → [random encounters with wilds_crawlers/wilds_mixed/stalker_ambush]
      → [hidden treasures: 1× Dimate, 1× Star Atomizer]
      → [reach objective]
        → Dialogue (wilds_battle_trigger → end)
        → BattleScreen (formation: wilds_crawlers or wilds_mixed)
          → Victory → +2 Monomate reward, full HP/TP restore
            → Dialogue (wilds_cleared → end)    sets wilds_cleared
            → Overworld
          → Defeat → Overworld

  → [interact Dezolis Spaceport] (requires wilds_cleared)
    → Dialogue (spaceport_arrival → end)    sets spaceport_entered
    → DungeonScreen (spaceport map)
      → [random encounters with stalker_ambush/wilds_mixed]
      → [hidden treasures: 1× Moon Atomizer, 1× Trimate]
      → [reach objective]
        → Dialogue (spaceport_boss_trigger → end)
        → BattleScreen (formation: warden, boss=true)
          → Victory → Dialogue (spaceport_victory → act1_finale → end)
            sets spaceport_cleared
            → Overworld
          → Defeat → Overworld
```

### Re-entry states

- `intro_seen=true, ariel_found=false` → re-enter DungeonScreen (crash_site map, no narration)
- `ariel_found=true, crash_cleared=false` → skip dungeon, go straight to BattleScreen
- `crash_cleared=true` → crash site shows "The wreckage is quiet now."
- `wilds_entered=true, wilds_cleared=false` → re-enter DungeonScreen (wilds map, no approach dialogue)
- `wilds_cleared=true` → wilds shows "The path through the wilds is clear."
- `spaceport_entered=true, spaceport_cleared=false` → re-enter DungeonScreen (spaceport map, no arrival dialogue)
- `spaceport_cleared=true` → spaceport shows "The ship is ready. Act 2 awaits..."

---

## Controls (all screens)

| Key | Action |
|---|---|
| Arrow keys | Navigate / move |
| WASD | Move (map screens only) |
| ENTER / SPACE | Confirm / interact / advance dialogue |
| Z | Confirm (dialogue only) |
| M / ESCAPE | Open menu (overworld); close menu |
| X | Cancel / back (menu sub-screens) |

---

## Title Screen

Scrolling star field with the Bane shadow in the upper-left and a Dezolis planet silhouette in the lower-right. Press ENTER or SPACE to go to the Overworld.

---

## Overworld Screen

Four locations on a dark landscape (left to right):

| Location | Unlock condition | Visual |
|---|---|---|
| **Crestfall Village** | Always available | Buildings with warm window lights |
| **Crash Site** | Always available | Tilted ship hull with amber light |
| **Dezolis Wilds** | `crash_cleared` flag | Frozen dead trees with ice patches |
| **Dezolis Spaceport** | `wilds_cleared` flag | Control tower, hangar, antenna dish |

- **◄►** to move the cursor between locations
- **ENTER/SPACE** to interact
- **M/ESCAPE** to open the menu

Locked locations display `[X]` after their name and show a message explaining the prerequisite. Cleared locations display `*` and show a completion message. Party HP mini-bars are shown bottom-right.

---

## Dungeon Screen (`DungeonScreen.ts`)

Tile-based top-down exploration with scrolling camera, random encounters, and hidden treasure chests. Replaces the old `CrashSiteMapScreen` for all three Act 1 areas.

### Grid and viewport

- **Tile size**: 32×32 pixels
- **Viewport**: 20×15 tiles (640×480 canvas)
- **Camera**: follows the player, clamped to map bounds so edges don't show void
- Maps are defined in `src/world/maps.ts` as string arrays; each character maps to a tile type

### Player movement

- Grid-based: one tile per keypress (arrow keys or WASD)
- Movement between tiles interpolates over ~0.15 seconds (smooth glide)
- No diagonal movement (one axis at a time)
- Solid tiles (walls, pillars, void) block movement

### Random encounters

- A step counter decrements on each tile move
- When it reaches 0, a random formation is picked from the map's encounter list and a battle begins
- After battle victory, the player returns to the dungeon at the same position
- After battle defeat, `onDefeat()` is called (returns to overworld)
- Step counter resets to a random value in the map's `[min, max]` encounter rate range

### Treasure chests

- Chests are visible on the map as glowing tiles (tile type `T`)
- Stepping onto an uncollected chest opens it, adds the item to inventory, sets a flag in `gctx.flags`, and shows a notification
- Already-collected chests render as opened (dark interior)
- Treasure does not trigger an encounter step

### Objective

- Each map has a single objective tile (type `O`, rendered with a pulsing blue ring)
- Stepping onto the objective calls `onComplete()`, which triggers the area's story sequence

### HUD

- **Top panel**: location name + objective label
- **Bottom-left**: party HP bars
- **Bottom-right**: controls hint
- **Centre**: notification popup for treasure collection (3-second fade)

### Menu access

Pressing **M** or **ESCAPE** opens the menu. The dungeon passes its current state (map ID, position, callbacks) so the menu can reconstruct the exact dungeon state on return.

### Legacy: CrashSiteMapScreen

`CrashSiteMapScreen.ts` still exists but is no longer used in the main game flow. It was a fixed-size pixel-movement exploration screen. The dungeon system replaces it with grid-based scrolling maps for all three areas.

---

## Dialogue Screen (`DialogueScreen.ts`)

### Rendering

- Starfield background with a crash site silhouette
- Character portrait box (64×64, coloured by character): Kael `#c84`, Lyra `#68c`, ARIEL `#4ca`, Shadowwarden `#a22`
- Dialogue box: bottom 160px of canvas
- Narration lines (no speaker): text in `#9bf`; "title" emotion: centred gold `#fd2`

### Typewriter

Characters reveal at 1 per `0.028 s`. Press ENTER/SPACE/Z to skip to end of current line. Press again to advance.

### Node format (`src/data/dialogue/intro.json`)

```json
{
  "id": "node_id",
  "lines": [
    { "speaker": "Name", "text": "...", "portrait": "name_key", "emotion": "neutral" }
  ],
  "next": "next_node_id",     // OR
  "choices": [
    { "text": "Option", "next": "target_id" }
  ]
}
```

`"next": "end"` or a node with empty `lines` triggers `onComplete()`. Navigation terminates at the `"end"` node (empty lines array).

### Dialogue nodes (Act 1 demo)

| Node | Speaker(s) | Triggers |
|---|---|---|
| `scene_start` | Narration | Opening lore. `next: "end"` → calls `onComplete` |
| `kael_lyra_01` | Lyra, Kael | Discover the pod. `next: "ariel_awakens"` |
| `ariel_awakens` | ARIEL, Kael, Lyra | ARIEL wakes. `next: "battle_trigger"` |
| `battle_trigger` | Kael | Shadowbeasts spotted. Choice: "ENGAGE!" → `"end"` |
| `post_battle_01` | Kael, ARIEL, Lyra | Post-fight. `next: "crash_site_resolved"` |
| `crash_site_resolved` | Narration | Hints at Dezolis Wilds; `next: "end"` |
| `wilds_approach` | Kael, ARIEL, Lyra | Enter the Dezolis Wilds. `next: "end"` |
| `wilds_battle_trigger` | ARIEL, Kael | Enemies emerge from permafrost. Choice: "Fight through!" → `"end"` |
| `wilds_cleared` | Lyra, ARIEL, Kael | Wilds battle won; spaceport sighted. `next: "end"` |
| `spaceport_arrival` | ARIEL, Kael, Lyra | Explore the abandoned spaceport. `next: "end"` |
| `spaceport_boss_trigger` | Narration, Shadowwarden, Lyra, Kael | Shadowwarden appears. Choice: "Stand your ground!" → `"end"` |
| `spaceport_victory` | Narration, Lyra, ARIEL, Kael | Boss defeated; Landale ship found. `next: "act1_finale"` |
| `act1_finale` | Narration | Party leaves Dezolis; the Bane watches. `next: "end"` |
| `end` | — | Empty lines; always calls `onComplete` immediately |

---

## Battle Screen (`BattleScreen.ts`)

### States

```
BATTLE_INTRO  → (ENTER/SPACE) → NEXT_TURN
NEXT_TURN     → PLAYER_MENU | ENEMY_TURN
PLAYER_MENU   → PLAYER_TECH | PLAYER_ITEM | PLAYER_TARGET_ENEMY | EXECUTING
PLAYER_TECH   → PLAYER_TARGET_ENEMY | PLAYER_TARGET_ALLY | EXECUTING
PLAYER_ITEM   → PLAYER_TARGET_ALLY | PLAYER_TARGET_ENEMY | EXECUTING
PLAYER_TARGET_ENEMY → EXECUTING
PLAYER_TARGET_ALLY  → EXECUTING
EXECUTING     → NEXT_TURN  (after stateTimer reaches threshold)
ENEMY_TURN    → NEXT_TURN  (after stateTimer reaches threshold)
VICTORY       → (stateTimer) → onVictory()
DEFEAT        → (stateTimer) → onDefeat()
```

### Turn order

`buildTurnQueue()` collects all living party members and non-defeated enemies, sorts by `speed` descending, stores in `turnQueue`. Queue is rebuilt each time it empties (new round).

### Player actions

| Menu item | Effect |
|---|---|
| ATTACK | Physical damage to one enemy: `max(1, round(max(1, atk - floor(def/2)) × rand(0.85–1.15)))` |
| TECHNIQUE | Opens tech submenu; targets enemy (damage) or ally (RES heal) |
| ITEM | Opens item submenu (only consumables with remaining quantity) |
| DEFEND | Sets `defendFlags[i] = true`; halves incoming physical damage this round |

### Techniques

| ID | TP cost | Effect |
|---|---|---|
| FOI | 4 | Fire damage: `max(1, round(25 + atk/3))` × 1.5 if target weak to FOI |
| RES | 5 | Restore 40 HP to one ally |
| RAY | 3 | Ray damage: `max(1, round(20 + atk/2))` × 1.5 if target weak to RAY |
| DARK_BOLT | — | Enemy-only; 22 damage to entire party (no weakness modifier) |

### Enemy AI

Each enemy picks a random action each turn:
- 30% chance: use a technique from `template.techniques` (if any)
- 70% (or if no techniques): physical attack on a random living party member

### Victory / Defeat

- **Victory**: all enemies `defeated === true`. Displays EXP and Meseta totals (not yet applied to characters — see [known-issues.md](known-issues.md)). After `stateTimer ≥ 2.5 s`, calls `onVictory()`.
- **Defeat**: all party `hp <= 0`. After `stateTimer ≥ 2.0 s`, calls `onDefeat()`.

### Visual conventions

- Enemy colours defined in `ENEMY_COLORS`: body, eye (hex), glow (pre-built `rgba(...)` string — must be valid CSS)
- Enemy sizes in `ENEMY_SIZE` (w × h in px)
- Float damage numbers fade over ~1 s
- Message log: last 4 messages shown, bottom panel

---

## Menu Screen (`MenuScreen.ts`)

Opened from any non-battle screen with **M** or **ESCAPE**. Closed with **M**, **ESCAPE**, or **X**.

### Tabs

**STATUS** — Three-column character cards. Each card: portrait, name, class, level, HP bar, TP bar, ATK/DEF/SPD/LCK stats, techniques list. KO'd members show `[KO]` in red.

**ITEMS** — Lists all consumable inventory slots. Select with ↑↓, press ENTER/SPACE to use.

Item use flow:
1. Press ENTER on an item → game checks for a valid target
2. If found: enter `target` sub-state, show right-side overlay panel
3. ↑↓ to cycle valid targets only; ENTER to confirm; X to cancel
4. Confirmation calls `applyItem()`, decrement quantity (remove slot if 0)

Target validity:
- `heal_hp` items: target must be alive (`hp > 0`) and not at full HP
- `cure_status` items with `value > 0` (Moon Atomizer): target must be KO'd (`hp <= 0`); revives at `floor(maxHp × value / 100)` HP
- Items with no valid target show "Can't use that now." for 2 s

**EQUIP** — Shows current equipment slots (weapon/armor/shield/accessory) for selected party member. Read-only (equipment changes not yet implemented).

---

## Characters (party.json)

| Name | Class | HP | TP | ATK | DEF | SPD | LCK | Techniques |
|---|---|---|---|---|---|---|---|---|
| Kael | Hunter | 45 | 15 | 18 | 10 | 9 | 8 | FOI |
| Lyra | Esper | 35 | 30 | 11 | 7 | 11 | 12 | FOI, RES |
| ARIEL | CAST | 50 | 25 | 14 | 14 | 8 | 6 | RAY |

ARIEL is a pre-Collapse CAST android found in the stasis pod. All three start at Level 1.

---

## Enemies (encounters.json)

| Name | HP | ATK | DEF | SPD | EXP | Meseta | Techniques | Weak to |
|---|---|---|---|---|---|---|---|---|
| Shadowpup | 18 | 8 | 4 | 12 | 12 | 5 | — | FOI |
| Shadowhound | 35 | 13 | 7 | 8 | 28 | 14 | — | FOI |
| Shadowwarden | 80 | 18 | 10 | 6 | 120 | 60 | DARK_BOLT | RAY |
| Ice Crawler | 28 | 11 | 8 | 7 | 22 | 10 | — | FOI |
| Void Stalker | 40 | 15 | 6 | 14 | 35 | 18 | DARK_BOLT | RAY |

### Formations

| ID | Enemies | Boss? | Used in |
|---|---|---|---|
| `pack` | 3× Shadowpup | No | Crash Site zone battle + random encounters |
| `patrol` | 1× Shadowhound + 1× Shadowpup | No | Crash Site random encounters |
| `warden` | 1× Shadowwarden | Yes | Spaceport boss fight |
| `wilds_crawlers` | 2× Ice Crawler | No | Wilds zone battle + random encounters |
| `wilds_mixed` | 1× Ice Crawler + 1× Shadowhound | No | Wilds zone battle + Spaceport random encounters |
| `stalker_ambush` | 2× Void Stalker | No | Wilds + Spaceport random encounters |

---

## Items (items.json)

| ID | Name | Type | Effect | Price |
|---|---|---|---|---|
| `monomate` | Monomate | consumable | heal_hp 50, single | 50 |
| `dimate` | Dimate | consumable | heal_hp 120, single | 120 |
| `trimate` | Trimate | consumable | heal_hp 999, single | 350 |
| `moon_atomizer` | Moon Atomizer | consumable | cure_status 30%, single (revive) | 300 |
| `antidote` | Antidote | consumable | cure_status 0 (poison cure) | 30 |
| `star_atomizer` | Star Atomizer | consumable | heal_hp 30, party | 500 |
| `telepipe` | Telepipe | consumable | (not yet functional) | 200 |
| `photon_blade` | Photon Blade | weapon | ATK +8 | 500 |
| `force_staff` | Force Staff | weapon | ATK +4 | 350 |
| `photon_arm` | Photon Arm | weapon | ATK +6 | 450 |
| `leather_vest` | Leather Vest | armor | DEF +5 | 200 |
| `cast_frame` | CAST Frame | armor | DEF +7 | 400 |
| `barrier_shield` | Barrier Shield | shield | DEF +4 | 250 |

### Starting inventory

```
Monomate       × 5
Dimate         × 2
Moon Atomizer  × 1
```

### In-game rewards

**Zone battle rewards:**
- Crash Site victory: full HP/TP restore
- Wilds victory: full HP/TP restore + 2 Monomate
- Spaceport victory: (final battle — no restore needed)

**Dungeon treasure chests:**
- Crash Site: 2× Monomate, 1× Antidote
- Dezolis Wilds: 1× Dimate, 1× Star Atomizer
- Dezolis Spaceport: 1× Moon Atomizer, 1× Trimate

---

## Story context (acts.json)

| Act | Title | Status |
|---|---|---|
| Act 1 | Echoes of the Fallen Star | **Demo implemented** |
| Act 2 | The Void Between Worlds | Planned |
| Act 3 | Light of the Archive | Planned |

**Act 1 premise:** On dying planet Dezolis, year 1157 Post-Collapse, hunters Kael and Lyra discover a crashed starship. Inside: a CAST android named ARIEL, dormant for 412 years. ARIEL carries coordinates to the Stellar Archive — pre-Collapse data that contains a weapon capable of destroying the Bane, the cosmic darkness devouring the stars. After fighting off Shadowbeasts at the crash site, the party crosses the dangerous Dezolis Wilds, battles through hostile creatures emerging from the permafrost, and reaches the abandoned Dezolis Spaceport. There they confront a Shadowwarden — a general of the Bane's host — guarding the facility. After defeating it, ARIEL discovers a pre-Collapse Landale-class courier ship and brings it online. The party departs Dezolis for Motavia and the Stellar Archive.
