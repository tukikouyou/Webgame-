/* 功能区 2:左上弹珠面板 RELEASE / MULTIPLY / SPIN。 */
import type { GameState, PlinkoBall } from './types';
import { toast, flash } from './fx';
import { fmt } from './util';
import { capFor } from './meta';
import {
  TEAMS,
  PX, PY, PW, PH, SLOT_H, PBR, PLINKO_GRAVITY,
  SLOT_RAMP, SLOT_REL_START, SLOT_REL_END, SLOT_SPIN,
  WX, WY, IR, pegs,
} from '../config/config';

export function newPlinkoBall(s: GameState, c: number): PlinkoBall {
  return { x: s.rng.range(PX + 24, PX + PW - 24), y: PY + 26, vx: s.rng.range(-90, 90), vy: 0, c, hp: 1 };
}

function respawnPlinko(s: GameState, b: PlinkoBall): void { b.x = newPlinkoBall(s, b.c).x; b.y = PY + 26; b.vx = s.rng.range(-90, 90); b.vy = 0; /* 保留 b.hp 本体值 */ }

// 槽位边界:开局 RELEASE/MULTIPLY 各 0.40,随时间过渡到 0.16/0.64(=1:4),SPIN 固定
export function slotBounds(s: GameState): [number, number] {
  const k = Math.min(1, s.t / SLOT_RAMP);
  const rel = SLOT_REL_START + (SLOT_REL_END - SLOT_REL_START) * k;
  return [rel, SLOT_SPIN];
}

export function updatePlinko(s: GameState, h: number): void {
  const out: PlinkoBall[] = [];
  for (const b of s.plinkoBalls) {
    if (!s.cannons[b.c].alive) continue;
    b.vy += PLINKO_GRAVITY * h;
    b.x += b.vx * h; b.y += b.vy * h;
    if (b.x < PX + PBR) { b.x = PX + PBR; b.vx = Math.abs(b.vx) * 0.8; }
    if (b.x > PX + PW - PBR) { b.x = PX + PW - PBR; b.vx = -Math.abs(b.vx) * 0.8; }
    if (b.y < PY + PBR) { b.y = PY + PBR; b.vy = Math.abs(b.vy) * 0.8; }
    for (const p of pegs) {
      const dx = b.x - p.x, dy = b.y - p.y, rr = PBR + 4, d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        b.x = p.x + nx * rr; b.y = p.y + ny * rr;
        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) { b.vx -= 1.75 * dot * nx; b.vy -= 1.75 * dot * ny; }
        b.vx += s.rng.range(-25, 25);
      }
    }
    if (b.y > PY + PH - SLOT_H - PBR) {
      const f = (b.x - PX) / PW;
      const bd = slotBounds(s);
      slotEffect(s, b.c, f < bd[0] ? 0 : f < bd[1] ? 1 : 2, b);
      respawnPlinko(s, b);
    }
    out.push(b);
  }
  s.plinkoBalls = out;
}

export function slotEffect(s: GameState, ci: number, slot: number, ball: PlinkoBall | null = null): void {
  const c = s.cannons[ci];
  if (!c || !c.alive) return;
  const tm = TEAMS[ci];
  const cap = capFor(s, ci);
  const ballHp = (ball ? ball.hp : 1) + (s.bentiBuff[ci] > 0 ? 1 : 0);   // 本体值(含"本体充能"30秒临时 +1)
  if (slot === 1) {                                   // MULTIPLY:弹药 ×(1+本体值)
    c.ammo = Math.min(cap, c.ammo * (1 + ballHp));
    toast(s, tm.name + ' 弹药 ×(1+本体' + ballHp + ') → ' + fmt(c.ammo), tm.ball);
    flash(s, 1);
  } else if (slot === 0) {                            // RELEASE:先 +本体值 弹药,再全部弹药转待发发射
    c.ammo = Math.min(cap, c.ammo + ballHp);          // 无弹药时=本体值(原+1),有弹药时叠加本体值
    const ratio = (c.trait === 'dblhp') ? 0.5 : 1;    // 重弹:转换比率 0.5
    const n = Math.floor(c.ammo * ratio);
    c.queue += n; c.ammo = c.baseAmmo;
    toast(s, tm.name + ' +本体' + ballHp + ' 后发射 ' + fmt(n) + ' 发!', tm.ball);
    flash(s, 0);
  } else {                                            // SPIN:进入技能转盘(携带本体值快照 + 源球引用)
    s.wheelBalls.push({ x: WX + s.rng.range(-30, 30), y: WY - IR * 0.6, vx: s.rng.range(-60, 60), vy: 0, c: ci, inRing: false, plinkoHp: ballHp, src: ball });
    toast(s, tm.name + ' 进入转盘!', tm.ball);
    flash(s, 2);
  }
}
