import type { GameContext } from '../engine/Game.ts';
import type { InputManager } from '../engine/InputManager.ts';
import type { Character } from '../engine/types.ts';
import { drawPanel } from '../ui/Panel.ts';
import { drawProgressBar } from '../ui/ProgressBar.ts';

type Tab = 'STATUS' | 'ITEMS' | 'EQUIP';
const TABS: Tab[] = ['STATUS', 'ITEMS', 'EQUIP'];

const PORTRAIT_COLORS: Record<string, string> = {
  kael: '#c84', lyra: '#68c', ariel: '#4ca',
};

export class MenuScreen {
  private gctx: GameContext;
  private tab: number = 0;
  private memberCursor: number = 0;
  private itemCursor: number = 0;
  private onClose: () => void;
  private time = 0;

  constructor(gctx: GameContext, onClose: () => void) {
    this.gctx = gctx;
    this.onClose = onClose;
  }

  update(dt: number, input: InputManager): void {
    this.time += dt;

    if (input.wasPressed('Escape') || input.wasPressed('KeyX') || input.wasPressed('KeyM')) {
      this.onClose();
      return;
    }

    if (input.wasPressed('ArrowLeft'))  this.tab = (this.tab - 1 + TABS.length) % TABS.length;
    if (input.wasPressed('ArrowRight')) this.tab = (this.tab + 1) % TABS.length;

    const currentTab = TABS[this.tab];

    if (currentTab === 'STATUS' || currentTab === 'EQUIP') {
      if (input.wasPressed('ArrowUp'))   this.memberCursor = Math.max(0, this.memberCursor - 1);
      if (input.wasPressed('ArrowDown')) this.memberCursor = Math.min(this.gctx.party.length - 1, this.memberCursor + 1);
    }

    if (currentTab === 'ITEMS') {
      const usable = this.getHealItems();
      if (input.wasPressed('ArrowUp'))   this.itemCursor = Math.max(0, this.itemCursor - 1);
      if (input.wasPressed('ArrowDown')) this.itemCursor = Math.min(Math.max(0, usable.length - 1), this.itemCursor + 1);
    }
  }

  private getHealItems() {
    return this.gctx.inventory.filter(slot => {
      const item = this.gctx.allItems.find(i => i.id === slot.itemId);
      return item && item.type === 'consumable';
    });
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.gctx.canvas;

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,8,0.97)';
    ctx.fillRect(0, 0, width, height);

    // Title bar
    drawPanel(ctx, 0, 0, width, 36, 'MENU');
    ctx.fillStyle = '#4af';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STARFALL CHRONICLES', width / 2, 22);

    // Tab bar
    TABS.forEach((t, i) => {
      const tabX = 10 + i * 110;
      const active = i === this.tab;
      ctx.fillStyle = active ? '#4af' : '#1a2030';
      ctx.fillRect(tabX, 38, 105, 24);
      ctx.strokeStyle = active ? '#8df' : '#2a3040';
      ctx.lineWidth = 1;
      ctx.strokeRect(tabX, 38, 105, 24);
      ctx.fillStyle = active ? '#000' : '#7ab';
      ctx.font = active ? 'bold 12px monospace' : '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t, tabX + 52, 54);
    });

    // Content area
    const contentY = 66;
    const contentH = height - contentY - 30;
    drawPanel(ctx, 0, contentY, width, contentH);

    const currentTab = TABS[this.tab];
    if (currentTab === 'STATUS') this.renderStatus(ctx, width, contentY);
    if (currentTab === 'ITEMS')  this.renderItems(ctx, width, contentY);
    if (currentTab === 'EQUIP')  this.renderEquip(ctx, width, contentY);

