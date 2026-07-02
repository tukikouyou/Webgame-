/* 特效缓冲:逻辑层通过这些函数把"表现事件"写进 state,渲染层只读不写。
   逻辑层因此完全不碰 Canvas。 */
import type { GameState } from './types';
import { PARTICLE_CAP, TOAST_CAP, TOAST_DURATION, FLASH_DURATION, WAVE_SPEED } from '../config/config';

export function explosion(s: GameState, x: number, y: number, col: string, n = 70, sp = 420): void {
  for (let i = 0; i < n; i++) {
    const a = s.rng.next() * 6.283, spd = s.rng.range(40, sp);
    s.particles.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: s.rng.range(0.4, 1.1), max: 1.1, col, sz: s.rng.range(2, 5),
    });
  }
}

export function spark(s: GameState, x: number, y: number, col: string): void {
  if (s.particles.length < PARTICLE_CAP) {
    s.particles.push({
      x, y, vx: s.rng.range(-120, 120), vy: s.rng.range(-120, 120),
      life: 0.3, max: 0.3, col, sz: 2,
    });
  }
}

export function toast(s: GameState, text: string, col: string): void {
  s.toasts.push({ text, col, t: TOAST_DURATION });
  if (s.toasts.length > TOAST_CAP) s.toasts.shift();
}

export function flash(s: GameState, slot: number): void {
  s.flashes.push({ slot, t: FLASH_DURATION });
}

export function updateParticles(s: GameState, h: number): void {
  const out = [];
  for (const p of s.particles) {
    p.life -= h;
    if (p.life <= 0) continue;
    p.x += p.vx * h; p.y += p.vy * h;
    p.vx *= 0.98; p.vy *= 0.98;
    out.push(p);
  }
  s.particles = out;
}

export function updateWaves(s: GameState, h: number): void {
  for (const w of s.waves) w.r += WAVE_SPEED * h;
  s.waves = s.waves.filter(w => w.r < w.max);
}

export function updateToasts(s: GameState, h: number): void {
  for (const o of s.toasts) o.t -= h;
  s.toasts = s.toasts.filter(o => o.t > 0);
  for (const f of s.flashes) f.t -= h;
  s.flashes = s.flashes.filter(f => f.t > 0);
}
