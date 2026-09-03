/* §SKILLS 各技能弹体:炸弹 / 追踪弹 / 核弹+冲击波 / 贯穿弹。
   每种都有 fireXxx(发射) + updateXxx(每帧推进与碰撞)。 */
import type { GameState, Cannon, HomingBall, PierceBall, Shockwave } from './types';
import { spark, explosion, toast } from './fx';
import { setCell, markCell, paintCell } from './grid';
import { applyMagnet, shielded, hitShield, clashPermanentShield, guardHit, applyDamage } from './damage';
import { fmt } from './util';
import {
  TEAMS, N, BX, BY, BS, CS, MR, SHIELD_R, CANNON_HIT_R,
  PR, BBR, BOMB_RC, NBR, NUKE_R, NUKE_SPEED, NUKE_FADE, BOMB_SPEED, NUKE_BALL_SPEED,
  SKILL_R_HP_REF, SKILL_R_GROW, SKILL_R_MAX, HOMING_SPEED, HOMING_TURN, HBR,
  GUARD_RAD, GUARD_THICK, PROJ_SPAWN_OFF,
} from '../config/config';

/* 吞噬:清除以 (cx,cy) 为心、半径平方 = r2 范围内所有非 owner 颜色的弹体 */
function engulf(s: GameState, cx: number, cy: number, r2: number, owner: number): void {
  s.marbles = s.marbles.filter(m => {
    if (m.c !== owner) { const dx = m.x - cx, dy = m.y - cy; if (dx * dx + dy * dy < r2) { s.counts[m.c]--; return false; } }
    return true;
  });
  s.pierceBalls = s.pierceBalls.filter(p => {
    if (p.c !== owner) { const dx = p.x - cx, dy = p.y - cy; if (dx * dx + dy * dy < r2) return false; }
    return true;
  });
  s.homingBalls = s.homingBalls.filter(b => {
    if (b.c !== owner) { const dx = b.x - cx, dy = b.y - cy; if (dx * dx + dy * dy < r2) return false; }
    return true;
  });
  for (const ob of s.bombBalls) { if (ob.c !== owner && !ob.dead) { const dx = ob.x - cx, dy = ob.y - cy; if (dx * dx + dy * dy < r2) ob.dead = true; } }
  for (const ob of s.nukeBalls) { if (ob.c !== owner && !ob.dead) { const dx = ob.x - cx, dy = ob.y - cy; if (dx * dx + dy * dy < r2) ob.dead = true; } }
}

/* ---- 动态半径与扫格工具(贯穿/追踪共用) ---- */
export function skillRadius(base: number, hp: number): number {
  return Math.min(SKILL_R_MAX, base + Math.sqrt(Math.max(0, (hp || 0) - SKILL_R_HP_REF)) * SKILL_R_GROW);
}
export function pierceRadius(p: PierceBall): number { return skillRadius(PR, p.hp); }
export function homingRadius(b: HomingBall): number { return skillRadius(HBR, b.hp); }

function circleTouchesCell(x: number, y: number, r: number, ci: number, cj: number): boolean {
  const x0 = BX + ci * CS, y0 = BY + cj * CS;
  const nx = Math.max(x0, Math.min(x, x0 + CS));
  const ny = Math.max(y0, Math.min(y, y0 + CS));
  const dx = x - nx, dy = y - ny;
  return dx * dx + dy * dy <= r * r;
}

// 沿弹体移动路径检查"圆形边缘"扫过的所有格子
function eachSweptCell(x0: number, y0: number, x1: number, y1: number, r: number, fn: (ci: number, cj: number, xx: number, yy: number) => boolean): boolean {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
  const stepLen = Math.max(2, Math.min(CS * 0.45, Math.max(2, r * 0.65)));
  const steps = Math.max(1, Math.ceil(d / stepLen));
  const seen = new Set<number>();
  for (let st = 1; st <= steps; st++) {
    const xx = x0 + dx * st / steps, yy = y0 + dy * st / steps;
    const i0 = Math.max(0, Math.floor((xx - BX - r) / CS));
    const i1 = Math.min(N - 1, Math.floor((xx - BX + r) / CS));
    const j0 = Math.max(0, Math.floor((yy - BY - r) / CS));
    const j1 = Math.min(N - 1, Math.floor((yy - BY + r) / CS));
    for (let cj = j0; cj <= j1; cj++) {
      for (let ci = i0; ci <= i1; ci++) {
        const key = cj * N + ci;
        if (seen.has(key) || !circleTouchesCell(xx, yy, r, ci, cj)) continue;
        seen.add(key);
        if (fn(ci, cj, xx, yy)) return true;
      }
    }
  }
  return false;
}

