/* 开局选择界面:为四炮台各选专属特性,可自选颜色,然后开始对战。 */
import type { App } from '../appTypes';
import type { TraitKey } from '../config/configTypes';
import { TEAMS, TRAITS, TRAIT_KEYS } from '../config/config';
import { deriveCell, colorName } from '../render/colors';
import { setPaused } from './controls';

const setupEl = document.getElementById('setup')!;
const setupGrid = document.getElementById('setupGrid')!;

export function initSetup(app: App): () => void {
  let setupTrait: TraitKey[] = app.state.cfg.trait.slice();

  function buildSetup(): void {
    setupGrid.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const tm = TEAMS[i];
      const card = document.createElement('div');
      card.className = 'teamCard';
      card.style.borderColor = tm.ball;
      const row = TRAIT_KEYS.map(k =>
        '<button class="traitBtn' + (setupTrait[i] === k ? ' sel' : '') + '" data-team="' + i + '" data-key="' + k + '">' + TRAITS[k].name + '</button>'
      ).join('');
      card.innerHTML =
        '<h4><span class="dot" id="dot' + i + '" style="background:' + tm.ball + '"></span><span id="tname' + i + '">' + tm.name + '炮台</span>' +
          '<input type="color" class="colPick" data-team="' + i + '" value="' + tm.ball + '" title="自选炮台颜色" ' +
          'style="margin-left:auto;width:34px;height:24px;padding:0;border:1px solid #2a2a30;border-radius:5px;background:none;cursor:pointer;"></h4>' +
        '<div class="traitRow">' + row + '</div>' +
        '<div class="traitDesc" id="desc' + i + '">' + TRAITS[setupTrait[i]].desc + '</div>';
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
  }

  function openSetup(): void {
    setupTrait = app.state.cfg.trait.slice();
    buildSetup();
    setupEl.classList.remove('hidden');
    setPaused(app, true);
  }

  document.getElementById('btnStart')!.onclick = () => {
    app.state.cfg.trait = setupTrait.slice();
    setupEl.classList.add('hidden');
    app.newGame();
  };

  return openSetup;
}
