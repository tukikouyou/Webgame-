/* 战场弹珠:我方齐射(带合并)、我方/敌方弹珠物理与沿路径打格子(照搬原作的路径步进思路)。
   坐标是战场世界坐标:x = 列号 × cellPx,y ∈ [0, rows × cellPx)。 */
import { T } from '../config/tuning';
import type { GameState } from './types';
import { getCol, genEnd, capture, damageBoss, bossRegionStart } from './field';
import { cellHp } from './grid';
import { dmgValue, salvoMul } from './economy';
import { spark } from './fx';

export const MR = 3.5;          // 弹珠半径
export const BOSS_R = 16;
export const SHIELD_R = 26;

export function fieldHeightPx(): number { return T.rows * T.cellPx; }
export function cannonX(s: GameState): number { return (s.run.front - T.cannonBehind + 0.5) * T.cellPx; }

/* 一次齐射进入待发队列;按 salvoSeconds 打完,弹药多时每颗弹珠代表多发(合并) */
export function addSalvo(s: GameState, amount: number): void {
  const r = s.run;
  r.queue += amount;
  r.perMarble = Math.max(1, r.queue / (T.emitRate * T.salvoSeconds));
  r.firedAcc += amount;
  s.lastSalvo = { amount, t: 1.6 };
}

export function emitMarbles(s: GameState, h: number): void {
  const r = s.run;
  if (r.queue <= 0) return;
  r.emitAcc += T.emitRate * h;
  const dmgPer = dmgValue(s) * salvoMul(s);
  const cx = cannonX(s), cy = fieldHeightPx() / 2;
  while (r.emitAcc >= 1 && r.queue > 0) {
    if (s.marbles.length >= T.marbleCap) { r.emitAcc = 0; break; }
    r.emitAcc -= 1;
    const v = Math.min(r.perMarble, r.queue);
    r.queue -= v;
    const a = s.rng.range(-0.55, 0.55);
    const sp = T.marbleSpeed * s.rng.range(0.85, 1.15);
    s.marbles.push({ x: cx, y: cy + s.rng.range(-20, 20), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, v, dmg: v * dmgPer, life: T.marbleLife });
  }
  if (r.queue < 1e-9) { r.queue = 0; r.emitAcc = 0; }
}

export function updateMarbles(s: GameState, h: number): void {
  const r = s.run;
  const H = fieldHeightPx();
  const rightWall = Math.min(r.fieldEnd, genEnd(s)) * T.cellPx;
  const leftKill = cannonX(s) - 60;
  const damp = Math.exp(-T.marbleDampPerSec * h);
  const b = r.boss;
  const out = [];
  for (const m of s.marbles) {
    m.life -= h;
    m.vx *= damp; m.vy *= damp;
    const px = m.x, py = m.y;
    m.x += m.vx * h; m.y += m.vy * h;
    if (m.y < MR) { m.y = MR; m.vy = Math.abs(m.vy); }
    else if (m.y > H - MR) { m.y = H - MR; m.vy = -Math.abs(m.vy); }
    if (m.x > rightWall - MR) { m.x = rightWall - MR; m.vx = -Math.abs(m.vx); }

    let dead = false;
    const dx = m.x - px, dy = m.y - py;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (T.cellPx * 0.7)));
    let lci = -1e9, lcj = -1;
    for (let st = 1; st <= steps; st++) {
      const xx = px + dx * st / steps, yy = py + dy * st / steps;
      const ci = Math.floor(xx / T.cellPx);
      const cj = Math.min(T.rows - 1, Math.max(0, Math.floor(yy / T.cellPx)));
      if (ci === lci && cj === lcj) continue;
      lci = ci; lcj = cj;
      const col = getCol(s, ci);
      if (!col || col.o[cj] === 0) continue;
      const hp = col.hp[cj];
      if (m.dmg >= hp) {
        m.dmg -= hp;
        capture(s, ci, cj, col);
        if (s.rng.next() < 0.3) spark(s, xx, yy, '#8fc4ff');
        if (m.dmg <= 0) { dead = true; m.x = xx; m.y = yy; break; }
      } else {
        col.hp[cj] -= m.dmg;
        m.dmg = 0;
        dead = true;
        m.x = xx; m.y = yy;
        break;
      }
    }

    if (!dead && b && b.alive) {
      const bx = (b.col + 0.5) * T.cellPx, by = (b.row + 0.5) * T.cellPx;
      const d2 = (m.x - bx) * (m.x - bx) + (m.y - by) * (m.y - by);
      if (!b.shieldBroken && d2 < SHIELD_R * SHIELD_R) {
        dead = true; spark(s, m.x, m.y, '#ffffff');
      } else if (b.shieldBroken && d2 < BOSS_R * BOSS_R) {
        dead = true; spark(s, m.x, m.y, '#ffffff');
        damageBoss(s, m.dmg);
        if (!b.alive) return;   // boss 被击杀时已清场,不能再把本帧存活的弹珠写回去
      }
    }

    if (dead || m.life <= 0 || m.x < leftKill || m.vx * m.vx + m.vy * m.vy < 400) continue;
    out.push(m);
  }
  s.marbles = out;
}