    // Footer
    drawPanel(ctx, 0, height - 28, width, 28);
    ctx.fillStyle = '#4af';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('◄► Tabs   ↑↓ Select   X/M: Close', 12, height - 12);
  }

  private renderStatus(ctx: CanvasRenderingContext2D, width: number, startY: number): void {
    const panelW = Math.floor((width - 8) / 3);

    this.gctx.party.forEach((c, i) => {
      const px = 4 + i * panelW;
      const py = startY + 6;
      const isSelected = i === this.memberCursor;

      if (isSelected) {
        ctx.fillStyle = 'rgba(68,170,255,0.12)';
        ctx.fillRect(px, py, panelW - 2, 340);
        ctx.strokeStyle = '#4af';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, panelW - 2, 340);
      }

      this.renderCharCard(ctx, c, px + 8, py + 8, panelW - 16);
    });
  }

  private renderCharCard(ctx: CanvasRenderingContext2D, c: Character, x: number, y: number, w: number): void {
    const color = PORTRAIT_COLORS[c.id] ?? '#666';
    const ko = c.hp <= 0;

    // Portrait
    ctx.fillStyle = ko ? '#333' : color;
    ctx.fillRect(x, y, 48, 48);
    ctx.fillStyle = ko ? '#666' : '#fff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(c.name[0] ?? '?', x + 24, y + 32);

    // Name + class
    ctx.fillStyle = ko ? '#666' : '#fc0';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(c.name, x + 56, y + 18);
    ctx.fillStyle = '#7ab';
    ctx.font = '11px monospace';
    ctx.fillText(`Lv.${c.level} ${c.class}`, x + 56, y + 32);
    if (ko) { ctx.fillStyle = '#f44'; ctx.fillText('[KO]', x + 56, y + 46); }

    const statY = y + 60;
    const lineH = 20;

    // HP bar
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText('HP', x, statY);
    drawProgressBar(ctx, x + 20, statY - 10, w - 20, 10, c.hp, c.maxHp, '#4f4');
    ctx.fillStyle = '#ccc';
    ctx.font = '10px monospace';
    ctx.fillText(`${c.hp}/${c.maxHp}`, x, statY + lineH * 0.5);

    // TP bar
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText('TP', x, statY + lineH);
    drawProgressBar(ctx, x + 20, statY + lineH - 10, w - 20, 10, c.tp, c.maxTp, '#4af');
    ctx.fillStyle = '#ccc';
    ctx.font = '10px monospace';
    ctx.fillText(`${c.tp}/${c.maxTp}`, x, statY + lineH * 1.5);

    // Stats grid
    const stats = [
      ['ATK', c.attack], ['DEF', c.defense],
      ['SPD', c.speed],  ['LCK', c.luck],
    ] as [string, number][];

    stats.forEach(([label, val], si) => {
      const row = Math.floor(si / 2);
      const col = si % 2;
      const sx = x + col * (w / 2);
      const sy = statY + lineH * 2.2 + row * lineH;
      ctx.fillStyle = '#567';
      ctx.font = '10px monospace';
      ctx.fillText(label, sx, sy);
      ctx.fillStyle = '#cef';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(String(val), sx + 28, sy);
    });

    // Techniques
    const techY = statY + lineH * 5;
    ctx.fillStyle = '#567';
    ctx.font = '10px monospace';
    ctx.fillText('TECH:', x, techY);
    ctx.fillStyle = '#8df';
    ctx.font = '11px monospace';
    ctx.fillText(c.techniques.join(' ') || '—', x + 36, techY);
  }

  private renderItems(ctx: CanvasRenderingContext2D, width: number, startY: number): void {
    const items = this.getHealItems();

    ctx.fillStyle = '#fc0';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('INVENTORY', 14, startY + 22);

    if (items.length === 0) {
      ctx.fillStyle = '#555';
      ctx.font = '13px monospace';
      ctx.fillText('No items.', 14, startY + 48);
      return;
    }

    items.forEach((slot, i) => {
      const item = this.gctx.allItems.find(it => it.id === slot.itemId);
      if (!item) return;
      const iy = startY + 36 + i * 28;
      const sel = i === this.itemCursor;

      if (sel) {
        ctx.fillStyle = 'rgba(68,170,255,0.15)';
        ctx.fillRect(8, iy - 14, width - 16, 22);
        ctx.fillStyle = '#fc0';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(`▶ ${item.name}`, 16, iy);
      } else {
        ctx.fillStyle = '#aaa';
        ctx.font = '13px monospace';
        ctx.fillText(`  ${item.name}`, 16, iy);
      }

      ctx.fillStyle = sel ? '#fc0' : '#666';
      ctx.textAlign = 'right';
      ctx.fillText(`x${slot.quantity}`, width - 16, iy);

      if (sel) {
        ctx.fillStyle = '#899';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(item.description, 24, iy + 14);
      }

      ctx.textAlign = 'left';
    });
  }

  private renderEquip(ctx: CanvasRenderingContext2D, _width: number, startY: number): void {
    const c = this.gctx.party[this.memberCursor];
    if (!c) return;

    // Member selector
    this.gctx.party.forEach((m, i) => {
      const tx = 14 + i * 100;
      const sel = i === this.memberCursor;
      ctx.fillStyle = sel ? '#fc0' : '#567';
      ctx.font = sel ? 'bold 12px monospace' : '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText((sel ? '▶ ' : '  ') + m.name, tx, startY + 20);
    });

    ctx.strokeStyle = '#2a3040';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8, startY + 28); ctx.lineTo(620, startY + 28); ctx.stroke();

    const slots = [
      ['WEAPON',    c.equipment.weapon],
      ['ARMOR',     c.equipment.armor],
      ['SHIELD',    c.equipment.shield],
      ['ACCESSORY', c.equipment.accessory],
    ] as [string, string | null][];

    slots.forEach(([slot, equipped], i) => {
      const sy = startY + 48 + i * 34;
      ctx.fillStyle = '#567';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(slot, 16, sy);
      ctx.fillStyle = equipped ? '#cef' : '#444';
      ctx.font = '13px monospace';
      ctx.fillText(equipped ?? '---', 100, sy);
    });
  }
}
