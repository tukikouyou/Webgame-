/* 下方操作面板:炮台 / 转生 / 纪元 / 传承 / 调试 五个页签,以及卡牌三选一弹窗。
   面板每 250ms 按状态重绘;按钮用 pointerdown 触发,避免重绘打断点击。 */
import { T, TUNABLE } from '../config/tuning';
import type { GameState, UpKind } from '../core/types';
import { fmt, fmtTime } from '../core/format';
import {
  UP_KINDS, UP_NAMES, upCost, buyUp, dmgValue, capValue, baseAmmo,
  pegBuyCost, pegUpCost, pegYield, buyPeg, upgradePeg, widthCost, buyWidth, maxFuncUnits, setMulAlloc,
  coinMul, energyMul, salvoMul, mulM, ballCount, cardN,
} from '../core/economy';
import { PEG_COLORS, PEG_COLOR_NAMES } from '../core/plinko';
import { CARDS, cardDef, cardPool, packCost, openPack, pickCard } from '../core/cards';
import {
  rebirthGain, canRebirth, doRebirth, canEndEpoch, sandGain, doEndEpoch, frontLabel,
  canLegacy, legacyGain, doLegacy, TALENTS, talentCost, buyTalent,
} from '../core/prestige';
import { autoUnlocked } from '../core/step';

export interface PanelApp {
  state: GameState;
  speed: number;
  paused: boolean;
  resetAll(): void;
  save(): void;
}

type Tab = 'cannon' | 'rebirth' | 'epoch' | 'legacy' | 'debug';
const TABS: [Tab, string][] = [['cannon', '炮台'], ['rebirth', '转生'], ['epoch', '纪元'], ['legacy', '传承'], ['debug', '调试']];

