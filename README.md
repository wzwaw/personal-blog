# 个人博客（VitePress + Cloudflare Pages）

零成本个人站：使用 Markdown 写作，通过 Cloudflare Pages 发布。

## 本地开发

```bash
npm install
npm run docs:dev
```

浏览器打开终端提示的本地地址（默认 `http://localhost:5173`）。

## 构建

```bash
npm run docs:build
```

产物目录：`docs/.vitepress/dist`

## 仓库地址

https://github.com/wzwaw/personal-blog

本地路径：`/Users/admin/Documents/work/personal-blog`（独立于工作仓，勿放进 `playlet-ui-broad`）。

## 发布到 Cloudflare Pages（推荐）

详细步骤见 [CLOUDFLARE.md](./CLOUDFLARE.md)。核心配置：

| 项 | 值 |
|----|-----|
| Build command | `npm run docs:build` |
| Build output directory | `docs/.vitepress/dist` |
| Node | `22` |

正式地址：`https://muyue627-blog.pages.dev`

### 之后更新

```bash
npm run docs:build
npx wrangler pages deploy docs/.vitepress/dist \
  --project-name=muyue627-blog \
  --branch=main
```

发布完成后再提交并推送源码。

### 备用 GitHub Pages

见 `CLOUDFLARE.md`；地址约为 `https://wzwaw.github.io/personal-blog/`。

## 内容红线

公网站点。只发可公开或已脱敏内容；拿不准默认不发。详见 `docs/notes/hello.md` 与 `docs/docs/publishing-workflow.md`。

## 目录结构

```text
docs/
  index.md          # 首页
  notes/            # 工作思考
  docs/             # 知识文档
  links/            # 外链书签
  .vitepress/
    config.ts       # 站点与侧边栏配置
```
