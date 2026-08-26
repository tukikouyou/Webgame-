/* 局外商店 + 波次三选一弹窗(roguelike 核心 UI)。
   只操作 DOM;商店/选择的数值与效果在 core/meta.ts 与 core/events.ts。 */
import type { App } from '../appTypes';
import { RELICS } from '../config/config';
import type { Choice } from '../core/events';

const shopEl = document.getElementById('shop')!;
const shopBody = document.getElementById('shopBody')!;
const shopCoins = document.getElementById('shopCoins')!;
const choiceEl = document.getElementById('choice')!;
const choiceBody = document.getElementById('choiceBody')!;
const choiceTitle = document.getElementById('choiceTitle')!;

export interface Interlude {
  openShop(): void;
  closeShop(): void;
  openChoice(wave: number, choices: Choice[], onPick: (c: Choice) => void): void;
  closeChoice(): void;
}

export function initInterlude(app: App): Interlude {
  function openShop(): void {
    const m = app.meta;
    shopCoins.textContent = '🪙 ' + m.coins;
    shopBody.innerHTML = RELICS.map(r => {
      const n = m.relics.filter(x => x === r.id).length;
      const afford = m.coins >= r.cost;
      return '<button class="relicCard' + (afford ? '' : ' poor') + '" data-id="' + r.id + '">'
        + '<span class="rIcon">' + r.icon + '</span>'
        + '<span class="rName">' + r.name + (n ? ' <i>已持有×' + n + '</i>' : '') + '</span>'
        + '<span class="rDesc">' + r.desc + '</span>'
        + '<span class="rCost">' + (afford ? '🪙 ' + r.cost : '金币不足') + '</span>'
        + '</button>';
    }).join('');
    shopBody.querySelectorAll('.relicCard').forEach(b => {
      (b as HTMLElement).onclick = () => {
        const id = (b as HTMLElement).dataset.id!;
        const r = RELICS.find(x => x.id === id)!;
        if (m.coins < r.cost) return;
        m.coins -= r.cost;
        m.relics.push(id);
        app.onMetaChanged();
        openShop();   // 刷新
      };
    });
    shopEl.classList.remove('hidden');
  }

  function closeShop(): void { shopEl.classList.add('hidden'); }

  function openChoice(wave: number, choices: Choice[], onPick: (c: Choice) => void): void {
    choiceTitle.textContent = '🌊 波次 ' + wave + ' 结算 —— 选择一项强化';
    choiceBody.innerHTML = choices.map((c, i) =>
      '<button class="choiceCard" data-i="' + i + '">'
      + '<span class="cIcon">' + c.icon + '</span>'
      + '<span class="cName">' + c.name + '</span>'
      + '<span class="cDesc">' + c.desc + '</span>'
      + '</button>'
    ).join('');
    choiceBody.querySelectorAll('.choiceCard').forEach(b => {
      (b as HTMLElement).onclick = () => {
        onPick(choices[+(b as HTMLElement).dataset.i!]);
        closeChoice();
      };
    });
    choiceEl.classList.remove('hidden');
  }

  function closeChoice(): void { choiceEl.classList.add('hidden'); }

  return { openShop, closeShop, openChoice, closeChoice };
}
