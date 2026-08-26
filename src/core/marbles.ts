/* 功能区 1(弹珠部分):普通小球物理、撞墙/护盾/挡板/格子/炮台结算、相位碰撞。 */
import type { GameState, Marble } from './types';
import { spark } from './fx';
import { setCell, markCell } from './grid';
import { applyMagnet, shielded, hitShield, guardHit, applyDamage } from './damage';
import {
  TEAMS, N, BX, BY, BS, CS, MR, SHIELD_R, CANNON_HIT_R, CANNON_DMG_CD, MARBLE_MIN_SPEED2,
} from '../config/config';
import { waveEnemyDmgMul } from './meta';

export function phaseWallKick(s: GameState, m: Marble): void {
  if (s.rng.next() < 0.25) {
    const sp = Math.hypot(m.vx, m.vy);
    const a = Math.atan2(m.vy, m.vx) + s.rng.range(-0.9, 0.9);
    m.vx = Math.cos(a) * sp; m.vy = Math.sin(a) * sp;
  }
}

export function updateMarbles(s: GameState, h: number): void {
  // 复活炮台的"清场"延迟处理
  for (const c of s.cannons) {
    if (c.purge) {
      s.marbles = s.marbles.filter(m => m.c !== c.idx);
      s.counts[c.idx] = 0;
      c.purge = false;
    }
  }
  const out: Marble[] = [];
  for (const m of s.marbles) {
    if (!s.cannons[m.c].alive) continue;
    if (m.hp == null) m.hp = 1;
    const owner = s.cannons[m.c];
    const isPhase = owner.trait === 'phase';
    if (!isPhase) {
      const damp = Math.pow(s.cfg.damp[m.c], h);
      m.vx *= damp; m.vy *= damp;
    }
    applyMagnet(s, m, h, 1);
    const px = m.x, py = m.y;
    m.x += m.vx * h; m.y += m.vy * h;
    // 撞墙反弹(相位弹珠撞墙 25% 概率改变角度)
    if (m.x < BX + MR) { m.x = BX + MR; m.vx = Math.abs(m.vx); if (isPhase) phaseWallKick(s, m); }
    else if (m.x > BX + BS - MR) { m.x = BX + BS - MR; m.vx = -Math.abs(m.vx); if (isPhase) phaseWallKick(s, m); }
    if (m.y < BY + MR) { m.y = BY + MR; m.vy = Math.abs(m.vy); if (isPhase) phaseWallKick(s, m); }
    else if (m.y > BY + BS - MR) { m.y = BY + BS - MR; m.vy = -Math.abs(m.vy); if (isPhase) phaseWallKick(s, m); }
    // 敌方护盾
    let dead = false;
    for (const cn of s.cannons) {
      if (cn.alive && shielded(cn) && cn.idx !== m.c) {
        const ax = m.x - cn.x, ay = m.y - cn.y;
        if (ax * ax + ay * ay < (SHIELD_R + MR) * (SHIELD_R + MR)) {
          dead = true;
          hitShield(cn);
          spark(s, m.x, m.y, TEAMS[m.c].ball);
          break;
        }
      }
    }
    // 敌方环卫挡板
    if (!dead && guardHit(s, m.x, m.y, m.c, MR, Math.max(1, m.hp))) {
      dead = true; spark(s, m.x, m.y, TEAMS[m.c].ball);
    }
    // 沿路径攻击非己方格子
    if (!dead) {
      const dx = m.x - px, dy = m.y - py;
      const d = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(d / (CS * 0.7)));
      let lci = -1, lcj = -1;
      for (let st = 1; st <= steps; st++) {
        const xx = px + dx * st / steps, yy = py + dy * st / steps;
        const ci = ((xx - BX) / CS) | 0, cj = ((yy - BY) / CS) | 0;
        if (ci < 0 || cj < 0 || ci >= N || cj >= N) continue;
        if (ci === lci && cj === lcj) continue;
        lci = ci; lcj = cj;
        if (s.cells[cj * N + ci] !== m.c) {
          const cellLife = s.cellHp[cj * N + ci];
          if (m.hp >= cellLife) {
            m.hp -= cellLife;
            setCell(s, ci, cj, m.c, 1);
            spark(s, xx, yy, TEAMS[m.c].ball);
            m.x = xx; m.y = yy;
            if (m.hp <= 0) { dead = true; break; }
          } else {
            s.cellHp[cj * N + ci] -= m.hp;
            markCell(s, ci, cj);
            m.hp = 0; m.x = xx; m.y = yy;
            dead = true;
            break;
          }
        }
      }
    }
    // 撞敌方炮台
    if (!dead) {
      for (const c of s.cannons) {
        if (!c.alive || c.idx === m.c) continue;
        const ax = m.x - c.x, ay = m.y - c.y;
        if (ax * ax + ay * ay < CANNON_HIT_R * CANNON_HIT_R) {
          dead = true;
          if (c.dmgCd <= 0) {
            c.dmgCd = CANNON_DMG_CD;
            spark(s, m.x, m.y, TEAMS[m.c].ball);
            applyDamage(s, c, waveEnemyDmgMul(s) * Math.max(1, m.hp), m.c);
          }
          break;
        }
      }
    }
    const sp2 = m.vx * m.vx + m.vy * m.vy;
    if (dead || (!isPhase && sp2 < MARBLE_MIN_SPEED2 * MARBLE_MIN_SPEED2)) { s.counts[m.c]--; continue; }
    out.push(m);
  }
  s.marbles = out;
  resolvePhaseCollisions(s);
}

// 相位弹珠可与敌方弹珠碰撞:互相抵消生命(空间哈希加速)
function resolvePhaseCollisions(s: GameState): void {
  const phase: Marble[] = [];
  for (const m of s.marbles) {
    if (s.cannons[m.c].trait === 'phase') phase.push(m);
  }
  if (!phase.length) return;

  const dead = new Set<Marble>();
  const cellSize = MR * 2.5;
  const buckets = new Map<string, Marble[]>();
  const key = (gx: number, gy: number) => gx + ',' + gy;

  for (const m of s.marbles) {
    const gx = Math.floor((m.x - BX) / cellSize);
    const gy = Math.floor((m.y - BY) / cellSize);
    const k = key(gx, gy);
    let arr = buckets.get(k);
    if (!arr) { arr = []; buckets.set(k, arr); }
    arr.push(m);
  }

  const rr = MR * 2;
  const rr2 = rr * rr;

  for (const p of phase) {
    if (dead.has(p)) continue;
    const gx = Math.floor((p.x - BX) / cellSize);
    const gy = Math.floor((p.y - BY) / cellSize);
    for (let yy = gy - 1; yy <= gy + 1; yy++) {
      for (let xx = gx - 1; xx <= gx + 1; xx++) {
        const arr = buckets.get(key(xx, yy));
        if (!arr) continue;
        for (const m of arr) {
          if (m === p || m.c === p.c || dead.has(m)) continue;
          const dx = p.x - m.x, dy = p.y - m.y;
          if (dx * dx + dy * dy < rr2) {
            const lo = Math.min(p.hp, m.hp);
            spark(s, (p.x + m.x) / 2, (p.y + m.y) / 2, '#fff');
            p.hp -= lo; m.hp -= lo;
            if (m.hp <= 0) dead.add(m);
            if (p.hp <= 0) { dead.add(p); break; }
          }
        }
        if (dead.has(p)) break;
      }
      if (dead.has(p)) break;
    }
  }

  if (dead.size) {
    s.marbles = s.marbles.filter(m => {
      if (dead.has(m)) { s.counts[m.c]--; return false; }
      return true;
    });
  }
}
