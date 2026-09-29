import { defineConfig } from 'vitepress';
import { Transformer } from 'markmap-lib';

const markmapTransformer = new Transformer();

type MarkmapNode = ReturnType<Transformer['transform']>['root'];

const countLeaves = (node: MarkmapNode): number =>
  node.children?.length ? node.children.reduce((sum, child) => sum + countLeaves(child), 0) : 1;

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'zh-CN',
  title: '个人博客',
  description: '工作思考 · 知识文档 · 外链摘录',
  // GitHub Pages 项目站需要 /personal-blog/；Cloudflare Pages 根域名保持 /
  base: process.env.VITEPRESS_BASE || '/',
  cleanUrls: true,
  lastUpdated: true,

  markdown: {
    config(md) {
      const renderFence = md.renderer.rules.fence!;
      // ```markmap 代码块：构建期把 Markdown 大纲转成节点树，浏览器端只需按需加载绘图库
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (token.info.trim() !== 'markmap') return renderFence(tokens, idx, options, env, self);
        const { root } = markmapTransformer.transform(token.content);
        const data = encodeURIComponent(JSON.stringify(root));
        return `<MarkmapDiagram data="${data}" :leaves="${countLeaves(root)}" />`;
      };
    }
  },

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '思考', link: '/notes/' },
      { text: '知识文档', link: '/docs/' },
      { text: '外链', link: '/links/' }
    ],

    sidebar: {
      '/notes/': [
        {
          text: '工作思考',
          items: [
            {
              text: '页面状态与三种抽象',
              link: '/notes/page-states-and-three-abstractions'
            },
            {
              text: '成熟系统里使用 AI',
              link: '/notes/ai-boundaries-in-mature-systems'
            },
            {
              text: '多业务线架构边界',
              link: '/notes/multi-business-architecture-boundaries'
            },
            {
              text: '提示词使用优化总结',
              link: '/notes/prompt-usage-optimization-summary'
            },
            {
              text: 'Clash 规则之外的根因',
              link: '/notes/clashx-tun-corporate-vpn'
            },
            { text: '写给第一篇的说明', link: '/notes/hello' }
          ]
        }
      ],
      '/docs/': [
        {
          text: '知识文档',
          items: [
            {
              text: 'React：从 setState 到 Commit',
              link: '/docs/react-update-from-setstate-to-commit'
            },
            {
              text: 'Hooks 为什么每次都执行',
              link: '/docs/why-hooks-rerun'
            },
            {
              text: 'Vue 3 响应式、watch 与 computed',
              link: '/docs/vue3-watch-computed-reactivity'
            },
            {
              text: 'Vue 2 里几类误判',
              link: '/docs/vue2-pitfalls-beyond-the-framework'
            },
            {
              text: '逻辑、表单和组件怎么抽',
              link: '/docs/extract-logic-forms-and-components'
            },
            {
              text: 'Vite 的开发与生产构建',
              link: '/docs/vite-dev-server-and-production-bundle'
            },
            {
              text: 'SSR 官网：CF、Nginx 与 Node',
              link: '/docs/ssr-site-cloudflare-nginx-node'
            },
            {
              text: '跨端页面的环境约束',
              link: '/docs/cross-platform-ui-constraints'
            },
            { text: '如何向本站投稿内容', link: '/docs/publishing-workflow' }
          ]
        }
      ],
      '/links/': [
        {
          text: '外链书签',
          items: [{ text: '精选链接', link: '/links/' }]
        }
      ]
    },

    socialLinks: [],

    outline: {
      label: '本页目录'
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },

    lastUpdated: {
      text: '最后更新'
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索',
            buttonAriaLabel: '搜索'
          },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },

    footer: {
      message: '内容均为个人学习与公开总结，不含未脱敏的内部资料。',
      copyright: 'Copyright © 2026'
    }
  }
});
