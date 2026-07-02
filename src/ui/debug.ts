/* 调试面板:实时改动每个炮台的生命/护盾/弹药/物理参数/特性/面板弹珠数。 */
import type { App } from '../appTypes';
import type { TraitKey } from '../config/configTypes';
import { TEAMS, TRAITS, TRAIT_KEYS } from '../config/config';
import { fmt } from '../core/util';
import { initTrait } from '../core/cannons';
import { newPlinkoBall } from '../core/plinko';

const debugEl = document.getElementById('debug')!;
const dbgBody = document.getElementById('dbgBody')!;

function field(label: string, val: number, min: number, max: number, stepv: number,
               oninput: (v: number) => void, fmtFn?: (v: number) => string): HTMLElement {
  const wrap = document.createElement('div'); wrap.className = 'dbgField';
  const lb = document.createElement('label'); lb.textContent = label;
  const rg = document.createElement('input'); rg.type = 'range';
  rg.min = '' + min; rg.max = '' + max; rg.step = '' + stepv; rg.value = '' + val;
  const vv = document.createElement('span'); vv.className = 'val';
  const show = (v: number) => (fmtFn ? fmtFn(v) : '' + v);
  vv.textContent = show(+val);
  rg.oninput = () => { vv.textContent = show(+rg.value); oninput(+rg.value); };
  wrap.append(lb, rg, vv); return wrap;
}

export function initDebug(app: App): { open: () => void; rebuild: () => void } {
  function buildDebug(): void {
    const s = app.state;
    dbgBody.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const c = s.cannons[i], tm = TEAMS[i];
      const det = document.createElement('details'); det.className = 'dbgTeam';
      if (i === 0) det.open = true;
      const sum = document.createElement('summary');
      sum.innerHTML = '<span class="dot" style="background:' + tm.ball + '"></span>' + tm.name + '炮台';
      det.appendChild(sum);
      // 特性下拉
      const fr = document.createElement('div'); fr.className = 'dbgField';
      const fl = document.createElement('label'); fl.textContent = '专属特性';
      const sel = document.createElement('select');
      for (const k of TRAIT_KEYS) {
        const op = document.createElement('option');
        op.value = k; op.textContent = TRAITS[k].name; if (c.trait === k) op.selected = true; sel.appendChild(op);
      }
      sel.onchange = () => { c.trait = sel.value as TraitKey; s.cfg.trait[i] = sel.value as TraitKey; initTrait(c); };
      fr.append(fl, sel); det.appendChild(fr);
      // 实时状态
      det.appendChild(field('生命值', c.hp, 0, 2000, 1, v => { c.hp = v; }));
      det.appendChild(field('生命上限', c.maxHp, 10, 2000, 5, v => { c.maxHp = v; if (c.hp > v) c.hp = v; }));
      det.appendChild(field('计时护盾(秒)', c.shield | 0, 0, 60, 1, v => { c.shield = v; }));
      det.appendChild(field('永久护盾值', c.shieldHp, 0, 2000, 10, v => { c.shieldHp = v; }));
      det.appendChild(field('额外生命', c.lives, 0, 20, 1, v => { c.lives = v; }));
      det.appendChild(field('最初弹药底数', c.baseAmmo, 1, 10000, 1, v => { c.baseAmmo = v; }, fmt));
      det.appendChild(field('弹药', c.ammo, 0, 100000, 100, v => { c.ammo = v; }, fmt));
      det.appendChild(field('待发子弹', c.queue, 0, 100000, 100, v => { c.queue = v; }, fmt));
      det.appendChild(field('炮弹速度↓', s.cfg.spMin[i], 20, 800, 10, v => { s.cfg.spMin[i] = v; if (s.cfg.spMax[i] < v) s.cfg.spMax[i] = v; }));
      det.appendChild(field('炮弹速度↑', s.cfg.spMax[i], 20, 800, 10, v => { s.cfg.spMax[i] = v; if (s.cfg.spMin[i] > v) s.cfg.spMin[i] = v; }));
      det.appendChild(field('阻力(保留/s)', s.cfg.damp[i], 0.80, 1.00, 0.005, v => { s.cfg.damp[i] = v; }, v => v.toFixed(3)));
      det.appendChild(field('摆动幅度', s.cfg.swing[i], 0, 3.14, 0.05, v => { s.cfg.swing[i] = v; }, v => v.toFixed(2)));
      det.appendChild(field('射速上限', s.cfg.fireRateMax[i], 10, 2000, 10, v => { s.cfg.fireRateMax[i] = v; }));
      det.appendChild(field('弹珠伤害', s.cfg.marbleDmg[i], 1, 100, 1, v => { s.cfg.marbleDmg[i] = v; }));
      // 面板弹珠数(增减)
      const pr = document.createElement('div'); pr.className = 'dbgField';
      const pl = document.createElement('label'); pl.textContent = '面板弹珠数';
      const minus = document.createElement('button'); minus.textContent = '−'; minus.style.cssText = 'padding:2px 12px;';
      const cnt = document.createElement('span'); cnt.className = 'val';
      const plus = document.createElement('button'); plus.textContent = '+'; plus.style.cssText = 'padding:2px 12px;';
      const refresh = () => { cnt.textContent = '' + s.plinkoBalls.reduce((a, b) => a + (b.c === i ? 1 : 0), 0); };
      minus.onclick = () => { const idx = s.plinkoBalls.findIndex(b => b.c === i); if (idx >= 0) s.plinkoBalls.splice(idx, 1); refresh(); };
      plus.onclick = () => { s.plinkoBalls.push(newPlinkoBall(s, i)); refresh(); };
      pr.append(pl, minus, cnt, plus); refresh(); det.appendChild(pr);
      dbgBody.appendChild(det);
    }
  }

  document.getElementById('dbgClose')!.onclick = () => debugEl.classList.add('hidden');
  debugEl.onclick = (e) => { if (e.target === debugEl) debugEl.classList.add('hidden'); };
  document.getElementById('dbgHealAll')!.onclick = () => { for (const c of app.state.cannons) c.hp = c.maxHp; buildDebug(); };
  document.getElementById('dbgAmmo1k')!.onclick = () => { for (const c of app.state.cannons) c.ammo += 1000; buildDebug(); };
  document.getElementById('dbgClearMarbles')!.onclick = () => { app.state.marbles = []; app.state.counts = [0, 0, 0, 0]; };

  return {
    open: () => { buildDebug(); debugEl.classList.remove('hidden'); },
    rebuild: buildDebug,
  };
}