export function initPanel(app: PanelApp): void {
  const root = document.getElementById('panel')!;
  const tabsEl = document.getElementById('tabs')!;
  const bodyEl = document.getElementById('tabBody')!;
  const pickEl = document.getElementById('pick')!;
  const speedEl = document.getElementById('speed')!;
  let tab: Tab = 'cannon';
  let pegColor = 0;
  let pickKey = '';

  const btn = (act: string, label: string, enabled = true, cls = '') =>
    '<button data-act="' + act + '"' + (enabled ? '' : ' disabled') + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</button>';

  function renderTabs(): void {
    tabsEl.innerHTML = TABS.map(([k, n]) => '<button data-tab="' + k + '" class="' + (k === tab ? 'active' : '') + '">' + n + '</button>').join('');
    speedEl.innerHTML = [1, 2, 5, 10, 30].map(v => '<button data-speed="' + v + '" class="' + (app.speed === v && !app.paused ? 'active' : '') + '">×' + v + '</button>').join('')
      + '<button data-act="pause" class="' + (app.paused ? 'active' : '') + '">' + (app.paused ? '继续' : '暂停') + '</button>';
  }

  /* ---- 各页签内容 ---- */
  function cannonTab(s: GameState): string {
    const rows = UP_KINDS.map(k => {
      const lv = s.run.up[k];
      const cost = upCost(k, lv);
      const cur = k === 'dmg' ? dmgValue(s) : k === 'cap' ? capValue(s) : baseAmmo(s);
      const next = k === 'dmg' ? cur * T.dmgMul : k === 'cap' ? cur * T.capMul : cur * T.baseAmmoMul;
      const skip = s.settings.autoSkip[k];
      const autoCell = autoUnlocked(s) ? '<td>' + btn('skip:' + k, skip ? '自动:跳过' : '自动:购买', true, skip ? '' : 'on') + '</td>' : '';
      return '<tr><td>' + UP_NAMES[k] + '</td><td>Lv ' + lv + '</td><td>' + fmt(cur) + ' → ' + fmt(next) + '</td><td>'
        + btn('up:' + k, '升级 ' + fmt(cost) + ' 金币', s.run.coins >= cost) + '</td>' + autoCell + '</tr>';
    }).join('');
    const auto = autoUnlocked(s)
      ? btn('toggle:autoUp', '自动升级:' + (s.settings.autoUp ? '开' : '关'), true, s.settings.autoUp ? 'on' : '') + ' <span class="dim">按最便宜的顺序买;每项右边的开关可以让自动升级跳过它</span>'
      : '<span class="dim">自动升级:到达 ' + T.autoUnlockDim + ' 维后解锁</span>';
    return '<p class="dim">金币来自占领格子(格子血量 × 奖励倍率)和己方格子的持续产出;转生后清零。</p>'
      + '<table class="tbl">' + rows + '</table><div class="row">' + auto + '</div>'
      + '<p class="dim">当前倍率:金币 ×' + fmt(coinMul(s)) + ' · 齐射伤害 ×' + salvoMul(s).toFixed(2) + ' · 倍增系数 ' + mulM(s).toFixed(2) + ' · 钉板弹珠 ' + ballCount(s) + ' 颗</p>';
  }

  function rebirthTab(s: GameState): string {
    const gain = rebirthGain(s);
    let h = '<div class="row big">转生可得 <b class="cE">+' + fmt(gain) + '</b> 维度能量(当前 ' + fmt(s.epoch.energy) + ')'
      + btn('rebirth', '转生(回到 1 维 1 区)', canRebirth(s), 'warn') + '</div>';
    h += '<p class="dim">推得越远能量越多(每推进一区价值 ×' + T.energyRegionMul + ',跨维度连续);boss 区按占领比例计入,击败 boss 额外奖励。金币和炮台升级清零,钉子、槽宽、卡牌保留。</p>';
    if (autoUnlocked(s)) {
      h += '<div class="row">' + btn('toggle:autoRebirth', '自动转生:' + (s.settings.autoRebirth ? '开' : '关'), true, s.settings.autoRebirth ? 'on' : '') + ' <span class="dim">最远纪录 ' + T.autoRebirthSec + ' 秒没刷新时自动转生(秒数可在调试页改)</span></div>';
    } else h += '<p class="dim">自动转生:到达 ' + T.autoUnlockDim + ' 维后解锁</p>';

    // 钉子
    h += '<h4>钉子(颜色只是种类标记,demo 里效果相同:被撞时弹药 + 数值)</h4><div class="row">选择购买颜色:';
    h += PEG_COLORS.map((c, i) => '<span class="sw' + (i === pegColor ? ' sel' : '') + '" data-color="' + i + '" style="background:' + c + '" title="' + PEG_COLOR_NAMES[i] + '"></span>').join('') + '</div>';
    h += '<div class="pegGrid">';
    for (let k = 0; k < T.pegSlots; k++) {
      const p = s.epoch.pegs.find(q => q.slot === k);
      if (p) {
        const cost = pegUpCost(p.level);
        h += '<div class="peg"><span class="sw" style="background:' + PEG_COLORS[p.color] + '"></span> 钉位 ' + (k + 1) + ' · Lv ' + p.level
          + ' · 每撞 +' + fmt(pegYield(p.level)) + '<br>' + btn('pegUp:' + k, '升级 ' + fmt(cost) + ' 能量', s.epoch.energy >= cost) + '</div>';
      } else {
        const cost = pegBuyCost(s.epoch.pegs.length);
        h += '<div class="peg empty">钉位 ' + (k + 1) + ' · 空<br>' + btn('pegBuy:' + k, '购买 ' + fmt(cost) + ' 能量', s.epoch.energy >= cost) + '</div>';
      }
    }
    h += '</div>';

    // 槽宽
    const maxU = maxFuncUnits(s);
    const unlocked = Math.min(s.epoch.funcUnlocked, maxU);
    const mul = Math.max(0, Math.min(s.epoch.mulAlloc, unlocked - 1));
    h += '<h4>落槽宽度(底部共 ' + T.slotUnits + ' 格;卡牌送的格子另算)</h4>';
    h += '<div class="row">已解锁功能格 <b>' + unlocked + '</b> / ' + maxU + ' '
      + btn('width', '再解锁 1 格 ' + fmt(widthCost(s)) + ' 能量', unlocked < maxU && s.epoch.energy >= widthCost(s)) + '</div>';
    h += '<div class="row">分配(免费调整):倍增 <b class="cMul">' + mul + '</b> ' + btn('mul:-1', '−', mul > 0) + btn('mul:1', '+', mul < unlocked - 1)
      + ' · 发射 <b class="cFire">' + (unlocked - mul) + '</b>(至少 1 格) · 空槽 ' + (T.slotUnits - unlocked - cardN(s, 'mulSlot') - cardN(s, 'fireSlot')) + '</div>';
    return h;
  }

  function epochTab(s: GameState): string {
    let h = '<div class="row big">本轮已推到 <b>' + frontLabel(s) + '</b>(本轮需到 ' + T.epochDim + ' 维) '
      + btn('endEpoch', canEndEpoch(s) ? '终结纪元 → +' + fmt(sandGain(s)) + ' 星砂' : '终结纪元(未达成)', canEndEpoch(s), 'warn') + '</div>';
    h += '<p class="dim">终结纪元会重置维度能量、钉子、槽宽和推进进度;保留卡牌、星砂和传承。条件和星砂都按<b>当前这一轮</b>推到的位置算,本轮推得越深星砂越多。</p>';
    h += '<div class="row big">星砂 <b class="cS">' + fmt(s.cycle.sand) + '</b> '
      + btn('pack', '开卡包(三选一)' + fmt(packCost(s)) + ' 星砂', s.cycle.sand >= packCost(s) && !s.cycle.pendingPick) + '</div>';
    h += '<h4>已有卡牌(重复抽到叠加层数)</h4><div class="cards">';
    const pool = new Set(cardPool(s).map(c => c.id));
    for (const c of CARDS) {
      const n = cardN(s, c.id);
      h += '<div class="card' + (pool.has(c.id) ? '' : ' locked') + '" style="border-color:' + c.color + '"><b style="color:' + c.color + '">' + c.name + '</b>'
        + (n ? ' ×' + n : '') + '<br><span class="dim">' + c.desc + (pool.has(c.id) ? '' : '(传承解锁)') + '</span></div>';
    }
    return h + '</div>';
  }

  function legacyTab(s: GameState): string {
    let h = '<div class="row big">传承点 <b class="cL">' + fmt(s.legacy.points) + '</b> '
      + btn('legacy', canLegacy(s) ? '进行传承 → +' + fmt(legacyGain(s)) + ' 传承点' : '进行传承(需本纪元推到 ' + T.legacyDim + ' 维)', canLegacy(s), 'warn') + '</div>';
    h += '<p class="dim">传承会重置卡牌、星砂、卡包价格以及以下所有层;保留传承点和天赋。</p><table class="tbl">';
    for (const t of TALENTS) {
      const cost = talentCost(s, t.id);
      const lv = t.id === 'coin' ? ' Lv ' + s.legacy.talents.coin : '';
      h += '<tr><td>' + t.name + lv + '</td><td class="dim">' + t.desc + '</td><td>'
        + (cost === null ? '<span class="dim">已拥有</span>' : btn('talent:' + t.id, fmt(cost) + ' 点', s.legacy.points >= cost)) + '</td></tr>';
    }
    return h + '</table>';
  }

  function debugTab(): string {
    let h = '<div class="row">加资源:' + btn('add:coins', '金币 ×10+1K') + btn('add:energy', '能量 +100') + btn('add:sand', '星砂 +100') + btn('add:legacy', '传承点 +5')
      + btn('reset', '重置全部存档', true, 'danger') + '</div>';
    h += '<div id="dbgStats" class="dim"></div><h4>数值参数(改完立即生效)</h4><div class="params">';
    for (const [k, label] of TUNABLE) {
      h += '<label>' + label + '<input type="number" step="any" data-param="' + k + '" value="' + T[k] + '"></label>';
    }
    return h + '</div>';
  }

  function renderBody(): void {
    const s = app.state;
    if (tab === 'debug') { updateDebugStats(); return; }
    bodyEl.innerHTML = tab === 'cannon' ? cannonTab(s) : tab === 'rebirth' ? rebirthTab(s) : tab === 'epoch' ? epochTab(s) : legacyTab(s);
  }

  function updateDebugStats(): void {
    const el = document.getElementById('dbgStats');
    if (!el) return;
    const s = app.state;
    el.innerHTML = '本轮用时 ' + fmtTime(s.run.time) + ' · 前线列 ' + s.run.front + ' · 场上弹珠 ' + s.marbles.length + ' / 敌方 ' + s.enemies.length
      + ' · 齐射速率 ' + fmt(s.run.ammoRate) + '/秒 · 能量倍率 ×' + energyMul(s).toFixed(2)
      + ' · 本纪元转生 ' + s.epoch.runs + ' 次 · 已终结纪元 ' + s.cycle.epochs + ' 次';
  }

  function renderPick(): void {
    const p = app.state.cycle.pendingPick;
    const key = p ? p.join(',') : '';
    if (key === pickKey) return;
    pickKey = key;
    if (!p) { pickEl.classList.add('hidden'); return; }
    pickEl.classList.remove('hidden');
    pickEl.innerHTML = '<div class="modal"><h3>选择一张卡牌</h3><div class="cards">'
      + p.map(id => { const c = cardDef(id)!; return '<div class="card pickable" data-pick="' + id + '" style="border-color:' + c.color + '"><b style="color:' + c.color + '">' + c.name + '</b>'
        + (cardN(app.state, id) ? '(已有 ×' + cardN(app.state, id) + ')' : '') + '<br><span class="dim">' + c.desc + '</span></div>'; }).join('')
      + '</div></div>';
  }

  /* ---- 交互 ---- */
  function act(a: string): void {
    const s = app.state;
    const [name, arg] = a.split(':');
    switch (name) {
      case 'pause': app.paused = !app.paused; break;
      case 'toggle': { const st = s.settings as unknown as Record<string, boolean>; st[arg] = !st[arg]; break; }
      case 'skip': s.settings.autoSkip[arg as UpKind] = !s.settings.autoSkip[arg as UpKind]; break;
      case 'up': buyUp(s, arg as UpKind); break;
      case 'rebirth': doRebirth(s); break;
      case 'pegBuy': buyPeg(s, +arg, pegColor); break;
      case 'pegUp': upgradePeg(s, +arg); break;
      case 'width': buyWidth(s); break;
      case 'mul': setMulAlloc(s, s.epoch.mulAlloc + +arg); break;
      case 'endEpoch': if (confirm('终结纪元?将重置能量、钉子、槽宽和推进进度。')) doEndEpoch(s); break;
      case 'pack': openPack(s); break;
      case 'legacy': if (confirm('进行传承?将重置卡牌、星砂和以下所有层。')) doLegacy(s); break;
      case 'talent': buyTalent(s, arg as 'vault' | 'res' | 'coin' | 'startPegs'); break;
      case 'add':
        if (arg === 'coins') s.run.coins = s.run.coins * 10 + 1000;
        if (arg === 'energy') s.epoch.energy += 100;
        if (arg === 'sand') s.cycle.sand += 100;
        if (arg === 'legacy') s.legacy.points += 5;
        break;
      case 'reset': if (confirm('确定重置全部存档?')) app.resetAll(); break;
    }
    app.save();
    renderTabs();
    renderBody();
    renderPick();
  }

  root.addEventListener('pointerdown', ev => {
    const el = (ev.target as HTMLElement).closest('[data-act],[data-tab],[data-speed],[data-color]') as HTMLElement | null;
    if (!el || (el as HTMLButtonElement).disabled) return;
    if (el.dataset.tab) {
      tab = el.dataset.tab as Tab;
      renderTabs();
      if (tab === 'debug') bodyEl.innerHTML = debugTab();
      renderBody();
      return;
    }
    if (el.dataset.speed) { app.speed = +el.dataset.speed; app.paused = false; renderTabs(); return; }
    if (el.dataset.color) { pegColor = +el.dataset.color; renderBody(); return; }
    if (el.dataset.act) act(el.dataset.act);
  });
  root.addEventListener('change', ev => {
    const el = ev.target as HTMLInputElement;
    if (el.dataset.param) {
      const v = parseFloat(el.value);
      if (isFinite(v)) (T as unknown as Record<string, number>)[el.dataset.param] = v;
    }
  });
  pickEl.addEventListener('pointerdown', ev => {
    const el = (ev.target as HTMLElement).closest('[data-pick]') as HTMLElement | null;
    if (!el) return;
    pickCard(app.state, el.dataset.pick!);
    app.save();
    renderPick();
    renderBody();
  });

  renderTabs();
  renderBody();
  setInterval(() => { if (tab !== 'debug') renderBody(); else updateDebugStats(); renderPick(); }, 250);
}
