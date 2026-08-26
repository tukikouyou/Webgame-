/* §LOOP 单步推进:按固定顺序驱动所有系统。渲染独立于此,只读结果。 */
import type { GameState } from './types';
import { updateCannons } from './cannons';
import { updateMarbles } from './marbles';
import { updatePierce, updateBombs, updateNukes, updateHoming, updateShockwaves } from './projectiles';
import { updatePlinko } from './plinko';
import { updateWheel } from './wheel';
import { updateUltimate } from './ultimate';
import { checkWin } from './damage';
import { updateParticles, updateWaves, updateToasts } from './fx';
import { updateEvents } from './events';
import { TEAMS, W } from '../config/config';

export function step(s: GameState, h: number): void {
  s.t += h;
  if (!s.gameOver) {
    updateCannons(s, h);
    updateMarbles(s, h);
    updatePierce(s, h);
    updateBombs(s, h);
    updateNukes(s, h);
    updateHoming(s, h);
    updateShockwaves(s, h);
    updatePlinko(s, h);
    updateWheel(s, h);
    updateUltimate(s, h);
    updateEvents(s, h);
    checkWin(s, h);
  } else if (s.winner) {
    s.confettiT -= h;
    if (s.confettiT <= 0) {
      s.confettiT = 0.08;
      s.particles.push({
        x: s.rng.range(0, W), y: -10, vx: s.rng.range(-40, 40), vy: s.rng.range(120, 320),
        life: s.rng.range(1, 2), max: 2, col: TEAMS[s.winner.idx].ball, sz: s.rng.range(3, 6),
      });
    }
  }
  updateParticles(s, h);
  updateWaves(s, h);
  updateToasts(s, h);
}
