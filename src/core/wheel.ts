/* 功能区 3(上半):普通技能转盘 —— 内圈弹跳 → 底部小口 → 旋转技能环触发技能。 */
import type { GameState, WheelBall } from './types';
import { toast, explosion } from './fx';
import { norm } from './util';
import { fmt } from './util';
import { fireBomb, fireHoming } from './projectiles';
import {
  TEAMS, AMMO_CAP,
  WX, WY, WX2, WY2, WR, IR, GAP_HALF, SMALL_SEG, BIG_SEG, STAR_RAMP, REG_SEGMENTS,
  PEG_OMEGA, WHEEL_GRAVITY, WHEEL_SPIN, PBR, wheelPegs, SEG_FLASH_DURATION,
  PROJ_SPAWN_OFF, PIERCE_SPEED,
} from '../config/config';

// 当前 ★ 小扇区角宽:随时间从 SMALL_SEG 线性变宽到 BIG_SEG
export function starSeg(s: GameState): number {
  return SMALL_SEG + (BIG_SEG - SMALL_SEG) * Math.min(1, s.t / STAR_RAMP);
}
// 其余常规扇区均分剩下的圆环
export function regSeg(s: GameState): number {
  return (Math.PI * 2 - starSeg(s)) / REG_SEGMENTS;
}
export function pegPos(s: GameState, p: { r: number; a: number }, cx: number, cy: number): [number, number] {
  const a = p.a + s.pegTheta;
  return [cx + Math.cos(a) * p.r, cy + Math.sin(a) * p.r];
}

export function enterUltimate(s: GameState, b: WheelBall): void {
  s.ultraBalls.push({ x: WX2 + s.rng.range(-30, 30), y: WY2 - IR * 0.6, vx: s.rng.range(-60, 60), vy: 0, c: b.c, inRing: false });
  toast(s, '🌟 ' + TEAMS[b.c].name + ' 进入终极转盘!', TEAMS[b.c].ball);
}

export function updateWheel(s: GameState, h: number): void {
  s.theta += h * WHEEL_SPIN;
  s.pegTheta += h * PEG_OMEGA;
  for (const f of s.segFlashes) f.t -= h;
  s.segFlashes = s.segFlashes.filter(f => f.t > 0);
  const out: WheelBall[] = [];
  for (const b of s.wheelBalls) {
    b.vy += WHEEL_GRAVITY * h;
    b.x += b.vx * h; b.y += b.vy * h;
    for (const p of wheelPegs) {
      const pp = pegPos(s, p, WX, WY), px = pp[0], py = pp[1];
      const dx = b.x - px, dy = b.y - py, rr = PBR + 5, d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        b.x = px + nx * rr; b.y = py + ny * rr;
        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) { b.vx -= 1.75 * dot * nx; b.vy -= 1.75 * dot * ny; }
        b.vx += -PEG_OMEGA * (py - WY) * 0.6 + s.rng.range(-20, 20);
        b.vy += PEG_OMEGA * (px - WX) * 0.6;
      }
    }
    const dx = b.x - WX, dy = b.y - WY, r = Math.hypot(dx, dy);
    if (!b.inRing) {
      if (r + PBR > IR) {
        const ang = norm(Math.atan2(dy, dx));
        const inGap = Math.abs(ang - Math.PI / 2) < GAP_HALF;
        if (inGap) {
          if (r - PBR > IR) b.inRing = true;
        } else {
          const nx = dx / r, ny = dy / r;
          b.x = WX + nx * (IR - PBR); b.y = WY + ny * (IR - PBR);
          const dot = b.vx * nx + b.vy * ny;
          if (dot > 0) { b.vx -= 1.72 * dot * nx; b.vy -= 1.72 * dot * ny; }
          b.vx *= 0.995; b.vy *= 0.995;
        }
      }
    } else {
      if (r + PBR >= WR - 2) {
        triggerSkill(s, b, Math.atan2(dy, dx));
        continue;
      }
      if (r - PBR < IR) {
        const nx = dx / r, ny = dy / r;
        b.x = WX + nx * (IR + PBR); b.y = WY + ny * (IR + PBR);
        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) { b.vx -= 1.6 * dot * nx; b.vy -= 1.6 * dot * ny; }
      }
    }
    out.push(b);
  }
  s.wheelBalls = out;
}

