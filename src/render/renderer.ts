/* §RENDER 总渲染:每帧统一按图层顺序绘制。渲染只读 state,不改任何游戏数据。 */
import type { GameState } from '../core/types';
import { flushGrid, getGridCanvas } from './grid';
import {
  drawMarbles, drawPierce, drawBombs, drawNukes, drawHoming,
  drawCannon, drawWaves, drawShockwaves, drawHUD, drawEventBanner,
} from './drawArena';
import { drawPlinko, drawWheel, drawUltimate } from './drawPanels';
import { drawParticles, drawToasts, drawOver } from './drawFx';
import { W, H, BX, BY, BS } from '../config/config';

export function render(ctx: CanvasRenderingContext2D, s: GameState): void {
  flushGrid(s);   // 先把脏格刷到离屏画布

  ctx.fillStyle = '#070709';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1a1a1d';
  ctx.fillRect(BX - 14, BY - 14, BS + 28, BS + 28);
  ctx.drawImage(getGridCanvas(), BX, BY);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  ctx.strokeRect(BX, BY, BS, BS);

  drawEventBanner(ctx, s);   // 背景水印(格子之上、实体之下)
  drawMarbles(ctx, s);
  drawPierce(ctx, s);
  drawBombs(ctx, s);
  drawNukes(ctx, s);
  drawHoming(ctx, s);
  for (const c of s.cannons) drawCannon(ctx, s, c);
  drawWaves(ctx, s);
  drawShockwaves(ctx, s);
  drawHUD(ctx, s);
  drawPlinko(ctx, s);
  drawWheel(ctx, s);
  drawUltimate(ctx, s);
  drawParticles(ctx, s);
  drawToasts(ctx, s);
  if (s.gameOver) drawOver(ctx, s);
}
