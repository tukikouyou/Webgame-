import { defineConfig } from 'vite';

export default defineConfig({
  // 用相对路径打包,使产物在 GitHub Pages 子路径(/Webgame-/)、
  // 以及直接双击 dist/index.html 时都能正常加载资源。
  base: './',
  // 多页面:原游戏 index.html + 《弹珠升维》demo idle.html
  build: {
    rollupOptions: {
      input: { main: 'index.html', idle: 'idle.html' },
    },
  },
});
