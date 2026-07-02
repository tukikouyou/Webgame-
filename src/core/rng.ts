/* 可置种随机数(mulberry32)。逻辑全部走它 → core 确定性可测、可复现,
   且对应 C# 里同样实现的 PRNG(移植时行为一致)。 */

export interface Rng {
  seed: number;
  next(): number;                 // [0, 1)
  range(a: number, b: number): number;
  angle(): number;                // [0, 2π)
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return {
    get seed() { return seed; },
    set seed(v: number) { seed = v; s = v >>> 0; },
    next,
    range: (a, b) => a + next() * (b - a),
    angle: () => next() * Math.PI * 2,
  };
}
