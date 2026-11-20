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
  fullContestDim: 6,           // 从第几维起取消巩固区:整个维度都可以被 boss 抢回
  frontRatio: 0.9,             // 一列我方占比 ≥ 90% 才算推过
  cannonBehind: 25,            // 炮台在前线后方多少列
  lookahead: 70,               // 前线前方预生成多少列
  homeCols: 3,                 // 开局自带的领土列数

  // ---- 敌方 ----
  g: 4,                        // 每推进一区格子血量 ×g(跨维度连续:2-1 接着 1 维 boss 之后继续涨)
  dimExtra: 1,                 // 每升一维额外再 ×此值
  bossCellMul: 5,              // boss 区格子血量倍率
  bossHpRatio: 2,              // boss 本体血量 = boss 区格子总血量 × 此值 × bossHpDimMul^(维度−1)
  bossHpDimMul: 1,             // boss 本体血量每维额外倍率
  bossShieldRatio: 0.1,        // boss 区敌格占比 ≤ 此值时护盾破除
  bossRegen: 0.01,             // boss 每秒回复最大血量的比例(破盾后的回血当作第二阶段:拖慢击杀,但一般不至于打不动)
  bossCircleHit: 0,            // 0 = 普通 boss:弹珠打到 boss 区末端墙就算命中;1 = 圆形碰撞(以后做成特殊 boss 的特性)
  // 敌方弹珠全部由 boss 发射,每一维开局就开火
  bossFireBase: 1,             // 前线在第 1 区时 boss 每秒发射数
  bossFireStep: 1.5,           // 前线每推进一个普通区,每秒多发这么多(1 → 2.5 → 4 → boss 区 7)
  bossFire: 7,                 // 前线进入 boss 区后 boss 每秒发射数
  bossFullFireDim: 6,          // 从第几维起 boss 整个维度都按 boss 区火力发射(不再按区递增)
  enemyDmgMul: 1,              // 敌方弹珠威力 = 所在区格子满血 × 此值(飞进哪个区就按哪个区算)
  enemySpeed: 150, enemyCap: 300,
  // boss 钉板:从第 bossBoardDim 维起,boss 也有一块钉板,齐射叠加在常规火力上
  bossBoardDim: 6,
  bossBoardBalls: 2,           // boss 钉板上的球数
  bossBoardMul: 3, bossBoardFire: 2,   // boss 钉板的倍增格 / 发射格数(其余为空槽)
  bossBoardAmmo: 1,            // 每颗球落槽带来的弹药
  bossSalvoCap: 40,            // boss 一次齐射最多几颗(蓄满也会自动发射)
  bossSalvoRate: 20,           // boss 齐射时每秒射出几颗

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
  // 发射上限每维约 ×5,与实际齐射弹药保持同一量级(金币每维 ×256,所以价格倍率要远大于上限倍率)
  capBase: 100, capMul: 1.55, capCost0: 5, capCostMul: 4.5,
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
  ['bossFireBase', 'boss 第 1 区发射(颗/秒)'],
  ['bossFireStep', 'boss 每区多发(颗/秒)'],
  ['bossFire', 'boss 区发射(颗/秒)'],
  ['bossBoardDim', 'boss 钉板起始维度'],
  ['fullContestDim', '取消巩固区起始维度'],
  ['bossFullFireDim', 'boss 全程满火力起始维度'],
  ['bossBoardBalls', 'boss 钉板球数'],
  ['bossSalvoCap', 'boss 齐射上限(颗)'],
  ['bossCircleHit', 'boss 圆形碰撞(0 整面墙 / 1 圆形)'],
  ['bossRegen', 'boss 每秒回血比例'],
  ['bossHpDimMul', 'boss 血量每维额外倍率'],
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
