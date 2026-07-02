/* 入口:拿 canvas/ctx、建 state、接 UI、跑 RAF 主循环。
   逻辑(core)、渲染(render)、界面(ui)三层在这里汇合。 */
import type { App } from './appTypes';
import { createState, resetState } from './core/state';
import { step } from './core/step';
import { render } from './render/renderer';
import { initControls, setPaused } from './ui/controls';
import { initSetup } from './ui/setup';
import { initDebug } from './ui/debug';
import { LOOP_MAX_DT, LOOP_SUBSTEP, LOOP_MAX_SUBSTEPS } from './config/config';

const cv = document.getElementById('cv') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;

const app: App = {
  state: createState(Date.now()),
  paused: false,
  speed: 1,
  newGame() { resetState(this.state, Date.now()); setPaused(app, false); },
  openSetup() { /* 由 initSetup 覆写 */ },
  rebuildDebug() { /* 由 initDebug 覆写 */ },
};

const openSetup = initSetup(app);
app.openSetup = openSetup;
const dbg = initDebug(app);
app.rebuildDebug = dbg.rebuild;
initControls(app, openSetup, dbg.open);

// 开局先弹出选择界面(此时暂停)
openSetup();

// 开发期调试钩子:便于无头环境手动驱动/采样(生产构建不含)
if ((import.meta as any).env?.DEV) {
  (window as any).__marble = { app, step, render, ctx };
}

let prev = performance.now();
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(LOOP_MAX_DT, (now - prev) / 1000);
  prev = now;
  if (!app.paused) {
    const sim = dt * app.speed;
    const steps = Math.min(LOOP_MAX_SUBSTEPS, Math.max(1, Math.ceil(sim / LOOP_SUBSTEP)));
    const h = sim / steps;
    for (let i = 0; i < steps; i++) step(app.state, h);
  }
  render(ctx, app.state);
}
requestAnimationFrame(frame);
