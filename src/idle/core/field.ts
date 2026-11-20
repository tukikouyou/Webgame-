/* 战场:列的生成与巩固、前线计算、区域能量结算、boss、金币收入。 */
import { T } from '../config/tuning';
import type { GameState, Column } from './types';
import { colInfo, cellHp, colsPerDim, regionValue, bossRegionNo } from './grid';
import { coinMul } from './economy';
import { toast, bigFlash } from './fx';

export function getCol(s: GameState, c: number): Column | null {
  const k = c - s.run.colBase;
  return k >= 0 && k < s.run.cols.length ? s.run.cols[k] : null;
}

/* 已生成列的末尾(不含) */
export function genEnd(s: GameState): number { return s.run.colBase + s.run.cols.length; }

export function ensureColumns(s: GameState): void {
  const r = s.run;
  ensureBoss(s);
  const target = Math.min(r.front + T.lookahead, r.fieldEnd);
  while (genEnd(s) < target) {
    const c = genEnd(s);
    const hp = cellHp(c);
    r.cols.push({ o: new Array(T.rows).fill(1), hp: new Array(T.rows).fill(hp) });
  }
}

/* 每一维开局就有 boss(位于当前维 boss 区),它负责发射全部敌方弹珠 */
function ensureBoss(s: GameState): void {
  const r = s.run;
  if (r.boss) return;
  const dim = Math.round(r.fieldEnd / colsPerDim());
  spawnBoss(s, dim, (dim - 1) * colsPerDim() + T.regionsPerDim * T.regionCols);
}

function spawnBoss(s: GameState, dim: number, regionStart: number): void {
  const hpMax = T.bossHpRatio * T.regionCols * T.rows * cellHp(regionStart);
  s.run.boss = {
    dim, col: regionStart + T.regionCols - 8, row: Math.floor(T.rows / 2),
    hp: hpMax, hpMax, shieldBroken: false, alive: true, p: 0, fireAcc: 0, bestP: 0, bestHp: 1,
  };
}

/* 占领一格:归我、回满我方格子血量、发占领奖励 */
export function capture(s: GameState, c: number, row: number, col: Column): void {
  const hp = cellHp(c);
  col.o[row] = 0;
  col.hp[row] = hp;
  s.run.coins += hp * T.bountyMul * coinMul(s);
}

export function updateFront(s: GameState, h: number): void {
  const r = s.run;
  const end = genEnd(s);
  let f = r.colBase;
  while (f < end) {
    const col = r.cols[f - r.colBase];
    let mine = 0;
    for (let k = 0; k < T.rows; k++) if (col.o[k] === 0) mine++;
    if (mine / T.rows < T.frontRatio) break;
    f++;
  }
  r.front = f;
  if (f > r.maxFront) { r.maxFront = f; r.sinceRecord = 0; } else r.sinceRecord += h;

  awardRegions(s);
  consolidate(s);

  // 前线速度(列/分钟),每 2 秒采样一次
  r.speedAcc += h;
  if (r.speedAcc >= 2) {
    const v = (r.front - r.speedPrevFront) / r.speedAcc * 60;
    r.frontSpeed = r.frontSpeed * 0.6 + v * 0.4;
    r.speedPrevFront = r.front;
    r.speedAcc = 0;
  }
}

/* 前线越过一个普通区 → 计入转生能量(boss 区在击毁时结算) */
function awardRegions(s: GameState): void {
  const r = s.run;
  while ((r.awardedRegion + 1) * T.regionCols <= r.front) {
    const info = colInfo(r.awardedRegion * T.regionCols);
    if (!info.isBoss) r.clearedValue += regionValue(info.dim, info.region);
    r.awardedRegion++;
  }
}

/* 前线后方超过争夺区的列 → 巩固:残留敌格投降,收入并入累计值,不再存格子 */
function consolidate(s: GameState): void {
  const r = s.run;
  while (r.front - r.colBase > T.bandCols && r.cols.length) {
    const c = r.colBase;
    const col = r.cols.shift()!;
    for (let k = 0; k < T.rows; k++) if (col.o[k] !== 0) capture(s, c, k, col);
    r.consolidatedIncome += T.rows * T.incomeRate * cellHp(c);
    r.colBase++;
  }
}

