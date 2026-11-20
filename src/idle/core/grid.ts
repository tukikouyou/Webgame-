/* 战场几何:全局列号 → 维度/区号,以及格子血量和区域价值。无状态纯函数。
   血量和能量价值都按「全局第几区」连续增长:boss 区是一个尖峰(×bossCellMul),下一维第 1 区接着往上涨。
   一轮的战场是连续的:1 维 1 区 → … → 1 维 boss 区 → 2 维 1 区 → …;列号 < 0 是开局领土。 */
import { T } from '../config/tuning';

export function colsPerDim(): number { return (T.regionsPerDim + 1) * T.regionCols; }
export function bossRegionNo(): number { return T.regionsPerDim + 1; }

export interface ColInfo { dim: number; region: number; isBoss: boolean; regionStart: number; }

export function colInfo(c: number): ColInfo {
  const cc = Math.max(0, c);
  const cpd = colsPerDim();
  const dim = Math.floor(cc / cpd) + 1;
  const within = cc - (dim - 1) * cpd;
  const region = Math.floor(within / T.regionCols) + 1;
  return {
    dim, region,
    isBoss: region === bossRegionNo(),
    regionStart: (dim - 1) * cpd + (region - 1) * T.regionCols,
  };
}

export function cellHp(c: number): number {
  if (c < 0) return 1;
  const i = colInfo(c);
  // 2 维起,前两区按上一维 boss 区的比例(第 1 区略低于 boss,第 2 区略高);第 3 区和 boss 区照原曲线
  if (i.dim > 1 && i.region <= 2) return (i.region === 1 ? T.dimR1Ratio : T.dimR2Ratio) * curveHp(i.dim - 1, bossRegionNo());
  return curveHp(i.dim, i.region);
}

/* 原连续曲线:每区 ×g,boss 区再 ×bossCellMul */
function curveHp(dim: number, region: number): number {
  return Math.pow(T.g, regionIndex(dim, region)) * Math.pow(T.dimExtra, dim - 1) * (region === bossRegionNo() ? T.bossCellMul : 1);
}

/* D 维第 r 区的转生能量价值(boss 区 r = 区数+1) */
export function regionValue(dim: number, region: number): number {
  return T.energyBase * Math.pow(T.energyRegionMul, regionIndex(dim, region)) * Math.pow(T.energyDimMul, dim - 1);
}

/* 全局第几区(从 0 开始);D 维 boss 区与 D+1 维第 1 区同级 */
export function regionIndex(dim: number, region: number): number {
  return (dim - 1) * T.regionsPerDim + (region - 1);
}

export function regionLabel(dim: number, region: number): string {
  return dim + '-' + (region === bossRegionNo() ? 'BOSS' : region);
}
