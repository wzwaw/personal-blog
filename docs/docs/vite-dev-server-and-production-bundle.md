# Vite 什么时候在打包，浏览器又从哪里开始渲染

Webpack 的心智模型是：从入口建立依赖图，用 loader 转换资源，打成 bundle，开发和生产都围绕这份打包结果。开发服务器只是把结果放在内存里，并尽量做成增量。

Vite 把这件事拆开了。开发时不先打整包；生产时才把模块交给 Rollup。

## 开发服务器按请求转换模块

浏览器请求哪个模块，Vite 就转换哪个模块，再以原生 ESM 的形式返回。项目依赖通常会用 esbuild 预构建一次，避免每个依赖都走大量细碎请求。

所以开发环境里不存在“先得到一个大 chunk，页面再跑起来”。改一个组件，重新转换的也是被请求到的那条模块链。

## 生产构建仍然会把模块打成 chunk

组件、TypeScript、CSS 和图片在 Vite 里都是模块，这一点和 Webpack 相同。差别是处理时机。

生产构建时：

- `.vue`、`.ts`、`.js` 先变成 JavaScript 模块，由 Rollup 建依赖图、做 tree-shaking 和分 chunk
- CSS 经过 Vite 和 PostCSS 处理，再提取成独立产物
- 图片和字体作为 asset：小文件可以内联，大文件输出到带 hash 的路径，引用会被改写成最终地址

Rollup 的核心是模块图，不是“只能看见 JS”。CSS 和图片通过 Vite / Rollup 插件进入这棵图。Webpack 则是另一套分工：loader 先把非 JS 资源转成能进入模块图的内容，plugin 再做压缩、注入和产物处理。

可以记成：

| | 开发 | 生产 | 非 JS 资源 |
| --- | --- | --- | --- |
| Webpack | 增量打包 | 打包 | loader 转换，plugin 增强 |
| Vite | 按请求转换，ESM 直出 | Rollup 打包 | 插件接入构建图 |

日常真正要管的通常是 `manualChunks`、代理、环境变量和构建后的资源路径，而不是重新发明一套打包器。

## 浏览器拿到包之后，从入口开始执行

打包不会自动知道该渲染哪个组件。入口模块会在执行时调用应用的挂载函数，例如：

```ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

React 则是入口里的 `createRoot(container).render(<App />)`。

HTML 引用这个入口脚本。入口执行时顺着 import 找到根组件，框架再从根组件的渲染结果创建页面。其他组件是否被执行，取决于根组件的渲染树和路由有没有引用它们。生产环境里，这些引用关系已经体现在 chunk 的依赖上；开发环境里，则是浏览器顺着 ESM 继续向 Vite 要模块。
