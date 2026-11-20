/* 单帧总编排:按固定顺序推进所有逻辑。 */
import { T } from '../config/tuning';
import type { GameState } from './types';
import { ensureColumns, updateFront, updateBoss, crushStep, incomePerSec } from './field';
import { updatePlinko } from './plinko';
import { emitMarbles, updateMarbles, updateEnemies, spawnEnemy } from './marbles';
import { autoBuy } from './economy';
import { canRebirth, doRebirth } from './prestige';
import { updateFx } from './fx';

export function autoUnlocked(s: GameState): boolean { return s.legacy.everDim >= T.autoUnlockDim; }

export function step(s: GameState, h: number): void {
  const r = s.run;
  r.time += h;
  ensureColumns(s);

  updatePlinko(s, h);

  emitMarbles(s, h);
  updateMarbles(s, h);
  updateEnemies(s, h);
  updateBoss(s, h, (x, y, dmg) => spawnEnemy(s, x, y, dmg));
  crushStep(s, h);
  updateFront(s, h);
  ensureColumns(s);

  // 齐射弹药速率的指数平均(时间常数 15 秒),用于估算火力
  r.ammoRate += r.firedAcc / 15 - r.ammoRate * Math.min(1, h / 15);
  r.firedAcc = 0;

  s.incomeAcc += h;
  if (s.incomeAcc >= 0.25) { s.incomePerSec = incomePerSec(s); s.incomeAcc = 0; }
  r.coins += s.incomePerSec * h;

  s.autoAcc += h;
  if (s.autoAcc >= 0.25) {
    s.autoAcc = 0;
    if (autoUnlocked(s)) {
      if (s.settings.autoUp) autoBuy(s);
      if (s.settings.autoRebirth && r.sinceRecord >= T.autoRebirthSec && canRebirth(s)) doRebirth(s);
    }
  }

  updateFx(s, h);
}
