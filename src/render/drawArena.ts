/* 主战场各图层绘制。只读 state,不改任何数据。 */
import type { GameState, Cannon } from '../core/types';
import { fmt } from '../core/util';
import { shielded } from '../core/damage';
import { pierceRadius, homingRadius } from '../core/projectiles';
import { shade } from './colors';
import {
  TEAMS, TRAITS, MR, SHIELD_R, BX, BY, BS, NUKE_R,
  GUARD_RAD, GUARD_THICK, GUARD_SPAN, MAGNET_R,
} from '../config/config';

type Ctx = CanvasRenderingContext2D;

// 触发随机事件时,在战场中央画大号低透明度"水印",随时间淡出。画在格子之上、实体之下。
export function drawEventBanner(ctx: Ctx, s: GameState): void {
  const b = s.eventBanner;
  if (!b || b.t <= 0) return;
  const a = 0.14 * Math.min(1, b.t / (b.max * 0.6));   // 前 40% 保持,后段淡出
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 110px "Microsoft YaHei", Verdana, sans-serif';
  ctx.fillText(b.icon + ' ' + b.name, BX + BS / 2, BY + BS / 2);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

export function drawMarbles(ctx: Ctx, s: GameState): void {
  for (let c = 0; c < 4; c++) {
    ctx.fillStyle = TEAMS[c].ball;
    ctx.beginPath();
    for (const m of s.marbles) {
      if (m.c !== c) continue;
      ctx.moveTo(m.x + MR, m.y);
      ctx.arc(m.x, m.y, MR, 0, 6.283);
    }
    ctx.fill();
  }
}

export function drawPierce(ctx: Ctx, s: GameState): void {
  for (const p of s.pierceBalls) {
    const tm = TEAMS[p.c];
    const r = pierceRadius(p);
    ctx.fillStyle = tm.ball;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = 'bold 13px Verdana';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText(fmt(p.hp), p.x, p.y - r - 5);
    ctx.fillStyle = '#fff';
    ctx.fillText(fmt(p.hp), p.x, p.y - r - 5);
  }
  ctx.textAlign = 'left';
}

export function drawBombs(ctx: Ctx, s: GameState): void {
  for (const b of s.bombBalls) {
    if (b.dead) continue;
    ctx.fillStyle = '#1c1c1f';
    ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, 6.283); ctx.fill();
    ctx.strokeStyle = TEAMS[b.c].ball; ctx.lineWidth = 3; ctx.stroke();
    if (Math.sin(s.t * 20) > 0) {
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(b.x + 9 * 0.5, b.y - 9 * 0.9, 2.5, 0, 6.283); ctx.fill();
    }
  }
}

export function drawNukes(ctx: Ctx, s: GameState): void {
  for (const b of s.nukeBalls) {
    if (b.dead) continue;
    ctx.fillStyle = '#101010';
    ctx.beginPath(); ctx.arc(b.x, b.y, 11, 0, 6.283); ctx.fill();
    ctx.strokeStyle = TEAMS[b.c].ball; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.font = 'bold 12px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('☢', b.x, b.y + 4);
  }
  ctx.textAlign = 'left';
}

export function drawHoming(ctx: Ctx, s: GameState): void {
  for (const b of s.homingBalls) {
    if (b.hp <= 0) continue;
    const tm = TEAMS[b.c];
    const r = homingRadius(b);
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.dir);
    ctx.fillStyle = tm.ball;
    ctx.beginPath();
    ctx.moveTo(r + 3, 0); ctx.lineTo(-r, r * 0.8); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r, -r * 0.8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    ctx.font = 'bold 12px Verdana'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText(fmt(b.hp), b.x, b.y - r - 5);
    ctx.fillStyle = '#fff'; ctx.fillText(fmt(b.hp), b.x, b.y - r - 5);
  }
  ctx.textAlign = 'left';
}

