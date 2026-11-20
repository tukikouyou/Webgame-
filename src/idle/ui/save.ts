/* localStorage 存档:只存四层成长和设置,不存球/弹珠/特效等瞬时对象。 */
import type { GameState } from '../core/types';

/* 地址带 ?sim 时用独立存档(跑数值模拟用,不碰正常存档) */
const KEY = 'marble-idle-demo-v1' + (new URLSearchParams(location.search).has('sim') ? '-sim' : '');

export function saveGame(s: GameState): void {
  const data = {
    seed: s.rng.seed,
    run: s.run, epoch: s.epoch, cycle: s.cycle, legacy: s.legacy,
    settings: s.settings, history: s.history,
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 存储不可用时忽略 */ }
}

export function loadGame(s: GameState): boolean {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { return false; }
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    Object.assign(s.run, d.run);
    Object.assign(s.epoch, d.epoch);
    Object.assign(s.cycle, d.cycle);
    Object.assign(s.legacy, d.legacy);
    s.legacy.talents = { ...s.legacy.talents, ...d.legacy?.talents };
    Object.assign(s.settings, d.settings);
    s.history = Array.isArray(d.history) ? d.history : [];
    return true;
  } catch { return false; }
}

export function clearSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* 忽略 */ }
}
