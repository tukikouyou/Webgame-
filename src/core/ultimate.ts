/* 功能区 3(下半):终极技能转盘。结构同普通转盘,7 个终极技能。 */
import type { GameState, WheelBall } from './types';
import { toast, explosion } from './fx';
import { norm, fmt } from './util';
import { pegPos } from './wheel';
import { fireNuke } from './projectiles';
import { newPlinkoBall } from './plinko';
import {
  TEAMS, AMMO_CAP,
  WX2, WY2, WR, IR, GAP_HALF, PBR, PEG_OMEGA, wheelPegs,
  SEG, ULT_SEGMENTS, WHEEL_GRAVITY, ULTIMATE_SPIN, SEG_FLASH_DURATION,
} from '../config/config';

export function updateUltimate(s: GameState, h: number): void {
  s.theta2 += h * ULTIMATE_SPIN;
  for (const fl of s.segFlashes2) fl.t -= h;
  s.segFlashes2 = s.segFlashes2.filter(fl => fl.t > 0);
  const out: WheelBall[] = [];
  for (const b of s.ultraBalls) {
    if (!s.cannons[b.c].alive) continue;
    b.vy += WHEEL_GRAVITY * h;
    b.x += b.vx * h; b.y += b.vy * h;
    for (const p of wheelPegs) {
      const pp = pegPos(s, p, WX2, WY2), px = pp[0], py = pp[1];
      const dx = b.x - px, dy = b.y - py, rr = PBR + 5, d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        b.x = px + nx * rr; b.y = py + ny * rr;
        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) { b.vx -= 1.75 * dot * nx; b.vy -= 1.75 * dot * ny; }
        b.vx += -PEG_OMEGA * (py - WY2) * 0.6 + s.rng.range(-20, 20);
        b.vy += PEG_OMEGA * (px - WX2) * 0.6;
      }
    }
    const dx = b.x - WX2, dy = b.y - WY2, r = Math.hypot(dx, dy);
    if (!b.inRing) {
      if (r + PBR > IR) {
        const ang = norm(Math.atan2(dy, dx));
        const inGap = Math.abs(ang - Math.PI / 2) < GAP_HALF;
        if (inGap) {
          if (r - PBR > IR) b.inRing = true;
        } else {
          const nx = dx / r, ny = dy / r;
          b.x = WX2 + nx * (IR - PBR); b.y = WY2 + ny * (IR - PBR);
          const dot = b.vx * nx + b.vy * ny;
          if (dot > 0) { b.vx -= 1.72 * dot * nx; b.vy -= 1.72 * dot * ny; }
          b.vx *= 0.995; b.vy *= 0.995;
        }
      }
    } else {
      if (r + PBR >= WR - 2) {
        ultimateSkill(s, b, Math.atan2(dy, dx));
        continue;
      }
      if (r - PBR < IR) {
        const nx = dx / r, ny = dy / r;
        b.x = WX2 + nx * (IR + PBR); b.y = WY2 + ny * (IR + PBR);
        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) { b.vx -= 1.6 * dot * nx; b.vy -= 1.6 * dot * ny; }
      }
    }
    out.push(b);
  }
  s.ultraBalls = out;
}

export function ultimateSkill(s: GameState, b: WheelBall, ang: number): void {
  const seg = Math.floor(norm(ang - s.theta2) / SEG) % ULT_SEGMENTS;
  const c = s.cannons[b.c];
  const tm = TEAMS[b.c];
  s.segFlashes2.push({ s: seg, t: SEG_FLASH_DURATION, col: tm.ball });
  explosion(s, b.x, b.y, tm.ball, 24, 200);
  if (!c || !c.alive) return;
  switch (seg) {
    case 0:    // +1 循环弹珠
      s.plinkoBalls.push(newPlinkoBall(s, c.idx));
      toast(s, '🌟 ' + tm.name + ' 面板弹珠 +1!', tm.ball);
      break;
    case 1:    // 生命上限 +50
      c.maxHp += 50;
      toast(s, '🌟 ' + tm.name + ' 生命上限 +50 → ' + c.maxHp, tm.ball);
      break;
    case 2:    // 100 HP 永久护盾
      c.shieldHp += 100;
      toast(s, '🌟 ' + tm.name + ' 永久护盾 +100(共 ' + c.shieldHp + ')', tm.ball);
      break;
    case 3:    // 弹药 ×10
      c.ammo = Math.min(AMMO_CAP, c.ammo * 10);
      toast(s, '🌟 ' + tm.name + ' 弹药 ×10 → ' + fmt(c.ammo), tm.ball);
      break;
    case 4:    // 额外生命
      c.lives++;
      toast(s, '🌟 ' + tm.name + ' 获得额外生命(共 ' + c.lives + ' 条)!', tm.ball);
      break;
    case 5:    // 核弹
      fireNuke(s, c);
      break;
    case 6:    // 最初弹药 +1
      c.baseAmmo++;
      c.ammo = Math.max(c.ammo, c.baseAmmo);
      toast(s, '🌟 ' + tm.name + ' 最初弹药 +1 → 底数 ' + c.baseAmmo, tm.ball);
      break;
  }
}
