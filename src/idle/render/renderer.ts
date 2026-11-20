/* 总渲染:钉板(左)、HUD(右上)、战场(右中)、消息(右下)。只读 state。 */
import { T } from '../config/tuning';
import type { GameState } from '../core/types';
import { PEGS, SPECIAL, PEG_COLORS, computeLayout } from '../core/plinko';
import { getCol, genEnd, bossRegionStart } from '../core/field';
import { colInfo, cellHp, regionLabel } from '../core/grid';
import { MR, BOSS_R, SHIELD_R, cannonX, fieldHeightPx } from '../core/marbles';
import { fmt, fmtTime } from '../core/format';
import { capValue, dmgValue, pegYield } from '../core/economy';
import { rebirthGain, frontLabel, canEndEpoch, canLegacy, sandGain } from '../core/prestige';
import { autoUnlocked } from '../core/step';

let cam = 0;

const MY_CELL = '#2b6cd4';
function enemyColor(dim: number, boss: boolean, damaged: boolean): string {
  const hue = (8 + (dim - 1) * 47) % 360;
  const l = boss ? 24 : 34;
  return 'hsl(' + hue + ',' + (boss ? 55 : 48) + '%,' + (damaged ? l + 10 : l) + '%)';
}

export function render(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.fillStyle = '#08080b';
  ctx.fillRect(0, 0, T.W, T.H);
  drawPlinko(ctx, s);
  drawHud(ctx, s);
  drawField(ctx, s);
  drawMessages(ctx, s);
  if (s.bigFlash) {
    const a = Math.min(1, s.bigFlash.t / 0.6);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.12 * a) + ')';
    ctx.fillRect(0, 0, T.W, T.H);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.bigFlash.text, (T.FX + T.W) / 2, T.FY - 30);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

