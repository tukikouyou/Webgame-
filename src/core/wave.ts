/* 波次(roguelike 难度推进)结算。
   一局只有一名玩家(其余 3 队为 AI):玩家队伍被淘汰 = 整局失败;
   其他队伍淘汰只是推进波次;只剩玩家 = 整局胜利。
   波次推进:AI 生命上限/弹珠伤害/射速提升 + 奖励金币,然后三选一。 */
import type { GameState } from './types';
import { toast } from './fx';
import { setCell } from './grid';
import { newPlinkoBall } from './plinko';
import { initTrait } from './cannons';
import { waveEnemyHp, waveRateMul, advanceWave, waveClamped } from './meta';
import type { MetaState } from './meta';
import {
  TEAMS, MAX_HP, N, BX, BY, BS, CS,
  INIT_TERRITORY_R_RATIO, CANNON_OFFSET_RATIO, PLINKO_INIT_BALLS,
} from '../config/config';

/** 波次推进:AI 变强 + 金币奖励。调用前需 s.wave++。返回新波次号 */
export function nextWave(s: GameState, m: MetaState): number {
  advanceWave(s, m);
  const w = waveClamped(s);
  for (const c of s.cannons) {
    if (c.idx === s.playerIdx) continue;
    const newMax = Math.round(waveEnemyHp(s) * (c.maxHp / MAX_HP));
    if (newMax > c.maxHp) { c.maxHp = newMax; c.hp = Math.min(c.maxHp, c.hp + (newMax - c.maxHp)); }
    s.cfg.fireRateMax[c.idx] = Math.max(100, Math.round(s.cfg.fireRateMax[c.idx] * waveRateMul(s) * 0.25));
  }
  const tm = TEAMS[s.playerIdx];
  toast(s, '🌊 波次 ' + w + (s.waveMaxed ? ' (最终波)' : '') + ' · 敌方 AI 已强化 · 金币 +' + m.coins, tm.ball);
  return w;
}

/** 淘汰判定:某队死亡时调用。
    返回 'lose'(玩家被灭)/ 'win'(只剩玩家)/ 'kill'(玩家击杀 AI,推进波次)/ 'aiKill'(AI 互杀,不推进)/ null */
export function onElimination(s: GameState, deadIdx: number, killerIdx: number | null): 'lose' | 'kill' | 'aiKill' {
  // 是否清空本波(只剩玩家)由 main 编排判定,这里不再直接结束整局
  if (deadIdx === s.playerIdx) return 'lose';
  return killerIdx === s.playerIdx ? 'kill' : 'aiKill';
}

/** 清空一波后:复活全部 AI 并逐波强化(生命/射速),重建其角落领地、补面板球。 */
export function respawnEnemies(s: GameState, m: MetaState): number {
  advanceWave(s, m);   // 金币奖励 + totalWaves + 最终波标记
  const w = waveClamped(s);
  const R = N * INIT_TERRITORY_R_RATIO;
  const off = Math.round(N * CANNON_OFFSET_RATIO);
  for (const c of s.cannons) {
    if (c.idx === s.playerIdx) continue;
    const tm = TEAMS[c.idx];
    // 复活并按波次强化
    c.alive = true;
    c.maxHp = waveEnemyHp(s);
    c.hp = c.maxHp;
    c.shield = 0; c.shieldHp = 0; c.lives = 0; c.purge = false;
    c.ammo = 1; c.queue = 10; c.fireAcc = 0; c.dmgCd = 0;
    c.dmgTaken = 0; c.regenAcc = 0; c.cellRegAcc = 0; c.plinkoAcc = 0;
    c.baseAmmo = 1;
    // 回到本方角落
    const ci = tm.corner[0] ? N - 1 - off : off;
    const cj = tm.corner[1] ? N - 1 - off : off;
    c.x = BX + (ci + 0.5) * CS; c.y = BY + (cj + 0.5) * CS;
    c.base = Math.atan2(BY + BS / 2 - c.y, BX + BS / 2 - c.x);
    c.aim = c.base;
    initTrait(c);
    // 射速随波次(每波从基准重算,不累积)
    s.cfg.fireRateMax[c.idx] = Math.min(1200, Math.round(400 * waveRateMul(s)));
    // 重建角落四分之一圆领地
    const cx = tm.corner[0] * (N - 1), cy = tm.corner[1] * (N - 1);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const dx = i - cx, dy = j - cy;
      if (dx * dx + dy * dy < R * R) setCell(s, i, j, c.idx, 1);
    }
    // 补充面板球
    for (let n = 0; n < PLINKO_INIT_BALLS; n++) s.plinkoBalls.push(newPlinkoBall(s, c.idx));
  }
  s.eventBanner = { name: '第 ' + w + ' 波', icon: '🌊', t: 3, max: 3 };   // 中央大横幅,明确是新波次而非重开
  toast(s, '🌊 第 ' + w + ' 波来袭!敌方 AI 已复活并强化', TEAMS[s.playerIdx].ball);
  return w;
}

/** 由 damage.onLethal 调用:记录淘汰归因到 state,供 main 编排消费 */
export function recordElimination(s: GameState, deadIdx: number, killerIdx: number | null): void {
  const res = onElimination(s, deadIdx, killerIdx);
  if (res === 'kill' || res === 'aiKill') {
    s.elimResult = res;
    if (res === 'aiKill') {
      const t = TEAMS[deadIdx];
      toast(s, '💀 ' + t.name + ' 被 AI 淘汰(不算你的击杀)', '#888');
    }
  }
}
