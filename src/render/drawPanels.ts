/* 左上弹珠面板 + 右侧普通/终极转盘的绘制。只读 state。 */
import type { GameState } from '../core/types';
import { slotBounds } from '../core/plinko';
import { regSeg, pegPos } from '../core/wheel';
import {
  TEAMS, ULT_LABELS, ULT_SEGMENTS,
  PX, PY, PW, PH, SLOT_H, PBR, pegs,
  WX, WY, WX2, WY2, WR, IR, GAP_HALF, SEG, wheelPegs,
} from '../config/config';

type Ctx = CanvasRenderingContext2D;

// 画一颗面板/转盘小球,并在本体值 >=2 时标出数字(默认值 1 不标,避免刷屏)。
// 本体值越大球越大,一眼能看出"厚"球。
function drawBall(ctx: Ctx, x: number, y: number, colorIdx: number, val: number): void {
  const r = val >= 2 ? PBR + 3 + Math.min(5, val - 2) : PBR;
  ctx.fillStyle = TEAMS[colorIdx].ball;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  if (val >= 2) {
    const txt = '' + val;
    const fs = Math.max(8, Math.min(14, r * 1.2) - (txt.length - 1) * 2);
    ctx.font = 'bold ' + fs.toFixed(0) + 'px Verdana';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(txt, x, y + 0.5);
    ctx.fillStyle = '#fff'; ctx.fillText(txt, x, y + 0.5);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
}

export function drawPlinko(ctx: Ctx, s: GameState): void {
  ctx.fillStyle = '#0d0d10';
  ctx.fillRect(PX - 6, PY - 6, PW + 12, PH + 12);
  ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 2;
  ctx.strokeRect(PX - 6, PY - 6, PW + 12, PH + 12);
  ctx.fillStyle = '#d8d8d8';
  ctx.beginPath();
  for (const p of pegs) { ctx.moveTo(p.x + 4, p.y); ctx.arc(p.x, p.y, 4, 0, 6.283); }
  ctx.fill();
  const sy = PY + PH - SLOT_H;
  const bd = slotBounds(s);
  const zones: [number, number, string][] = [[0, bd[0], 'RELEASE'], [bd[0], bd[1], 'MULTIPLY'], [bd[1], 1, 'SPIN']];
  for (let i = 0; i < 3; i++) {
    const z = zones[i], x0 = PX + PW * z[0], w = PW * (z[1] - z[0]);
    const lit = s.flashes.some(f => f.slot === i);
    ctx.fillStyle = lit ? '#ffe27a' : '#f2f2f2';
    ctx.fillRect(x0, sy, w - 3, SLOT_H);
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    const fs = Math.max(9, Math.min(19, (w - 14) / (z[2].length * 0.62)));
    ctx.font = 'bold ' + fs.toFixed(0) + 'px Verdana';
    ctx.fillText(z[2], x0 + (w - 3) / 2, sy + SLOT_H / 2 + fs * 0.36);
  }
  for (const b of s.plinkoBalls) drawBall(ctx, b.x, b.y, b.c, b.hp + (s.bentiBuff[b.c] > 0 ? 1 : 0));
  // 面板各色弹珠数
  const cnt = [0, 0, 0, 0];
  for (const b of s.plinkoBalls) cnt[b.c]++;
  ctx.font = 'bold 13px Verdana'; ctx.textAlign = 'left';
  let lx = PX - 2; const ly = PY + PH + 18;
  ctx.fillStyle = '#999'; ctx.fillText('面板弹珠:', lx, ly); lx += 70;
  for (let i = 0; i < 4; i++) {
    if (!s.cannons[i] || !s.cannons[i].alive) continue;
    ctx.fillStyle = TEAMS[i].ball;
    const txt = cnt[i] + '';
    ctx.beginPath(); ctx.arc(lx + 5, ly - 4, 5, 0, 6.283); ctx.fill();
    ctx.fillText(txt, lx + 14, ly); lx += 22 + txt.length * 8;
  }
  ctx.textAlign = 'left';
}

export function drawWheel(ctx: Ctx, s: GameState): void {
  ctx.fillStyle = '#0d0d10';
  ctx.beginPath(); ctx.arc(WX, WY, WR + 30, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 2; ctx.stroke();
  const reg = regSeg(s);
  for (let seg = 0; seg < 10; seg++) {
    const a0 = s.theta + Math.min(seg, 9) * reg;
    const a1 = seg < 9 ? a0 + reg : s.theta + Math.PI * 2;
    const fl = s.segFlashes.find(f => f.s === seg);
    if (fl) {
      ctx.globalAlpha = Math.min(1, fl.t / 0.4);
      ctx.fillStyle = fl.col;
    } else if (seg === 9) {
      ctx.fillStyle = '#8a6b14';
    } else {
      ctx.fillStyle = seg % 2 ? '#17171c' : '#0e0e12';
    }
    ctx.beginPath();
    ctx.arc(WX, WY, WR, a0, a1);
    ctx.arc(WX, WY, IR, a1, a0, true);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(WX + Math.cos(a0) * IR, WY + Math.sin(a0) * IR);
    ctx.lineTo(WX + Math.cos(a0) * WR, WY + Math.sin(a0) * WR);
    ctx.stroke();
    const am = (a0 + a1) / 2, lr = (IR + WR) / 2;
    ctx.save();
    ctx.translate(WX + Math.cos(am) * lr, WY + Math.sin(am) * lr);
    ctx.rotate(am + Math.PI / 2);
    ctx.fillStyle = seg === 9 ? '#ffe27a' : '#e8e8e8';
    ctx.font = 'bold 10px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText(seg === 9 ? '★' : s.labels[seg], 0, 4);
    ctx.restore();
  }
  ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(WX, WY, WR, 0, 6.283); ctx.stroke();
  ctx.fillStyle = '#050507';
  ctx.beginPath(); ctx.arc(WX, WY, IR - 4, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(WX, WY, IR, Math.PI / 2 + GAP_HALF, Math.PI / 2 - GAP_HALF + Math.PI * 2);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#d8d8d8';
  ctx.beginPath();
  for (const p of wheelPegs) {
    const pp = pegPos(s, p, WX, WY), px = pp[0], py = pp[1];
    ctx.moveTo(px + 5, py); ctx.arc(px, py, 5, 0, 6.283);
  }
  ctx.fill();
  for (const b of s.wheelBalls) drawBall(ctx, b.x, b.y, b.c, b.plinkoHp);
  ctx.textAlign = 'left';
}

export function drawUltimate(ctx: Ctx, s: GameState): void {
  ctx.fillStyle = '#0d0d10';
  ctx.beginPath(); ctx.arc(WX2, WY2, WR + 30, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#6b5a1f'; ctx.lineWidth = 2; ctx.stroke();
  for (let seg = 0; seg < ULT_SEGMENTS; seg++) {
    const a0 = s.theta2 + seg * SEG, a1 = a0 + SEG;
    const fl = s.segFlashes2.find(f => f.s === seg);
    if (fl) {
      ctx.globalAlpha = Math.min(1, fl.t / 0.4);
      ctx.fillStyle = fl.col;
    } else {
      ctx.fillStyle = seg % 2 ? '#1d1709' : '#120e06';
    }
    ctx.beginPath();
    ctx.arc(WX2, WY2, WR, a0, a1);
    ctx.arc(WX2, WY2, IR, a1, a0, true);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#4a3f1d'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(WX2 + Math.cos(a0) * IR, WY2 + Math.sin(a0) * IR);
    ctx.lineTo(WX2 + Math.cos(a0) * WR, WY2 + Math.sin(a0) * WR);
    ctx.stroke();
    const am = a0 + SEG / 2, lr = (IR + WR) / 2;
    ctx.save();
    ctx.translate(WX2 + Math.cos(am) * lr, WY2 + Math.sin(am) * lr);
    ctx.rotate(am + Math.PI / 2);
    ctx.fillStyle = '#ffe27a';
    ctx.font = 'bold 13px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText(ULT_LABELS[seg], 0, 4);
    ctx.restore();
  }
  ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(WX2, WY2, WR, 0, 6.283); ctx.stroke();
  ctx.fillStyle = '#050507';
  ctx.beginPath(); ctx.arc(WX2, WY2, IR - 4, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(WX2, WY2, IR, Math.PI / 2 + GAP_HALF, Math.PI / 2 - GAP_HALF + Math.PI * 2);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#d8d8d8';
  ctx.beginPath();
  for (const p of wheelPegs) {
    const pp = pegPos(s, p, WX2, WY2), px = pp[0], py = pp[1];
    ctx.moveTo(px + 5, py); ctx.arc(px, py, 5, 0, 6.283);
  }
  ctx.fill();
  for (const b of s.ultraBalls) drawBall(ctx, b.x, b.y, b.c, b.plinkoHp);
  ctx.textAlign = 'left';
}
