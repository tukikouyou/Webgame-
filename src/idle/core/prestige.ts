/* 三种重置:转生(能量)、终结纪元(星砂)、传承(传承点),以及传承天赋。 */
import { T } from '../config/tuning';
import type { GameState } from './types';
import { colInfo, regionValue, bossRegionNo, regionLabel } from './grid';
import { energyMul } from './economy';
import { freshRun, freshEpoch, freshCycle, clearTransient } from './state';
import { toast, bigFlash } from './fx';

/* ---- 转生 ---- */
export function rebirthGain(s: GameState): number {
  const r = s.run;
  let v = r.clearedValue;
  const b = r.boss;
  if (b && b.alive && r.front >= colInfo(b.col).regionStart) v += b.p * regionValue(b.dim, bossRegionNo());
  return Math.floor(v * energyMul(s));
}

export function canRebirth(s: GameState): boolean { return rebirthGain(s) >= 1; }

/* 当前这一轮推到的维度与区号 */
export function frontInfo(s: GameState) { return colInfo(Math.min(s.run.front, s.run.fieldEnd - 1)); }

export function frontLabel(s: GameState): string {
  const info = frontInfo(s);
  return regionLabel(info.dim, info.region);
}

export function doRebirth(s: GameState): void {
  const gain = rebirthGain(s);
  if (gain < 1) return;
  s.history.unshift({ label: frontLabel(s), energy: gain, time: s.run.time });
  if (s.history.length > 8) s.history.length = 8;
  s.epoch.energy += gain;
  s.epoch.runs++;
  s.run = freshRun();
  clearTransient(s);
  toast(s, '转生!获得 ' + gain + ' 维度能量', '#7fd0ff');
}

/* ---- 终结纪元:条件和星砂都按当前这一轮推到的位置算 ---- */
export function canEndEpoch(s: GameState): boolean { return frontInfo(s).dim >= T.epochDim; }

/* 星砂:本轮过第 k 维得 sandPerDim × sandDimGrow^(k−1),全部累加(在 5 维时已过 4 维) */
export function sandGain(s: GameState): number {
  const passed = frontInfo(s).dim - 1;
  const r = T.sandDimGrow;
  const sum = r === 1 ? passed : (Math.pow(r, passed) - 1) / (r - 1);
  return Math.floor(T.sandPerDim * sum);
}

export function doEndEpoch(s: GameState): void {
  if (!canEndEpoch(s)) return;
  const gain = sandGain(s);
  s.cycle.sand += gain;
  s.cycle.epochs++;
  s.epoch = freshEpoch(s.legacy);
  s.run = freshRun();
  clearTransient(s);
  bigFlash(s, '纪元终结 · +' + gain + ' 星砂');
}

/* ---- 传承 ---- */
export function canLegacy(s: GameState): boolean { return s.epoch.maxDim >= T.legacyDim; }
export function legacyGain(s: GameState): number { return 1 + Math.max(0, s.epoch.maxDim - T.legacyDim); }

export function doLegacy(s: GameState): void {
  if (!canLegacy(s)) return;
  const gain = legacyGain(s);
  s.legacy.points += gain;
  s.legacy.count++;
  s.cycle = freshCycle();
  s.epoch = freshEpoch(s.legacy);
  s.run = freshRun();
  clearTransient(s);
  bigFlash(s, '传承 · +' + gain + ' 传承点');
}

export interface TalentDef { id: 'vault' | 'res' | 'coin' | 'startPegs'; name: string; desc: string; }
export const TALENTS: TalentDef[] = [
  { id: 'vault', name: '解锁「弹药库」', desc: '卡池加入弹药库(发射上限 ×2)' },
  { id: 'res', name: '解锁「能量共鸣」', desc: '卡池加入能量共鸣(维度能量 ×1.3)' },
  { id: 'coin', name: '金币天赋', desc: '金币收入 ×1.5 / 级' },
  { id: 'startPegs', name: '起步钉子', desc: '每个纪元开局自带 2 颗 1 级钉子' },
];

export function talentCost(s: GameState, id: TalentDef['id']): number | null {
  const t = s.legacy.talents;
  if (id === 'vault') return t.vault ? null : 1;
  if (id === 'res') return t.res ? null : 1;
  if (id === 'startPegs') return t.startPegs ? null : 2;
  return Math.pow(2, t.coin);
}

export function buyTalent(s: GameState, id: TalentDef['id']): boolean {
  const cost = talentCost(s, id);
  if (cost === null || s.legacy.points < cost) return false;
  s.legacy.points -= cost;
  const t = s.legacy.talents;
  if (id === 'coin') t.coin++;
  else t[id] = true;
  return true;
}
