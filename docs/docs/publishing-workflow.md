# 如何向本站投稿内容

固定写作流：

1. 你提供原文、飞书链接或外链列表
2. 标明：`可公开` / `需脱敏` / `仅作素材不直接发`
3. 整理成 Markdown，放入对应目录
4. 本地 `npm run docs:dev` 预览
5. 运行 `npm run docs:build`
6. 发布到 Cloudflare Pages：

```bash
npx wrangler pages deploy docs/.vitepress/dist \
  --project-name=muyue627-blog \
  --branch=main
```

7. 提交并推送源码

## 目录约定

| 栏目 | 目录 | 用途 |
|------|------|------|
| 思考 | `docs/notes/` | 随笔、复盘 |
| 知识文档 | `docs/docs/` | 手册、流程总结 |
| 外链 | `docs/links/` | 书签与摘录 |

## 新建一篇文章

1. 在对应目录新建 `xxx.md`
2. 在 `docs/.vitepress/config.ts` 的 `sidebar` 里加上链接
3. 提交并推送
