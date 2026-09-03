/* 全部游戏实体 + GameState 的类型定义。
   这些接口对应将来 C# 的 class:一个 GameState 持有所有可变数据,
   系统函数签名统一为 fn(state, h)。core/ 内禁止出现 ctx/document/window。 */
import type { TraitKey } from '../config/configTypes';
import type { Rng } from './rng';

/* ---- 环卫挡板 ---- */
export interface Guard {
  ang: number;
  alive: boolean;
  hp: number;
  maxHp: number;
  regen: number;
}

/* ---- 炮台 ---- */
export interface Cannon {
  idx: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number;      // 计时护盾(秒)
  shieldHp: number;    // 永久护盾值
  lives: number;       // 额外生命
  purge: boolean;      // 复活后延迟清场标记
  ammo: number;        // 累计弹药
  queue: number;       // 待发子弹
  fireAcc: number;
  dmgCd: number;
  alive: boolean;
  trait: TraitKey;
  dmgTaken: number;    // 累计受伤(应激护盾)
  regenAcc: number;    // 背水回血计时
  cellRegAcc: number;  // 固土计时
  plinkoAcc: number;   // 增殖计时
  nomadDir: number;    // 游牧漂移方向
  guards: Guard[];
  phase: number;       // 炮口摆动相位
  base: number;        // 炮口基准朝向
  aim: number;         // 当前炮口角度
  baseAmmo: number;    // RELEASE 后弹药底数
  ammoMul: number;
}

/* ---- 各类弹体 ---- */
export interface Marble { x: number; y: number; vx: number; vy: number; c: number; hp: number; }
export interface PlinkoBall { x: number; y: number; vx: number; vy: number; c: number; hp: number; }   // hp = 本体值(初始1,可被终极技能提升)
export interface WheelBall { x: number; y: number; vx: number; vy: number; c: number; inRing: boolean; plinkoHp: number; src: PlinkoBall | null; }   // plinkoHp = 携带的本体值快照;src = 来源面板球(用于"本体+1"回写,null=球已消失)
export interface PierceBall { x: number; y: number; vx: number; vy: number; c: number; hp: number; }
export interface BombBall { x: number; y: number; vx: number; vy: number; c: number; dead: boolean; }
export interface NukeBall { x: number; y: number; vx: number; vy: number; c: number; dead: boolean; }
export interface HomingBall { x: number; y: number; dir: number; c: number; hp: number; }
export interface Shockwave { x: number; y: number; r: number; c: number; fade: number; claimR: number; }   // fade=达到最大半径后的淡出剩余秒数;claimR=已染色到的半径

/* ---- 特效缓冲(逻辑写入,渲染只读) ---- */
export interface Wave { x: number; y: number; r: number; max: number; col: string; }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; sz: number; }
export interface Toast { text: string; col: string; t: number; }
export interface Flash { slot: number; t: number; }
export interface SegFlash { s: number; t: number; col: string; }

/* ---- 可变配置(调试面板实时写入) ---- */
export interface Cfg {
  trait: TraitKey[];
  spMin: number[];
  spMax: number[];
  damp: number[];
  swing: number[];
  fireRateMax: number[];
  marbleDmg: number[];
}

/* ---- 聚合状态 ---- */
export interface GameState {
  // 战场格子
  cells: Int16Array;
  cellHp: Int16Array;
  dirtyCells: Set<number>;   // 本帧被修改、待渲染重绘的格子下标
  gridDirtyAll: boolean;     // reset 后需整屏重绘

  // 实体集合
  cannons: Cannon[];
  marbles: Marble[];
  counts: number[];
  plinkoBalls: PlinkoBall[];
  wheelBalls: WheelBall[];
  pierceBalls: PierceBall[];
  bombBalls: BombBall[];
  nukeBalls: NukeBall[];
  homingBalls: HomingBall[];
  ultraBalls: WheelBall[];
  shockwaves: Shockwave[];

  // 特效缓冲
  waves: Wave[];
  particles: Particle[];
  toasts: Toast[];
  flashes: Flash[];
  segFlashes: SegFlash[];
  segFlashes2: SegFlash[];

  // 计时 / 全局标量
  t: number;
  theta: number;
  theta2: number;
  pegTheta: number;
  plusVal: number;
  gameOver: boolean;
  winner: Cannon | null;
  winTimer: number;
  confettiT: number;

  // 波次 / 事件(roguelike)
  wave: number;
  waveMaxed: boolean;
  waveTime: number;
  eventAcc: number;
  eventBanner: { name: string; icon: string; t: number; max: number } | null;   // 触发事件时的背景水印(渲染读)
  bentiBuff: number[];   // 各队"本体充能"剩余秒数(>0 时该队面板球本体值临时 +1)

  // 局外成长(Meta)
  metaLevel: number;
  playerIdx: number;   // 玩家控制的炮台(其余 3 队为 AI)
  elimResult: 'kill' | 'aiKill' | null;   // 最近一次 AI 淘汰的归因(由 main 消费)
  use: import('./meta').UseMeta | null;   // 开局派生,运行期只读

  // 运行期可变数据
  labels: string[];   // 普通转盘技能标签(+n 会变)
  cfg: Cfg;
  rng: Rng;

  // territory() 每帧缓存
  territoryCacheT: number;
  territoryCache: number[];
}
