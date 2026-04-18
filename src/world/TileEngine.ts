/**
 * TileEngine — tile definitions, tileset palettes, and procedural tile rendering.
 *
 * Each tile is 32×32 pixels. The visible viewport is 20×15 tiles (640×480).
 * Tiles are drawn procedurally with canvas primitives to emulate the look of
 * classic 16-bit JRPG tilesets (Phantasy Star IV era).
 */

// ── Constants ───────────────────────────────────────────────────────────────

export const TILE_SIZE = 32;
export const VIEW_COLS = 20; // 640 / 32
export const VIEW_ROWS = 15; // 480 / 32

// ── Tile types ──────────────────────────────────────────────────────────────

export const Tile = {
  VOID:      0,
  FLOOR:     1,
  WALL:      2,
  FLOOR_ALT: 3,
  PILLAR:    4,
  DEBRIS:    5,
  CHEST:     6,
  OBJECTIVE: 7,
} as const;

export type TileId = (typeof Tile)[keyof typeof Tile];

// ── Tileset palettes ────────────────────────────────────────────────────────

export type TilesetId = 'stone' | 'ice' | 'metal';

interface TilePalette {
  floorBase: string;
  floorGrid: string;
  floorAlt: string;
  floorAltGrid: string;
  wallFace: string;
  wallTop: string;
  wallMortar: string;
  wallHighlight: string;
  wallShadow: string;
  pillarBody: string;
  pillarCap: string;
  pillarShadow: string;
  debrisMain: string;
  debrisLight: string;
  chestBody: string;
  chestLid: string;
  chestLatch: string;
  voidColor: string;
}

const PALETTES: Record<TilesetId, TilePalette> = {
  stone: {
    floorBase:     '#2a2a3a',
    floorGrid:     '#22223a',
    floorAlt:      '#2e2840',
    floorAltGrid:  '#262240',
    wallFace:      '#4a3a30',
    wallTop:       '#5a4a3e',
    wallMortar:    '#322820',
    wallHighlight: '#6a5a48',
    wallShadow:    '#281e18',
    pillarBody:    '#48404a',
    pillarCap:     '#5a5260',
    pillarShadow:  '#1a1820',
    debrisMain:    '#3a3040',
    debrisLight:   '#4a4050',
    chestBody:     '#6a5030',
    chestLid:      '#7a6038',
    chestLatch:    '#d4a840',
    voidColor:     '#08080c',
  },
  ice: {
    floorBase:     '#1e2a3a',
    floorGrid:     '#182438',
    floorAlt:      '#223040',
    floorAltGrid:  '#1c2a3e',
    wallFace:      '#3a5068',
    wallTop:       '#4a6078',
    wallMortar:    '#283848',
    wallHighlight: '#5a7a98',
    wallShadow:    '#1a2838',
    pillarBody:    '#3a4858',
    pillarCap:     '#4a5a6a',
    pillarShadow:  '#101820',
    debrisMain:    '#2a3848',
    debrisLight:   '#3a4a5a',
    chestBody:     '#4a6070',
    chestLid:      '#5a7080',
    chestLatch:    '#80d0f0',
    voidColor:     '#060a10',
  },
  metal: {
    floorBase:     '#222830',
    floorGrid:     '#1c222a',
    floorAlt:      '#282e38',
    floorAltGrid:  '#222830',
    wallFace:      '#3a4250',
    wallTop:       '#4a5260',
    wallMortar:    '#282e38',
    wallHighlight: '#5a6878',
    wallShadow:    '#181e28',
    pillarBody:    '#3a4048',
    pillarCap:     '#4a5058',
    pillarShadow:  '#101418',
    debrisMain:    '#303840',
    debrisLight:   '#404850',
    chestBody:     '#505860',
    chestLid:      '#606870',
    chestLatch:    '#f0c040',
    voidColor:     '#04060a',
  },
};

// ── Solid-tile check ────────────────────────────────────────────────────────

export function isSolid(tile: TileId): boolean {
  return tile === Tile.VOID || tile === Tile.WALL || tile === Tile.PILLAR;
}

// ── Tile rendering ──────────────────────────────────────────────────────────

/**
 * Render a single tile at pixel position (px, py).
 * `time` is the elapsed game time in seconds (used for animated tiles).
 */