// 技能弹与普通小球互拼生命
function collideSkillWithMarbles(s: GameState, obj: { x: number; y: number; c: number; hp: number }, r: number): boolean {
  const deadMarbles = [];
  for (const m of s.marbles) {
    if (m.c === obj.c || m.hp <= 0) continue;
    const dx = obj.x - m.x, dy = obj.y - m.y;
    const rr = r + MR;
    if (dx * dx + dy * dy < rr * rr) {
      const loss = Math.min(obj.hp, m.hp);
      obj.hp -= loss;
      m.hp -= loss;
      spark(s, (obj.x + m.x) / 2, (obj.y + m.y) / 2, '#fff');
      if (m.hp <= 0) deadMarbles.push(m);
      if (obj.hp <= 0) break;
    }
  }
  if (deadMarbles.length) {
    const dead = new Set(deadMarbles);
    s.marbles = s.marbles.filter(m => {
      if (dead.has(m)) { s.counts[m.c]--; return false; }
      return true;
    });
  }
  return obj.hp <= 0;
}

/* ---------- 炸弹 ---------- */
export function fireBomb(s: GameState, c: Cannon): void {
  const a = c.aim;
  s.bombBalls.push({ x: c.x + Math.cos(a) * PROJ_SPAWN_OFF, y: c.y + Math.sin(a) * PROJ_SPAWN_OFF, vx: Math.cos(a) * BOMB_SPEED, vy: Math.sin(a) * BOMB_SPEED, c: c.idx, dead: false });
  toast(s, '💣 ' + TEAMS[c.idx].name + ' 发射炸弹弹珠!', TEAMS[c.idx].ball);
}
export function updateBombs(s: GameState, h: number): void {
  const out = [];
  for (const b of s.bombBalls) {
    if (b.dead || !s.cannons[b.c].alive) continue;
    applyMagnet(s, b, h, 0.5);
    const px0 = b.x, py0 = b.y;
    b.x += b.vx * h; b.y += b.vy * h;
    if (b.x < BX + BBR) { b.x = BX + BBR; b.vx = Math.abs(b.vx); }
    else if (b.x > BX + BS - BBR) { b.x = BX + BS - BBR; b.vx = -Math.abs(b.vx); }
    if (b.y < BY + BBR) { b.y = BY + BBR; b.vy = Math.abs(b.vy); }
    else if (b.y > BY + BS - BBR) { b.y = BY + BS - BBR; b.vy = -Math.abs(b.vy); }
    let boom = false;
    const dx = b.x - px0, dy = b.y - py0, d = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(d / (CS * 0.7)));
    for (let st = 1; st <= steps; st++) {
      const xx = px0 + dx * st / steps, yy = py0 + dy * st / steps;
      const ci = ((xx - BX) / CS) | 0, cj = ((yy - BY) / CS) | 0;
      if (ci < 0 || cj < 0 || ci >= N || cj >= N) continue;
      if (s.cells[cj * N + ci] !== b.c) {
        bombAt(s, b.c, ci, cj);
        boom = true;
        break;
      }
    }
    if (boom || b.dead) continue;
    out.push(b);
  }
  s.bombBalls = out;
}
function bombAt(s: GameState, color: number, tx: number, ty: number): void {
  const bx = BX + (tx + 0.5) * CS, by = BY + (ty + 0.5) * CS;
  const rc = BOMB_RC, R = CS * rc;
  for (let j = Math.max(0, ty - rc); j <= Math.min(N - 1, ty + rc); j++)
    for (let i = Math.max(0, tx - rc); i <= Math.min(N - 1, tx + rc); i++) {
      const dx = i - tx, dy = j - ty;
      if (dx * dx + dy * dy <= rc * rc) paintCell(s, i, j, color);
    }
  engulf(s, bx, by, R * R, color);
  explosion(s, bx, by, TEAMS[color].ball, 110, 520);
  s.waves.push({ x: bx, y: by, r: 0, max: R + 30, col: TEAMS[color].ball });
  toast(s, '💣 ' + TEAMS[color].name + ' 炸弹爆炸!', TEAMS[color].ball);
}

