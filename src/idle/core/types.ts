/* demo 的状态结构。四层成长各自一块:run(推进,转生清零)、epoch(转生层,终结纪元清零)、
   cycle(纪元层,传承清零)、legacy(永久)。其余是不存档的瞬时对象(球、弹珠、特效)。 */
import type { Rng } from '../../core/rng';

export type UpKind = 'dmg' | 'cap' | 'base';
export type SlotKind = 'empty' | 'mul' | 'fire';

/* 战场的一列格子:o[行] 0=我方 1=敌方;hp[行] 当前血量 */
export interface Column { o: number[]; hp: number[]; }

export interface Boss {
  dim: number; col: number; row: number;
  hp: number; hpMax: number;
  shieldBroken: boolean; alive: boolean;
  p: number;            // boss 区我方占领比例
  fireAcc: number;
  bestP: number; bestHp: number;   // 本轮 boss 战的最好进展(判定撞墙用)
  // boss 钉板(第 bossBoardDim 维起)
  board: boolean; bAmmo: number; bMultK: number; bQueue: number; bEmitAcc: number;
}

export interface RunState {
  coins: number;
  up: Record<UpKind, number>;
  // 钉板蓄力
  ammo: number; multK: number;
  // 待发射
  queue: number; perMarble: number; emitAcc: number;
  firedAcc: number; ammoRate: number;   // 齐射弹药速率(指数平均),用于估算火力
  // 战场
  colBase: number; cols: Column[];      // 只存 [colBase, colBase+cols.length) 的列
  consolidatedIncome: number;           // 巩固区每秒金币(未乘倍率)
  front: number; maxFront: number; sinceRecord: number; time: number;
  fieldEnd: number;                     // 尚未击败的 boss 区末尾,之后的列不存在
  boss: Boss | null;
  clearedValue: number; awardedRegion: number;   // 转生能量累计
  frontSpeed: number; speedAcc: number; speedPrevFront: number;
}

export interface OwnedPeg { slot: number; color: number; level: number; }

export interface EpochState {
  energy: number;
  pegs: OwnedPeg[];
  funcUnlocked: number;     // 用能量解锁的功能格数
  mulAlloc: number;         // 其中分给倍增的格数(其余为发射)
  maxDim: number;           // 本纪元到过的最高维度(传承条件用)
  runs: number;
}

export interface CycleState {
  sand: number;
  cards: Record<string, number>;
  packsOpened: number;
  epochs: number;
  pendingPick: string[] | null;
}

export interface LegacyState {
  points: number;
  talents: { vault: boolean; res: boolean; coin: number; startPegs: boolean };
  count: number;
  everDim: number;          // 历史最高维度(解锁自动化用)
}

export interface Settings {
  autoUp: boolean; autoRebirth: boolean;
  autoSkip: Record<UpKind, boolean>;   // 自动升级跳过的项目
}

export interface Ball { x: number; y: number; vx: number; vy: number; lastPeg: number; }
export interface Marble { x: number; y: number; vx: number; vy: number; v: number; dmg: number; life: number; }
export interface EnemyMarble { x: number; y: number; vx: number; vy: number; power: number; }   // power:以所在区一格满血为单位的剩余威力
export interface Toast { text: string; color: string; t: number; }
export interface Spark { x: number; y: number; t: number; color: string; }

export interface RunRecord { label: string; energy: number; time: number; }

export interface GameState {
  rng: Rng;
  run: RunState;
  epoch: EpochState;
  cycle: CycleState;
  legacy: LegacyState;
  settings: Settings;
  // 瞬时
  balls: Ball[];
  bossBalls: Ball[];
  marbles: Marble[];
  enemies: EnemyMarble[];
  toasts: Toast[];
  sparks: Spark[];
  slotFlash: number[];
  pegFlash: number[];
  bigFlash: { text: string; t: number } | null;
  lastSalvo: { amount: number; t: number } | null;
  incomeAcc: number; incomePerSec: number; autoAcc: number;
  history: RunRecord[];
}
