# Cloudflare Pages 接入（推荐正式托管）

仓库已推送：https://github.com/wzwaw/personal-blog（当前为私有，可按需改公开）。

## 方式 A：Dashboard 连接 Git（最简单，推荐）

1. 打开 https://dash.cloudflare.com 用邮箱注册/登录（可不绑信用卡）
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 授权 GitHub，勾选仓库 `wzwaw/personal-blog`
4. 构建设置：

| 项 | 值 |
|----|-----|
| Project name | `personal-blog`（将得到 `personal-blog.pages.dev`） |
| Production branch | `main` |
| Build command | `npm run docs:build` |
| Build output directory | `docs/.vitepress/dist` |
| Root directory | `/` |
| Environment variable | `NODE_VERSION` = `22` |

5. **Save and Deploy**，约 1～2 分钟后得到：

`https://personal-blog.pages.dev`

之后每次 `git push` 自动更新。

## 方式 B：GitHub Actions + API Token

1. Cloudflare → My Profile → API Tokens → Create Token → 模板 **Edit Cloudflare Workers**（需含 Pages 编辑）
2. 复制 Account ID（Workers 概览右侧）
3. GitHub 仓库 → Settings → Secrets → Actions，添加：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. 推送或手动跑 `.github/workflows/deploy-pages.yml`

## 备用：GitHub Pages

不依赖 Cloudflare 时，可用 `.github/workflows/deploy-github-pages.yml`。

1. 仓库改为 **Public**（免费 Pages 要求）
2. Settings → Pages → Source = **GitHub Actions**
3. 地址约为：`https://wzwaw.github.io/personal-blog/`