/* ---------- 追踪弹 ---------- */
export function fireHoming(s: GameState, c: Cannon, mult: number = 1): void {
  const tm = TEAMS[c.idx];
  const n = Math.max(10, Math.floor(c.queue * 0.10));
  c.queue = Math.max(0, c.queue - n);
  const hp = n * mult;   // 本体值倍率放大威力
  const a = c.aim;
  s.homingBalls.push({ x: c.x + Math.cos(a) * PROJ_SPAWN_OFF, y: c.y + Math.sin(a) * PROJ_SPAWN_OFF, dir: a, c: c.idx, hp });
  toast(s, '🎯 ' + tm.name + ' 发射追踪弹 (HP ' + fmt(hp) + ')!', tm.ball);
}
export function updateHoming(s: GameState, h: number): void {
  const out = [];
  for (const b of s.homingBalls) {
    if (!s.cannons[b.c].alive) continue;
    if (b.hp <= 0) continue;
    let rad = homingRadius(b);
    let tgt: Cannon | null = null, best = 1e18;
    for (const cn of s.cannons) {
      if (!cn.alive || cn.idx === b.c) continue;
      const dx = cn.x - b.x, dy = cn.y - b.y, d = dx * dx + dy * dy;
      if (d < best) { best = d; tgt = cn; }
    }
    if (tgt) {
      const want = Math.atan2(tgt.y - b.y, tgt.x - b.x);
      let diff = ((want - b.dir) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); if (diff > Math.PI) diff -= Math.PI * 2;
      const turn = Math.max(-HOMING_TURN * h, Math.min(HOMING_TURN * h, diff));
      b.dir += turn;
    }
    const px0 = b.x, py0 = b.y;
    b.x += Math.cos(b.dir) * HOMING_SPEED * h;
    b.y += Math.sin(b.dir) * HOMING_SPEED * h;
    if (b.x < BX + rad) { b.x = BX + rad; b.dir = Math.PI - b.dir; }
    else if (b.x > BX + BS - rad) { b.x = BX + BS - rad; b.dir = Math.PI - b.dir; }
    if (b.y < BY + rad) { b.y = BY + rad; b.dir = -b.dir; }
    else if (b.y > BY + BS - rad) { b.y = BY + BS - rad; b.dir = -b.dir; }
    let dead = false;
    // 敌方护盾
    for (const cn of s.cannons) {
      if (cn.alive && shielded(cn) && cn.idx !== b.c) {
        const dx = b.x - cn.x, dy = b.y - cn.y, rr = SHIELD_R + rad;
        if (dx * dx + dy * dy < rr * rr) {
          let d = Math.hypot(dx, dy), nx, ny;
          if (d > 0.0001) { nx = dx / d; ny = dy / d; }
          else { nx = -Math.cos(b.dir); ny = -Math.sin(b.dir); }
          b.x = cn.x + nx * rr; b.y = cn.y + ny * rr;
          if (cn.shield <= 0 && cn.shieldHp > 0) {
            clashPermanentShield(b, cn);
          } else {
            b.hp -= Math.ceil(b.hp / 2);
            hitShield(cn);
          }
          spark(s, b.x, b.y, TEAMS[b.c].ball);
          b.dir = Math.atan2(ny, nx);
          if (b.hp <= 0) dead = true;
          rad = homingRadius(b);
          break;
        }
      }
    }
    // 敌方挡板
    if (!dead) {
      const loss = Math.ceil(b.hp / 2);
      const hcn = guardHit(s, b.x, b.y, b.c, rad, loss);
      if (hcn) {
        b.hp -= loss; spark(s, b.x, b.y, TEAMS[b.c].ball);
        const dx = b.x - hcn.x, dy = b.y - hcn.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
        rad = homingRadius(b);
        const out2 = GUARD_RAD + GUARD_THICK + rad + 0.5;
        b.x = hcn.x + nx * out2; b.y = hcn.y + ny * out2;
        b.dir = Math.atan2(ny, nx);
        if (b.hp <= 0) dead = true;
      }
    }
    // 撞普通小球
    if (!dead) {
      dead = collideSkillWithMarbles(s, b, rad);
      rad = homingRadius(b);
    }
    // 啃格子
    if (!dead) {
      dead = eachSweptCell(px0, py0, b.x, b.y, rad, (ci, cj, xx, yy) => {
        if (s.cells[cj * N + ci] === b.c) return false;
        const cl = s.cellHp[cj * N + ci];
        if (b.hp >= cl) { b.hp -= cl; setCell(s, ci, cj, b.c, 1); }
        else { s.cellHp[cj * N + ci] -= b.hp; markCell(s, ci, cj); b.hp = 0; }
        if (b.hp <= 0) { b.x = xx; b.y = yy; spark(s, xx, yy, TEAMS[b.c].ball); return true; }
        return false;
      });
      rad = homingRadius(b);
    }
    // 命中炮台
    if (!dead) {
      for (const cn of s.cannons) {
        if (!cn.alive || cn.idx === b.c || shielded(cn)) continue;
        const dx = b.x - cn.x, dy = b.y - cn.y;
        if (dx * dx + dy * dy < (CANNON_HIT_R + rad) * (CANNON_HIT_R + rad)) {
          explosion(s, b.x, b.y, TEAMS[b.c].ball, 40, 300);
          toast(s, '🎯 追踪弹命中 ' + TEAMS[cn.idx].name + ' (-' + fmt(b.hp) + ' HP)', TEAMS[b.c].ball);
          applyDamage(s, cn, b.hp, b.c);
          dead = true; break;
        }
      }
    }
    if (dead) continue;
    out.push(b);
  }
  s.homingBalls = out;
}

