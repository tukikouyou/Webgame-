/* 《弹珠升维》demo 的全部数值参数。T 是可变对象:调试页可以实时修改。
   以后翻译成 C# 时,这里对应一个配置类/JSON。 */
export const T = {
  // ---- 画布布局(屏幕像素) ----
  W: 1600, H: 720,
  FX: 380, FY: 300,            // 战场左上角
  viewCols: 100,               // 战场可见列数

  // ---- 钉板几何(沿用原作尺寸) ----
  PX: 14, PY: 14, PW: 336, PH: 690, SLOT_H: 46, PBR: 7, plinkoGravity: 420,
  pegRows: 12, pegRowSpacing: 44, pegColSpacing: 40, pegRowTop: 78,

  // ---- 战场 ----
  rows: 13, cellPx: 12,
  regionCols: 40, regionsPerDim: 3,   // 每维 3 个普通区 + 1 个 boss 区
  bandCols: 20,                // 前线后方多少列以内仍可被反推(争夺区)
  frontRatio: 0.9,             // 一列我方占比 ≥ 90% 才算推过
  cannonBehind: 25,            // 炮台在前线后方多少列
  lookahead: 70,               // 前线前方预生成多少列
  homeCols: 3,                 // 开局自带的领土列数

  // ---- 敌方 ----
  g: 4,                        // 每推进一区格子血量 ×g(跨维度连续:2-1 接着 1 维 boss 之后继续涨)
  dimExtra: 1,                 // 每升一维额外再 ×此值
  bossCellMul: 5,              // boss 区格子血量倍率
  bossHpRatio: 0.5,            // boss 本体血量 = boss 区格子总血量 × 此值
  bossShieldRatio: 0.1,        // boss 区敌格占比 ≤ 此值时护盾破除
  pushNormal: 0.3,             // 普通区敌方反推弹珠/秒
  pushBoss: 5,                 // boss 区敌方反推弹珠/秒
  bossFire: 2,                 // boss 本体弹珠/秒
  enemyDmgMul: 1,              // 敌方弹珠伤害 = 所在列格子血量 × 此值
  enemySpeed: 150, enemyCap: 300,

  // ---- 我方弹珠 ----
  marbleSpeed: 230, marbleLife: 10,   // 弹珠不减速,飞行 marbleLife 秒后消失
  marbleCap: 400,              // 场上弹珠上限(超出就合并成大弹珠)
  emitRate: 150,               // 每秒发出弹珠数
  salvoSeconds: 2,             // 一次齐射大约多少秒打完

  // ---- 钉板 / 弹药 ----
  initBalls: 2, slotUnits: 12, startMul: 2, startFire: 2,
  mulDecay: 0.7,               // 第 k 次倍增 = 1 + m × mulDecay^(k−1)
  pegSlots: 8,                 // 特殊钉位数量
  pegYield0: 25, pegYieldMul: 1.6,   // 特殊钉每次被撞:弹药 + pegYield0 × pegYieldMul^(等级−1)

  // ---- 炮台升级(金币) ----
  dmgMul: 1.09, dmgCost0: 10, dmgCostMul: 1.15,
  capBase: 100, capMul: 1.6, capCost0: 50, capCostMul: 1.4,
  baseAmmo0: 10, baseAmmoMul: 1.1, baseAmmoCost0: 20, baseAmmoCostMul: 1.6,

  // ---- 金币 ----
  bountyMul: 1,                // 占领一格得 格子血量 × 此值 金币
  incomeRate: 0.02,            // 己方格子每秒产出 格子血量 × 此值

  // ---- 维度能量(转生) ----
  energyBase: 4,               // 区域能量价值的整体倍率
  energyRegionMul: 1.6,        // 每推进一区能量价值 ×此值(跨维度连续)
  energyDimMul: 1,             // 每升一维能量价值额外 ×此值
  energyBossKill: 10,          // 击败 boss 额外奖励 = 该维第 1 区价值 × 此值
  pegCost0: 2, pegCostMul: 1.6, pegUpCost0: 3, pegUpCostMul: 1.5,
  widthCost0: 5, widthCostMul: 1.4,

  // ---- 自动化 ----
  autoRebirthSec: 90,          // 自动转生:最远纪录多少秒没刷新
  autoUnlockDim: 2,            // 到达几维解锁自动升级/自动转生

  // ---- 纪元 / 传承 ----
  epochDim: 5,
  sandPerRegion: 0.5,          // 终结纪元:本轮推过第 1 个区得多少星砂
  sandRegionGrow: 1.11,        // 之后每个区比上一个区 ×此值(累加;约每维 ×1.5)
  packCost0: 10, packCostMul: 1.25,
  legacyDim: 10,
};

export type Tuning = typeof T;

/* 调试页可以实时调整的参数 */
export const TUNABLE: [keyof Tuning, string][] = [
  ['g', '每区敌方血量倍率 g'],
  ['dimExtra', '每维额外血量倍率'],
  ['bossCellMul', 'boss 区格子倍率'],
  ['bossHpRatio', 'boss 本体血量比例'],
  ['pushNormal', '普通区反推(弹珠/秒)'],
  ['pushBoss', 'boss 区反推(弹珠/秒)'],
  ['bossFire', 'boss 开火(弹珠/秒)'],
  ['dmgMul', '伤害每级倍率'],
  ['dmgCostMul', '伤害价格每级倍率'],
  ['capBase', '发射上限初始值'],
  ['capMul', '发射上限每级倍率'],
  ['baseAmmo0', '底弹初始值'],
  ['mulDecay', '倍增递减系数'],
  ['pegYield0', '钉子基础弹药'],
  ['pegYieldMul', '钉子每级弹药倍率'],
  ['bountyMul', '占领奖励倍率'],
  ['incomeRate', '格子每秒产出比例'],
  ['energyBase', '区域能量基数'],
  ['energyRegionMul', '能量每区倍率'],
  ['autoRebirthSec', '自动转生秒数'],
  ['epochDim', '终结纪元所需维度'],
  ['sandPerRegion', '第 1 区星砂'],
  ['sandRegionGrow', '每区星砂增长倍率'],
  ['legacyDim', '传承所需维度'],
];