/* ---------------- 钉板 ---------------- */
function drawPlinko(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.fillStyle = '#101016';
  ctx.fillRect(T.PX, T.PY, T.PW, T.PH);
  ctx.strokeStyle = '#2a2a34';
  ctx.strokeRect(T.PX + 0.5, T.PY + 0.5, T.PW - 1, T.PH - 1);

  // 蓄力弹药(钉板顶部)
  ctx.fillStyle = '#9aa';
  ctx.font = '12px "Microsoft YaHei",sans-serif';
  ctx.fillText('蓄力弹药', T.PX + 10, T.PY + 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Microsoft YaHei",sans-serif';
  ctx.fillText(fmt(s.run.ammo), T.PX + 10, T.PY + 46);
  const cap = capValue(s);
  ctx.fillStyle = '#9aa';
  ctx.font = '12px "Microsoft YaHei",sans-serif';
  ctx.fillText('发射上限 ' + fmt(cap) + ' · 倍增 ×' + (s.run.multK - 1), T.PX + 120, T.PY + 22);
  const gw = T.PW - 130;
  ctx.fillStyle = '#22222a';
  ctx.fillRect(T.PX + 120, T.PY + 30, gw, 6);
  ctx.fillStyle = '#d64545';
  ctx.fillRect(T.PX + 120, T.PY + 30, gw * Math.min(1, s.run.ammo / cap), 6);
  ctx.fillStyle = '#777';
  ctx.font = '10px "Microsoft YaHei",sans-serif';
  ctx.fillText('蓄满自动发射', T.PX + 120, T.PY + 48);
  if (s.lastSalvo) {
    ctx.globalAlpha = Math.min(1, s.lastSalvo.t);
    ctx.fillStyle = '#ff8a8a';
    ctx.font = 'bold 16px "Microsoft YaHei",sans-serif';
    ctx.fillText('齐射 ' + fmt(s.lastSalvo.amount) + '!', T.PX + 190, T.PY + 50);
    ctx.globalAlpha = 1;
  }

  // 普通钉
  ctx.fillStyle = '#5b5b66';
  for (let i = 0; i < PEGS.length; i++) {
    if (SPECIAL.includes(i)) continue;
    ctx.beginPath(); ctx.arc(PEGS[i].x, PEGS[i].y, 4, 0, Math.PI * 2); ctx.fill();
  }
  // 特殊钉位
  const owned = new Map(s.epoch.pegs.map(p => [p.slot, p]));
  for (let k = 0; k < SPECIAL.length; k++) {
    const p = PEGS[SPECIAL[k]];
    const og = owned.get(k);
    if (og) {
      const fl = s.pegFlash[k] > 0;
      ctx.fillStyle = PEG_COLORS[og.color];
      ctx.beginPath(); ctx.arc(p.x, p.y, fl ? 9 : 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(og.level), p.x, p.y + 3);
      ctx.textAlign = 'left';
      if (fl) {
        ctx.fillStyle = PEG_COLORS[og.color];
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('+' + fmt(pegYield(og.level)), p.x + 10, p.y - 6);
      }
    } else {
      ctx.strokeStyle = '#6a6a78';
      ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 落槽
  const layout = computeLayout(s);
  const uw = T.PW / T.slotUnits;
  const sy = T.PY + T.PH - T.SLOT_H;
  for (let u = 0; u < T.slotUnits; u++) {
    const L = layout[u];
    ctx.fillStyle = L.color;
    ctx.globalAlpha = s.slotFlash[u] > 0 ? 1 : 0.75;
    ctx.fillRect(T.PX + u * uw + 1, sy, uw - 2, T.SLOT_H - 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(L.kind === 'mul' ? '×' : L.kind === 'fire' ? '发' : '+', T.PX + u * uw + uw / 2, sy + 28);
    ctx.textAlign = 'left';
  }

  // 球
  ctx.fillStyle = '#f4f4f4';
  for (const b of s.balls) {
    ctx.beginPath(); ctx.arc(b.x, b.y, T.PBR, 0, Math.PI * 2); ctx.fill();
  }
}

/* ---------------- HUD ---------------- */
function drawHud(ctx: CanvasRenderingContext2D, s: GameState): void {
  const r = s.run;
  const x0 = T.FX, y0 = 30;
  ctx.textAlign = 'left';

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "Microsoft YaHei",sans-serif';
  ctx.fillText(frontLabel(s).replace('-', ' 维 · ').replace(/ · (\d+)$/, ' · 第 $1 区').replace('BOSS', 'BOSS 关'), x0, y0 + 14);

  const col = (label: string, val: string, sub: string, x: number, y: number, color: string) => {
    ctx.fillStyle = '#888';
    ctx.font = '13px "Microsoft YaHei",sans-serif';
    ctx.fillText(label, x, y);
    ctx.fillStyle = color;
    ctx.font = 'bold 24px "Microsoft YaHei",sans-serif';
    ctx.fillText(val, x, y + 28);
    ctx.fillStyle = '#777';
    ctx.font = '12px "Microsoft YaHei",sans-serif';
    ctx.fillText(sub, x, y + 46);
  };
  const y1 = 70;
  col('金币', fmt(r.coins), '+' + fmt(s.incomePerSec) + '/秒', x0, y1, '#ffd24a');
  col('伤害', fmt(dmgValue(s)), 'Lv ' + r.up.dmg, x0 + 200, y1, '#ffffff');
  col('维度能量', fmt(s.epoch.energy), '本纪元转生 ' + s.epoch.runs + ' 次', x0 + 360, y1, '#7fd0ff');
  col('星砂', fmt(s.cycle.sand), '已开包 ' + s.cycle.packsOpened, x0 + 560, y1, '#ffb0f0');
  col('传承点', fmt(s.legacy.points), '已传承 ' + s.legacy.count + ' 次', x0 + 720, y1, '#b0ffb8');

  const gain = rebirthGain(s);
  const y2 = 150;
  col('转生可得', gain >= 1 ? '+' + fmt(gain) + ' 能量' : '—', '最远纪录 ' + fmtTime(r.sinceRecord) + ' 未刷新', x0, y2, gain >= 1 ? '#7fd0ff' : '#555');
  col('前线速度', fmt(Math.max(0, r.frontSpeed)) + ' 列/分', '本轮 ' + fmtTime(r.time), x0 + 200, y2, '#ffffff');
  col('前线格子血量', fmt(cellHp(r.front)), '每区 ×' + T.g + ',boss 区 ×' + T.bossCellMul, x0 + 360, y2, '#ff9a8a');
  col('终结纪元', canEndEpoch(s) ? '+' + fmt(sandGain(s)) + ' 星砂' : '本轮需到 ' + T.epochDim + ' 维', canLegacy(s) ? '可以传承!' : '传承需本轮到 ' + T.legacyDim + ' 维', x0 + 560, y2, canEndEpoch(s) ? '#ffb0f0' : '#777');
  col('待发弹药', fmt(r.queue), '自动化' + (autoUnlocked(s) ? '已解锁' : '到 ' + T.autoUnlockDim + ' 维解锁'), x0 + 720, y2, '#ff8a8a');

  // boss 条
  const b = r.boss;
  if (b && b.alive && r.front >= bossRegionStart(s) - 40) {
    const bx = x0, by = 240, bw = 700;
    ctx.fillStyle = '#ccc';
    ctx.font = 'bold 14px "Microsoft YaHei",sans-serif';
    ctx.fillText(b.dim + ' 维 BOSS  ·  ' + (b.shieldBroken ? '护盾已破' : '护盾中(敌格 ≤ ' + Math.round(T.bossShieldRatio * 100) + '% 破盾)'), bx, by);
    ctx.fillStyle = '#22222a'; ctx.fillRect(bx, by + 8, bw, 10);
    ctx.fillStyle = '#2b6cd4'; ctx.fillRect(bx, by + 8, bw * b.p, 10);
    ctx.fillStyle = '#888'; ctx.font = '11px sans-serif';
    ctx.fillText('占领 ' + Math.round(b.p * 100) + '%', bx + bw + 8, by + 17);
    ctx.fillStyle = '#22222a'; ctx.fillRect(bx, by + 24, bw, 10);
    ctx.fillStyle = '#eeeeee'; ctx.fillRect(bx, by + 24, bw * Math.max(0, b.hp / b.hpMax), 10);
    ctx.fillStyle = '#888';
    ctx.fillText('HP ' + fmt(Math.max(0, b.hp)) + ' / ' + fmt(b.hpMax), bx + bw + 8, by + 33);
  }
}

/* ---------------- 战场 ---------------- */
function drawField(ctx: CanvasRenderingContext2D, s: GameState): void {
  const r = s.run;
  const cs = T.cellPx;
  const fh = fieldHeightPx();
  const target = r.front - Math.floor(T.viewCols * 0.6);
  if (Math.abs(target - cam) > 150) cam = target; else cam += (target - cam) * 0.12;
  const camI = Math.round(cam);
  const fw = T.viewCols * cs;
  const ox = T.FX - camI * cs, oy = T.FY;

  ctx.save();
  ctx.beginPath(); ctx.rect(T.FX, T.FY, fw, fh); ctx.clip();
  const end = genEnd(s);
  for (let i = 0; i < T.viewCols; i++) {
    const c = camI + i;
    const x = T.FX + i * cs;
    if (c < r.colBase) {
      ctx.fillStyle = MY_CELL; ctx.fillRect(x, oy, cs, fh);
      continue;
    }
    if (c >= r.fieldEnd) {
      ctx.fillStyle = '#141418'; ctx.fillRect(x, oy, cs, fh);
      continue;
    }
    const info = colInfo(c);
    if (c >= end) {
      ctx.fillStyle = enemyColor(info.dim, info.isBoss, false); ctx.fillRect(x, oy, cs, fh);
      continue;
    }
    const col = getCol(s, c)!;
    const full = cellHp(c);
    for (let k = 0; k < T.rows; k++) {
      ctx.fillStyle = col.o[k] === 0 ? MY_CELL : enemyColor(info.dim, info.isBoss, col.hp[k] < full * 0.999);
      ctx.fillRect(x, oy + k * cs, cs, cs);
    }
  }
  // 网格线
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= T.viewCols; i++) { ctx.moveTo(T.FX + i * cs + 0.5, oy); ctx.lineTo(T.FX + i * cs + 0.5, oy + fh); }
  for (let k = 0; k <= T.rows; k++) { ctx.moveTo(T.FX, oy + k * cs + 0.5); ctx.lineTo(T.FX + fw, oy + k * cs + 0.5); }
  ctx.stroke();

  // 区域分界与标签
  const firstReg = Math.floor(camI / T.regionCols);
  for (let g = firstReg; g <= firstReg + Math.ceil(T.viewCols / T.regionCols) + 1; g++) {
    const c = g * T.regionCols;
    if (c < 0) continue;
    const x = ox + c * cs;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(x + 0.5, oy); ctx.lineTo(x + 0.5, oy + fh); ctx.stroke();
    if (c < r.fieldEnd) {
      const info = colInfo(c);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = 'bold 12px "Microsoft YaHei",sans-serif';
      ctx.fillText(regionLabel(info.dim, info.region), x + 4, oy + 13);
    }
  }
  // 巩固线、前线
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.setLineDash([4, 4]);
  const bx = ox + r.colBase * cs;
  ctx.beginPath(); ctx.moveTo(bx, oy); ctx.lineTo(bx, oy + fh); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#ffe066';
  ctx.lineWidth = 2;
  const fx = ox + r.front * cs;
  ctx.beginPath(); ctx.moveTo(fx, oy - 6); ctx.lineTo(fx, oy + fh + 6); ctx.stroke();
  ctx.lineWidth = 1;

  // 炮台
  const cx = ox + cannonX(s), cy = oy + fh / 2;
  ctx.fillStyle = '#9fd0ff';
  ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0d2a55';
  ctx.fillRect(cx, cy - 3, 16, 6);

  // boss
  const b = r.boss;
  if (b && b.alive) {
    const px = ox + (b.col + 0.5) * cs, py = oy + (b.row + 0.5) * cs;
    if (!b.shieldBroken) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, SHIELD_R, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath(); ctx.arc(px, py, BOSS_R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillRect(px - 16, py - 2, -10, 4);
  }

  // 敌方弹珠
  ctx.fillStyle = '#ff7070';
  for (const e of s.enemies) { ctx.beginPath(); ctx.arc(ox + e.x, oy + e.y, MR - 0.5, 0, Math.PI * 2); ctx.fill(); }
  // 我方弹珠(合并后的大弹珠更大,并显示代表数)
  for (const m of s.marbles) {
    const rr = MR + Math.min(6, Math.log10(Math.max(1, m.v)) * 1.5);
    ctx.fillStyle = m.v > 1 ? '#ffffff' : '#cfe6ff';
    ctx.beginPath(); ctx.arc(ox + m.x, oy + m.y, rr, 0, Math.PI * 2); ctx.fill();
  }
  // 火花
  for (const p of s.sparks) {
    ctx.globalAlpha = p.t / 0.35;
    ctx.fillStyle = p.color;
    ctx.fillRect(ox + p.x - 2, oy + p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.strokeStyle = '#2a2a34';
  ctx.strokeRect(T.FX - 0.5, T.FY - 0.5, fw + 1, fh + 1);
  if (s.marbles.some(m => m.v > 1)) {
    const maxV = s.marbles.reduce((a, m) => Math.max(a, m.v), 0);
    ctx.fillStyle = '#aaa';
    ctx.font = '12px "Microsoft YaHei",sans-serif';
    ctx.fillText('弹珠合并中:每颗最多代表 ' + fmt(maxV) + ' 发', T.FX, T.FY + fh + 18);
  }
}

/* ---------------- 消息与轮次记录 ---------------- */
function drawMessages(ctx: CanvasRenderingContext2D, s: GameState): void {
  let y = T.FY + fieldHeightPx() + 46;
  ctx.font = '14px "Microsoft YaHei",sans-serif';
  for (let i = s.toasts.length - 1; i >= 0; i--) {
    const t = s.toasts[i];
    ctx.globalAlpha = Math.min(1, t.t);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, T.FX, y);
    y += 22;
  }
  ctx.globalAlpha = 1;

  const hx = T.FX + 760;
  let hy = T.FY + fieldHeightPx() + 46;
  ctx.fillStyle = '#888';
  ctx.font = '13px "Microsoft YaHei",sans-serif';
  ctx.fillText('最近几轮转生', hx, hy);
  hy += 20;
  for (const h of s.history) {
    ctx.fillStyle = '#bbb';
    ctx.fillText(h.label + '  ·  +' + fmt(h.energy) + ' 能量  ·  ' + fmtTime(h.time), hx, hy);
    hy += 19;
  }
}
