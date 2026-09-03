/* 入口:拿 canvas/ctx、建 state、接 UI、跑 RAF 主循环。
   逻辑(core)、渲染(render)、界面(ui)三层在这里汇合。
   局外存档(meta)在 main 层持久化:localStorage 读写只发生在这里。 */
import type { App } from './appTypes';
import { createState, resetState } from './core/state';
import { step } from './core/step';
import { slotEffect } from './core/plinko';
import { triggerSkill } from './core/wheel';
import { ultimateSkill } from './core/ultimate';
import { render } from './render/renderer';
import { initControls, setPaused } from './ui/controls';
import { initSetup } from './ui/setup';
import { initDebug } from './ui/debug';
import { loadMeta, saveMeta } from './ui/metaStore';
import { initInterlude } from './ui/interlude';
import { settleVictory, finalWave } from './core/meta';
import { respawnEnemies } from './core/wave';
import { waveChoices, type Choice } from './core/events';
import { toast } from './core/fx';
import { applyDamage } from './core/damage';
import { TEAMS, LOOP_MAX_DT, LOOP_SUBSTEP, LOOP_MAX_SUBSTEPS } from './config/config';

const cv = document.getElementById('cv') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;

const meta = loadMeta();

const app: App = {
  state: createState(Date.now()),
  meta,
  paused: true,
  speed: 1,
  newGame() {
    resetState(this.state, this.meta, Date.now());
    setPaused(this, false);
  },
  openSetup() { /* 由 initSetup 覆写 */ },
  openShop() { /* 由 initInterlude 覆写 */ },
  rebuildDebug() { /* 由 initDebug 覆写 */ },
  onMetaChanged() { saveMeta(this.meta); },
  interlude: null as any,
};

const interlude = initInterlude(app);
app.interlude = interlude;
app.openShop = interlude.openShop;

const openSetup = initSetup(app);
app.openSetup = openSetup;
const dbg = initDebug(app);
app.rebuildDebug = dbg.rebuild;
initControls(app, openSetup, dbg.open);

/* ---- 波次 / 胜负编排 ----
   淘汰事件由 core/wave.onElimination 判定并写入 s.elimResult,
   main 每帧消费:玩家击杀 AI → 波次+三选一;AI 互杀 → 仅播报不推进。 */
let settleShown = false;
const FINAL_WAVE = finalWave();   // 整局共多少波,清空即通关

// 整局通关结算
function finalVictory(): void {
  const s = app.state, m = app.meta;
  settleShown = true;
  s.gameOver = true; s.winner = s.cannons[s.playerIdx];
  const ups = settleVictory(s, m);
  saveMeta(m);
  toast(s, '🏆 通关!清空全部 ' + FINAL_WAVE + ' 波' + (ups ? ' · 升级 ' + ups + ' 级!' : ''), TEAMS[s.playerIdx].ball);
}

// 本波是否已清空(只剩玩家):是→推进下一波(复活强化)或整局通关
function advanceIfCleared(): void {
  const s = app.state, m = app.meta;
  if (settleShown) return;
  if (s.cannons.some(c => c.alive && c.idx !== s.playerIdx)) return;   // 还有 AI 活着,本波未清
  if (s.wave >= FINAL_WAVE) { finalVictory(); return; }
  s.wave++;
  respawnEnemies(s, m);   // 敌方复活并逐波强化
  saveMeta(m);
}

function orchestrate(): void {
  const s = app.state;
  const m = app.meta;
  if (s.gameOver) return;

  // 玩家被淘汰 → 整局失败(局外成长保留)
  if (!s.cannons[s.playerIdx].alive && !settleShown) {
    settleShown = true;
    s.gameOver = true; s.winner = null;
    m.coins += 1;   // 安慰奖
    toast(s, '☠ 你的炮台被摧毁了……局外成长保留,再战!', '#ff8080');
    saveMeta(m);
    return;
  }

  // 消费淘汰事件:玩家击杀 AI → 三选一奖励
  while (s.elimResult) {
    const res = s.elimResult; s.elimResult = null;
    if (res === 'kill') {
      const c = s.cannons[s.playerIdx];
      const choices: Choice[] = waveChoices(s, c, s.rng.next);
      setPaused(app, true);
      interlude.openChoice(s.wave, choices, ch => {
        ch.apply(s, c);
        advanceIfCleared();                       // 若这一杀清空了本波:复活下一波或通关
        if (!s.gameOver) setPaused(app, false);   // 未通关则继续对战
      });
      return;
    }
    // 'aiKill':不给奖励;若因此清空本波,由下方统一推进
  }
  advanceIfCleared();
}

/* ---- 主循环 ---- */
// 开局先弹出选择界面(此时暂停);meta 套用在新局时发生
resetState(app.state, meta);
app.paused = true;
openSetup();

// 开发期调试钩子:便于无头环境手动驱动/采样(生产构建不含)
if ((import.meta as any).env?.DEV) {
  (window as any).__marble = { app, step, render, ctx, slotEffect, triggerSkill, ultimateSkill, waveChoices, orchestrate, advanceIfCleared, applyDamage };
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
    orchestrate();
  }
  render(ctx, app.state);
}
requestAnimationFrame(frame);
