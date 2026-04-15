import { InputManager } from './InputManager.ts';

export type GameScreen = 'title' | 'overworld' | 'battle' | 'menu' | 'dialogue';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private input: InputManager;
  private currentScreen: GameScreen = 'title';
  private running = false;
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D rendering context');
    this.ctx = ctx;
    this.input = new InputManager();
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.input.attach();
    requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    this.running = false;
    this.input.detach();
  }

  private loop(time: number): void {
    if (!this.running) return;

    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    // Update current screen logic based on this.currentScreen
    // Each screen will have its own update method
    void dt;
  }

  private render(): void {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    switch (this.currentScreen) {
      case 'title':
        this.renderTitle();
        break;
      default:
        break;
    }
  }

  private renderTitle(): void {
    const { ctx, canvas } = this;

    // Title text
    ctx.fillStyle = '#4af';
    ctx.font = '48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STARFALL', canvas.width / 2, canvas.height / 2 - 40);

    ctx.fillStyle = '#8df';
    ctx.font = '28px monospace';
    ctx.fillText('CHRONICLES', canvas.width / 2, canvas.height / 2 + 10);

    // Blinking prompt
    if (Math.floor(performance.now() / 600) % 2 === 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.fillText('Press ENTER to start', canvas.width / 2, canvas.height / 2 + 80);
    }
  }

  setScreen(screen: GameScreen): void {
    this.currentScreen = screen;
  }

  getScreen(): GameScreen {
    return this.currentScreen;
  }
}
