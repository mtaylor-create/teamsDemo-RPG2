import type { GameContext } from '../engine/Game.ts';
import type { InputManager } from '../engine/InputManager.ts';
import type { Character, Enemy, Item } from '../engine/types.ts';
import { drawPanel } from '../ui/Panel.ts';
import { drawProgressBar } from '../ui/ProgressBar.ts';

type BattleState =
  | 'BATTLE_INTRO'
  | 'PLAYER_MENU' | 'PLAYER_TECH' | 'PLAYER_ITEM'
  | 'PLAYER_TARGET_ENEMY' | 'PLAYER_TARGET_ALLY'
  | 'EXECUTING' | 'ENEMY_TURN' | 'NEXT_TURN'
  | 'VICTORY' | 'DEFEAT';

interface BattleEnemy {
  template: Enemy;
  currentHp: number;
  index: number;
  flashTimer: number;
  shakeOffset: number;
  defeated: boolean;
  fadeAlpha: number;
}

interface FloatText {
  text: string;
  x: number;
  y: number;
  alpha: number;
  color: string;
  timer: number;
}

interface TurnEntry {
  type: 'party' | 'enemy';
  index: number;
  speed: number;
}

const TECHNIQUES: Record<string, { name: string; tp: number; desc: string }> = {
  FOI:  { name: 'FOI',  tp: 4, desc: 'Fire dmg to one' },
  RES:  { name: 'RES',  tp: 5, desc: 'Restore 40 HP'   },
  RAY:  { name: 'RAY',  tp: 3, desc: 'Ray dmg to one'  },
};

const ENEMY_COLORS: Record<string, { body: string; eye: string; glow: string }> = {
  shadowpup:    { body: '#28143e', eye: '#f26', glow: 'rgba(255,40,80,0.22)'   },
  shadowhound:  { body: '#3e1414', eye: '#fa4', glow: 'rgba(255,160,40,0.22)'  },
  shadowwarden: { body: '#301408', eye: '#f44', glow: 'rgba(255,60,60,0.22)'  },
  ice_crawler:  { body: '#142838', eye: '#4ef', glow: 'rgba(60,220,255,0.20)'  },
  void_stalker: { body: '#1e0830', eye: '#c4f', glow: 'rgba(180,60,255,0.22)' },
};

const ENEMY_SIZE: Record<string, { w: number; h: number }> = {
  shadowpup:    { w: 55, h: 45 },
  shadowhound:  { w: 80, h: 65 },
  shadowwarden: { w: 120, h: 100 },
  ice_crawler:  { w: 70, h: 55 },
  void_stalker: { w: 75, h: 70 },
};

export class BattleScreen {
  private gctx: GameContext;
  private party: Character[];
  private enemies: BattleEnemy[];
  private allItems: Item[];
  private onVictory: () => void;
  private onDefeat: () => void;

  private state: BattleState = 'NEXT_TURN';
  private turnQueue: TurnEntry[] = [];
  private currentTurn: TurnEntry | null = null;

  private menuIndex = 0;
  private menuItems = ['ATTACK', 'TECHNIQUE', 'ITEM', 'DEFEND'];
  private techMenuIndex = 0;
  private itemMenuIndex = 0;
  private targetIndex = 0;
  private defendFlags: boolean[] = [];

  private floatTexts: FloatText[] = [];
  private messages: string[] = [];
  private stateTimer = 0;

  private victoryExp = 0;
  private victoryMeseta = 0;
  private time = 0;
  private isBoss: boolean;

  constructor(
    gctx: GameContext,
    enemyTemplates: Enemy[],
    isBoss: boolean,
    onVictory: () => void,
    onDefeat: () => void
  ) {
    this.gctx = gctx;
    this.party = gctx.party;
    this.allItems = gctx.allItems;
    this.onVictory = onVictory;
    this.onDefeat = onDefeat;
    this.isBoss = isBoss;

    this.enemies = enemyTemplates.map((t, i) => ({
      template: t,
      currentHp: t.hp,
      index: i,
      flashTimer: 0,
      shakeOffset: 0,
      defeated: false,
      fadeAlpha: 1,
    }));

    this.defendFlags = new Array(this.party.length).fill(false);

    this.addMessage(isBoss ? '★ BOSS ENCOUNTER! ★' : 'Shadowbeasts appeared!');
    this.state = 'BATTLE_INTRO';
    this.buildTurnQueue();
  }

