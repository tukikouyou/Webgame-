/* 配置数据的类型契约。这些接口对应将来 C# 里的 config 结构体 / 反序列化目标。 */

export interface TeamDef {
  name: string;
  ball: string;   // 弹珠 / 炮台主色
  cell: string;   // 领地格子色(由主色派生)
  corner: [number, number];
}

export interface TraitDef {
  name: string;
  desc: string;
}

export type TraitKey =
  | 'none' | 'plinko' | 'dmgshd' | 'regen' | 'guard'
  | 'cellreg' | 'dblhp' | 'nomad' | 'magnet' | 'phase';

export interface CannonDefaults {
  spMin: number;
  spMax: number;
  damp: number;
  swing: number;
  fireRateMax: number;
  marbleDmg: number;
}

export interface SkillsConfig {
  normal: string[];
  ultimate: string[];
  defaultTraits: TraitKey[];
  cannonDefaults: CannonDefaults;
}

/* tuning.json 的分组结构 */
export interface TuningConfig {
  canvas: { W: number; H: number };
  arena: Record<string, number>;
  projectiles: Record<string, number>;
  traitsTuning: Record<string, number>;
  plinko: Record<string, number>;
  wheel: Record<string, number>;
  fx: Record<string, number>;
  loop: Record<string, number>;
}
