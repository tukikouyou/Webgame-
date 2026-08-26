/* 共享战斗原语:伤害入口、淘汰、护盾、环卫挡板命中、磁场、胜负判定。 */
import type { GameState, Cannon, Guard } from './types';
import { spark, explosion, toast } from './fx';
import { newPlinkoBall } from './plinko';
import { norm } from './util';
import { metaOutMul, metaInMul, useFor } from './meta';
import { recordElimination } from './wave';
import {
  TEAMS,
  GUARD_HP_RATIO, GUARD_REGEN, GUARD_RAD, GUARD_THICK, GUARD_SPAN,
  MAGNET_R, MAGNET_FORCE,
  DMG_SHIELD_THRESHOLD, DMG_SHIELD_DURATION, REVIVE_SHIELD,
} from '../config/config';


/* ---- 护盾判定 ---- */
export function shielded(c: Cannon): boolean { return c.shield > 0 || c.shieldHp > 0; }
export function hitShield(c: Cannon): void { if (c.shield <= 0 && c.shieldHp > 0) c.shieldHp--; }

// 技能弹撞永久护盾:像弹珠互撞一样互相抵消生命值
export function clashPermanentShield(obj: { hp: number }, cn: Cannon): number {
  const loss = Math.min(Math.max(0, obj.hp || 0), Math.max(0, cn.shieldHp || 0));
  obj.hp -= loss;
  cn.shieldHp -= loss;
  if (obj.hp < 0) obj.hp = 0;
  if (cn.shieldHp < 0) cn.shieldHp = 0;
  return loss;
}

/* ---- 环卫挡板 ---- */
export function guardMaxHp(c: Cannon): number { return Math.max(1, Math.round(c.maxHp * GUARD_HP_RATIO)); }

function damageGuard(s: GameState, cn: Cannon, g: Guard, dmg: number): void {
  g.hp -= dmg;
  if (g.hp <= 0) { g.alive = false; g.regen = GUARD_REGEN; spark(s, cn.x, cn.y, '#fff'); }
}

// 命中任一敌方存活扇形挡板? 命中则扣其 dmg 血,返回被命中的炮台,否则 null
export function guardHit(s: GameState, x: number, y: number, atkColor: number, rad: number, dmg: number): Cannon | null {
  for (const cn of s.cannons) {
    if (!cn.alive || cn.idx === atkColor || !cn.guards.length) continue;
    const dx = x - cn.x, dy = y - cn.y, dist = Math.hypot(dx, dy);
    if (dist < GUARD_RAD - GUARD_THICK - rad || dist > GUARD_RAD + GUARD_THICK + rad) continue;
    const ang = Math.atan2(dy, dx);
    for (const g of cn.guards) {
      if (!g.alive) continue;
      let d = Math.abs(norm(ang - g.ang));
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < GUARD_SPAN / 2) { if (dmg) damageGuard(s, cn, g, dmg); return cn; }
    }
  }
  return null;
}

/* ---- 磁场 ---- */
// 对一个带 vx/vy 的弹体施加敌方磁场排斥;scale<1 用于削弱大型弹珠
export function applyMagnet(s: GameState, obj: { x: number; y: number; vx: number; vy: number; c: number }, h: number, scale: number): void {
  for (const cn of s.cannons) {
    if (!cn.alive || cn.trait !== 'magnet' || cn.idx === obj.c) continue;
    const dx = obj.x - cn.x, dy = obj.y - cn.y, d = Math.hypot(dx, dy);
    if (d > MAGNET_R || d < 1) continue;
    const f = MAGNET_FORCE * scale * (1 - d / MAGNET_R) / d * h;
    obj.vx += dx * f; obj.vy += dy * f;
  }
}

/* ---- 伤害 / 淘汰 / 胜负 ---- */
export function applyDamage(s: GameState, c: Cannon, dmg: number, attacker: number | null): void {
  // 输出加成看攻击方、承伤减免看承伤方,都只对玩家生效
  const d = metaInMul(useFor(s, c.idx), metaOutMul(useFor(s, attacker), dmg));
  c.hp -= d;
  if (c.trait === 'dmgshd') {
    c.dmgTaken += d;
    while (c.dmgTaken >= DMG_SHIELD_THRESHOLD) {
      c.dmgTaken -= DMG_SHIELD_THRESHOLD;
      c.shield = Math.max(c.shield, DMG_SHIELD_DURATION);
      toast(s, '🛡 ' + TEAMS[c.idx].name + ' 应激护盾触发!', TEAMS[c.idx].ball);
    }
  }
  if (c.hp <= 0) onLethal(s, c, attacker);
}

export function onLethal(s: GameState, c: Cannon, attacker: number | null): void {
  if (c.lives > 0) {
    c.lives--;
    c.hp = c.maxHp;
    c.ammo = 0; c.queue = 0;
    c.purge = true;
    c.shield = Math.max(c.shield, REVIVE_SHIELD);
    explosion(s, c.x, c.y, '#ffffff', 80, 420);
    toast(s, '🔁 ' + TEAMS[c.idx].name + ' 消耗一条生命复活!(剩余 ' + c.lives + ' 条)', TEAMS[c.idx].ball);
  } else {
    eliminate(s, c);
    recordElimination(s, c.idx, attacker);   // 波次/胜负结算(区分玩家击杀/AI互杀)
    if (attacker != null && attacker !== c.idx) {
      const k = s.cannons[attacker];
      if (k && k.alive && k.trait === 'plinko') {
        s.plinkoBalls.push(newPlinkoBall(s, attacker));
        toast(s, '☠ ' + TEAMS[attacker].name + ' 击杀奖励:面板弹珠 +1!', TEAMS[attacker].ball);
      }
    }
  }
}

export function eliminate(s: GameState, c: Cannon): void {
  c.alive = false;
  explosion(s, c.x, c.y, TEAMS[c.idx].ball);
  toast(s, '💥 ' + TEAMS[c.idx].name + '炮台被摧毁!', TEAMS[c.idx].ball);
  const id = c.idx;
  s.plinkoBalls = s.plinkoBalls.filter(b => b.c !== id);
  s.wheelBalls = s.wheelBalls.filter(b => b.c !== id);
  s.marbles = s.marbles.filter(m => m.c !== id);
  s.pierceBalls = s.pierceBalls.filter(p => p.c !== id);
  s.bombBalls = s.bombBalls.filter(b => b.c !== id);
  s.nukeBalls = s.nukeBalls.filter(b => b.c !== id);
  s.homingBalls = s.homingBalls.filter(b => b.c !== id);
  s.ultraBalls = s.ultraBalls.filter(b => b.c !== id);
  s.shockwaves = s.shockwaves.filter(w => w.c !== id);
  s.counts[id] = 0;
}

export function checkWin(s: GameState, h: number): void {
  if (s.gameOver) return;
  const alive = s.cannons.filter(c => c.alive);
  if (alive.length <= 1) {
    s.winTimer += h;
    if (s.winTimer > 1.0) { s.gameOver = true; s.winner = alive[0] || null; }
  } else s.winTimer = 0;
}