/* ---- boss ---- */
export function bossRegionStart(s: GameState): number {
  const b = s.run.boss;
  return b ? colInfo(b.col).regionStart : Infinity;
}

export function updateBoss(s: GameState, h: number, spawnEnemy: (x: number, y: number) => void): void {
  const r = s.run;
  const b = r.boss;
  if (!b || !b.alive) return;
  const start = bossRegionStart(s);
  let enemy = 0;
  for (let c = start; c < start + T.regionCols; c++) {
    const col = getCol(s, c);
    if (!col) { if (c >= genEnd(s)) enemy += T.rows; continue; }
    for (let k = 0; k < T.rows; k++) if (col.o[k] !== 0) enemy++;
  }
  const total = T.regionCols * T.rows;
  b.p = 1 - enemy / total;
  b.hp = Math.min(b.hpMax, b.hp + T.bossRegen * b.hpMax * h);
  // boss 战里前线不动,但占领比例上升或血量下降也算有进展(避免误判撞墙)
  const hpFrac = b.hp / b.hpMax;
  if (b.p > b.bestP + 0.01 || hpFrac < b.bestHp - 0.01) {
    b.bestP = Math.max(b.bestP, b.p);
    b.bestHp = Math.min(b.bestHp, hpFrac);
    r.sinceRecord = 0;
  }
  if (!b.shieldBroken && enemy / total <= T.bossShieldRatio) {
    b.shieldBroken = true;
    toast(s, '🛡 boss 护盾破除!', '#ffffff');
  }
  // 从每一维开局就开火,发射数随前线所在的区递增;前线进入 boss 区后用 boss 区火力
  const region = colInfo(Math.min(r.front, r.fieldEnd - 1)).region;
  const rate = r.front >= start ? T.bossFire : T.bossFireBase + T.bossFireStep * (region - 1);
  b.fireAcc += rate * h;
  while (b.fireAcc >= 1) {
    b.fireAcc -= 1;
    spawnEnemy((b.col + 0.5) * T.cellPx, (b.row + 0.5) * T.cellPx);
  }
}

export function damageBoss(s: GameState, dmg: number): void {
  const b = s.run.boss;
  if (!b || !b.alive || !b.shieldBroken) return;
  b.hp -= dmg;
  if (b.hp <= 0) killBoss(s);
}

/* 击毁 boss → 升维:boss 区残格投降,战场延伸到下一维,本轮继续 */
function killBoss(s: GameState): void {
  const r = s.run;
  const b = r.boss!;
  b.alive = false;
  const start = bossRegionStart(s);
  for (let c = start; c < start + T.regionCols; c++) {
    const col = getCol(s, c);
    if (col) for (let k = 0; k < T.rows; k++) if (col.o[k] !== 0) capture(s, c, k, col);
  }
  r.clearedValue += regionValue(b.dim, bossRegionNo()) + T.energyBossKill * regionValue(b.dim, 1);
  r.fieldEnd = (b.dim + 1) * colsPerDim();
  const nd = b.dim + 1;
  r.boss = null;
  s.marbles = [];          // 打过 boss 清场:场上弹珠和还没打完的待发齐射都清掉
  s.enemies = [];
  r.queue = 0;
  r.emitAcc = 0;
  if (nd > s.epoch.maxDim) s.epoch.maxDim = nd;
  if (nd > s.legacy.everDim) s.legacy.everDim = nd;
  bigFlash(s, '升维 → ' + nd + ' 维');
  toast(s, '击败 ' + b.dim + ' 维 boss!进入 ' + nd + ' 维', '#ffffff');
}

/* ---- 金币收入(每秒,已乘倍率) ---- */
export function incomePerSec(s: GameState): number {
  const r = s.run;
  let sum = r.consolidatedIncome;
  for (let i = 0; i < r.cols.length; i++) {
    const col = r.cols[i];
    let mine = 0;
    for (let k = 0; k < T.rows; k++) if (col.o[k] === 0) mine++;
    if (mine) sum += mine * T.incomeRate * cellHp(r.colBase + i);
  }
  return sum * coinMul(s);
}
