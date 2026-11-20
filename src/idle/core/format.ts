/* 数字格式化:1.22K、3.80M、5.1B、7T,之后 aa、ab…(英文增量游戏常见写法)。 */
const UNITS = ['', 'K', 'M', 'B', 'T'];

function suffix(i: number): string {
  if (i < UNITS.length) return UNITS[i];
  const k = i - UNITS.length;
  return String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + k % 26);
}

export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(1) : String(Math.floor(n));
  let i = Math.floor(Math.log10(n) / 3);
  let v = n / Math.pow(1000, i);
  if (v >= 999.95) { i++; v /= 1000; }
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + suffix(i);
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}