/* ---------- 核弹 + 冲击波 ---------- */
export function fireNuke(s: GameState, c: Cannon): void {
  const a = c.aim;
  s.nukeBalls.push({ x: c.x + Math.cos(a) * PROJ_SPAWN_OFF, y: c.y + Math.sin(a) * PROJ_SPAWN_OFF, vx: Math.cos(a) * NUKE_BALL_SPEED, vy: Math.sin(a) * NUKE_BALL_SPEED, c: c.idx, dead: false });
  toast(s, '☢ ' + TEAMS[c.idx].name + ' 发射核弹!', TEAMS[c.idx].ball);
}
export function updateNukes(s: GameState, h: number): void {
  const out = [];
  for (const b of s.nukeBalls) {
    if (b.dead || !s.cannons[b.c].alive) continue;
    applyMagnet(s, b, h, 0.5);
    const px0 = b.x, py0 = b.y;
    b.x += b.vx * h; b.y += b.vy * h;
    if (b.x < BX + NBR) { b.x = BX + NBR; b.vx = Math.abs(b.vx); }
    else if (b.x > BX + BS - NBR) { b.x = BX + BS - NBR; b.vx = -Math.abs(b.vx); }
    if (b.y < BY + NBR) { b.y = BY + NBR; b.vy = Math.abs(b.vy); }
    else if (b.y > BY + BS - NBR) { b.y = BY + BS - NBR; b.vy = -Math.abs(b.vy); }
    let boom = false;
    const dx = b.x - px0, dy = b.y - py0, d = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(d / (CS * 0.7)));
    for (let st = 1; st <= steps; st++) {
      const xx = px0 + dx * st / steps, yy = py0 + dy * st / steps;
      const ci = ((xx - BX) / CS) | 0, cj = ((yy - BY) / CS) | 0;
      if (ci < 0 || cj < 0 || ci >= N || cj >= N) continue;
      if (s.cells[cj * N + ci] !== b.c) {
        s.shockwaves.push({ x: xx, y: yy, r: 0, c: b.c, fade: NUKE_FADE, claimR: 0 });
        explosion(s, xx, yy, '#ffffff', 80, 420);
        toast(s, '☢ ' + TEAMS[b.c].name + ' 核弹引爆!', TEAMS[b.c].ball);
        boom = true;
        break;
      }
    }
    if (boom || b.dead) continue;
    out.push(b);
  }
  s.nukeBalls = out;
}
// 冲击波把覆盖到的格子染成 owner 色(随扩散渐进染色,每前进约一格才扫一次,省性能)
function claimShockCells(s: GameState, w: Shockwave): void {
  const r2 = w.r * w.r, pr2 = w.claimR * w.claimR, rc = w.r / CS;
  const cxCell = (w.x - BX) / CS, cyCell = (w.y - BY) / CS;
  const i0 = Math.max(0, Math.floor(cxCell - rc)), i1 = Math.min(N - 1, Math.ceil(cxCell + rc));
  const j0 = Math.max(0, Math.floor(cyCell - rc)), j1 = Math.min(N - 1, Math.ceil(cyCell + rc));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const dx = BX + (i + 0.5) * CS - w.x, dy = BY + (j + 0.5) * CS - w.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2 && d2 > pr2) paintCell(s, i, j, w.c);
  }
  w.claimR = w.r;
}

export function updateShockwaves(s: GameState, h: number): void {
  const out = [];
  for (const w of s.shockwaves) {
    if (w.r < NUKE_R) {
      w.r = Math.min(NUKE_R, w.r + NUKE_SPEED * h);
      engulf(s, w.x, w.y, w.r * w.r, w.c);
      if (w.r - w.claimR >= CS || w.r >= NUKE_R) claimShockCells(s, w);   // 沿途染色:核弹变更地块所属
      out.push(w);
    } else {
      // 已到最大半径:继续吞噬,并在 NUKE_FADE 秒内逐渐淡出(不再突兀消失)
      engulf(s, w.x, w.y, w.r * w.r, w.c);
      w.fade -= h;
      if (w.fade > 0) out.push(w);
    }
  }
  s.shockwaves = out;
}

