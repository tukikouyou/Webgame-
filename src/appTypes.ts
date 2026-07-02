/* 应用上下文:把可变的运行期开关(暂停/倍速)与全局动作(新局/打开界面)
   暴露给 UI 层,避免 UI 直接依赖 main 的内部实现。 */
import type { GameState } from './core/types';

export interface App {
  state: GameState;
  paused: boolean;
  speed: number;
  newGame(): void;        // 重开一局(新种子)并取消暂停
  openSetup(): void;      // 打开开局选择界面
  rebuildDebug(): void;   // 外部改动后刷新调试面板
}
