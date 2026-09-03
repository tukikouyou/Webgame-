/* 局内事件 / 三选一(roguelike 抉择 + 随机事件)。
   所有效果立即生效、写入 state,并 toast 播报;纯 core,不碰 DOM。 */
import type { GameState, Cannon } from './types';
import { toast } from './fx';
import { setCell } from './grid';
import { newPlinkoBall } from './plinko';
import { TEAMS, N, BX, BY, BS } from '../config/config';
import { META_WAVE } from '../config/meta';
import { waveClamped, capFor } from './meta';

export interface Choice {
  id: string;
  name: string;
  icon: string;
  desc: string;
  apply: (s: GameState, c: Cannon) => void;
}

/* 波次结算的三选一(难度越高出现更强的选项) */
export function waveChoices(s: GameState, c: Cannon, rng: () => number): Choice[] {
  const id = c.idx;
  const tm = TEAMS[id];
  const w = waveClamped(s);
  const pool: Choice[] = [
    { id: 'hp10', name: '强化装甲', icon: '🛡', desc: '生命上限 +10 并回复 10',
      apply: (ss, cc) => { cc.maxHp += 10; cc.hp = Math.min(cc.maxHp, cc.hp + 10); toast(ss, '🛡 生命上限 +10', tm.ball); } },
    { id: 'ammo', name: '弹药补给', icon: '📦', desc: '弹药 +50',
      apply: (ss, cc) => { cc.ammo = Math.min(capFor(ss, cc.idx), cc.ammo + 50); toast(ss, '📦 弹药 +50', tm.ball); } },
    { id: 'queue', name: '全力装填', icon: '🧨', desc: '待发弹药 +200',
      apply: (ss, cc) => { cc.queue += 200; toast(ss, '🧨 待发弹药 +200', tm.ball); } },
    { id: 'shield', name: '护盾充能', icon: '✨', desc: '立即获得 10 秒护盾',
      apply: (ss, cc) => { cc.shield = Math.max(cc.shield, 10); toast(ss, '✨ 护盾 10 秒', tm.ball); } },
    { id: 'plinko', name: '幸运弹珠', icon: '🎱', desc: '面板弹珠 +1',
      apply: (ss) => { ss.plinkoBalls.push(newPlinkoBall(ss, id)); toast(ss, '🎱 面板弹珠 +1', tm.ball); } },
    { id: 'heal', name: '战地医疗', icon: '💚', desc: '回复 20 点生命',
      apply: (ss, cc) => { cc.hp = Math.min(cc.maxHp, cc.hp + 20); toast(ss, '💚 回复 20 生命', tm.ball); } },
    { id: 'fire', name: '加速火控', icon: '🔥', desc: '射速上限 +15',
      apply: (ss) => { ss.cfg.fireRateMax[id] += 15; toast(ss, '🔥 射速上限 +15', tm.ball); } },
    { id: 'speed', name: '精准弹道', icon: '🎯', desc: '炮弹速度 +20',
      apply: (ss) => { ss.cfg.spMin[id] += 20; ss.cfg.spMax[id] += 20; toast(ss, '🎯 炮弹速度 +20', tm.ball); } },
    { id: 'wall', name: '坚壁', icon: '🧱', desc: '己方所有格子生命 +1',
      apply: (ss) => {
        for (let k = 0; k < ss.cells.length; k++) if (ss.cells[k] === id) { ss.cellHp[k]++; ss.dirtyCells.add(k); }
        toast(ss, '🧱 己方格子 +1 生命', tm.ball);
      } },
    { id: 'paint', name: '宣示主权', icon: '🗺', desc: '随机占领 40 个格子',
      apply: (ss) => {
        let n = 0;
        for (let tries = 0; tries < 300 && n < 40; tries++) {
          const i = (rng() * N) | 0, j = (rng() * N) | 0, k = j * N + i;
          if (ss.cells[k] !== id) { setCell(ss, i, j, id, 1); n++; }
        }
        toast(ss, '🗺 宣示主权:+' + n + ' 格', tm.ball);
      } },
  ];
  if (w >= 3) pool.push(
    { id: 'shieldHp', name: '结晶护盾', icon: '💎', desc: '永久护盾 +30',
      apply: (ss, cc) => { cc.shieldHp += 30; toast(ss, '💎 永久护盾 +30', tm.ball); } },
    { id: 'benti', name: '本体充能', icon: '🔮', desc: '30 秒内面板球本体值 +1',
      apply: (ss) => { ss.bentiBuff[id] = 30; toast(ss, '🔮 本体充能:面板球本体值 +1(30 秒)', tm.ball); } },
  );
  if (w >= 4) pool.push(
    { id: 'dmg', name: '磨利钢珠', icon: '⚪', desc: '弹珠伤害 +1(中期强力)',
      apply: (ss) => { ss.cfg.marbleDmg[id] += 1; toast(ss, '⚪ 弹珠伤害 +1 → ' + ss.cfg.marbleDmg[id], tm.ball); } },
  );
  if (w >= 5) pool.push(
    { id: 'lives', name: '命运护佑', icon: '🔁', desc: '额外生命 +1',
      apply: (ss, cc) => { cc.lives++; toast(ss, '🔁 额外生命 +1', tm.ball); } },
    { id: 'nuke', name: '战术核武', icon: '☢', desc: '立即向中心发射核弹',
      apply: (ss, cc) => {
        const a = Math.atan2(BY + BS / 2 - cc.y, BX + BS / 2 - cc.x);
        ss.nukeBalls.push({ x: cc.x + Math.cos(a) * 36, y: cc.y + Math.sin(a) * 36, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, c: id, dead: false });
        toast(ss, '☢ 战术核武!', tm.ball);
      } },
  );
  // 洗牌取 3 个
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr.slice(0, 3);
}

