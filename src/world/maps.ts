/**
 * Map definitions for the dungeon exploration system.
 *
 * Each map is defined as a string array where each character represents one tile:
 *   '#' = wall, '.' = floor, ',' = alt floor, 'C' = pillar, 'D' = debris,
 *   'T' = treasure chest, 'O' = objective (mission target), ' ' = void
 *
 * Maps are designed as maze-like areas for exploration, with hidden treasures
 * tucked into dead ends and branching corridors.
 *
 * IMPORTANT: Every row in a layout MUST be exactly 28 characters wide.
 */

import { Tile, type TileId, type TilesetId } from './TileEngine.ts';

// ── Types ───────────────────────────────────────────────────────────────────

export interface TreasureDef {
  /** Grid column */
  col: number;
  /** Grid row */
  row: number;
  /** Item ID to add to inventory */
  itemId: string;
  /** Quantity to give */
  quantity: number;
  /** Flag key — once set, this chest is opened */
  flag: string;
}

export interface MapDef {
  id: string;
  name: string;
  tileset: TilesetId;
  /** String-based layout (parsed into tile grid at runtime) */
  layout: string[];
  /** Player start position (grid coords) */
  playerStart: { col: number; row: number };
  /** Where the objective / exit is (grid coords) */
  objective: { col: number; row: number };
  /** Label shown in the HUD for the objective */
  objectiveLabel: string;
  /** Treasure chests hidden in the map */
  treasures: TreasureDef[];
  /** Formation IDs used for random encounters */
  encounterFormations: string[];
  /** Steps between encounters: [min, max] */
  encounterRate: [number, number];
}

// ── Layout parsing ──────────────────────────────────────────────────────────

const CHAR_TO_TILE: Record<string, TileId> = {
  ' ': Tile.VOID,
  '#': Tile.WALL,
  '.': Tile.FLOOR,
  ',': Tile.FLOOR_ALT,
  'C': Tile.PILLAR,
  'D': Tile.DEBRIS,
  'T': Tile.CHEST,
  'O': Tile.OBJECTIVE,
};

/** Convert a string-based layout to a 2D tile grid. */
export function parseLayout(layout: string[]): TileId[][] {
  return layout.map(row =>
    [...row].map(ch => CHAR_TO_TILE[ch] ?? Tile.VOID)
  );
}

// ── Map definitions ─────────────────────────────────────────────────────────
// All rows are exactly 28 characters wide (verified by dev-time check below).

const CRASH_SITE: MapDef = {
  id: 'crash_site',
  name: 'Crash Site',
  tileset: 'stone',
  layout: [
    '############################',
    '#..........##..............#',
    '#.##.####..##.####.##.###..#',
    '#.##.#.....D..#....##..#...#',
    '#....#.###.##.###.#....##..#',
    '#.##...#.......#..#.##.....#',
    '#.##.###.#####.#.##.##.##..#',
    '#......D.#...#.......#..#..#',
    '#.####.#.#.#.#.####..#.##..#',
    '#.#....#...#...#..#.....#..#',
    '#.#.######.###.#..####..#..#',
    '#.#.......#T#.....#.....#..#',
    '#.########.#.######.###.#..#',
    '#..........#,,,,,,,,..#....#',
    '##.###.###.#,,,,,,,,#.#.##.#',
    '#..#.....#.#,,,,O,,,#....#.#',
    '#.##.###.#.#,,,,,,,,#.##...#',
    '#....#T#.#..,,,,,,,,..#.#..#',
    '#.####.#.##.########.##.#..#',
    '############################',
  ],
  playerStart: { col: 1, row: 1 },
  objective: { col: 16, row: 15 },
  objectiveLabel: 'Find the stasis pod',
  treasures: [
    { col: 11, row: 11, itemId: 'monomate', quantity: 2, flag: 'chest_crash_1' },
    { col: 6,  row: 17, itemId: 'antidote',  quantity: 1, flag: 'chest_crash_2' },
  ],
  encounterFormations: ['pack', 'patrol'],
  encounterRate: [12, 20],
};