export function renderTile(
  ctx: CanvasRenderingContext2D,
  tile: TileId,
  tileset: TilesetId,
  px: number,
  py: number,
  time: number,
  chestOpened?: boolean,
): void {
  const pal = PALETTES[tileset];
  const S = TILE_SIZE;

  switch (tile) {
    case Tile.VOID:
      ctx.fillStyle = pal.voidColor;
      ctx.fillRect(px, py, S, S);
      break;

    case Tile.FLOOR:
      drawFloor(ctx, pal, px, py, false);
      break;

    case Tile.FLOOR_ALT:
      drawFloor(ctx, pal, px, py, true);
      break;

    case Tile.WALL:
      drawWall(ctx, pal, px, py);
      break;

    case Tile.PILLAR:
      drawFloor(ctx, pal, px, py, false);
      drawPillar(ctx, pal, px, py);
      break;

    case Tile.DEBRIS:
      drawFloor(ctx, pal, px, py, false);
      drawDebris(ctx, pal, px, py);
      break;

    case Tile.CHEST:
      drawFloor(ctx, pal, px, py, false);
      drawChest(ctx, pal, px, py, time, chestOpened ?? false);
      break;

    case Tile.OBJECTIVE:
      drawFloor(ctx, pal, px, py, true);
      drawObjectiveMarker(ctx, px, py, time);
      break;
  }
}

// ── Drawing helpers ─────────────────────────────────────────────────────────

function drawFloor(ctx: CanvasRenderingContext2D, pal: TilePalette, px: number, py: number, alt: boolean): void {
  const S = TILE_SIZE;
  ctx.fillStyle = alt ? pal.floorAlt : pal.floorBase;
  ctx.fillRect(px, py, S, S);

  // Grid lines — subtle tile edges
  ctx.strokeStyle = alt ? pal.floorAltGrid : pal.floorGrid;
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);

  // Detail marks — tiny specks for texture
  ctx.fillStyle = alt ? pal.floorAltGrid : pal.floorGrid;
  // Use position-based pseudo-random for deterministic specks
  const hash = ((px * 7 + py * 13) & 0xff) / 255;
  if (hash > 0.5) {
    ctx.fillRect(px + 8, py + 12, 1, 1);
    ctx.fillRect(px + 22, py + 6, 1, 1);
  }
  if (hash > 0.3) {
    ctx.fillRect(px + 14, py + 24, 1, 1);
  }
}

function drawWall(ctx: CanvasRenderingContext2D, pal: TilePalette, px: number, py: number): void {
  const S = TILE_SIZE;

  // Wall face (full tile)
  ctx.fillStyle = pal.wallFace;
  ctx.fillRect(px, py, S, S);

  // Brick pattern — 4 rows of offset bricks with mortar lines
  ctx.fillStyle = pal.wallMortar;
  const brickH = 8;
  for (let row = 0; row < 4; row++) {
    const by = py + row * brickH;
    // Horizontal mortar line
    ctx.fillRect(px, by, S, 1);
    // Vertical mortar lines (offset every other row)
    const offset = (row % 2 === 0) ? 0 : 10;
    for (let vx = offset; vx < S; vx += 20) {
      ctx.fillRect(px + vx, by, 1, brickH);
    }
  }

  // Top edge highlight
  ctx.fillStyle = pal.wallHighlight;
  ctx.fillRect(px, py, S, 2);

  // Wall cap (lighter top strip)
  ctx.fillStyle = pal.wallTop;
  ctx.fillRect(px, py, S, 4);

  // Bottom shadow edge
  ctx.fillStyle = pal.wallShadow;
  ctx.fillRect(px, py + S - 2, S, 2);

  // Left highlight edge
  ctx.fillStyle = pal.wallHighlight;
  ctx.fillRect(px, py, 1, S);

  // Right shadow edge
  ctx.fillStyle = pal.wallShadow;
  ctx.fillRect(px + S - 1, py, 1, S);
}

function drawPillar(ctx: CanvasRenderingContext2D, pal: TilePalette, px: number, py: number): void {
  const S = TILE_SIZE;
  const pw = 14; // pillar width
  const ox = px + (S - pw) / 2;

  // Pillar shadow on floor
  ctx.fillStyle = pal.pillarShadow;
  ctx.fillRect(ox + 3, py + S - 6, pw, 6);

  // Pillar body
  ctx.fillStyle = pal.pillarBody;
  ctx.fillRect(ox, py + 4, pw, S - 4);

  // Pillar cap (top)
  ctx.fillStyle = pal.pillarCap;
  ctx.fillRect(ox - 2, py + 2, pw + 4, 6);

  // Pillar base
  ctx.fillStyle = pal.pillarCap;
  ctx.fillRect(ox - 1, py + S - 4, pw + 2, 4);

  // Highlight stripe down the left
  ctx.fillStyle = pal.pillarCap;
  ctx.fillRect(ox + 1, py + 6, 2, S - 12);
}

function drawDebris(ctx: CanvasRenderingContext2D, pal: TilePalette, px: number, py: number): void {
  // Scattered fragments on the floor
  const fragments = [
    { dx: 4,  dy: 8,  w: 8,  h: 5 },
    { dx: 16, dy: 14, w: 10, h: 4 },
    { dx: 8,  dy: 22, w: 6,  h: 4 },
    { dx: 22, dy: 6,  w: 5,  h: 6 },
  ];

  for (const f of fragments) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(px + f.dx + 1, py + f.dy + 1, f.w, f.h);
    // Fragment
    ctx.fillStyle = pal.debrisMain;
    ctx.fillRect(px + f.dx, py + f.dy, f.w, f.h);
    // Top highlight
    ctx.fillStyle = pal.debrisLight;
    ctx.fillRect(px + f.dx, py + f.dy, f.w, 1);
  }
}

