/* GameState 的创建与重置。RNG 种子由外部注入(main 传 Date.now(),测试传固定值),
   使 core 保持纯净、且可复现。 */
import type { GameState, Cfg, Cannon } from './types';
import type { TraitKey } from '../config/configTypes';
import { createRng } from './rng';
import { initTrait } from './cannons';
import { newPlinkoBall } from './plinko';
import {
  TEAMS, SKILLS, N, BX, BY, BS, CS, MAX_HP, AMMO_CAP,
  INIT_TERRITORY_R_RATIO, CANNON_OFFSET_RATIO, PLINKO_INIT_BALLS,
} from '../config/config';
import { useMeta, metaStartingHp, metaStartingLives } from './meta';
import type { MetaState } from './meta';

export function createCfg(): Cfg {
  const d = SKILLS.cannonDefaults;
  const four = <T>(v: T): T[] => [v, v, v, v];
  return {
    trait: [...SKILLS.defaultTraits] as TraitKey[],
    spMin: four(d.spMin),
    spMax: four(d.spMax),
    damp: four(d.damp),
    swing: four(d.swing),
    fireRateMax: four(d.fireRateMax),
    marbleDmg: four(d.marbleDmg),
  };
}

export function createState(seed: number): GameState {
  const s: GameState = {
    cells: new Int16Array(N * N),
    cellHp: new Int16Array(N * N),
    dirtyCells: new Set<number>(),
    gridDirtyAll: true,
    cannons: [], marbles: [], counts: [0, 0, 0, 0],
    plinkoBalls: [], wheelBalls: [], pierceBalls: [], bombBalls: [],
    nukeBalls: [], homingBalls: [], ultraBalls: [], shockwaves: [],
    waves: [], particles: [], toasts: [], flashes: [], segFlashes: [], segFlashes2: [],
    t: 0, theta: 0, theta2: 0, pegTheta: 0, plusVal: 1,
    gameOver: false, winner: null, winTimer: 0, confettiT: 0,
    wave: 1, waveMaxed: false, waveTime: 0, eventAcc: 0, eventBanner: null,
    bentiBuff: [0, 0, 0, 0],
    metaLevel: 1, playerIdx: 0, elimResult: null, use: null,
    labels: [...SKILLS.normal],
    cfg: createCfg(),
    rng: createRng(seed),
    territoryCacheT: -1, territoryCache: [0, 0, 0, 0],
  };
  resetState(s);
  return s;
}

// 重置一局(保留 s.cfg —— 玩家选的特性/调试数值)。seed 非空则重新置种。
// meta: 局外存档(金币/等级/遗物),非空时套用局外加成;wave: 波次(roguelike 难度)。
export function resetState(s: GameState, meta: MetaState | null = null, seed?: number): void {
  if (seed != null) s.rng.seed = seed;
  s.t = 0; s.theta = 0; s.theta2 = 0; s.pegTheta = 0;
  s.plusVal = 1; s.labels = [...SKILLS.normal];
  s.gameOver = false; s.winner = null; s.winTimer = 0; s.confettiT = 0;
  s.wave = 1; s.waveMaxed = false; s.waveTime = 0; s.eventAcc = 0;
  s.eventBanner = null;
  s.bentiBuff = [0, 0, 0, 0];
  s.elimResult = null;
  s.marbles = []; s.plinkoBalls = []; s.wheelBalls = []; s.pierceBalls = [];
  s.bombBalls = []; s.nukeBalls = []; s.homingBalls = []; s.ultraBalls = [];
  s.shockwaves = []; s.waves = []; s.particles = []; s.toasts = [];
  s.flashes = []; s.segFlashes = []; s.segFlashes2 = [];
  s.counts = [0, 0, 0, 0];
  s.territoryCacheT = -1; s.territoryCache = [0, 0, 0, 0];

  s.cells = new Int16Array(N * N).fill(-1);
  s.cellHp = new Int16Array(N * N).fill(1);

  // 初始领地:四角四分之一圆
  const R = N * INIT_TERRITORY_R_RATIO;
  const cc = TEAMS.map(tm => [tm.corner[0] * (N - 1), tm.corner[1] * (N - 1)]);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let o = -1;
    for (let c = 0; c < 4; c++) {
      const dx = i - cc[c][0], dy = j - cc[c][1];
      if (dx * dx + dy * dy < R * R) { o = c; break; }
    }
    s.cells[j * N + i] = o;
  }
  // 全屏重绘标记(渲染层据此整屏刷格子)
  s.dirtyCells.clear();
  s.gridDirtyAll = true;

  const u = meta ? useMeta(meta, AMMO_CAP) : null;   // 局外加成:仅玩家享受
  s.cannons = TEAMS.map((tm, idx): Cannon => {
    const off = Math.round(N * CANNON_OFFSET_RATIO);
    const ci = tm.corner[0] ? N - 1 - off : off;
    const cj = tm.corner[1] ? N - 1 - off : off;
    const x = BX + (ci + 0.5) * CS, y = BY + (cj + 0.5) * CS;
    const isPlayer = idx === s.playerIdx;
    const hp = (u && isPlayer) ? metaStartingHp(u, MAX_HP) : MAX_HP;
    const c: Cannon = {
      idx, x, y, hp, maxHp: hp, shield: 0, shieldHp: 0,
      lives: (u && isPlayer) ? metaStartingLives(u) : 0, purge: false,
      ammo: 1, queue: 10, fireAcc: 0, dmgCd: 0, alive: true,
      trait: s.cfg.trait[idx],
      dmgTaken: 0, regenAcc: 0, cellRegAcc: 0, plinkoAcc: 0,
      nomadDir: s.rng.angle(), guards: [], phase: s.rng.angle(),
      base: Math.atan2(BY + BS / 2 - y, BX + BS / 2 - x), aim: 0,
      baseAmmo: 1, ammoMul: 1,
    };
    initTrait(c);
    return c;
  });
  s.use = u;
  s.metaLevel = meta ? meta.level : 1;

  // 弹珠面板:每色初始小球(受增殖特性影响;额外弹珠遗物只给玩家)
  for (let i = 0; i < 4; i++) {
    const extra = (u && i === s.playerIdx) ? u.extraPlinko : 0;
    const base = PLINKO_INIT_BALLS + (s.cannons[i].trait === 'plinko' ? 1 : 0) + extra;
    for (let n = 0; n < base; n++) s.plinkoBalls.push(newPlinkoBall(s, i));
  }
}
