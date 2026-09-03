/* 配置聚合层:导入 JSON 数据 + 计算派生常量,统一以命名常量导出。
   core/ 与 render/ 都从这里读常量;将来移植 C# 时,JSON 直接复用、这里换成常量类。 */
import tuningJson from './tuning.json';
import teamsJson from './teams.json';
import traitsJson from './traits.json';
import skillsJson from './skills.json';
import metaJson from './meta.json';
import type { TeamDef, TraitDef, TraitKey, SkillsConfig, TuningConfig, MetaConfig, RelicDef } from './configTypes';

const T = tuningJson as unknown as TuningConfig;

/* ---- 画布 ---- */
export const W = T.canvas.W;
export const H = T.canvas.H;

/* ---- 主战场 ---- */
export const N = T.arena.N;
export const BS = T.arena.BS;
export const BX = T.arena.BX;
export const BY = T.arena.BY;
export const CS = BS / N;                 // 派生:单格像素尺寸
export const MAX_HP = T.arena.MAX_HP;
export const AMMO_CAP = T.arena.AMMO_CAP;
export const MARBLE_CAP = T.arena.MARBLE_CAP;
export const MR = T.arena.MR;
export const SHIELD_R = T.arena.SHIELD_R;
export const INIT_TERRITORY_R_RATIO = T.arena.initialTerritoryRadiusRatio;
export const CANNON_OFFSET_RATIO = T.arena.cannonOffsetRatio;
export const CANNON_HIT_R = T.arena.cannonHitRadius;
export const CANNON_DMG_CD = T.arena.cannonDmgCd;
export const FIRE_RATE_BASE = T.arena.fireRateBase;
export const FIRE_RATE_QUEUE_FACTOR = T.arena.fireRateQueueFactor;
export const MARBLE_SPAWN_OFF = T.arena.marbleSpawnOffset;
export const MARBLE_MIN_SPEED2 = T.arena.marbleMinSpeed2;
export const AIM_SPREAD = T.arena.aimSpread;
export const SWING_FREQ = T.arena.swingFreq;

/* ---- 技能弹体 ---- */
export const PR = T.projectiles.PR;
export const BBR = T.projectiles.BBR;
export const BOMB_RC = T.projectiles.BOMB_RC;
export const NBR = T.projectiles.NBR;
export const NUKE_R = T.projectiles.NUKE_R;
export const NUKE_SPEED = T.projectiles.NUKE_SPEED;
export const NUKE_FADE = T.projectiles.NUKE_FADE;
export const BOMB_SPEED = T.projectiles.bombSpeed;
export const NUKE_BALL_SPEED = T.projectiles.nukeSpeed;
export const PIERCE_SPEED = T.projectiles.pierceSpeed;
export const SKILL_R_HP_REF = T.projectiles.SKILL_R_HP_REF;
export const SKILL_R_GROW = T.projectiles.SKILL_R_GROW;
export const SKILL_R_MAX = T.projectiles.SKILL_R_MAX;
export const HOMING_SPEED = T.projectiles.HOMING_SPEED;
export const HOMING_TURN = T.projectiles.HOMING_TURN;
export const HBR = T.projectiles.HBR;
export const HOMING_SPEED_INIT = T.projectiles.homingSpeedInit;
export const PROJ_SPAWN_OFF = T.projectiles.projectileSpawnOffset;

/* ---- 专属特性调参 ---- */
export const GUARD_HP_RATIO = T.traitsTuning.GUARD_HP_RATIO;
export const GUARD_REGEN = T.traitsTuning.GUARD_REGEN;
export const GUARD_RAD = T.traitsTuning.GUARD_RAD;
export const GUARD_THICK = T.traitsTuning.GUARD_THICK;
export const GUARD_SPAN = Math.PI / 2 * T.traitsTuning.GUARD_SPAN_FACTOR;   // 派生
export const GUARD_SPIN = T.traitsTuning.GUARD_SPIN;
export const NOMAD_SPEED = T.traitsTuning.NOMAD_SPEED;
export const NOMAD_SPIN = T.traitsTuning.NOMAD_SPIN;
export const MAGNET_R = T.traitsTuning.MAGNET_R;
export const MAGNET_FORCE = T.traitsTuning.MAGNET_FORCE;
export const DMG_SHIELD_THRESHOLD = T.traitsTuning.dmgShieldThreshold;
export const DMG_SHIELD_DURATION = T.traitsTuning.dmgShieldDuration;
export const CELLREG_INTERVAL = T.traitsTuning.cellRegInterval;
export const PLINKO_AMMO_INTERVAL = T.traitsTuning.plinkoAmmoInterval;
export const REVIVE_SHIELD = T.traitsTuning.reviveShield;
export const REGEN_INTERVAL = T.traitsTuning.regenInterval;