function drawChest(
  ctx: CanvasRenderingContext2D,
  pal: TilePalette,
  px: number,
  py: number,
  time: number,
  opened: boolean,
): void {
  const S = TILE_SIZE;
  const cw = 20;
  const ch = 16;
  const cx = px + (S - cw) / 2;
  const cy = py + (S - ch) / 2 + 2;

  if (opened) {
    // Opened chest — lid tilted back, empty interior
    ctx.fillStyle = pal.chestBody;
    ctx.fillRect(cx, cy + 4, cw, ch - 4);
    // Dark interior
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx + 2, cy + 6, cw - 4, ch - 8);
    // Lid tilted back (smaller rect above)
    ctx.fillStyle = pal.chestLid;
    ctx.fillRect(cx - 1, cy, cw + 2, 5);
  } else {
    // Closed chest with glow
    const pulse = 0.4 + 0.3 * Math.sin(time * 3.0);
    // Glow underneath
    ctx.fillStyle = `rgba(255, 200, 60, ${(pulse * 0.3).toFixed(3)})`;
    ctx.fillRect(cx - 3, cy - 3, cw + 6, ch + 6);

    // Chest body
    ctx.fillStyle = pal.chestBody;
    ctx.fillRect(cx, cy, cw, ch);
    // Lid
    ctx.fillStyle = pal.chestLid;
    ctx.fillRect(cx - 1, cy, cw + 2, 6);
    // Latch (bright center)
    ctx.fillStyle = pal.chestLatch;
    ctx.fillRect(cx + cw / 2 - 2, cy + 6, 4, 4);
    // Highlight on lid
    ctx.fillStyle = `rgba(255, 255, 255, ${(pulse * 0.2).toFixed(3)})`;
    ctx.fillRect(cx + 2, cy + 1, cw - 4, 2);
  }
}

function drawObjectiveMarker(ctx: CanvasRenderingContext2D, px: number, py: number, time: number): void {
  const S = TILE_SIZE;
  const cx = px + S / 2;
  const cy = py + S / 2;

  // Pulsing ring
  const pulse = 0.4 + 0.4 * Math.sin(time * 2.5);
  ctx.strokeStyle = `rgba(80, 200, 255, ${pulse.toFixed(3)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 10 + pulse * 3, 0, Math.PI * 2);
  ctx.stroke();

  // Inner glow dot
  ctx.fillStyle = `rgba(120, 220, 255, ${(0.5 + pulse * 0.3).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}

// ── Player sprite rendering ─────────────────────────────────────────────────

export type Facing = 'up' | 'down' | 'left' | 'right';

/**
 * Draw the player character at pixel position (px, py) with the given facing.
 * `walking` true triggers a simple bob animation.
 */
export function renderPlayer(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  facing: Facing,
  time: number,
  walking: boolean,
): void {
  const S = TILE_SIZE;
  const cx = px + S / 2;
  const cy = py + S / 2;

  // Walk bob
  const bob = walking ? Math.sin(time * 12) * 2 : 0;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, py + S - 3, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body (main rectangle)
  const bodyW = 14;
  const bodyH = 20;
  const bx = cx - bodyW / 2;
  const by = cy - bodyH / 2 + bob - 2;

  // Body color — Kael's blue
  ctx.fillStyle = '#3a7acf';
  ctx.fillRect(bx, by + 4, bodyW, bodyH - 4);

  // Head
  ctx.fillStyle = '#e8c89a';
  ctx.fillRect(bx + 2, by, bodyW - 4, 8);

  // Hair (dark top)
  ctx.fillStyle = '#3a3040';
  ctx.fillRect(bx + 1, by - 1, bodyW - 2, 4);

  // Eyes (based on facing)
  ctx.fillStyle = '#fff';
  if (facing === 'down' || facing === 'left' || facing === 'right') {
    ctx.fillRect(bx + 4, by + 4, 2, 2);
    ctx.fillRect(bx + bodyW - 6, by + 4, 2, 2);
  }
  if (facing === 'up') {
    // Back of head — just hair
    ctx.fillStyle = '#3a3040';
    ctx.fillRect(bx + 2, by + 2, bodyW - 4, 4);
  }

  // Direction indicator — small bright nub
  const indLen = 14;
  let ix = cx, iy = cy + bob - 2;
  switch (facing) {
    case 'up':    iy -= indLen; break;
    case 'down':  iy += indLen; break;
    case 'left':  ix -= indLen; break;
    case 'right': ix += indLen; break;
  }
  ctx.fillStyle = '#8cf';
  ctx.beginPath();
  ctx.arc(ix, iy, 2, 0, Math.PI * 2);
  ctx.fill();
}