const WILDS_CAVE: MapDef = {
  id: 'wilds',
  name: 'Dezolis Wilds',
  tileset: 'ice',
  layout: [
    '############################',
    '#..........................#',
    '#.####.######.####.######..#',
    '#.#..........D.......#..#..#',
    '#.#.##.####.####.###.#..#..#',
    '#.#.#..#T#..#......#..#....#',
    '#...#.##.##.#.####.####.#..#',
    '#.###.......D..#........#..#',
    '#.#...####.###.#.######.#..#',
    '#.#.###......#.#.#....#.#..#',
    '#.#.....####.#.#.#.##.#.#..#',
    '#.#.###.#....#...#..#.##...#',
    '#.#...#.#.######.##.#...#..#',
    '#.###.#.#........#..###.#..#',
    '#.....#.#.########.....#...#',
    '#.#####.#...#....#.####.#..#',
    '#.......###.#.##.#.#T.#.#..#',
    '#.#####.....#.##.#.#..#.#..#',
    '#.#...#.###.#....#..#...#..#',
    '#.#.#.#.#.#.######.##.##...#',
    '#...#...#.#,,,,,,,,,...#...#',
    '#.#######.#,,,,,,,,,,.##...#',
    '######..#.#,,,,O,,,,,.#....#',
    '#.......#.#,,,,,,,,,,..###.#',
    '############################',
  ],
  playerStart: { col: 1, row: 1 },
  objective: { col: 15, row: 22 },
  objectiveLabel: 'Cross the frozen valley',
  treasures: [
    { col: 8,  row: 5,  itemId: 'dimate',       quantity: 1, flag: 'chest_wilds_1' },
    { col: 20, row: 16, itemId: 'star_atomizer', quantity: 1, flag: 'chest_wilds_2' },
  ],
  encounterFormations: ['wilds_crawlers', 'wilds_mixed', 'stalker_ambush'],
  encounterRate: [10, 18],
};

const SPACEPORT: MapDef = {
  id: 'spaceport',
  name: 'Dezolis Spaceport',
  tileset: 'metal',
  layout: [
    '############################',
    '#..........................#',
    '#.######.####.######.####..#',
    '#.#....#.#..#.#....#.#..#..#',
    '#.#.##.#.#..#.#.##.#.#..#..#',
    '#.#..#.#.#D.#.#..#..#.T.#..#',
    '#.##.#...####.##.#.###..#..#',
    '#....#.#........#.#....##..#',
    '#.####.#.######.#.#.##.....#',
    '#.#......#....#.#.#.#..#...#',
    '#.#.######.##.#.#.#.#..#...#',
    '#.#........##.#...#.#.##...#',
    '#.########....#.###.#......#',
    '#..........####.#...#.###..#',
    '#.####.###......#.###..D...#',
    '#.#..#.#.#.######....###...#',
    '#.#..#.#.#.#....#.###.#....#',
    '#.##.#...#.#.##.#.#T#.#.#..#',
    '#....###.#.#.##.#.#.#.#.#..#',
    '#.##.....#.#....#...#.#.#..#',
    '#..#.#####.######.###.#.#..#',
    '#.##.......#,,,,,,,,.#.#...#',
    '#....#####.#,,,,,,,,.###...#',
    '#.########.#,,,,O,,,...#...#',
    '#..........#,,,,,,,,.####..#',
    '#.####.###.#,,,,,,,,.#.....#',
    '#......#.#..,,,,,,,,.......#',
    '############################',
  ],
  playerStart: { col: 1, row: 1 },
  objective: { col: 16, row: 23 },
  objectiveLabel: 'Reach the hangar bay',
  treasures: [
    { col: 22, row: 5,  itemId: 'moon_atomizer', quantity: 1, flag: 'chest_port_1' },
    { col: 19, row: 17, itemId: 'trimate',       quantity: 1, flag: 'chest_port_2' },
  ],
  encounterFormations: ['stalker_ambush', 'wilds_mixed'],
  encounterRate: [8, 15],
};

// ── Exports ─────────────────────────────────────────────────────────────────

export const ALL_MAPS: Record<string, MapDef> = {
  crash_site: CRASH_SITE,
  wilds:      WILDS_CAVE,
  spaceport:  SPACEPORT,
};

// ── Dev-time layout validation ──────────────────────────────────────────────
// Runs once at import time; logs errors if a row has the wrong width.
for (const map of Object.values(ALL_MAPS)) {
  const expectedWidth = map.layout[0]!.length;
  for (let r = 0; r < map.layout.length; r++) {
    if (map.layout[r]!.length !== expectedWidth) {
      console.error(
        `Map "${map.id}" row ${r}: expected width ${expectedWidth}, got ${map.layout[r]!.length}`
      );
    }
  }
}
