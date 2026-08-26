/* 局外成长(Meta)层:金币 / 经验 / 局外等级 + 可购买遗物(重复购买可叠加)。
   跨局持久化由 ui/metaStore(localStorage) 负责;core 内保持纯函数、不碰 DOM。
   遗物数值在 config/meta.json;本局生效值统一经 useMeta() 派生。 */
import { RELICS, META, META_WAVE } from '../config/meta';
import { MAX_HP, AMMO_CAP } from '../config/config';
import type { GameState, Cannon } from './types';

/* ---- 持久化存档(字段即 localStorage 结构) ---- */
export interface MetaState {
  coins: number;
  level: number;
  xp: number;
  relics: string[];   // 已购遗物 id 列表,同一 id 可出现多次(叠加)
  wins: number;
  totalWaves: number;
}

/* ---- 派生:每个炮台本局生效的局外加成 ---- */
export interface UseMeta {
  level: number;
  marbleDmgMul: number;
  speedMul: number;
  fireRateMul: number;
  dmgOutMul: number;
  dmgInMul: number;
  ammoCapMul: number;
  ammoCap: number;   // 生效弹药上限(含 meta)
  hpBonus: number;
  extraLives: number;
  extraPlinko: number;
  relicCount: number;
}

export function emptyMeta(): MetaState {
  return { coins: 0, level: 1, xp: 0, relics: [], wins: 0, totalWaves: 0 };
}

/* 升级所需经验(纯函数) */
export function xpForLevel(lv: number): number {
  return Math.floor(100 * Math.pow(META.xpGrow, lv - 1));
}

/* 结算经验;可能连续升多级。返回升级数 */
export function grantXp(m: MetaState, amount: number): number {
  m.xp += amount;
  let ups = 0;
  while (m.level < META.maxLevel && m.xp >= xpForLevel(m.level)) {
    m.xp -= xpForLevel(m.level);
    m.level++; ups++;
  }
  if (m.level >= META.maxLevel) m.xp = 0;
  return ups;
}

/** 等级 + 遗物 → 本局每个炮台的生效加成(乘算叠加) */
export function useMeta(m: MetaState, baseAmmoCap: number): UseMeta {
  const u: UseMeta = {
    level: m.level,
    marbleDmgMul: 1 + META.lvDmg * (m.level - 1),
    speedMul: 1,
    fireRateMul: 1 + META.lvFire * (m.level - 1),
    dmgOutMul: 1, dmgInMul: 1,
    ammoCapMul: 1, ammoCap: baseAmmoCap,
    hpBonus: 0, extraLives: 0, extraPlinko: 0,
    relicCount: m.relics.length,
  };
  for (const id of m.relics) {
    const r = RELICS.find((x: { id: string }) => x.id === id);
    if (!r) continue;
    u.marbleDmgMul *= r.dmgMul || 1;
    u.speedMul *= r.speedMul || 1;
    u.fireRateMul *= r.fireRateMul || 1;
    u.dmgOutMul *= r.dmgOutMul || 1;
    u.dmgInMul *= r.dmgInMul || 1;
    u.ammoCapMul *= r.ammoCapMul || 1;
    u.hpBonus += r.hpBonus || 0;
    u.extraLives += r.lives || 0;
    u.extraPlinko += r.extraRelic || 0;
  }
  u.ammoCap = Math.floor(baseAmmoCap * u.ammoCapMul);
  return u;
}

/* ---- 开局应用 ---- */
export function metaStartingHp(u: UseMeta, baseMaxHp: number): number {
  return baseMaxHp + u.hpBonus;
}
export function metaStartingLives(u: UseMeta): number {
  return u.extraLives;
}
export function metaStartingPlinko(u: UseMeta, base: number): number {
  return base + u.extraPlinko;
}

/* 开火时:元加成乘到弹珠生命与速度上(marbleDmg 已含基础值) */
export function metaFireHp(cfgDmg: number, u: UseMeta | null, cannon: Cannon): number {
  let hp = cfgDmg * (u ? u.marbleDmgMul : 1);
  if (cannon.trait === 'dblhp') hp *= 2;
  return Math.max(1, Math.round(hp * 10) / 10);
}
export function metaFireSpeed(sp: number, u: UseMeta | null): number {
  return sp * (u ? u.speedMul : 1);
}

/* 局外加成只对玩家炮台生效:非玩家一律返回 null(=无加成),防止商店遗物惠及 AI。
   s.use 存的是玩家的 UseMeta;所有 per-cannon 消费点都经此访问器取。 */
export function useFor(s: GameState, idx: number | null | undefined): UseMeta | null {
  return (idx != null && idx === s.playerIdx) ? s.use : null;
}
export function capFor(s: GameState, idx: number): number {
  const u = useFor(s, idx);
  return u ? u.ammoCap : AMMO_CAP;
}

/* 伤害乘区(伤害入口统一走这里) */
export function metaOutMul(u: UseMeta | null, dmg: number): number {
  return dmg * (u ? u.dmgOutMul : 1);
}
export function metaInMul(u: UseMeta | null, dmg: number): number {
  return dmg * (u ? u.dmgInMul : 1);
}

/* ---- 波次(roguelike 难度推进) ---- */
export function finalWave(): number {
  return META_WAVE.maxWaves;   // 整局共多少波(清空即通关)
}
export function waveClamped(s: GameState): number {
  return Math.min(META_WAVE.maxWaves, s.wave);
}
export function waveEnemyHp(s: GameState): number {
  return MAX_HP + META_WAVE.enemyHpPerWave * (waveClamped(s) - 1);
}
export function waveEnemyDmgMul(s: GameState): number {
  return 1 + META_WAVE.enemyDmgPerWave * (waveClamped(s) - 1);
}
export function waveRateMul(s: GameState): number {
  return 1 + META_WAVE.enemyRatePerWave * (waveClamped(s) - 1);
}

/** 波次结算:奖励 + 难度推进。s.wave 由调用方先 +1 */
export function advanceWave(s: GameState, m: MetaState): void {
  m.coins += META.coinsPerWave + (s.wave - 1);
  m.totalWaves++;
  if (s.wave >= META_WAVE.maxWaves) s.waveMaxed = true;
}

/** 整局获胜:金币 + 经验 + 胜场。返回升级数(用于 UI 提示) */
export function settleVictory(s: GameState, m: MetaState): number {
  m.wins++;
  m.coins += META.coinsPerWin + (s.wave - 1) * 2;
  return grantXp(m, META.xpPerWin + (s.wave - 1) * 8);
}
