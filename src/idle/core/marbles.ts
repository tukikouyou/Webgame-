/* 战场弹珠:我方齐射(带合并)、我方/敌方弹珠物理与沿路径打格子(照搬原作的路径步进思路)。
   坐标是战场世界坐标:x = 列号 × cellPx,y ∈ [0, rows × cellPx)。 */
import { T } from '../config/tuning';
import type { GameState } from './types';
import { getCol, genEnd, capture, damageBoss, bossY } from './field';
import { cellHp } from './grid';
import { dmgValue, salvoMul } from './economy';
import { spark } from './fx';

export const MR = 3.5;          // 弹珠半径
export const BOSS_R = 24;       // boss 在墙上,飞到墙且离 boss 中心 ±BOSS_R 以内的弹珠算命中
export const SHIELD_R = 30;

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
  const b = r.boss;
  const out = [];
  for (const m of s.marbles) {
    m.life -= h;
    const px = m.x, py = m.y;
    m.x += m.vx * h; m.y += m.vy * h;
    if (m.y < MR) { m.y = MR; m.vy = Math.abs(m.vy); }
    else if (m.y > H - MR) { m.y = H - MR; m.vy = -Math.abs(m.vy); }
    const atWall = m.x > rightWall - MR;
    if (atWall) m.x = rightWall - MR;

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

    // boss 在 boss 区右端的墙上:普通 boss 整面墙都算命中(或被护盾挡下);
    // 圆形碰撞的 boss 只有飞到墙且正好在 boss 那几行的弹珠才算
    if (!dead && atWall) {
      const hitBand = b && b.alive && rightWall >= r.fieldEnd * T.cellPx
        && (!b.circle || Math.abs(m.y - bossY(b)) < (b.shieldBroken ? BOSS_R : SHIELD_R));
      if (hitBand && b) {
        dead = true; spark(s, m.x, m.y, '#ffffff');
        if (b.shieldBroken) {
          damageBoss(s, m.dmg);
          if (!b.alive) return;   // boss 被击杀时已清场,不能再把本帧存活的弹珠写回去
        }
      } else m.vx = -Math.abs(m.vx);
    }

    if (dead || m.life <= 0 || m.x < leftKill) continue;
    out.push(m);
  }
  s.marbles = out;
}

/* ---- 敌方弹珠(全部由 boss 发射) ----
   power 以「所在区一格满血」为单位:飞进哪个区,实际伤害就按那个区的格子血量换算 */
export function spawnEnemy(s: GameState, x: number, y: number): void {
  if (s.enemies.length >= T.enemyCap) return;
  const a = Math.PI + s.rng.range(-0.5, 0.5);
  const sp = T.enemySpeed * s.rng.range(0.85, 1.15);
  s.enemies.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, power: T.enemyDmgMul });
}

export function updateEnemies(s: GameState, h: number): void {
  const r = s.run;
  const H = fieldHeightPx();
  const leftKill = r.colBase * T.cellPx;
  const rightKill = r.fieldEnd * T.cellPx + 40;
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
      const unit = cellHp(ci);
      const avail = e.power * unit;
      if (col.o[cj] !== 0) {
        // 穿过被我方打残的己方格子:先把它补满,补多少就从这颗弹珠的威力里扣多少
        const missing = unit - col.hp[cj];
        if (missing > 0) {
          const heal = Math.min(missing, avail);
          col.hp[cj] += heal;
          e.power -= heal / unit;
          if (e.power <= 1e-9) { dead = true; break; }
        }
        continue;
      }
      const hp = col.hp[cj];
      if (avail >= hp) {
        e.power -= hp / unit;
        col.o[cj] = 1;
        col.hp[cj] = unit;
        if (e.power <= 1e-9) { dead = true; break; }
      } else {
        col.hp[cj] -= avail;
        dead = true;
        break;
      }
    }
    if (!dead) out.push(e);
  }
  s.enemies = out;
}
