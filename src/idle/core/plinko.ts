/* 钉板:落球物理(照搬原作)、特殊钉加弹药、落槽效果(空槽/倍增/发射),蓄力达到发射上限时自动发射。
   boss 钉板(高维度)与我方共用同一套落球几何。 */
import { T } from '../config/tuning';
import type { GameState, Ball, Boss, SlotKind } from './types';
import { addSalvo, spawnEnemy } from './marbles';
import { bossX, bossY } from './field';
import { baseAmmo, capValue, mulM, pegYield, ballCount, cardN, maxFuncUnits } from './economy';

export interface PegPos { x: number; y: number; }

export const PEGS: PegPos[] = (() => {
  const out: PegPos[] = [];
  for (let r = 0; r < T.pegRows; r++) {
    const y = T.PY + T.pegRowTop + r * T.pegRowSpacing;
    for (let x = T.PX + 26 + (r % 2) * 20; x < T.PX + T.PW - 16; x += T.pegColSpacing) out.push({ x, y });
  }
  return out;
})();

/* 8 个特殊钉位在 PEGS 里的下标:分布在第 2~9 行,左右错开 */
export const SPECIAL: number[] = (() => {
  const cols = [1, 6, 3, 4, 2, 5, 0, 7];
  const out: number[] = [];
  for (let k = 0; k < T.pegSlots; k++) {
    const row = 2 + k;
    const idx = PEGS.findIndex(p => Math.abs(p.y - (T.PY + T.pegRowTop + row * T.pegRowSpacing)) < 1);
    const rowLen = PEGS.filter(p => Math.abs(p.y - PEGS[idx].y) < 1).length;
    out.push(idx + Math.min(cols[k % cols.length], rowLen - 1));
  }
  return out;
})();

export const PEG_COLORS = ['#ffcf3a', '#c77dff', '#3ee07a', '#ffa34d', '#ff5c7a'];
export const PEG_COLOR_NAMES = ['暴击', '本体', '分裂', '金币', '炸弹'];

export interface SlotUnit { kind: SlotKind; color: string; card: boolean; }
const KIND_COLOR: Record<SlotKind, string> = { empty: '#3a3a44', mul: '#2f6fd6', fire: '#d64545' };

/* 我方底部 12 格的布局 */
export function computeLayout(s: GameState): SlotUnit[] {
  const unlocked = Math.min(s.epoch.funcUnlocked, maxFuncUnits(s));
  const mul = Math.max(0, Math.min(s.epoch.mulAlloc, unlocked - 1));
  const fire = unlocked - mul;
  return arrangeSlots([
    { unit: { kind: 'mul', color: KIND_COLOR.mul, card: false }, count: mul },
    { unit: { kind: 'fire', color: KIND_COLOR.fire, card: false }, count: fire },
    { unit: { kind: 'mul', color: '#5aa9ff', card: true }, count: cardN(s, 'mulSlot') },
    { unit: { kind: 'fire', color: '#ff6b6b', card: true }, count: cardN(s, 'fireSlot') },
  ]);
}

/* boss 钉板的布局(固定) */
export function bossLayout(): SlotUnit[] {
  return arrangeSlots([
    { unit: { kind: 'mul', color: KIND_COLOR.mul, card: false }, count: T.bossBoardMul },
    { unit: { kind: 'fire', color: KIND_COLOR.fire, card: false }, count: T.bossBoardFire },
  ]);
}

/* 功能格在整排均匀分布,各类交错 */
function arrangeSlots(groups: { unit: SlotUnit; count: number }[]): SlotUnit[] {
  const n = T.slotUnits;
  const items: { key: number; unit: SlotUnit }[] = [];
  for (const g of groups) for (let j = 0; j < g.count; j++) items.push({ key: (j + 0.5) / g.count, unit: g.unit });
  items.sort((a, b) => a.key - b.key);
  const k = Math.min(items.length, n);
  const out: SlotUnit[] = Array.from({ length: n }, () => ({ kind: 'empty' as SlotKind, color: KIND_COLOR.empty, card: false }));
  for (let i = 0; i < k; i++) out[Math.floor((i + 0.5) * n / k)] = items[i].unit;
  return out;
}

function newBall(s: GameState): Ball {
  return { x: s.rng.range(T.PX + 24, T.PX + T.PW - 24), y: T.PY + 60, vx: s.rng.range(-90, 90), vy: 0, lastPeg: -1 };
}

