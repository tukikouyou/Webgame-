/* 颜色工具(渲染 / UI 用)。纯函数,但归在 render 侧,因为只服务于表现。 */

export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}

// 由炮台主色派生较亮的领地格子色
export function deriveCell(ball: string): string { return shade(ball, 0.40); }

// 由 hex 主色推断中文颜色名(HSL 色相归类)
export function colorName(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dlt = mx - mn;
  if (dlt < 0.08) return l > 0.8 ? '白色' : l < 0.18 ? '黑色' : '灰色';
  let h: number;
  if (mx === r) h = ((g - b) / dlt) % 6; else if (mx === g) h = (b - r) / dlt + 2; else h = (r - g) / dlt + 4;
  h *= 60; if (h < 0) h += 360;
  const map: [number, string][] = [[15, '红色'], [45, '橙色'], [70, '黄色'], [160, '绿色'], [195, '青色'], [255, '蓝色'], [290, '紫色'], [330, '粉色'], [360, '红色']];
  for (const [t, nm] of map) if (h < t) return nm;
  return '红色';
}
