/* 功能区 1(炮台部分):炮台行为、开火、专属特性(环卫再生/背水回血/固土/增殖/游牧)。 */
import type { GameState, Cannon } from './types';
import { spark, toast } from './fx';
import { territory, markCell } from './grid';
import { guardMaxHp } from './damage';
import {
  TEAMS, N, BX, BY, BS, CS, AMMO_CAP, MARBLE_CAP,
  FIRE_RATE_BASE, FIRE_RATE_QUEUE_FACTOR, MARBLE_SPAWN_OFF, AIM_SPREAD, SWING_FREQ,
  GUARD_SPIN, NOMAD_SPEED, NOMAD_SPIN,
  CELLREG_INTERVAL, PLINKO_AMMO_INTERVAL, REGEN_INTERVAL,
} from '../config/config';
import { metaFireHp, metaFireSpeed, useFor } from './meta';

// ---- 专属特性初始化 ----
export function initTrait(c: Cannon): void {
  c.guards = [];
  if (c.trait === 'guard') {
    const ghp = guardMaxHp(c);
    for (let g = 0; g < 4; g++) c.guards.push({ ang: g * Math.PI / 2, alive: true, hp: ghp, maxHp: ghp, regen: 0 });
  }
}

export function fireMarble(s: GameState, c: Cannon): void {
  const id = c.idx;
  const a = c.aim + s.rng.range(-AIM_SPREAD, AIM_SPREAD);
  const u = useFor(s, id);   // 局外加成只对玩家
  const sp = metaFireSpeed(s.rng.range(s.cfg.spMin[id], s.cfg.spMax[id]), u);
  const hp = metaFireHp(s.cfg.marbleDmg[id], u, c);
  s.marbles.push({
    x: c.x + Math.cos(a) * MARBLE_SPAWN_OFF, y: c.y + Math.sin(a) * MARBLE_SPAWN_OFF,
    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, c: id, hp,
  });
  s.counts[id]++;
}

function nomadMove(s: GameState, c: Cannon, h: number): void {
  c.nomadDir += s.rng.range(-0.6, 0.6) * h;
  const nx = c.x + Math.cos(c.nomadDir) * NOMAD_SPEED * h;
  const ny = c.y + Math.sin(c.nomadDir) * NOMAD_SPEED * h;
  if (nx < BX + 30 || nx > BX + BS - 30) { c.nomadDir = Math.PI - c.nomadDir; return; }
  if (ny < BY + 30 || ny > BY + BS - 30) { c.nomadDir = -c.nomadDir; return; }
  const ci = ((nx - BX) / CS) | 0, cj = ((ny - BY) / CS) | 0;
  const k = cj * N + ci;
  if (ci >= 0 && cj >= 0 && ci < N && cj < N && s.cells[k] !== c.idx) {
    s.cellHp[k]--;
    if (s.cellHp[k] <= 0) { s.cells[k] = c.idx; s.cellHp[k] = 1; }
    markCell(s, ci, cj);
    spark(s, nx, ny, TEAMS[c.idx].ball);
    c.nomadDir += Math.PI + s.rng.range(-0.8, 0.8);
    return;
  }
  c.x = nx; c.y = ny;
  c.base = Math.atan2(BY + BS / 2 - c.y, BX + BS / 2 - c.x);
}

export function updateCannons(s: GameState, h: number): void {
  for (const c of s.cannons) {
    if (!c.alive) continue;
    const id = c.idx;
    c.dmgCd -= h;
    if (c.shield > 0) c.shield = Math.max(0, c.shield - h);
    if (c.trait === 'nomad') c.aim += h * NOMAD_SPIN;
    else c.aim = c.base + Math.sin(s.t * SWING_FREQ + c.phase) * s.cfg.swing[id];
    const uc = useFor(s, id);   // 射速加成只对玩家
    const rate = Math.min(s.cfg.fireRateMax[id] * (uc ? uc.fireRateMul : 1), FIRE_RATE_BASE + c.queue * FIRE_RATE_QUEUE_FACTOR);
    c.fireAcc += h * rate;
    while (c.fireAcc >= 1 && c.queue > 0) {
      c.fireAcc -= 1;
      if (s.counts[id] >= MARBLE_CAP) break;
      c.queue--;
      fireMarble(s, c);
    }
    if (c.fireAcc > 3) c.fireAcc = 3;
    // 环卫:挡板旋转 + 破坏再生
    if (c.guards.length) for (const g of c.guards) {
      g.ang += h * GUARD_SPIN;
      if (!g.alive) {
        g.regen -= h;
        if (g.regen <= 0) { g.alive = true; g.maxHp = guardMaxHp(c); g.hp = g.maxHp; spark(s, c.x, c.y, TEAMS[id].ball); }
      }
    }
    // 背水回血
    if (c.trait === 'regen' && c.hp < c.maxHp) {
      if (territory(s, id) < N * N / 4) {
        const ratio = c.hp / c.maxHp;
        let interval = REGEN_INTERVAL, amount = 1;
        if (ratio < 0.25) { interval = 1; amount = 2; }
        else if (ratio < 0.50) { interval = 1; amount = 1; }
        c.regenAcc += h;
        if (c.regenAcc >= interval) { c.regenAcc -= interval; c.hp = Math.min(c.maxHp, c.hp + amount); spark(s, c.x, c.y - 30, '#5be05b'); }
      } else c.regenAcc = 0;
    }
    // 固土:每 15 秒己方所有格子生命 +1
    if (c.trait === 'cellreg') {
      c.cellRegAcc += h;
      if (c.cellRegAcc >= CELLREG_INTERVAL) {
        c.cellRegAcc -= CELLREG_INTERVAL;
        for (let k = 0; k < s.cells.length; k++) {
          if (s.cells[k] === id) { s.cellHp[k]++; markCell(s, k % N, (k / N) | 0); }
        }
        toast(s, '🧱 ' + TEAMS[id].name + ' 固土:全域格子 +1 生命', TEAMS[id].ball);
      }
    }
    // 增殖:每 10 秒获得 = 面板弹珠数 的弹药
    if (c.trait === 'plinko') {
      c.plinkoAcc += h;
      if (c.plinkoAcc >= PLINKO_AMMO_INTERVAL) {
        c.plinkoAcc -= PLINKO_AMMO_INTERVAL;
        let n = 0; for (const b of s.plinkoBalls) if (b.c === id) n++;
        if (n > 0) { c.ammo = Math.min(AMMO_CAP, c.ammo + n); spark(s, c.x, c.y - 30, TEAMS[id].ball); }
      }
    }
    // 游牧
    if (c.trait === 'nomad') nomadMove(s, c, h);
  }
}