/* ---------- 贯穿弹 ---------- */
export function updatePierce(s: GameState, h: number): void {
  const out = [];
  for (const p of s.pierceBalls) {
    if (!s.cannons[p.c].alive) continue;
    let rad = pierceRadius(p);
    const px0 = p.x, py0 = p.y;
    p.x += p.vx * h; p.y += p.vy * h;
    if (p.x < BX + rad) { p.x = BX + rad; p.vx = Math.abs(p.vx); }
    else if (p.x > BX + BS - rad) { p.x = BX + BS - rad; p.vx = -Math.abs(p.vx); }
    if (p.y < BY + rad) { p.y = BY + rad; p.vy = Math.abs(p.vy); }
    else if (p.y > BY + BS - rad) { p.y = BY + BS - rad; p.vy = -Math.abs(p.vy); }
    let dead = false;
    // 敌方护盾
    for (const cn of s.cannons) {
      if (cn.alive && shielded(cn) && cn.idx !== p.c) {
        const dx = p.x - cn.x, dy = p.y - cn.y, d2 = dx * dx + dy * dy, rr = SHIELD_R + rad;
        if (d2 < rr * rr) {
          let d = Math.sqrt(d2), nx, ny;
          if (d > 0.0001) { nx = dx / d; ny = dy / d; }
          else {
            const sp = Math.hypot(p.vx, p.vy) || 1;
            nx = -p.vx / sp; ny = -p.vy / sp;
          }
          p.x = cn.x + nx * rr; p.y = cn.y + ny * rr;
          const dot = p.vx * nx + p.vy * ny;
          if (dot < 0) { p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny; }
          if (cn.shield <= 0 && cn.shieldHp > 0) {
            clashPermanentShield(p, cn);
          } else {
            p.hp -= Math.ceil(p.hp / 2);
            hitShield(cn);
          }
          spark(s, p.x, p.y, TEAMS[p.c].ball);
          if (p.hp <= 0) dead = true;
          rad = pierceRadius(p);
          break;
        }
      }
    }
    // 敌方挡板
    if (!dead) {
      const loss = Math.ceil(p.hp / 2);
      const hcn = guardHit(s, p.x, p.y, p.c, rad, loss);
      if (hcn) {
        const dx = p.x - hcn.x, dy = p.y - hcn.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
        p.hp -= loss; spark(s, p.x, p.y, TEAMS[p.c].ball);
        rad = pierceRadius(p);
        const out2 = GUARD_RAD + GUARD_THICK + rad + 0.5;
        p.x = hcn.x + nx * out2; p.y = hcn.y + ny * out2;
        const dot = p.vx * nx + p.vy * ny;
        if (dot < 0) { p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny; }
        if (p.hp <= 0) dead = true;
      }
    }
    // 撞普通小球
    if (!dead) {
      dead = collideSkillWithMarbles(s, p, rad);
      rad = pierceRadius(p);
    }
    // 敌方炮台
    if (!dead) {
      for (const cn of s.cannons) {
        if (!cn.alive || cn.idx === p.c || shielded(cn)) continue;
        const dx = p.x - cn.x, dy = p.y - cn.y;
        if (dx * dx + dy * dy < (CANNON_HIT_R + rad) * (CANNON_HIT_R + rad)) {
          explosion(s, p.x, p.y, TEAMS[p.c].ball, 40, 300);
          toast(s, '💥 贯穿弹命中 ' + TEAMS[cn.idx].name + ' (-' + fmt(p.hp) + ' HP)', TEAMS[p.c].ball);
          applyDamage(s, cn, p.hp, p.c);
          dead = true;
          break;
        }
      }
    }
    // 啃格子
    if (!dead) {
      dead = eachSweptCell(px0, py0, p.x, p.y, rad, (ci, cj, xx, yy) => {
        if (s.cells[cj * N + ci] === p.c) return false;
        const cellLife = s.cellHp[cj * N + ci];
        if (p.hp >= cellLife) {
          p.hp -= cellLife; setCell(s, ci, cj, p.c, 1);
        } else {
          s.cellHp[cj * N + ci] -= p.hp; markCell(s, ci, cj); p.hp = 0;
        }
        if (p.hp <= 0) { p.x = xx; p.y = yy; spark(s, xx, yy, TEAMS[p.c].ball); return true; }
        return false;
      });
    }
    if (dead) continue;
    out.push(p);
  }
  s.pierceBalls = out;
}