  private updateBattleIntro(input: InputManager): void {
    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      this.nextTurn();
    }
  }

  private buildTurnQueue(): void {
    const entries: TurnEntry[] = [];
    this.party.forEach((c, i) => {
      if (c.hp > 0) entries.push({ type: 'party', index: i, speed: c.speed });
    });
    this.enemies.forEach((e, i) => {
      if (!e.defeated) entries.push({ type: 'enemy', index: i, speed: e.template.speed });
    });
    entries.sort((a, b) => b.speed - a.speed);
    this.turnQueue = entries;
  }

  private nextTurn(): void {
    if (this.checkVictory()) return;
    if (this.checkDefeat()) return;

    if (this.turnQueue.length === 0) {
      this.buildTurnQueue();
    }
    this.currentTurn = this.turnQueue.shift() ?? null;
    if (!this.currentTurn) return;

    const t = this.currentTurn;
    if (t.type === 'party') {
      const member = this.party[t.index];
      if (!member || member.hp <= 0) { this.nextTurn(); return; }
      this.menuIndex = 0;
      this.state = 'PLAYER_MENU';
    } else {
      const enemy = this.enemies[t.index];
      if (!enemy || enemy.defeated) { this.nextTurn(); return; }
      this.state = 'ENEMY_TURN';
      this.stateTimer = 0.45;
    }
  }

  private checkVictory(): boolean {
    if (this.enemies.every(e => e.defeated)) {
      this.victoryExp = this.enemies.reduce((s, e) => s + e.template.exp, 0);
      this.victoryMeseta = this.enemies.reduce((s, e) => s + e.template.meseta, 0);
      this.state = 'VICTORY';
      this.stateTimer = 0;
      return true;
    }
    return false;
  }

  private checkDefeat(): boolean {
    if (this.party.every(c => c.hp <= 0)) {
      this.state = 'DEFEAT';
      this.stateTimer = 0;
      return true;
    }
    return false;
  }

  private addMessage(msg: string): void {
    this.messages.push(msg);
    if (this.messages.length > 4) this.messages.shift();
  }

  private spawnFloat(x: number, y: number, text: string, color: string): void {
    this.floatTexts.push({ text, x, y, alpha: 1, color, timer: 0 });
  }

  private calcDamage(atk: number, def: number): number {
    const base = Math.max(1, atk - Math.floor(def / 2));
    return Math.max(1, Math.round(base * (0.85 + Math.random() * 0.3)));
  }

  private getTechDamage(techId: string, attacker: Character | BattleEnemy, target: Enemy): number {
    const atk = 'attack' in attacker ? (attacker as Character).attack : (attacker as BattleEnemy).template.attack;
    let dmg = 0;
    if (techId === 'FOI') dmg = Math.max(1, Math.round(25 + atk / 3));
    if (techId === 'RAY') dmg = Math.max(1, Math.round(20 + atk / 2));
    if (techId === 'DARK_BOLT') dmg = 22;
    // Weakness bonus
    if (target.weaknesses.includes(techId)) dmg = Math.round(dmg * 1.5);
    return Math.max(1, dmg);
  }

  // Enemy position on canvas
  private enemyPos(i: number): { x: number; y: number } {
    const count = this.enemies.length;
    const totalW = 620;
    const spacing = totalW / (count + 1);
    return { x: Math.round(10 + spacing * (i + 1)), y: 160 };
  }

  update(dt: number, input: InputManager): void {
    this.time += dt;

    // Update float texts
    for (const f of this.floatTexts) {
      f.timer += dt;
      f.y -= 40 * dt;
      f.alpha = Math.max(0, 1 - f.timer / 1.2);
    }
    this.floatTexts = this.floatTexts.filter(f => f.alpha > 0);

    // Update enemy flash/shake
    for (const e of this.enemies) {
      if (e.flashTimer > 0) e.flashTimer -= dt;
      if (e.shakeOffset !== 0 && e.flashTimer <= 0) e.shakeOffset = 0;
      if (e.defeated && e.fadeAlpha > 0) e.fadeAlpha = Math.max(0, e.fadeAlpha - dt * 1.5);
    }

    switch (this.state) {
      case 'BATTLE_INTRO':  this.updateBattleIntro(input); break;
      case 'PLAYER_MENU':   this.updatePlayerMenu(input); break;
      case 'PLAYER_TECH':   this.updateTechMenu(input); break;
      case 'PLAYER_ITEM':   this.updateItemMenu(input); break;
      case 'PLAYER_TARGET_ENEMY': this.updateTargetEnemy(input); break;
      case 'PLAYER_TARGET_ALLY':  this.updateTargetAlly(input); break;
      case 'EXECUTING':     this.updateExecuting(dt); break;
      case 'ENEMY_TURN':    this.updateEnemyTurn(dt); break;
      case 'NEXT_TURN':     this.updateNextTurn(dt); break;
      case 'VICTORY':       this.updateVictory(dt, input); break;
      case 'DEFEAT':        this.updateDefeat(dt, input); break;
    }
  }

  private updatePlayerMenu(input: InputManager): void {
    if (input.wasPressed('ArrowUp'))   this.menuIndex = (this.menuIndex - 1 + 4) % 4;
    if (input.wasPressed('ArrowDown')) this.menuIndex = (this.menuIndex + 1) % 4;

    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      switch (this.menuIndex) {
        case 0: // ATTACK
          this.targetIndex = this.firstLiveEnemy();
          this.state = 'PLAYER_TARGET_ENEMY';
          break;
        case 1: // TECHNIQUE
          this.techMenuIndex = 0;
          this.state = 'PLAYER_TECH';
          break;
        case 2: // ITEM
          this.itemMenuIndex = 0;
          this.state = 'PLAYER_ITEM';
          break;
        case 3: // DEFEND
          if (this.currentTurn) {
            this.defendFlags[this.currentTurn.index] = true;
            this.addMessage(`${this.party[this.currentTurn.index]!.name} takes a defensive stance.`);
            this.state = 'NEXT_TURN';
            this.stateTimer = 0.3;
          }
          break;
      }
    }
  }

  private firstLiveEnemy(): number {
    return this.enemies.findIndex(e => !e.defeated);
  }

  private updateTechMenu(input: InputManager): void {
    if (!this.currentTurn) return;
    const member = this.party[this.currentTurn.index];
    if (!member) return;
    const techs = member.techniques;

    if (input.wasPressed('ArrowUp'))   this.techMenuIndex = Math.max(0, this.techMenuIndex - 1);
    if (input.wasPressed('ArrowDown')) this.techMenuIndex = Math.min(techs.length - 1, this.techMenuIndex + 1);
    if (input.wasPressed('Escape') || input.wasPressed('KeyX')) { this.state = 'PLAYER_MENU'; return; }

    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      const techId = techs[this.techMenuIndex];
      if (!techId) return;
      const tech = TECHNIQUES[techId];
      if (!tech) return;
      if (member.tp < tech.tp) { this.addMessage('Not enough TP!'); return; }

      this._pendingTech = techId;
      if (techId === 'RES') {
        this.targetIndex = this.currentTurn.index;
        this.state = 'PLAYER_TARGET_ALLY';
      } else {
        this.targetIndex = this.firstLiveEnemy();
        this.state = 'PLAYER_TARGET_ENEMY';
      }
    }
  }

  private _pendingTech: string | null = null;
  private _pendingItem: Item | null = null;

  private updateItemMenu(input: InputManager): void {
    const usable = this.getUsableItems();
    this.itemMenuIndex = Math.max(0, Math.min(this.itemMenuIndex, usable.length - 1));
    if (usable.length === 0) {
      this.addMessage('No usable items!');
      this.state = 'PLAYER_MENU';
      return;
    }
    if (input.wasPressed('ArrowUp'))   this.itemMenuIndex = Math.max(0, this.itemMenuIndex - 1);
    if (input.wasPressed('ArrowDown')) this.itemMenuIndex = Math.min(usable.length - 1, this.itemMenuIndex + 1);
    if (input.wasPressed('Escape') || input.wasPressed('KeyX')) { this.state = 'PLAYER_MENU'; return; }

    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      const entry = usable[this.itemMenuIndex];
      if (!entry) return;
      const item = this.allItems.find(i => i.id === entry.itemId);
      if (!item) return;
      this._pendingItem = item;
      this.targetIndex = this.currentTurn?.index ?? 0;
      this.state = 'PLAYER_TARGET_ALLY';
    }
  }

  private getUsableItems(): { itemId: string; quantity: number }[] {
    return this.gctx.inventory.filter(slot => {
      const item = this.allItems.find(i => i.id === slot.itemId);
      if (!item || item.type !== 'consumable' || !item.effect) return false;
      // Only single-target heal_hp items with a positive value
      return item.effect.type === 'heal_hp' && item.effect.target === 'single' && item.effect.value > 0;
    });
  }

  private updateTargetEnemy(input: InputManager): void {
    const live = this.enemies.filter(e => !e.defeated);
    if (live.length === 0) { this.state = 'PLAYER_MENU'; return; }

    if (input.wasPressed('ArrowLeft') || input.wasPressed('ArrowUp')) {
      let guard = 0;
      do {
        this.targetIndex = (this.targetIndex - 1 + this.enemies.length) % this.enemies.length;
      } while (this.enemies[this.targetIndex]?.defeated && ++guard < this.enemies.length);
    }
    if (input.wasPressed('ArrowRight') || input.wasPressed('ArrowDown')) {
      let guard = 0;
      do {
        this.targetIndex = (this.targetIndex + 1) % this.enemies.length;
      } while (this.enemies[this.targetIndex]?.defeated && ++guard < this.enemies.length);
    }
    if (input.wasPressed('Escape') || input.wasPressed('KeyX')) {
      const hadTech = this._pendingTech !== null;
      this._pendingTech = null;
      this._pendingItem = null;
      this.state = hadTech ? 'PLAYER_TECH' : 'PLAYER_MENU';
      return;
    }

    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      this.executePlayerAction();
    }
  }

  private updateTargetAlly(input: InputManager): void {
    // Heal actions (item or RES) should skip KO'd members
    const skipKO = this._pendingItem !== null || this._pendingTech === 'RES';
    if (input.wasPressed('ArrowLeft') || input.wasPressed('ArrowUp')) {
      let guard = 0;
      do {
        this.targetIndex = (this.targetIndex - 1 + this.party.length) % this.party.length;
      } while (skipKO && (this.party[this.targetIndex]?.hp ?? 0) <= 0 && ++guard < this.party.length);
    }
    if (input.wasPressed('ArrowRight') || input.wasPressed('ArrowDown')) {
      let guard = 0;
      do {
        this.targetIndex = (this.targetIndex + 1) % this.party.length;
      } while (skipKO && (this.party[this.targetIndex]?.hp ?? 0) <= 0 && ++guard < this.party.length);
    }
    if (input.wasPressed('Escape') || input.wasPressed('KeyX')) {
      this._pendingTech = null;
      this._pendingItem = null;
      this.state = 'PLAYER_MENU';
      return;
    }
    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      this.executePlayerAction();
    }
  }

  private executePlayerAction(): void {
    if (!this.currentTurn) return;
    const actor = this.party[this.currentTurn.index];
    if (!actor) return;

    if (this._pendingTech) {
      const techId = this._pendingTech;
      const tech = TECHNIQUES[techId];
      if (!tech) return;
      actor.tp -= tech.tp;
      this._pendingTech = null;

      if (techId === 'RES') {
        const target = this.party[this.targetIndex];
        if (!target) return;
        const heal = Math.min(40, target.maxHp - target.hp);
        target.hp = Math.min(target.maxHp, target.hp + 40);
        const pos = this.partyBarPos(this.targetIndex);
        this.spawnFloat(pos.x, pos.y, `+${heal}`, '#4f8');
        this.addMessage(`${actor.name} casts RES on ${target.name}! Restored ${heal} HP.`);
      } else {
        const enemy = this.enemies[this.targetIndex];
        if (!enemy || enemy.defeated) return;
        const dmg = this.getTechDamage(techId, actor, enemy.template);
        enemy.currentHp = Math.max(0, enemy.currentHp - dmg);
        enemy.flashTimer = 0.25;
        enemy.shakeOffset = 5;
        const weak = enemy.template.weaknesses.includes(techId);
        const pos = this.enemyPos(this.targetIndex);
        this.spawnFloat(pos.x, pos.y - 50, `-${dmg}`, weak ? '#fc0' : '#f88');
        this.addMessage(`${actor.name} casts ${techId}!${weak ? ' WEAKNESS!' : ''} ${dmg} damage to ${enemy.template.name}.`);
        if (enemy.currentHp <= 0) {
          enemy.defeated = true;
          this.addMessage(`${enemy.template.name} was defeated!`);
        }
      }
    } else if (this._pendingItem) {
      const item = this._pendingItem;
      this._pendingItem = null;
      const target = this.party[this.targetIndex];
      if (!target) return;
      const slot = this.gctx.inventory.find(s => s.itemId === item.id);
      if (slot) { slot.quantity--; if (slot.quantity <= 0) this.gctx.inventory.splice(this.gctx.inventory.indexOf(slot), 1); }
      const healAmt = item.effect?.value ?? 50;
      const actual = Math.min(healAmt, target.maxHp - target.hp);
      target.hp = Math.min(target.maxHp, target.hp + healAmt);
      const pos = this.partyBarPos(this.targetIndex);
      this.spawnFloat(pos.x, pos.y, `+${actual}`, '#4f8');
      this.addMessage(`${actor.name} used ${item.name}! Restored ${actual} HP to ${target.name}.`);
    } else {
      // Physical attack
      const enemy = this.enemies[this.targetIndex];
      if (!enemy || enemy.defeated) return;
      const dmg = this.calcDamage(actor.attack, enemy.template.defense);
      enemy.currentHp = Math.max(0, enemy.currentHp - dmg);
      const finalDmg = dmg;
      enemy.flashTimer = 0.2;
      enemy.shakeOffset = 6;
      const pos = this.enemyPos(this.targetIndex);
      this.spawnFloat(pos.x, pos.y - 50, `-${finalDmg}`, '#f88');
      this.addMessage(`${actor.name} attacks ${enemy.template.name}! ${finalDmg} damage.`);
      if (enemy.currentHp <= 0) {
        enemy.defeated = true;
        this.addMessage(`${enemy.template.name} was defeated!`);
      }
    }

    this.defendFlags[this.currentTurn.index] = false;
    this.state = 'NEXT_TURN';
    this.stateTimer = 0.35;
  }

  private updateExecuting(dt: number): void {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.state = 'NEXT_TURN';
      this.stateTimer = 0.2;
    }
  }

  private updateEnemyTurn(dt: number): void {
    this.stateTimer -= dt;
    if (this.stateTimer > 0) return;

    if (!this.currentTurn) return;
    const enemy = this.enemies[this.currentTurn.index];
    if (!enemy || enemy.defeated) { this.state = 'NEXT_TURN'; this.stateTimer = 0.2; return; }

    const livingParty = this.party.filter(c => c.hp > 0);
    if (livingParty.length === 0) { this.checkDefeat(); return; }

    const hasDarkBolt = enemy.template.techniques.includes('DARK_BOLT');

    if (hasDarkBolt && Math.random() < 0.3) {
      // DARK_BOLT — hits all
      this.addMessage(`${enemy.template.name} unleashes DARK BOLT!`);
      this.party.forEach((c, i) => {
        if (c.hp <= 0) return;
        const def = this.defendFlags[i] ? 2 : 1;
        const dmg = Math.round(22 / def);
        c.hp = Math.max(0, c.hp - dmg);
        const pos = this.partyBarPos(i);
        this.spawnFloat(pos.x, pos.y, `-${dmg}`, '#c4f');
        if (c.hp <= 0) this.addMessage(`${c.name} was knocked out!`);
      });
      if (this.checkDefeat()) return;
    } else {
      const target = livingParty[Math.floor(Math.random() * livingParty.length)]!;
      const targetIdx = this.party.indexOf(target);
      const def = this.defendFlags[targetIdx] ? target.defense * 2 : target.defense;
      const dmg = this.calcDamage(enemy.template.attack, def);
      target.hp = Math.max(0, target.hp - dmg);
      const pos = this.partyBarPos(targetIdx);
      this.spawnFloat(pos.x, pos.y, `-${dmg}`, '#f44');
      this.addMessage(`${enemy.template.name} attacks ${target.name}! ${dmg} damage.`);
      if (target.hp <= 0) this.addMessage(`${target.name} was knocked out!`);
    }

    this.defendFlags.fill(false);
    this.state = 'NEXT_TURN';
    this.stateTimer = 0.4;
  }

  private updateNextTurn(dt: number): void {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) this.nextTurn();
  }

  private updateVictory(dt: number, input: InputManager): void {
    this.stateTimer += dt;
    if (this.stateTimer > 2.5 && (input.wasPressed('Enter') || input.wasPressed('Space'))) {
      this.onVictory();
    }
  }

  private updateDefeat(_dt: number, input: InputManager): void {
    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      // Restore party HP to half for retry
      for (const c of this.party) { c.hp = Math.floor(c.maxHp / 2); }
      this.onDefeat();
    }
  }

  private partyBarPos(i: number): { x: number; y: number } {
    const panelW = Math.floor((620) / 3);
    return { x: 10 + i * panelW + panelW / 2, y: 285 };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.gctx.canvas;

    // Background — darker indigo
    ctx.fillStyle = '#060a18';
    ctx.fillRect(0, 0, width, height);

    // Grid lines in enemy area — more visible
    ctx.strokeStyle = 'rgba(20, 60, 110, 0.35)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 260); ctx.stroke();
    }
    for (let y = 0; y < 260; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Message log
    drawPanel(ctx, 0, 0, width, 56);
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    const msgStart = Math.max(0, this.messages.length - 3);
    for (let i = msgStart; i < this.messages.length; i++) {
      const age = this.messages.length - 1 - i;
      const alpha = age === 0 ? 1 : age === 1 ? 0.7 : 0.45;
      ctx.fillStyle = `rgba(200, 230, 255, ${alpha})`;
      ctx.fillText(this.messages[i] ?? '', 10, 14 + (i - msgStart) * 15);
    }

    // Enemies
    for (let i = 0; i < this.enemies.length; i++) {
      this.renderEnemy(ctx, i);
    }

    // Party status bar
    this.renderPartyStatus(ctx, width);

    // Action area
    this.renderActionArea(ctx, width, height);

    // Float texts
    for (const f of this.floatTexts) {
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = f.color;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    if (this.state === 'VICTORY') this.renderVictory(ctx, width, height);
    if (this.state === 'DEFEAT')  this.renderDefeat(ctx, width, height);
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, i: number): void {
    const e = this.enemies[i];
    if (!e) return;
    if (e.fadeAlpha <= 0) return;

    ctx.globalAlpha = e.fadeAlpha;

    const pos = this.enemyPos(i);
    const sz = ENEMY_SIZE[e.template.id] ?? { w: 70, h: 60 };
    const colors = ENEMY_COLORS[e.template.id] ?? { body: '#222', eye: '#f00', glow: 'rgba(255,0,0,0.15)' };

    const ox = e.flashTimer > 0 ? e.shakeOffset * Math.sin(this.time * 40) : 0;
    const x = pos.x + ox;
    const y = pos.y;

    // Flash overlay
    if (e.flashTimer > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, e.flashTimer / 0.15)})`;
      ctx.fillRect(x - sz.w / 2, y - sz.h, sz.w, sz.h);
    }

    // Body
    ctx.fillStyle = colors.body;
    ctx.fillRect(x - sz.w / 2, y - sz.h, sz.w, sz.h);

    // Bane aura glow
    const glowGrad = ctx.createRadialGradient(x, y - sz.h / 2, sz.w * 0.1, x, y - sz.h / 2, sz.w * 0.8);
    glowGrad.addColorStop(0, 'rgba(80,0,0,0)');
    glowGrad.addColorStop(1, colors.glow);
    ctx.fillStyle = glowGrad;
    ctx.fillRect(x - sz.w, y - sz.h * 1.5, sz.w * 2, sz.h * 2);

    // Eyes
    const eyeY = y - sz.h * 0.65;
    const eyeGlow = 0.6 + 0.4 * Math.sin(this.time * 2.5 + i);
    ctx.fillStyle = colors.eye;
    ctx.globalAlpha = e.fadeAlpha * eyeGlow;
    ctx.fillRect(x - sz.w * 0.25 - 3, eyeY - 3, 6, 6);
    ctx.fillRect(x + sz.w * 0.25 - 3, eyeY - 3, 6, 6);
    ctx.globalAlpha = e.fadeAlpha;

    // Boss crown indicator
    if (this.isBoss) {
      ctx.fillStyle = '#fc0';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★ BOSS ★', x, y - sz.h - 4);
    }

    // Enemy name
    ctx.fillStyle = '#dde';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(e.template.name, x, y + 12);

    // HP bar
    drawProgressBar(ctx, x - sz.w / 2, y + 16, sz.w, 6, e.currentHp, e.template.hp, '#4f4');

    // Target indicator
    if ((this.state === 'PLAYER_TARGET_ENEMY') && this.targetIndex === i && !e.defeated) {
      ctx.strokeStyle = '#fc0';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - sz.w / 2 - 2, y - sz.h - 2, sz.w + 4, sz.h + 4);
      ctx.fillStyle = '#fc0';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▼', x, y - sz.h - 8);
    }

    ctx.globalAlpha = 1;
  }

  private renderPartyStatus(ctx: CanvasRenderingContext2D, width: number): void {
    drawPanel(ctx, 0, 258, width, 74, 'PARTY');
    const panelW = Math.floor((width - 8) / 3);

    this.party.forEach((c, i) => {
      const px = 4 + i * panelW;
      const isActive = this.currentTurn?.type === 'party' && this.currentTurn.index === i;
      const isTargetAlly = this.state === 'PLAYER_TARGET_ALLY' && this.targetIndex === i;

      if (isActive) {
        ctx.fillStyle = 'rgba(68,170,255,0.15)';
        ctx.fillRect(px, 258, panelW, 74);
      }
      if (isTargetAlly) {
        ctx.strokeStyle = '#4f8';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, 260, panelW - 2, 70);
      }

      const ko = c.hp <= 0;
      ctx.fillStyle = ko ? '#666' : isActive ? '#fc0' : '#def';
      ctx.font = `bold 11px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(ko ? `${c.name} [KO]` : c.name, px + 6, 276);

      ctx.fillStyle = '#99a';
      ctx.font = '9px monospace';
      ctx.fillText(c.class, px + 6, 287);

      if (!ko) {
        ctx.fillStyle = '#bbc';
        ctx.font = '10px monospace';
        ctx.fillText(`HP`, px + 6, 302);
        drawProgressBar(ctx, px + 22, 294, panelW - 30, 7, c.hp, c.maxHp, '#4f4');
        ctx.fillText(`${c.hp}/${c.maxHp}`, px + 6, 312);

        ctx.fillText(`TP`, px + 6, 322);
        drawProgressBar(ctx, px + 22, 314, panelW - 30, 5, c.tp, c.maxTp, '#4af');
      }
    });
  }

  private renderActionArea(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    drawPanel(ctx, 0, 334, width, height - 334);

    switch (this.state) {
      case 'BATTLE_INTRO':    this.renderBattleIntro(ctx, width, height); break;
      case 'PLAYER_MENU':     this.renderPlayerMenu(ctx, width, height); break;
      case 'PLAYER_TECH':     this.renderTechMenu(ctx, width, height); break;
      case 'PLAYER_ITEM':     this.renderItemMenu(ctx, width, height); break;
      case 'PLAYER_TARGET_ENEMY':
      case 'PLAYER_TARGET_ALLY':
        this.renderTargetPrompt(ctx, width, height); break;
      case 'ENEMY_TURN':      this.renderEnemyTurnMsg(ctx, width); break;
      case 'NEXT_TURN':
      case 'EXECUTING': {
        const dots = '.'.repeat((Math.floor(this.time / 0.35) % 3) + 1);
        ctx.fillStyle = 'rgba(100,160,220,0.55)';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Resolving${dots}`, width / 2, 360);
        break;
      }
    }
  }

  private renderBattleIntro(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = this.isBoss ? '#fc0' : '#f88';
    ctx.font = `bold 14px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(this.isBoss ? '★ BOSS BATTLE ★' : 'BATTLE START!', w / 2, 352);

    const enemyNames = this.enemies.map(e => e.template.name).join(', ');
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText(`Enemies: ${enemyNames}`, w / 2, 368);

    ctx.fillStyle = '#4af';
    ctx.font = '11px monospace';
    ctx.fillText('CONTROLS', w / 2, 388);
    ctx.fillStyle = '#889';
    ctx.fillText('↑ ↓  Navigate menu     ENTER / SPACE  Confirm', w / 2, 402);
    ctx.fillText('◄ ►  Select target     X / ESC         Back', w / 2, 415);

    if (Math.floor(this.time / 0.5) % 2 === 0) {
      ctx.fillStyle = '#fc0';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('Press ENTER to begin!', w / 2, h - 10);
    }
  }

  private renderPlayerMenu(ctx: CanvasRenderingContext2D, _w: number, _h: number): void {
    if (!this.currentTurn) return;
    const member = this.party[this.currentTurn.index];
    if (!member) return;

    ctx.fillStyle = '#fc0';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${member.name}'s turn`, 14, 354);

    const menuX = 20;
    const menuY = 364;
    this.menuItems.forEach((item, i) => {
      const y = menuY + i * 26;
      const selected = i === this.menuIndex;
      if (selected) {
        ctx.fillStyle = 'rgba(68,170,255,0.2)';
        ctx.fillRect(menuX - 2, y - 14, 160, 20);
        ctx.fillStyle = '#fc0';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('▶ ' + item, menuX, y);
      } else {
        ctx.fillStyle = '#999';
        ctx.font = '13px monospace';
        ctx.fillText('  ' + item, menuX, y);
      }
    });

    // Controls hint
    ctx.fillStyle = 'rgba(100,160,220,0.85)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('↑↓ Select   ENTER/SPACE Confirm', _w - 10, _h - 8);
  }

  private renderTechMenu(ctx: CanvasRenderingContext2D, _w: number, _h: number): void {
    if (!this.currentTurn) return;
    const member = this.party[this.currentTurn.index];
    if (!member) return;
    const techs = member.techniques;

    ctx.fillStyle = '#4af';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TECHNIQUE', 14, 354);

    techs.forEach((tid, i) => {
      const tech = TECHNIQUES[tid];
      if (!tech) return;
      const y = 372 + i * 26;
      const sel = i === this.techMenuIndex;
      const canAfford = member.tp >= tech.tp;
      if (sel) {
        ctx.fillStyle = 'rgba(68,170,255,0.2)';
        ctx.fillRect(14, y - 14, 260, 20);
        ctx.fillStyle = canAfford ? '#fc0' : '#844';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(`▶ ${tech.name}   TP:${tech.tp}  ${tech.desc}`, 16, y);
      } else {
        ctx.fillStyle = canAfford ? '#aaa' : '#555';
        ctx.font = '13px monospace';
        ctx.fillText(`  ${tech.name}   TP:${tech.tp}  ${tech.desc}`, 16, y);
      }
    });

    ctx.fillStyle = 'rgba(100,140,180,0.6)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('X/ESC: Back', _w - 10, _h - 8);
  }

  private renderItemMenu(ctx: CanvasRenderingContext2D, _w: number, _h: number): void {
    const usable = this.getUsableItems();
    ctx.fillStyle = '#4af';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ITEM', 14, 354);

    if (usable.length === 0) {
      ctx.fillStyle = '#666';
      ctx.font = '13px monospace';
      ctx.fillText('No usable items.', 16, 374);
      return;
    }

    usable.forEach((slot, i) => {
      const item = this.allItems.find(it => it.id === slot.itemId);
      if (!item) return;
      const y = 372 + i * 26;
      const sel = i === this.itemMenuIndex;
      if (sel) {
        ctx.fillStyle = 'rgba(68,170,255,0.2)';
        ctx.fillRect(14, y - 14, 260, 20);
        ctx.fillStyle = '#fc0';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(`▶ ${item.name} x${slot.quantity}`, 16, y);
      } else {
        ctx.fillStyle = '#aaa';
        ctx.font = '13px monospace';
        ctx.fillText(`  ${item.name} x${slot.quantity}`, 16, y);
      }
    });
  }

  private renderTargetPrompt(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    ctx.fillStyle = '#4af';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    const msg = this.state === 'PLAYER_TARGET_ALLY' ? 'SELECT TARGET ALLY  ◄►' : 'SELECT TARGET  ◄►';
    ctx.fillText(msg, w / 2, 360);
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText('ENTER: Confirm   X: Cancel', w / 2, 380);
  }

  private renderEnemyTurnMsg(ctx: CanvasRenderingContext2D, w: number): void {
    if (!this.currentTurn) return;
    const enemy = this.enemies[this.currentTurn.index];
    if (!enemy) return;

    ctx.fillStyle = '#f44';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('— ENEMY PHASE —', w / 2, 348);

    const pulse = Math.sin(this.time * 6) * 0.3 + 0.7;
    ctx.fillStyle = '#f88';
    ctx.font = 'bold 13px monospace';
    ctx.globalAlpha = pulse;
    ctx.fillText(`${enemy.template.name} is acting...`, w / 2, 368);
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(140,140,160,0.75)';
    ctx.font = '10px monospace';
    ctx.fillText('Wait for your turn...', w / 2, 388);
  }

  private renderVictory(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, w, h);

    drawPanel(ctx, w / 2 - 160, h / 2 - 70, 320, 140);

    ctx.fillStyle = '#fc0';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', w / 2, h / 2 - 30);

    ctx.fillStyle = '#4f8';
    ctx.font = '14px monospace';
    ctx.fillText(`EXP: +${this.victoryExp}`, w / 2, h / 2);
    ctx.fillStyle = '#fa0';
    ctx.fillText(`MESETA: +${this.victoryMeseta}`, w / 2, h / 2 + 20);

    if (this.stateTimer > 2.5 && Math.floor(this.time / 0.5) % 2 === 0) {
      ctx.fillStyle = '#aaf';
      ctx.font = '12px monospace';
      ctx.fillText('Press ENTER to continue', w / 2, h / 2 + 48);
    }
  }

  private renderDefeat(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#f44';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', w / 2, h / 2 - 20);

    ctx.fillStyle = '#888';
    ctx.font = '13px monospace';
    ctx.fillText('Press ENTER to continue', w / 2, h / 2 + 20);
  }
}