/* ---- 敌方反推 ---- */
export function spawnEnemy(s: GameState, x: number, y: number, dmg: number): void {
  if (s.enemies.length >= T.enemyCap) return;
  const a = Math.PI + s.rng.range(-0.5, 0.5);
  const sp = T.enemySpeed * s.rng.range(0.85, 1.15);
  s.enemies.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg });
}

export function updateEnemies(s: GameState, h: number): void {
  const r = s.run;
  const end = genEnd(s);
  const H = fieldHeightPx();
  const b = r.boss;
  const inBoss = !!b && b.alive && r.front >= bossRegionStart(s);
  r.pushAcc += (inBoss ? T.pushBoss : T.pushNormal) * h;
  while (r.pushAcc >= 1) {
    r.pushAcc -= 1;
    const sc = Math.min(r.front + 30, end - 1);
    if (sc < r.front) break;
    spawnEnemy(s, (sc + 0.5) * T.cellPx, s.rng.range(MR, H - MR), cellHp(sc) * T.enemyDmgMul);
  }

  const leftKill = r.colBase * T.cellPx;
  const rightKill = end * T.cellPx + 40;
  const out = [];
  for (const e of s.enemies) {
    const px = e.x, py = e.y;
    e.x += e.vx * h; e.y += e.vy * h;
    if (e.y < MR) { e.y = MR; e.vy = Math.abs(e.vy); }
    else if (e.y > H - MR) { e.y = H - MR; e.vy = -Math.abs(e.vy); }
    if (e.x < leftKill || e.x > rightKill) continue;

    let dead = false;
    const dx = e.x - px, dy = e.y - py;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (T.cellPx * 0.7)));
    let lci = -1e9, lcj = -1;
    for (let st = 1; st <= steps; st++) {
      const xx = px + dx * st / steps, yy = py + dy * st / steps;
      const ci = Math.floor(xx / T.cellPx);
      const cj = Math.min(T.rows - 1, Math.max(0, Math.floor(yy / T.cellPx)));
      if (ci === lci && cj === lcj) continue;
      lci = ci; lcj = cj;
      const col = getCol(s, ci);
      if (!col) continue;
      if (col.o[cj] !== 0) {
        // 穿过被我方打残的己方格子:先把它补满,补多少就从这颗弹珠的伤害里扣多少
        const missing = cellHp(ci) - col.hp[cj];
        if (missing > 0) {
          const heal = Math.min(missing, e.dmg);
          col.hp[cj] += heal;
          e.dmg -= heal;
          if (e.dmg <= 0) { dead = true; break; }
        }
        continue;
      }
      const hp = col.hp[cj];
      if (e.dmg >= hp) {
        e.dmg -= hp;
        col.o[cj] = 1;
        col.hp[cj] = cellHp(ci);
        if (e.dmg <= 0) { dead = true; break; }
      } else {
        col.hp[cj] -= e.dmg;
        dead = true;
        break;
      }
    }
    if (!dead) out.push(e);
  }
  s.enemies = out;
}
