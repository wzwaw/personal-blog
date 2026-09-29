import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import MarkmapDiagram from './components/MarkmapDiagram.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Markdown 中的 ```markmap 代码块在构建期被转换为该组件
    app.component('MarkmapDiagram', MarkmapDiagram);
  }
} satisfies Theme;
