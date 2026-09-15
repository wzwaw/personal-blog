# 个人博客（VitePress + Cloudflare Pages）

零成本个人站：Markdown 写作，Git 推送自动发布。

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

## 发布到 Cloudflare Pages

### 1. 创建 GitHub 仓库

1. 打开 https://github.com/new
2. 仓库名建议：`personal-blog`（可私有）
3. **不要**勾选自动添加 README（本目录已有文件）
4. 在本目录执行：

```bash
git init
git add .
git commit -m "chore: 初始化 VitePress 个人博客骨架"
git branch -M main
git remote add origin git@github.com:<你的用户名>/personal-blog.git
git push -u origin main
```

### 2. 连接 Cloudflare Pages

1. 注册/登录 https://dash.cloudflare.com （邮箱即可，可不绑信用卡）
2. 左侧 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 授权 GitHub，选择 `personal-blog` 仓库
4. 构建设置：

| 项 | 值 |
|----|-----|
| Framework preset | VitePress（或 None） |
| Build command | `npm run docs:build` |
| Build output directory | `docs/.vitepress/dist` |
| Root directory | `/`（仓库根目录） |

5. 保存并部署。成功后会得到 `https://<项目名>.pages.dev`

### 3. 之后更新

改 Markdown → `git push` → Pages 自动重新构建。

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
