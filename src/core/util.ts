/* 纯函数工具(无 DOM/Canvas)。 */

export function norm(a: number): number {
  a %= Math.PI * 2;
  if (a < 0) a += Math.PI * 2;
  return a;
}

export function fmt(n: number): string {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'k';
  return '' + n;
}
