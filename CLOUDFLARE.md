# Cloudflare Pages 部署

正式站点：https://muyue627-blog.pages.dev

Cloudflare Pages 项目名：`muyue627-blog`

## 本地发布

确认 Wrangler 已登录：

```bash
npx wrangler whoami
```

构建并发布：

```bash
npm run docs:build
npx wrangler pages deploy docs/.vitepress/dist \
  --project-name=muyue627-blog \
  --branch=main
```

## GitHub Actions 发布

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