/* ---- 左上弹珠面板 ---- */
export const PX = T.plinko.PX;
export const PY = T.plinko.PY;
export const PW = T.plinko.PW;
export const PH = T.plinko.PH;
export const SLOT_H = T.plinko.SLOT_H;
export const PBR = T.plinko.PBR;
export const SLOT_RAMP = T.plinko.SLOT_RAMP;
export const PLINKO_GRAVITY = T.plinko.gravity;
export const SLOT_REL_START = T.plinko.slotRelStart;
export const SLOT_REL_END = T.plinko.slotRelEnd;
export const SLOT_SPIN = T.plinko.slotSpin;
export const PLINKO_INIT_BALLS = T.plinko.initialBalls;

/* ---- 技能转盘 ---- */
export const WX = T.wheel.WX;
export const WY = T.wheel.WY;
export const WX2 = WX;
export const WY2 = T.wheel.WY2;
export const WR = T.wheel.WR;
export const IR = T.wheel.IR;
export const GAP_HALF = T.wheel.GAP_HALF;
export const SMALL_SEG = T.wheel.SMALL_SEG;
export const BIG_SEG = T.wheel.BIG_SEG;
export const STAR_RAMP = T.wheel.STAR_RAMP;
export const ULT_SEGMENTS = T.wheel.ULT_SEGMENTS;
export const REG_SEGMENTS = T.wheel.REG_SEGMENTS;
export const SEG = Math.PI * 2 / ULT_SEGMENTS;   // 派生:终极扇区角宽
export const PEG_OMEGA = T.wheel.PEG_OMEGA;
export const WHEEL_GRAVITY = T.wheel.gravity;
export const WHEEL_SPIN = T.wheel.wheelSpin;
export const ULTIMATE_SPIN = T.wheel.ultimateSpin;

/* ---- 特效 / 主循环 ---- */
export const PARTICLE_CAP = T.fx.particleCap;
export const TOAST_CAP = T.fx.toastCap;
export const TOAST_DURATION = T.fx.toastDuration;
export const FLASH_DURATION = T.fx.flashDuration;
export const SEG_FLASH_DURATION = T.fx.segFlashDuration;
export const WAVE_SPEED = T.fx.waveSpeed;
export const LOOP_MAX_DT = T.loop.maxDt;
export const LOOP_SUBSTEP = T.loop.subStep;
export const LOOP_MAX_SUBSTEPS = T.loop.maxSubSteps;

/* ---- 局外成长 / 波次 ---- */
export const META = metaJson as unknown as Omit<MetaConfig, 'relics' | 'wave'>;
export const META_WAVE = metaJson.wave;
export const RELICS: RelicDef[] = metaJson.relics;

/* ---- 数据表 ---- */
export const NEUTRAL = '#9c9c9c';
// TEAMS 在开局界面可被玩家改色 → 运行期可变(拷贝一份,不动原始 JSON)
export const TEAMS: TeamDef[] = (teamsJson as TeamDef[]).map(t => ({ ...t, corner: [...t.corner] as [number, number] }));
export const TRAITS = traitsJson as Record<TraitKey, TraitDef>;
export const TRAIT_KEYS = Object.keys(TRAITS) as TraitKey[];
export const SKILLS = skillsJson as unknown as SkillsConfig;
export const ULT_LABELS = SKILLS.ultimate;

/* ---- 派生几何:面板钉板 ---- */
export interface Peg { x: number; y: number; }
export const pegs: Peg[] = (() => {
  const out: Peg[] = [];
  const rows = T.plinko.pegRows, rowSp = T.plinko.pegRowSpacing;
  const colSp = T.plinko.pegColSpacing, rowTop = T.plinko.pegRowTop;
  for (let r = 0; r < rows; r++) {
    const y = PY + rowTop + r * rowSp;
    for (let x = PX + 26 + (r % 2) * 20; x < PX + PW - 16; x += colSp) out.push({ x, y });
  }
  return out;
})();

/* ---- 派生几何:转盘旋转节点 ---- */
export interface WheelPeg { r: number; a: number; }
export const wheelPegs: WheelPeg[] = (() => {
  const out: WheelPeg[] = [{ r: 8, a: -Math.PI / 2 }];
  for (let i = 0; i < 5; i++) out.push({ r: 30, a: i * Math.PI * 2 / 5 + Math.PI / 2 });
  for (let i = 0; i < 9; i++) out.push({ r: 58, a: i * Math.PI * 2 / 9 + Math.PI / 9 });
  for (let i = 0; i < 12; i++) out.push({ r: 84, a: i * Math.PI * 2 / 12 });
  return out;
})();

export type { TeamDef, TraitDef, TraitKey, SkillsConfig, CannonDefaults } from './configTypes';