export function triggerSkill(s: GameState, b: WheelBall, ang: number): void {
  const rel = norm(ang - s.theta);
  const reg = regSeg(s);
  if (rel >= 9 * reg) {                  // ★ 小扇区:进入终极转盘
    s.segFlashes.push({ s: 9, t: SEG_FLASH_DURATION, col: TEAMS[b.c].ball });
    enterUltimate(s, b);
    return;
  }
  const seg = Math.min(8, Math.floor(rel / reg));
  const c = s.cannons[b.c];
  const tm = TEAMS[b.c];
  s.segFlashes.push({ s: seg, t: SEG_FLASH_DURATION, col: tm.ball });
  explosion(s, b.x, b.y, tm.ball, 18, 160);
  if (!c || !c.alive) return;
  switch (seg) {
    case 0: {  // +n:数值逐次增长
      c.ammo = Math.min(AMMO_CAP, c.ammo + s.plusVal);
      toast(s, '✨ ' + tm.name + ' 弹药 +' + s.plusVal + ' → ' + fmt(c.ammo), tm.ball);
      s.plusVal++;
      s.labels[0] = '+' + s.plusVal;
      break;
    }
    case 1: {  // 护盾:10 秒
      c.shield = 10;
      toast(s, '🛡 ' + tm.name + ' 展开护盾 10 秒!', tm.ball);
      break;
    }
    case 2: {  // ×4
      c.ammo = Math.min(AMMO_CAP, c.ammo * 4);
      toast(s, '✨ ' + tm.name + ' 弹药 ×4 → ' + fmt(c.ammo), tm.ball);
      break;
    }
    case 3: {  // 偷取:夺走待发最多对手一半待发弹药
      let victim = null;
      for (const o of s.cannons) {
        if (!o.alive || o.idx === c.idx) continue;
        if (!victim || o.queue > victim.queue) victim = o;
      }
      if (victim && victim.queue > 1) {
        const n = Math.floor(victim.queue / 2);
        victim.queue -= n;
        c.queue += n;
        toast(s, '🕳 ' + tm.name + ' 偷走 ' + TEAMS[victim.idx].name + ' ' + fmt(n) + ' 待发弹药!', tm.ball);
      } else {
        toast(s, tm.name + ' 偷取落空:对手没有可偷的待发弹药', tm.ball);
      }
      break;
    }
    case 4:    // 炸弹
      fireBomb(s, c);
      break;
    case 5: {  // 贯穿弹:生命 = max(10, 待发弹药 10%)
      const n = Math.max(10, Math.floor(c.queue * 0.10));
      c.queue = Math.max(0, c.queue - n);
      const a = c.aim;
      s.pierceBalls.push({
        x: c.x + Math.cos(a) * PROJ_SPAWN_OFF, y: c.y + Math.sin(a) * PROJ_SPAWN_OFF,
        vx: Math.cos(a) * PIERCE_SPEED, vy: Math.sin(a) * PIERCE_SPEED, c: c.idx, hp: n,
      });
      toast(s, '💠 ' + tm.name + ' 发射贯穿弹 (HP ' + fmt(n) + ')!', tm.ball);
      break;
    }
    case 6:    // 回血
      c.hp = c.maxHp;
      toast(s, '💚 ' + tm.name + ' 生命回满 (' + c.maxHp + ')!', tm.ball);
      break;
    case 7:    // 生命上限+10
      c.maxHp += 10;
      toast(s, '❤ ' + tm.name + ' 生命上限 +10 → ' + c.maxHp, tm.ball);
      break;
    case 8:    // 追踪弹
      fireHoming(s, c);
      break;
  }
}
