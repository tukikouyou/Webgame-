/* 特效缓冲:逻辑层写入,渲染层只读。 */
import type { GameState } from './types';

export function toast(s: GameState, text: string, color = '#ddd'): void {
  s.toasts.push({ text, color, t: 3.5 });
  if (s.toasts.length > 6) s.toasts.shift();
}

export function spark(s: GameState, x: number, y: number, color: string): void {
  if (s.sparks.length < 300) s.sparks.push({ x, y, t: 0.35, color });
}

export function bigFlash(s: GameState, text: string): void {
  s.bigFlash = { text, t: 2.5 };
}

export function updateFx(s: GameState, h: number): void {
  for (const t of s.toasts) t.t -= h;
  s.toasts = s.toasts.filter(t => t.t > 0);
  for (const p of s.sparks) p.t -= h;
  s.sparks = s.sparks.filter(p => p.t > 0);
  for (let i = 0; i < s.slotFlash.length; i++) if (s.slotFlash[i] > 0) s.slotFlash[i] -= h;
  for (let i = 0; i < s.pegFlash.length; i++) if (s.pegFlash[i] > 0) s.pegFlash[i] -= h;
  if (s.bigFlash) { s.bigFlash.t -= h; if (s.bigFlash.t <= 0) s.bigFlash = null; }
  if (s.lastSalvo) { s.lastSalvo.t -= h; if (s.lastSalvo.t <= 0) s.lastSalvo = null; }
}
