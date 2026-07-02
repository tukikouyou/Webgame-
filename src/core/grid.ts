/* 战场格子的纯数据操作。关键:这里只改 cells/cellHp 并把下标记入 dirtyCells,
   绝不画图 —— 渲染层每帧读 dirtyCells 重绘脏格(见 render/grid.ts)。 */
import type { GameState } from './types';
import { N } from '../config/config';

/** 直接设置某格颜色 o 与生命 hp(初始化/技能用) */
export function setCell(s: GameState, i: number, j: number, o: number, hp: number): void {
  if (i < 0 || j < 0 || i >= N || j >= N) return;
  const k = j * N + i;
  s.cells[k] = o;
  s.cellHp[k] = hp;
  s.dirtyCells.add(k);
}

/** 兼容旧调用:染色并把生命值设为 1 */
export function paintCell(s: GameState, i: number, j: number, o: number): void {
  if (i < 0 || j < 0 || i >= N || j >= N) return;
  const k = j * N + i;
  if (s.cells[k] === o && s.cellHp[k] === 1) return;
  s.cells[k] = o;
  s.cellHp[k] = 1;
  s.dirtyCells.add(k);
}

/** 调用方直接改了 cellHp(而非颜色)后,用此标记该格需重绘 */
export function markCell(s: GameState, i: number, j: number): void {
  if (i < 0 || j < 0 || i >= N || j >= N) return;
  s.dirtyCells.add(j * N + i);
}

/** 统计某色占领格数(每帧最多算一次,缓存于 state) */
export function territory(s: GameState, id: number): number {
  if (s.territoryCacheT !== s.t) {
    s.territoryCacheT = s.t;
    s.territoryCache = [0, 0, 0, 0];
    for (let k = 0; k < s.cells.length; k++) {
      const o = s.cells[k];
      if (o >= 0) s.territoryCache[o]++;
    }
  }
  return s.territoryCache[id];
}
