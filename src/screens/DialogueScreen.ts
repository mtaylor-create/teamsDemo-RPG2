import type { GameContext } from '../engine/Game.ts';
import type { InputManager } from '../engine/InputManager.ts';
import type { DialogueNode } from '../engine/types.ts';
import { drawPanel } from '../ui/Panel.ts';

const CHAR_DELAY = 0.028; // seconds per character
const PORTRAIT_COLORS: Record<string, string> = {
  kael: '#c84',
  lyra: '#68c',
  ariel: '#4ca',
  shadowwarden: '#a22',
};

export class DialogueScreen {
  private gctx: GameContext;
  private nodes: Map<string, DialogueNode>;
  private currentNode: DialogueNode | null = null;
  private lineIndex = 0;
  private charIndex = 0;
  private charTimer = 0;
  private typingDone = false;
  private onComplete: () => void;
  private selectedChoice = 0;
  private bgStars: { x: number; y: number; b: number }[] = [];
  private time = 0;

  constructor(
    gctx: GameContext,
    nodes: Map<string, DialogueNode>,
    startNodeId: string,
    onComplete: () => void
  ) {
    this.gctx = gctx;
    this.nodes = nodes;
    this.onComplete = onComplete;
    this.goToNode(startNodeId);

    const { width, height } = gctx.canvas;
    for (let i = 0; i < 80; i++) {
      this.bgStars.push({ x: Math.random() * width, y: Math.random() * height, b: Math.random() });
    }
  }

  private goToNode(id: string): void {
    const node = this.nodes.get(id);
    if (!node || node.lines.length === 0) {
      this.onComplete();
      return;
    }
    this.currentNode = node;
    this.lineIndex = 0;
    this.charIndex = 0;
    this.charTimer = 0;
    this.typingDone = false;
    this.selectedChoice = 0;
  }

  private currentLine() {
    return this.currentNode?.lines[this.lineIndex] ?? null;
  }

