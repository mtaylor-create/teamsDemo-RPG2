# Known Issues and Open Work

Bugs confirmed by QA audit and deferred, plus missing systems needed for future development. Update this file when issues are fixed or new ones are found.

---

## Deferred bugs

These were identified during QA review and are known-but-deferred. They do not block the demo but should be fixed before expanding the system they affect.

### Bug 8 — Moon Atomizer cannot revive in battle
**Severity:** Medium  
**System:** BattleScreen / PLAYER_ITEM flow  
**Steps:** Enter battle with a KO'd party member. Select ITEM → Moon Atomizer. No valid target is offered (the item targeting loop skips KO'd members).  
**Root cause:** `updateTargetAlly` filters out KO'd members for all items. Moon Atomizer (`cure_status` with `value > 0`) should target only KO'd members, mirroring the out-of-combat logic in MenuScreen.  
**Fix needed:** In `updateTargetAlly`, branch on `item.effect.type` and `item.effect.value` to allow KO'd targets for revival items.

### Bug 9 — EXP and Meseta are displayed but never applied
**Severity:** Low (no progression system yet)  
**System:** BattleScreen VICTORY state  
**Steps:** Win any battle. Victory screen shows EXP and Meseta totals. Party level and any hypothetical wallet remain unchanged.  
**Root cause:** `victoryExp` and `victoryMeseta` are computed and rendered but never written back to `gctx.party` or a wallet field on `GameContext`.  
**Fix needed:** Implement an EXP/level-up system and a Meseta balance on `GameContext`, then apply values in the VICTORY state.

### Bug 11 — Opening menu during battle then closing returns to a fresh empty battle
**Severity:** Medium (latent — menu is not currently accessible from battle)  
**System:** Game.switchScreen / MenuScreen  
**Steps:** If a menu trigger were added to BattleScreen, closing the menu would call `switchScreen(prevScreenName)` which is `'battle'`. This creates a **new** `BattleScreen` with no enemy templates — instant victory or crash.  
**Root cause:** `prevScreenName` stores the string `'battle'` but the `data` payload (enemy templates, callbacks) is not persisted.  
**Fix needed:** Either prevent menu from being opened during battle, or store the current screen instance and restore it instead of reconstructing from name alone.

### Bug 14 — `stateTimer` direction inconsistency
**Severity:** Low (cosmetic / maintainability)  
**System:** BattleScreen  
**Details:** All other timers in the codebase (e.g., `notifTimer`, `useNoticeTimer`, `stateTimer` for transitions in OverworldScreen) count **down** to zero. `stateTimer` in BattleScreen counts **up** from zero and fires when it exceeds a threshold. This is confusing to read and inconsistent.  
**Fix needed:** Invert the pattern — set `stateTimer` to a positive value at state entry, subtract `dt` each frame, fire when `<= 0`.

---

## Missing systems

These are not bugs — they are features not yet built. Required before Act 2.

### Save / load
`SaveData` interface exists in `types.ts` but is not wired up. `GameContext` state resets on every page refresh. Needed: serialize `party`, `inventory`, `flags`, and current location to `localStorage`; provide save/load UI in MenuScreen.

### EXP and levelling
Characters have a `level` field but there is no level-up formula, stat growth table, or XP-to-next-level curve. Required before EXP can be applied at battle end (Bug 9).

### Equipment management
The EQUIP tab in MenuScreen is read-only. Selecting different equipment and applying stat changes is not implemented. `Item.stats` fields exist but are not applied to `Character` stats.

### Shop / economy
Meseta is tracked on enemies but there is no wallet on `GameContext` and no shop screen. Needed for Dezolis Spaceport in Act 2.

### Poison / status effects
`antidote` item exists, `cure_status` effect type exists, but no status effect can currently be applied to party members. No poison or other status is inflicted by any current enemy.

### Sound and music
`src/audio/` directory is a placeholder. No audio manager, no sound effects, no music.

### Sprite assets
All enemies and characters are drawn procedurally with canvas primitives. `Enemy.sprite` and `Character.portrait` fields reference asset keys that have no corresponding files yet.

### Map scrolling / multi-room areas
`CrashSiteMapScreen` is a single fixed 640×480 screen. Act 2 locations will need a scrolling or room-transition system.

---

## Low-priority polish

- `stateTimer` direction (Bug 14 above)
- DialogueScreen background is a static silhouette; it does not update to show the current location's actual visual
- OverworldScreen has only two locations; adding more requires expanding the `LOCATIONS` array and adjusting path rendering
- BattleScreen enemy positions are computed by index; a formation layout system would improve readability for larger or mixed groups
