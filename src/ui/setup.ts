/* 开局选择界面:选玩家队伍、为四炮台各选专属特性、可自选颜色,然后开始对战。
   下方展示局外成长:等级/经验/金币 + 已购遗物(波次结算的商店里购买)。 */
import type { App } from '../appTypes';
import type { TraitKey } from '../config/configTypes';
import { TEAMS, TRAITS, TRAIT_KEYS, RELICS, META } from '../config/config';
import { deriveCell, colorName } from '../render/colors';
import { xpForLevel } from '../core/meta';
import { setPaused } from './controls';

const setupEl = document.getElementById('setup')!;
const setupGrid = document.getElementById('setupGrid')!;
const metaEl = document.getElementById('setupMeta')!;
const cancelBtn = document.getElementById('btnCancelSetup')!;

export function initSetup(app: App): () => void {
  let setupTrait: TraitKey[] = app.state.cfg.trait.slice();
  let playerIdx = app.state.playerIdx;
  let started = false;   // 是否已经开过至少一局(决定"返回对局"是否可用)

  function renderMetaPanel(): void {
    const m = app.meta;
    const owned: Record<string, number> = {};
    for (const r of m.relics) owned[r] = (owned[r] || 0) + 1;
    const nextXp = m.level >= META.maxLevel ? 0 : xpForLevel(m.level);
    metaEl.innerHTML =
      '<div class="metaRow">'
      + '<span class="metaLvl">Lv.' + m.level + '</span>'
      + '<div class="xpBar"><div class="xpFill" style="width:' + (nextXp ? Math.min(100, m.xp / nextXp * 100) : 100) + '%"></div></div>'
      + '<span class="xpTxt">' + (nextXp ? m.xp + '/' + nextXp + ' XP' : 'MAX') + '</span>'
      + '<span class="metaCoins">🪙 ' + m.coins + '</span>'
      + '<span class="metaWins">🏆 ' + m.wins + ' 胜</span>'
      + '</div>'
      + '<div class="relicRow">' + (m.relics.length
        ? RELICS.filter(r => owned[r.id]).map(r => '<span class="relicChip" title="' + r.desc + '">' + r.icon + ' ' + r.name + (owned[r.id] > 1 ? '×' + owned[r.id] : '') + '</span>').join('')
        : '<span class="relicNone">尚未拥有遗物 —— 通过波次与整局胜利获得金币后在此查看</span>')
      + '</div>';
  }

  function buildSetup(): void {
    setupGrid.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const tm = TEAMS[i];
      const card = document.createElement('div');
      card.className = 'teamCard' + (playerIdx === i ? ' isPlayer' : '');
      card.style.borderColor = tm.ball;
      const row = TRAIT_KEYS.map(k =>
        '<button class="traitBtn' + (setupTrait[i] === k ? ' sel' : '') + '" data-team="' + i + '" data-key="' + k + '">' + TRAITS[k].name + '</button>'
      ).join('');
      card.innerHTML =
        '<h4>' + (playerIdx === i ? '<span class="youTag">你</span>' : '')
          + '<span class="dot" id="dot' + i + '" style="background:' + tm.ball + '"></span><span id="tname' + i + '">' + tm.name + '炮台</span>'
          + '<button class="pickYou' + (playerIdx === i ? ' sel' : '') + '" data-team="' + i + '" style="margin-left:auto;">选为我方</button>'
          + '<input type="color" class="colPick" data-team="' + i + '" value="' + tm.ball + '" title="自选炮台颜色" ' +
          'style="width:34px;height:24px;padding:0;border:1px solid #2a2a30;border-radius:5px;background:none;cursor:pointer;"></h4>'
        + '<div class="traitRow">' + row + '</div>'
        + '<div class="traitDesc" id="desc' + i + '">' + TRAITS[setupTrait[i]].desc + '</div>';
      setupGrid.appendChild(card);
    }
    setupGrid.querySelectorAll('.traitBtn').forEach(b => {
      (b as HTMLElement).onclick = () => {
        const el = b as HTMLElement;
        const ti = +el.dataset.team!, key = el.dataset.key as TraitKey;
        setupTrait[ti] = key;
        setupGrid.querySelectorAll('.traitBtn[data-team="' + ti + '"]').forEach(x =>
          x.classList.toggle('sel', (x as HTMLElement).dataset.key === key));
        document.getElementById('desc' + ti)!.textContent = TRAITS[key].desc;
      };
    });
    setupGrid.querySelectorAll('.pickYou').forEach(b => {
      (b as HTMLElement).onclick = () => {
        playerIdx = +(b as HTMLElement).dataset.team!;
        buildSetup();
      };
    });
    setupGrid.querySelectorAll('.colPick').forEach(inp => {
      (inp as HTMLInputElement).oninput = () => {
        const el = inp as HTMLInputElement;
        const ti = +el.dataset.team!;
        TEAMS[ti].ball = el.value;
        TEAMS[ti].cell = deriveCell(el.value);
        TEAMS[ti].name = colorName(el.value);
        document.getElementById('dot' + ti)!.style.background = el.value;
        document.getElementById('tname' + ti)!.textContent = TEAMS[ti].name + '炮台';
        (setupGrid.children[ti] as HTMLElement).style.borderColor = el.value;
      };
    });
    renderMetaPanel();
  }

  function openSetup(): void {
    setupTrait = app.state.cfg.trait.slice();
    playerIdx = app.state.playerIdx;
    buildSetup();
    // 仅在对局进行中(已开过局且未结束)才显示"返回对局";首次进入/已分胜负时隐藏
    cancelBtn.style.display = (started && !app.state.gameOver) ? '' : 'none';
    setupEl.classList.remove('hidden');
    setPaused(app, true);
  }

  document.getElementById('btnStart')!.onclick = () => {
    app.state.cfg.trait = setupTrait.slice();
    app.state.playerIdx = playerIdx;
    setupEl.classList.add('hidden');
    started = true;
    app.newGame();
  };

  // 返回对局:关闭界面并继续当前对局(不重置)——防止误点"选择炮台"被迫重开
  cancelBtn.onclick = () => {
    setupEl.classList.add('hidden');
    setPaused(app, false);
  };

  return openSetup;
}