  update(dt: number, input: InputManager): void {
    this.time += dt;
    if (!this.currentNode) return;

    const line = this.currentLine();
    if (!line) return;

    const fullText = line.text;

    // Typing animation
    if (!this.typingDone) {
      this.charTimer += dt;
      const charsToShow = Math.floor(this.charTimer / CHAR_DELAY);
      this.charIndex = Math.min(charsToShow, fullText.length);
      if (this.charIndex >= fullText.length) this.typingDone = true;
    }

    const confirmPressed = input.wasPressed('Enter') || input.wasPressed('Space') || input.wasPressed('KeyZ');

    if (confirmPressed) {
      if (!this.typingDone) {
        // Skip typewriter
        this.charIndex = fullText.length;
        this.typingDone = true;
        return;
      }

      const node = this.currentNode;

      // If showing choices on last line
      if (node.choices && this.lineIndex >= node.lines.length - 1) {
        const chosen = node.choices[this.selectedChoice];
        if (chosen) {
          if (chosen.next === 'end') { this.onComplete(); return; }
          this.goToNode(chosen.next);
        }
        return;
      }

      // Advance line
      if (this.lineIndex + 1 < node.lines.length) {
        this.lineIndex++;
        this.charIndex = 0;
        this.charTimer = 0;
        this.typingDone = false;
      } else {
        // Advance to next node
        if (node.next) {
          if (node.next === 'end') { this.onComplete(); return; }
          this.goToNode(node.next);
        } else {
          this.onComplete();
        }
      }
    }

    // Choice navigation
    if (this.typingDone && this.currentNode.choices) {
      if (input.wasPressed('ArrowUp')) this.selectedChoice = Math.max(0, this.selectedChoice - 1);
      if (input.wasPressed('ArrowDown')) {
        const max = (this.currentNode.choices.length - 1);
        this.selectedChoice = Math.min(max, this.selectedChoice + 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.gctx.canvas;

    // Background — richer starfield
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#060a1e');
    grad.addColorStop(1, '#040814');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    for (const s of this.bgStars) {
      const alpha = 0.3 + s.b * 0.5 * (0.8 + 0.2 * Math.sin(this.time + s.x));
      ctx.fillStyle = `rgba(190,220,255,${alpha})`;
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
    }

    // Crash site silhouette
    this.renderCrashScene(ctx, width, height);

    if (!this.currentNode) return;
    const line = this.currentLine();
    if (!line) return;

    const isNarration = !line.speaker;
    const boxY = height - 160;
    const boxH = 150;
    const boxX = 10;
    const boxW = width - 20;

    // Portrait box
    if (!isNarration && line.speaker) {
      const color = PORTRAIT_COLORS[line.portrait ?? ''] ?? '#666';
      drawPanel(ctx, boxX, boxY - 72, 64, 64);
      // Portrait rectangle
      ctx.fillStyle = color;
      ctx.fillRect(boxX + 4, boxY - 68, 56, 56);
      // Character initial
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText((line.speaker[0] ?? '?'), boxX + 32, boxY - 36);
    }

    // Main dialogue box
    drawPanel(ctx, boxX, boxY, boxW, boxH);

    // Speaker name
    if (line.speaker) {
      ctx.fillStyle = '#fc0';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(line.speaker, boxX + 10, boxY + 22);
    }

    // Dialogue text (with word wrap)
    const textY = isNarration ? boxY + 22 : boxY + 40;
    const textColor = line.emotion === 'narration' ? '#9bf' :
      line.emotion === 'title' ? '#fd2' : '#eef';

    ctx.fillStyle = textColor;
    const fontSize = line.emotion === 'title' ? 16 : 13;
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = line.emotion === 'title' ? 'center' : 'left';

    const displayText = line.text.substring(0, this.charIndex);
    const textX = line.emotion === 'title' ? width / 2 : boxX + 10;
    this.wrapText(ctx, displayText, textX, textY, boxW - 20, 18);

    // Advance indicator (blinking arrow)
    if (this.typingDone && !this.currentNode?.choices) {
      if (Math.floor(this.time / 0.4) % 2 === 0) {
        ctx.fillStyle = '#4af';
        ctx.font = '12px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('▼', boxX + boxW - 10, boxY + boxH - 10);
      }
    }

    // Choices
    if (this.typingDone && this.currentNode?.choices && this.lineIndex >= (this.currentNode.lines.length - 1)) {
      const choices = this.currentNode.choices;
      const choiceBoxY = boxY - (choices.length * 28 + 16);
      drawPanel(ctx, width - 220, choiceBoxY, 210, choices.length * 28 + 14);
      choices.forEach((c, i) => {
        const cy = choiceBoxY + 10 + i * 28;
        if (i === this.selectedChoice) {
          ctx.fillStyle = 'rgba(68,170,255,0.2)';
          ctx.fillRect(width - 218, cy, 206, 24);
          ctx.fillStyle = '#fc0';
          ctx.font = 'bold 13px monospace';
          ctx.textAlign = 'left';
          ctx.fillText('▶ ' + c.text, width - 210, cy + 16);
        } else {
          ctx.fillStyle = '#aaa';
          ctx.font = '13px monospace';
          ctx.textAlign = 'left';
          ctx.fillText('  ' + c.text, width - 210, cy + 16);
        }
      });
    }
  }

  private renderCrashScene(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const groundY = height - 175;

    // Ground
    ctx.fillStyle = '#121824';
    ctx.fillRect(0, groundY, width, 20);

    // Crashed ship — tilted metallic shape, brighter
    ctx.save();
    ctx.translate(440, groundY - 40);
    ctx.rotate(0.15);
    ctx.fillStyle = '#283850';
    ctx.fillRect(-90, -30, 180, 45);
    ctx.fillStyle = '#1a2538';
    ctx.fillRect(-70, -50, 60, 25);
    // Amber emergency light
    const flickerAlpha = 0.5 + 0.5 * Math.sin(this.time * 4.5);
    ctx.fillStyle = `rgba(255, 160, 20, ${flickerAlpha})`;
    ctx.fillRect(40, -20, 8, 8);
    ctx.restore();

    // Trees / rocks silhouette — slightly brighter
    for (let i = 0; i < 6; i++) {
      const tx = 30 + i * 100;
      ctx.fillStyle = '#0a1018';
      ctx.fillRect(tx, groundY - 30, 12, 35);
      ctx.beginPath();
      ctx.moveTo(tx - 10, groundY - 28);
      ctx.lineTo(tx + 6, groundY - 60);
      ctx.lineTo(tx + 22, groundY - 28);
      ctx.closePath();
      ctx.fill();
    }
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        currentY += lineHeight;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, currentY);
  }
}
