# 追剧清单 / WatchList

个人追剧与观影进度管理应用，通过 TMDB 获取影视元数据，前台展示观影清单，后台管理追剧进度。

## 技术栈

| 类别 | 选择 |
|------|------|
| 框架 | Next.js 15 (App Router, TypeScript) |
| UI | shadcn/ui + Tailwind CSS + Radix UI + Lucide Icons |
| 数据库 | Turso (libSQL / SQLite) |
| ORM | Drizzle ORM |
| 认证 | Auth.js v5 (Credentials, JWT) |
| 部署 | Vercel |

## 功能一览

**前台**
- 影视列表 — 按类型 (剧集/电影)、状态 (在看/已看/想看…)、标签筛选 + 分页
- 详情页 — 全宽背景墙、海报、评分、观看进度 (TV S02E05)、播放按钮
- 标签归档页
- 暗色/亮色主题切换

**后台 (`/admin`)**
- 仪表盘 — 总数、状态分布、最近更新
- TMDB 搜索 — 搜索并一键添加影视到库
- 影视管理 — 编辑状态、评分、笔记、播放链接、可见性
- 剧集进度 — 季/集选择器 + 可视化集数网格
- 标签管理 — 增删改 + 颜色选择
- 系统设置 — KV 键值配置

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local` 并填写：

```bash
cp .env.example .env.local
```

```env
# Auth — 生成密钥: openssl rand -hex 32
AUTH_SECRET=
ADMIN_USERNAME=admin
# 生成密码哈希: node -e "require('bcryptjs').hash('yourpassword',10).then(console.log)"
ADMIN_PASSWORD_HASH=

# Database (Turso)
TURSO_CONNECTION_URL=file:local.db   # 本地开发可用文件数据库
TURSO_AUTH_TOKEN=                     # Turso 远程连接时需要

# TMDB — 在 https://www.themoviedb.org/settings/api 申请
TMDB_API_KEY=

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. 初始化数据库

```bash
pnpm db:push
```

### 4. 启动开发服务器

```bash
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看前台，访问 `/login` 登录后进入 `/admin` 后台。

## 项目结构

```
src/
├── app/
│   ├── (auth)/login/          # 登录页
│   ├── (public)/              # 前台
│   │   ├── media/             # 影视列表 + 详情
│   │   └── tags/[slug]/       # 标签筛选
│   ├── admin/                 # 后台管理
│   │   ├── search/            # TMDB 搜索添加
│   │   ├── library/           # 影视管理 + 编辑
│   │   ├── tags/              # 标签管理
│   │   └── settings/          # 系统设置
│   └── api/
│       ├── auth/              # Auth.js 路由
│       └── tmdb/              # TMDB 代理 API
├── components/                # 业务组件 + shadcn/ui
├── db/                        # Drizzle Schema + 客户端
├── lib/                       # auth / tmdb / utils
└── middleware.ts               # 路由保护
```

## 数据库表

| 表名 | 说明 |
|------|------|
| `media_items` | 影视条目主表 (TMDB 元数据 + 状态/评分/笔记) |
| `tv_progress` | 电视剧进度 (季/集) |
| `movie_progress` | 电影观看状态 |
| `tags` | 标签 |
| `media_tags` | 影视-标签关联 |
| `site_config` | 站点配置 (KV) |

## 常用命令

```bash
pnpm dev            # 开发服务器
pnpm build          # 生产构建
pnpm db:push        # 推送 Schema 到数据库
pnpm db:generate    # 生成迁移文件
pnpm db:studio      # 打开 Drizzle Studio
```

## 部署到 Vercel

1. 在 Vercel 导入仓库
2. 设置环境变量 (同 `.env.example`)
3. 部署即可 — 构建命令和框架会自动识别

## License

MIT
