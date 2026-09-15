import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'zh-CN',
  title: '个人博客',
  description: '工作思考 · 知识文档 · 外链摘录',
  // GitHub Pages 项目站需要 /personal-blog/；Cloudflare Pages 根域名保持 /
  base: process.env.VITEPRESS_BASE || '/',
  cleanUrls: true,
  lastUpdated: true,

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
          items: [{ text: '写给第一篇的说明', link: '/notes/hello' }]
        }
      ],
      '/docs/': [
        {
          text: '知识文档',
          items: [{ text: '如何向本站投稿内容', link: '/docs/publishing-workflow' }]
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
