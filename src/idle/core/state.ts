/* 建档与各层重置。重置层级:转生 → freshRun;终结纪元 → freshEpoch + freshRun;
   传承 → freshCycle + freshEpoch + freshRun。 */
import { T } from '../config/tuning';
import { createRng } from '../../core/rng';
import type { GameState, RunState, EpochState, CycleState, LegacyState } from './types';
import { colsPerDim } from './grid';

export function freshRun(): RunState {
  return {
    coins: 0,
    up: { dmg: 0, cap: 0, base: 0 },
    ammo: 0, multK: 1,
    queue: 0, perMarble: 1, emitAcc: 0,
    firedAcc: 0, ammoRate: 0,
    colBase: 0, cols: [],
    consolidatedIncome: T.homeCols * T.rows * T.incomeRate,
    front: 0, maxFront: 0, sinceRecord: 0, time: 0,
    fieldEnd: colsPerDim(),
    boss: null,
    clearedValue: 0, awardedRegion: 0,
    frontSpeed: 0, speedAcc: 0, speedPrevFront: 0,
  };
}

export function freshEpoch(legacy: LegacyState): EpochState {
  const e: EpochState = {
    energy: 0,
    pegs: [],
    funcUnlocked: T.startMul + T.startFire,
    mulAlloc: T.startMul,
    maxDim: 1,
    runs: 0,
  };
  if (legacy.talents.startPegs) {
    e.pegs.push({ slot: 0, color: 0, level: 1 }, { slot: 1, color: 1, level: 1 });
  }
  return e;
}

export function freshCycle(): CycleState {
  return { sand: 0, cards: {}, packsOpened: 0, epochs: 0, pendingPick: null };
}

export function freshLegacy(): LegacyState {
  return { points: 0, talents: { vault: false, res: false, coin: 0, startPegs: false }, count: 0, everDim: 1 };
}

/* 清掉场上所有瞬时对象(换轮时调用) */
export function clearTransient(s: GameState): void {
  s.marbles = [];
  s.enemies = [];
  s.bossBalls = [];
  s.sparks = [];
  s.incomePerSec = 0;
}

export function createState(seed: number): GameState {
  const legacy = freshLegacy();
  return {
    rng: createRng(seed),
    run: freshRun(),
    epoch: freshEpoch(legacy),
    cycle: freshCycle(),
    legacy,
    settings: { autoUp: true, autoRebirth: false, autoSkip: { dmg: false, cap: false, base: false } },
    balls: [],
    bossBalls: [],
    marbles: [],
    enemies: [],
    toasts: [],
    sparks: [],
    slotFlash: new Array(T.slotUnits).fill(0),
    pegFlash: new Array(T.pegSlots).fill(0),
    bigFlash: null,
    lastSalvo: null,
    incomeAcc: 0, incomePerSec: 0, autoAcc: 0,
    plinkoAcc: 0,
    history: [],
  };
}