/* ---- 随机事件:在战场上随机发生,给各队即时 buff,增加每局变化 ---- */
export interface ArenaEvent { id: string; name: string; icon: string; }
export const ARENA_EVENTS: ArenaEvent[] = [
  { id: 'rain',  name: '弹雨',     icon: '🌧' },   // 随机位置天降弹珠
  { id: 'quake', name: '地动',     icon: '🌋' },   // 全场随机格翻为中立
  { id: 'bless', name: '祝福之风', icon: '🎁' },   // 随机一队获得弹药+护盾
  { id: 'storm', name: '磁暴',     icon: '⚡' },   // 所有弹珠速度 ×1.3
  { id: 'frost', name: '寒霜',     icon: '❄' },    // 所有弹珠速度 ×0.6(减速)
];

export function randomEvent(s: GameState): ArenaEvent | null {
  const r = s.rng.next();
  if (r > META_WAVE.eventChance) return null;   // 触发概率读配置 config/meta.json (eventChance)
  return ARENA_EVENTS[(s.rng.next() * ARENA_EVENTS.length) | 0];
}

export function fireEvent(s: GameState, ev: ArenaEvent): void {
  const alive = s.cannons.filter(c => c.alive);
  if (!alive.length) return;
  s.eventBanner = { name: ev.name, icon: ev.icon, t: 4, max: 4 };   // 背景水印横幅(渲染读)
  switch (ev.id) {
    case 'rain': {
      const owner = alive[(s.rng.next() * alive.length) | 0];
      const x = s.rng.range(BX + 40, BX + 660), y = s.rng.range(BY + 40, BY + 660);
      for (let i = 0; i < 8; i++) {
        const a = s.rng.angle();
        s.marbles.push({ x, y, vx: Math.cos(a) * s.rng.range(60, 140), vy: Math.sin(a) * s.rng.range(60, 140), c: owner.idx, hp: 1 });
      }
      toast(s, '🌧 弹雨! ' + TEAMS[owner.idx].name + ' 的弹珠从天而降', TEAMS[owner.idx].ball);
      break;
    }
    case 'quake': {
      // 加强:全场均匀判定(不再只削顶部),每格 6% 概率化为中立
      let n = 0;
      for (let k = 0; k < s.cells.length; k++) {
        if (s.cells[k] >= 0 && s.rng.next() < 0.06) { s.cells[k] = -1; s.cellHp[k] = 1; s.dirtyCells.add(k); n++; }
      }
      toast(s, '🌋 地动!战场 ' + n + ' 格化为中立', '#ffb84d');
      break;
    }
    case 'bless': {
      const c2 = alive[(s.rng.next() * alive.length) | 0];
      c2.ammo = Math.min(capFor(s, c2.idx), c2.ammo + 100);
      c2.shield = Math.max(c2.shield, 6);
      toast(s, '🎁 祝福之风眷顾 ' + TEAMS[c2.idx].name + ':弹药 +100、护盾 6 秒', TEAMS[c2.idx].ball);
      break;
    }
    case 'storm': {
      for (const m of s.marbles) { m.vx *= 1.3; m.vy *= 1.3; }
      toast(s, '⚡ 磁暴!全场弹珠加速', '#ffd24a');
      break;
    }
    case 'frost': {
      for (const m of s.marbles) { m.vx *= 0.6; m.vy *= 0.6; }
      toast(s, '❄ 寒霜降临,全场弹珠减速', '#9ad8ff');
      break;
    }
  }
}

/* 事件冷却驱动:每帧调用,间隔与概率读 config/meta.json (eventInterval / eventChance) */
export function updateEvents(s: GameState, h: number): void {
  if (s.eventBanner) { s.eventBanner.t -= h; if (s.eventBanner.t <= 0) s.eventBanner = null; }
  for (let i = 0; i < s.bentiBuff.length; i++) if (s.bentiBuff[i] > 0) s.bentiBuff[i] = Math.max(0, s.bentiBuff[i] - h);
  s.eventAcc += h;
  const interval = META_WAVE.eventInterval;
  if (s.eventAcc >= interval) {
    s.eventAcc = 0;
    const ev = randomEvent(s);
    if (ev) fireEvent(s, ev);
  }
}
