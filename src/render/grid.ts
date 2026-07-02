/* 战场格子的渲染:维护离屏画布,每帧只把 state.dirtyCells 里的脏格重绘上去
   (保留原版"只重绘变化格"的性能优化)。逻辑层从不碰这里。 */
import type { GameState } from '../core/types';
import { N, BS, CS, NEUTRAL, TEAMS } from '../config/config';

const bc = document.createElement('canvas');
bc.width = BS; bc.height = BS;
const bctx = bc.getContext('2d')!;

export function getGridCanvas(): HTMLCanvasElement { return bc; }

function drawCell(s: GameState, i: number, j: number): void {
  const o = s.cells[j * N + i];
  bctx.fillStyle = o < 0 ? NEUTRAL : TEAMS[o].cell;
  bctx.fillRect(i * CS, j * CS, CS, CS);
  const hp = s.cellHp[j * N + i];
  if (hp > 1) {
    bctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.72, 0.06 * (hp - 1)) + ')';
    bctx.fillRect(i * CS, j * CS, CS, CS);
  }
  bctx.strokeStyle = 'rgba(0,0,0,0.30)';
  bctx.lineWidth = 1;
  bctx.strokeRect(i * CS + 0.5, j * CS + 0.5, CS - 1, CS - 1);
}

// 每帧调用:整屏重绘(reset 后)或只刷脏格
export function flushGrid(s: GameState): void {
  if (s.gridDirtyAll) {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) drawCell(s, i, j);
    s.gridDirtyAll = false;
    s.dirtyCells.clear();
    return;
  }
  if (s.dirtyCells.size) {
    for (const k of s.dirtyCells) drawCell(s, k % N, (k / N) | 0);
    s.dirtyCells.clear();
  }
}
