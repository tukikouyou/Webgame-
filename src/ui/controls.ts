/* 顶栏控件:暂停 / 重新开始 / 选择炮台 / 调试面板 / 倍速,以及结算后点画面重开选择。 */
import type { App } from '../appTypes';

const btnPause = document.getElementById('btnPause')!;

// 统一设置暂停态并同步按钮文字(setup/debug 也会调用)
export function setPaused(app: App, v: boolean): void {
  app.paused = v;
  btnPause.textContent = v ? '▶ 继续' : '⏸ 暂停';
}

export function initControls(app: App, openSetup: () => void, openDebug: () => void): void {
  btnPause.onclick = () => setPaused(app, !app.paused);
  document.getElementById('btnReset')!.onclick = () => { app.newGame(); };
  document.getElementById('btnSetup')!.onclick = openSetup;
  document.getElementById('btnDebug')!.onclick = openDebug;

  document.querySelectorAll('.sp').forEach(b => {
    (b as HTMLElement).onclick = () => {
      app.speed = +(b as HTMLElement).dataset.s!;
      document.querySelectorAll('.sp').forEach(x => x.classList.toggle('active', x === b));
    };
  });

  const cv = document.getElementById('cv')!;
  cv.addEventListener('click', () => { if (app.state.gameOver) openSetup(); });
}