export function updatePlinko(s: GameState, h: number): void {
  const want = ballCount(s);
  while (s.balls.length < want) {
    const b = newBall(s);
    b.y -= s.balls.length * 12;            // 错开下落
    s.balls.push(b);
  }
  if (s.balls.length > want) s.balls.length = want;

  const layout = computeLayout(s);
  const owned = new Map<number, number>();  // 特殊钉位 → 等级
  for (const p of s.epoch.pegs) owned.set(p.slot, p.level);

  for (const b of s.balls) {
    const u = moveBall(s, b, h, i => {
      const slot = SPECIAL.indexOf(i);
      const lv = slot >= 0 ? owned.get(slot) : undefined;
      if (lv !== undefined) {
        s.run.ammo += pegYield(lv);
        s.pegFlash[slot] = 0.3;
      }
    });
    if (u >= 0) {
      slotEffect(s, layout[u].kind);
      s.slotFlash[u] = 0.35;
    }
  }
  if (s.run.ammo >= capValue(s)) doFire(s);   // 蓄满发射上限 → 自动发射
}

/* 推进一颗球(玩家与 boss 钉板共用同一套几何);落到底返回落槽下标并换成新球,否则返回 −1。
   球第一次碰到某颗钉子时调用 onPeg(钉子下标)。 */
function moveBall(s: GameState, b: Ball, h: number, onPeg?: (pegIndex: number) => void): number {
  b.vy += T.plinkoGravity * h;
  b.x += b.vx * h; b.y += b.vy * h;
  if (b.x < T.PX + T.PBR) { b.x = T.PX + T.PBR; b.vx = Math.abs(b.vx) * 0.8; }
  if (b.x > T.PX + T.PW - T.PBR) { b.x = T.PX + T.PW - T.PBR; b.vx = -Math.abs(b.vx) * 0.8; }
  for (let i = 0; i < PEGS.length; i++) {
    const p = PEGS[i];
    const dx = b.x - p.x, dy = b.y - p.y, rr = T.PBR + 4, d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0.0001) {
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      b.x = p.x + nx * rr; b.y = p.y + ny * rr;
      const dot = b.vx * nx + b.vy * ny;
      if (dot < 0) { b.vx -= 1.75 * dot * nx; b.vy -= 1.75 * dot * ny; }
      b.vx += s.rng.range(-25, 25);
      if (b.lastPeg !== i) { b.lastPeg = i; if (onPeg) onPeg(i); }
    }
  }
  if (b.y <= T.PY + T.PH - T.SLOT_H - T.PBR) return -1;
  const u = Math.min(T.slotUnits - 1, Math.max(0, Math.floor((b.x - T.PX) / T.PW * T.slotUnits)));
  Object.assign(b, newBall(s));
  return u;
}

/* ---- boss 钉板(第 bossBoardDim 维起):攒弹药、倍增,落进发射槽或蓄满时齐射一波敌方弹珠,
   叠加在 boss 的常规火力之上 ---- */
export function updateBossBoard(s: GameState, h: number): void {
  const b = s.run.boss;
  if (!b || !b.alive || !b.board) { s.bossBalls.length = 0; return; }
  while (s.bossBalls.length < T.bossBoardBalls) {
    const nb = newBall(s);
    nb.y -= s.bossBalls.length * 12;
    s.bossBalls.push(nb);
  }
  if (s.bossBalls.length > T.bossBoardBalls) s.bossBalls.length = T.bossBoardBalls;

  const layout = bossLayout();
  for (const ball of s.bossBalls) {
    const u = moveBall(s, ball, h);
    if (u < 0) continue;
    b.bAmmo += T.bossBoardAmmo;
    const kind = layout[u].kind;
    if (kind === 'mul') { b.bAmmo *= 1 + Math.pow(T.mulDecay, b.bMultK - 1); b.bMultK++; }
    else if (kind === 'fire') bossBoardFire(b);
  }
  if (b.bAmmo >= T.bossSalvoCap) bossBoardFire(b);

  b.bEmitAcc += T.bossSalvoRate * h;
  while (b.bEmitAcc >= 1 && b.bQueue >= 1) {
    b.bEmitAcc -= 1;
    b.bQueue -= 1;
    spawnEnemy(s, bossX(b), bossY(b));
  }
  if (b.bQueue < 1) b.bEmitAcc = 0;
}

function bossBoardFire(b: Boss): void {
  b.bQueue += Math.min(Math.floor(b.bAmmo), T.bossSalvoCap);
  b.bAmmo = 0;
  b.bMultK = 1;
}

/* 每颗球落进任何槽都先带来「底弹」数量的弹药,再结算槽效果(空槽只有底弹) */
function slotEffect(s: GameState, kind: SlotKind): void {
  const r = s.run;
  r.ammo += baseAmmo(s);
  if (kind === 'mul') { r.ammo *= 1 + mulM(s) * Math.pow(T.mulDecay, r.multK - 1); r.multK++; }
  else if (kind === 'fire') doFire(s);
}

/* 发射:min(弹药, 发射上限) 进入待发;超出部分留作下一轮起始弹药(最多等于上限) */
export function doFire(s: GameState): void {
  const r = s.run;
  const cap = capValue(s);
  const amount = Math.min(r.ammo, cap);
  const carry = Math.min(r.ammo - amount, cap);
  if (amount > 0) addSalvo(s, amount);
  r.ammo = carry;
  r.multK = 1;
}
