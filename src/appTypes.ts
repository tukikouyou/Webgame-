/* 应用上下文:把可变的运行期开关(暂停/倍速)、全局动作(新局/打开界面)
   与局外存档(meta)暴露给 UI 层,避免 UI 直接依赖 main 的内部实现。 */
import type { GameState } from './core/types';
import type { MetaState } from './core/meta';
import type { Interlude } from './ui/interlude';

export interface App {
  state: GameState;
  meta: MetaState;
  paused: boolean;
  speed: number;
  newGame(): void;        // 重开一局(新种子,套用 meta)并取消暂停
  openSetup(): void;      // 打开开局选择界面
  openShop(): void;       // 打开局外商店(金币/遗物)
  rebuildDebug(): void;   // 外部改动后刷新调试面板
  onMetaChanged(): void;  // 商店购买后:持久化 + 刷新 meta 面板
  interlude: Interlude;   // 波次三选一 / 商店弹窗
}
