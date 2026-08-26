/* 局外存档的 localStorage 持久化。只在 ui 层碰 localStorage(浏览器 API),
   规则(经验/金币/遗物效果)全部在 core/meta.ts,这里是薄 IO 壳。 */
import type { MetaState } from '../core/meta';
import { emptyMeta } from '../core/meta';

const KEY = 'marble_territory_war_meta_v1';

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyMeta();
    const o = JSON.parse(raw);
    const m = emptyMeta();
    m.coins = +o.coins || 0;
    m.level = Math.max(1, +o.level || 1);
    m.xp = +o.xp || 0;
    m.relics = Array.isArray(o.relics) ? o.relics.filter((x: unknown) => typeof x === 'string') : [];
    m.wins = +o.wins || 0;
    m.totalWaves = +o.totalWaves || 0;
    return m;
  } catch {
    return emptyMeta();
  }
}

export function saveMeta(m: MetaState): void {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* 隐私模式等忽略 */ }
}

export function resetMeta(): MetaState {
  const m = emptyMeta();
  saveMeta(m);
  return m;
}
