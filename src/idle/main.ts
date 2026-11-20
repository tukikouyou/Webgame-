/* 《弹珠升维》demo 入口:建 state、读档、接面板、跑主循环(每帧分步模拟 + 渲染)、定时存档。 */
import { createState } from './core/state';
import { step } from './core/step';
import { render } from './render/renderer';
import { initPanel, type PanelApp } from './ui/panel';
import { loadGame, saveGame, clearSave } from './ui/save';
import * as eco from './core/economy';
import * as pre from './core/prestige';
import * as cards from './core/cards';
import { T } from './config/tuning';

const cv = document.getElementById('cv') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;

const SUBSTEP = 0.016;
const MAX_SUBSTEPS = 120;      // ×30 倍速时每帧最多模拟约 1.9 秒

const app: PanelApp = {
  state: createState(Date.now() >>> 0),
  speed: 1,
  paused: false,
  resetAll() {
    clearSave();
    this.state = createState(Date.now() >>> 0);
  },
  save() { saveGame(this.state); },
};
loadGame(app.state);
initPanel(app);

if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
  (window as unknown as Record<string, unknown>).__idle = { app, step, eco, pre, cards, T, renderNow: () => render(ctx, app.state) };
}

let prev = performance.now();
let saveAcc = 0;
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - prev) / 1000);
  prev = now;
  if (!app.paused) {
    const sim = dt * app.speed;
    const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(sim / SUBSTEP)));
    const h = sim / steps;
    for (let i = 0; i < steps; i++) step(app.state, h);
  }
  render(ctx, app.state);
  saveAcc += dt;
  if (saveAcc >= 5) { saveAcc = 0; app.save(); }
}
requestAnimationFrame(frame);
window.addEventListener('beforeunload', () => app.save());
