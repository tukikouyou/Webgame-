/* 粒子 / 顶部提示 toast / 结算画面。只读 state。 */
import type { GameState } from '../core/types';
import { TEAMS, W, H } from '../config/config';

type Ctx = CanvasRenderingContext2D;

export function drawParticles(ctx: Ctx, s: GameState): void {
  for (const p of s.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
  }
  ctx.globalAlpha = 1;
}

export function drawToasts(ctx: Ctx, s: GameState): void {
  ctx.textAlign = 'center';
  const cx = W / 2;
  let y = 46;
  for (const o of s.toasts) {
    ctx.globalAlpha = Math.min(1, o.t / 0.5);
    ctx.font = 'bold 20px Verdana';
    const w = ctx.measureText(o.text).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(cx - w / 2, y - 20, w, 28);
    ctx.fillStyle = o.col;
    ctx.fillText(o.text, cx, y);
    y += 34;
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

export function drawOver(ctx: Ctx, s: GameState): void {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  const cx = W / 2;
  if (s.winner) {
    ctx.fillStyle = TEAMS[s.winner.idx].ball;
    ctx.font = 'bold 72px Verdana';
    ctx.fillText('🏆 ' + TEAMS[s.winner.idx].name + ' 获胜!', cx, 430);
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 72px Verdana';
    ctx.fillText('平局!', cx, 430);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px Verdana';
  ctx.fillText('点击画面重新选择炮台,或按"重新开始"再来一局', cx, 490);
  ctx.textAlign = 'left';
}
