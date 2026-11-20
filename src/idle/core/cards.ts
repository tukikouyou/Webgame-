/* 纪元层:星砂开卡包,三选一。demo 卡池 6 张,效果都是简单数值(颜色区分)。 */
import { T } from '../config/tuning';
import type { GameState } from './types';
import { toast } from './fx';

export interface CardDef { id: string; name: string; color: string; desc: string; lock?: 'vault' | 'res'; }

export const CARDS: CardDef[] = [
  { id: 'balls',     name: '弹珠补给', color: '#f2f2f2', desc: '钉板初始弹珠 +1' },
  { id: 'mulSlot',   name: '倍增槽卡', color: '#5aa9ff', desc: '送 1 格倍增(不占解锁宽度);倍增系数 +0.25' },
  { id: 'fireSlot',  name: '发射槽卡', color: '#ff6b6b', desc: '送 1 格发射(不占解锁宽度);齐射伤害 ×1.2' },
  { id: 'coinPact',  name: '金币契约', color: '#ffd24a', desc: '金币收入 ×1.5' },
  { id: 'ammoVault', name: '弹药库',   color: '#b98cff', desc: '发射上限 ×2', lock: 'vault' },
  { id: 'energyRes', name: '能量共鸣', color: '#4de0c0', desc: '维度能量 ×1.3', lock: 'res' },
];

export function cardDef(id: string): CardDef | undefined { return CARDS.find(c => c.id === id); }

export function cardPool(s: GameState): CardDef[] {
  return CARDS.filter(c => !c.lock || s.legacy.talents[c.lock]);
}

export function packCost(s: GameState): number {
  return Math.ceil(T.packCost0 * Math.pow(T.packCostMul, s.cycle.packsOpened));
}

export function openPack(s: GameState): boolean {
  if (s.cycle.pendingPick) return false;
  const cost = packCost(s);
  if (s.cycle.sand < cost) return false;
  s.cycle.sand -= cost;
  s.cycle.packsOpened++;
  const pool = cardPool(s).map(c => c.id);
  const pick: string[] = [];
  const bag = pool.slice();
  for (let i = 0; i < 3; i++) {
    if (!bag.length) bag.push(...pool);          // 卡池不足 3 张时允许重复
    const k = Math.floor(s.rng.next() * bag.length);
    pick.push(bag.splice(k, 1)[0]);
  }
  s.cycle.pendingPick = pick;
  return true;
}

export function pickCard(s: GameState, id: string): void {
  if (!s.cycle.pendingPick || !s.cycle.pendingPick.includes(id)) return;
  s.cycle.cards[id] = (s.cycle.cards[id] || 0) + 1;
  s.cycle.pendingPick = null;
  const d = cardDef(id);
  if (d) toast(s, '获得卡牌:' + d.name + '(第 ' + s.cycle.cards[id] + ' 层)', d.color);
}
