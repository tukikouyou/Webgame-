# 🎯 弹珠领土战争 (Marble Territory War)

一款 2D 俯视的弹珠自走对战游戏：四角炮台不断发射弹珠争夺领土，
靠 **弹珠面板** 攒弹药、**技能转盘** 抽技能、**专属特性** 定策略，活到最后者获胜。
灵感来自 B站「3D 领土战争」弹珠视频。

[![Deploy to GitHub Pages](https://github.com/tukikouyou/Webgame-/actions/workflows/deploy.yml/badge.svg)](https://github.com/tukikouyou/Webgame-/actions/workflows/deploy.yml)

**▶ 在线试玩：https://tukikouyou.github.io/Webgame-/**

---

## 🎮 玩法简介

游戏画面分三个功能区：

- **主战场（80×80 格）** —— 四角四色炮台，弹珠撞到异色格子拼生命值，格子血归零才翻色；把领地铺到敌方炮台脚下才能打炮台，炮台 100 血归零爆炸淘汰。
- **左上弹珠面板（Plinko）** —— 四色小球循环下落，落入 **RELEASE**（发射全部弹药）/ **MULTIPLY**（弹药 ×2）/ **SPIN**（进技能转盘）。
- **右侧技能转盘** —— 普通转盘 9 个技能，金色 ★ 扇区掉入下方**终极转盘** 7 个大招。

**9 个专属特性**（开局每个炮台选一个）：增殖 / 应激护盾 / 背水回血 / 环卫 / 固土 / 重弹 / 游牧 / 磁场 / 相位。

**技能一览：** +弹药 / 护盾 / 偷取 / 炸弹 / 贯穿弹 / 回血 / 追踪弹 …… 以及核弹、永久护盾、额外生命等终极技能。

顶栏还带**倍速切换**和**调试面板**（实时改每个炮台的血量、弹药、物理参数、特性）。

---

## 🛠 技术栈与架构

- **Vite + TypeScript**（strict 模式，零类型错误）
- **四层分离架构**，逻辑与渲染彻底解耦：

```
src/
  config/   数据化配置(JSON + 派生常量)
  core/     纯逻辑内核 —— 零 DOM/Canvas 引用,可移植到 Cocos / C#
  render/   渲染层 —— 只读状态,往 Canvas 画
  ui/       界面层 —— 只操作 DOM
  main.ts   入口:每帧 step(推进) + render(绘制)
```

> `core/` 是引擎无关的「可移植内核」：将来上微信小游戏 / 用 C# 上 Steam 时，
> `config/` 的 JSON 直接复用、`core/` 照着翻译，只需重写 `render/` 和 `ui/`。

详见 [项目结构说明.md](项目结构说明.md)。

---

## 🚀 快速开始

需要 [Node.js](https://nodejs.org/) 20+（推荐 LTS）。

```bash
git clone git@github.com:tukikouyou/Webgame-.git
cd Webgame-
npm install

npm run dev        # 开发服务器,浏览器开 http://localhost:5173(热更新)
npm run build      # 生产构建(tsc 类型检查 + vite 打包) → dist/
npm run preview    # 本地预览构建产物
npm run typecheck  # 只跑类型检查
```

> 也保留了原始单文件版 `marble_territory_war.html`，**双击即可运行**，无需构建。

---

## 📦 部署

推送到 `main` 分支即由 **GitHub Actions 自动构建并发布**到 GitHub Pages。
一次性设置与排错见 [部署说明.md](部署说明.md)。

---

## 🗺 路线图

- [x] 单文件原型 → **Vite + TypeScript 分层重构**
- [x] Web 端（GitHub Pages 自动部署）
- [ ] **微信小游戏**（复用 `core/` + `config/`，适配微信 Canvas）
- [ ] **Steam 桌面版**（Cocos / C# 或 Electron 打包）
- [ ] 更多内容：新技能 / 新特性 / 音效 / 存档

---

## 📚 文档索引

| 文档 | 内容 |
|------|------|
| [项目结构说明.md](项目结构说明.md) | 代码怎么组织、每个文件干什么、加功能该动哪 |
| [部署说明.md](部署说明.md) | GitHub Pages 自动上线的原理与操作步骤 |
