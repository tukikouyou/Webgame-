/* 价格、属性值与购买操作(纯逻辑)。四层的所有「花钱」都在这里。 */
import { T } from '../config/tuning';
import type { GameState, UpKind } from './types';

export const cardN = (s: GameState, id: string): number => s.cycle.cards[id] || 0;

/* ---- 倍率(来自卡牌与天赋) ---- */
export function coinMul(s: GameState): number {
  return Math.pow(1.5, cardN(s, 'coinPact')) * Math.pow(1.5, s.legacy.talents.coin);
}
export function energyMul(s: GameState): number { return Math.pow(1.3, cardN(s, 'energyRes')); }
export function salvoMul(s: GameState): number { return Math.pow(1.2, cardN(s, 'fireSlot')); }
export function mulM(s: GameState): number { return 1 + 0.25 * cardN(s, 'mulSlot'); }
export function ballCount(s: GameState): number { return T.initBalls + cardN(s, 'balls'); }

/* ---- 炮台属性(金币,转生清零) ---- */
export function dmgValue(s: GameState): number { return Math.pow(T.dmgMul, s.run.up.dmg); }
export function capValue(s: GameState): number {
  return T.capBase * Math.pow(T.capMul, s.run.up.cap) * Math.pow(2, cardN(s, 'ammoVault'));
}
export function baseAmmo(s: GameState): number { return T.baseAmmo0 * Math.pow(T.baseAmmoMul, s.run.up.base); }

export const UP_KINDS: UpKind[] = ['dmg', 'cap', 'base'];
export const UP_NAMES: Record<UpKind, string> = { dmg: '伤害', cap: '发射上限', base: '底弹' };

export function upCost(kind: UpKind, level: number): number {
  if (kind === 'dmg') return T.dmgCost0 * Math.pow(T.dmgCostMul, level);
  if (kind === 'cap') return T.capCost0 * Math.pow(T.capCostMul, level);
  return T.baseAmmoCost0 * Math.pow(T.baseAmmoCostMul, level);
}

export function buyUp(s: GameState, kind: UpKind): boolean {
  const cost = upCost(kind, s.run.up[kind]);
  if (s.run.coins < cost) return false;
  s.run.coins -= cost;
  s.run.up[kind]++;
  return true;
}

/* 自动升级:反复买「买得起的最便宜项目」;发射上限只在最近一次齐射是蓄满触发时才买 */
export function autoBuy(s: GameState): void {
  for (let n = 0; n < 60; n++) {
    let best: UpKind | null = null, bestCost = Infinity;
    for (const k of UP_KINDS) {
      if (k === 'cap' && !s.run.capBinding) continue;
      const c = upCost(k, s.run.up[k]);
      if (c < bestCost) { bestCost = c; best = k; }
    }
    if (!best || !buyUp(s, best)) return;
  }
}

/* ---- 钉子与槽宽(维度能量,终结纪元清零) ---- */
export function pegYield(level: number): number { return T.pegYield0 * Math.pow(T.pegYieldMul, level - 1); }
export function pegBuyCost(owned: number): number { return T.pegCost0 * Math.pow(T.pegCostMul, owned); }
export function pegUpCost(level: number): number { return T.pegUpCost0 * Math.pow(T.pegUpCostMul, level - 1); }

export function cardUnits(s: GameState): number { return cardN(s, 'mulSlot') + cardN(s, 'fireSlot'); }
export function maxFuncUnits(s: GameState): number { return Math.max(0, T.slotUnits - cardUnits(s)); }
export function widthBought(s: GameState): number { return s.epoch.funcUnlocked - (T.startMul + T.startFire); }
export function widthCost(s: GameState): number { return T.widthCost0 * Math.pow(T.widthCostMul, widthBought(s)); }

export function buyPeg(s: GameState, slot: number, color: number): boolean {
  if (s.epoch.pegs.some(p => p.slot === slot)) return false;
  const cost = pegBuyCost(s.epoch.pegs.length);
  if (s.epoch.energy < cost) return false;
  s.epoch.energy -= cost;
  s.epoch.pegs.push({ slot, color, level: 1 });
  return true;
}

export function upgradePeg(s: GameState, slot: number): boolean {
  const p = s.epoch.pegs.find(q => q.slot === slot);
  if (!p) return false;
  const cost = pegUpCost(p.level);
  if (s.epoch.energy < cost) return false;
  s.epoch.energy -= cost;
  p.level++;
  return true;
}

export function buyWidth(s: GameState): boolean {
  if (s.epoch.funcUnlocked >= maxFuncUnits(s)) return false;
  const cost = widthCost(s);
  if (s.epoch.energy < cost) return false;
  s.epoch.energy -= cost;
  s.epoch.funcUnlocked++;
  return true;
}

/* 已解锁的功能格在倍增/发射之间免费分配;至少保留 1 格发射 */
export function setMulAlloc(s: GameState, n: number): void {
  const unlocked = Math.min(s.epoch.funcUnlocked, maxFuncUnits(s));
  s.epoch.mulAlloc = Math.max(0, Math.min(n, unlocked - 1));
}