export function drawShockwaves(ctx: Ctx, s: GameState): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(BX, BY, BS, BS); ctx.clip();
  for (const w of s.shockwaves) {
    const a = Math.max(0.15, 1 - w.r / NUKE_R);
    ctx.globalAlpha = 0.10 * a;
    ctx.fillStyle = TEAMS[w.c].ball;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 0.70 * a + 0.15;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, 6.283); ctx.stroke();
    ctx.strokeStyle = TEAMS[w.c].ball; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w.x, w.y, Math.max(0, w.r - 6), 0, 6.283); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawWaves(ctx: Ctx, s: GameState): void {
  for (const w of s.waves) {
    ctx.globalAlpha = Math.max(0, 1 - w.r / w.max);
    ctx.strokeStyle = w.col;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, 6.283); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawCannon(ctx: Ctx, s: GameState, c: Cannon): void {
  if (!c.alive) return;
  const tm = TEAMS[c.idx];
  if (shielded(c)) {
    ctx.globalAlpha = 0.45 + 0.20 * Math.sin(s.t * 8);
    ctx.fillStyle = tm.ball;
    ctx.beginPath(); ctx.arc(c.x, c.y, SHIELD_R, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 0.9;
    if (c.shield > 0) {
      ctx.strokeStyle = tm.ball; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, SHIELD_R, -Math.PI / 2, -Math.PI / 2 + 6.283 * Math.min(1, c.shield / 10));
      ctx.stroke();
    }
    if (c.shieldHp > 0) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, SHIELD_R + 5, 0, 6.283); ctx.stroke();
      ctx.font = 'bold 13px Verdana';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText('' + c.shieldHp, c.x, c.y - SHIELD_R - 10);
      ctx.fillStyle = '#fff';
      ctx.fillText('' + c.shieldHp, c.x, c.y - SHIELD_R - 10);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(c.x, c.y); ctx.rotate(c.aim);
  ctx.fillStyle = shade(tm.ball, -0.55);
  ctx.fillRect(0, -6, 34, 12);
  ctx.restore();
  const g = ctx.createRadialGradient(c.x - 6, c.y - 6, 4, c.x, c.y, 22);
  g.addColorStop(0, shade(tm.ball, -0.15));
  g.addColorStop(1, shade(tm.ball, -0.70));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(c.x, c.y, 20, 0, 6.283); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(c.x - 26, c.y - 38, 52, 7);
  ctx.fillStyle = c.hp > c.maxHp * 0.3 ? '#5be05b' : '#ff5050';
  ctx.fillRect(c.x - 25, c.y - 37, 50 * Math.max(0, c.hp) / c.maxHp, 5);
  if (c.guards.length) {
    for (const g of c.guards) {
      if (!g.alive) continue;
      const ratio = g.maxHp ? Math.max(0, g.hp / g.maxHp) : 1;
      ctx.globalAlpha = 0.4 + 0.6 * ratio;
      ctx.beginPath();
      ctx.arc(c.x, c.y, GUARD_RAD + GUARD_THICK, g.ang - GUARD_SPAN / 2, g.ang + GUARD_SPAN / 2);
      ctx.arc(c.x, c.y, GUARD_RAD - GUARD_THICK, g.ang + GUARD_SPAN / 2, g.ang - GUARD_SPAN / 2, true);
      ctx.closePath();
      ctx.fillStyle = shade(tm.ball, -0.1);
      ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  if (c.trait === 'magnet') {
    ctx.save();
    ctx.globalAlpha = 0.30 + 0.12 * Math.sin(s.t * 4);
    ctx.strokeStyle = tm.ball; ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.arc(c.x, c.y, MAGNET_R * (0.7 + 0.06 * Math.sin(s.t * 3)), 0, 6.283); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

export function drawHUD(ctx: Ctx, s: GameState): void {
  const pos = [
    { x: BX + 4, y: BY - 58, a: 'left' as const },
    { x: BX + BS - 4, y: BY - 58, a: 'right' as const },
    { x: BX + 4, y: BY + BS + 38, a: 'left' as const },
    { x: BX + BS - 4, y: BY + BS + 38, a: 'right' as const },
  ];
  for (let i = 0; i < 4; i++) {
    const c = s.cannons[i], tm = TEAMS[i], p = pos[i];
    ctx.textAlign = p.a;
    ctx.fillStyle = tm.ball;
    ctx.font = 'bold 24px Verdana, sans-serif';
    if (!c.alive) { ctx.fillText(tm.name + ' 已淘汰', p.x, p.y + 13); continue; }
    ctx.fillText('HP:' + c.hp + '/' + c.maxHp + (c.lives > 0 ? '  ♥×' + c.lives : ''), p.x, p.y);
    ctx.font = 'bold 18px Verdana, sans-serif';
    ctx.fillText('特性:' + TRAITS[c.trait].name + '  ' + fmt(c.ammo) + ' 弹药 · 待发 ' + fmt(c.queue), p.x, p.y + 24);
  }
  ctx.textAlign = 'left';
}
