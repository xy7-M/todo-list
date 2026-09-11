# 🎙️ Todo · 语音待办

> 一句话语音、一段话，自动解析成带**时间**和**优先级**的待办清单。
> 基于 Next.js 15 (App Router) + Supabase，支持语音输入、AI 自然语言解析、账号同步与实时更新。

✅ **已适配 Vercel 部署**：内置 `vercel.json`、`.nvmrc` 与 `package-lock.json`，构建开箱即通。

---

## ✨ 功能特性

- 🎤 **语音录入** —— 按住录音或上传音频，硅基流动 `SenseVoiceSmall` 实时转写成文字
- 🤖 **AI 解析** —— DeepSeek 把「明天下午 3 点提醒我带钥匙」自动拆成「时间 + 事项 + 优先级」
- 🚩 **优先级标记** —— 每条待办支持 `高 / 中 / 低`，列表上一键循环切换
- 🔐 **账号体系** —— Supabase Auth 邮箱注册 / 登录 / 登出
- ☁️ **云端同步** —— 数据存 Supabase Postgres，开启 RLS，**每个用户只能看自己的数据**
- ⚡ **实时更新** —— Supabase Realtime，多端秒级同步
- 🌑 **暗色极客主题** —— 默认深色，护眼、低饱和

---

## 🧱 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 15.5.24 (App Router) · React 18 |
| 运行时 | Node.js 22（Vercel 默认 ≥ 20.9） |
| 样式 | Tailwind CSS 3.4 · Radix UI · lucide-react |
| 后端 / BaaS | Supabase (Postgres + Auth + Realtime + Storage) |
| 语音识别 | 硅基流动（SiliconFlow）SenseVoiceSmall |
| AI 解析 | DeepSeek Chat |
| 部署 | Vercel（推荐） |

---

## 📁 目录结构

```text
.
├── app/
│   ├── api/
│   │   ├── parse-todo/route.ts   # DeepSeek 自然语言解析（服务端）
│   │   ├── transcribe/route.ts    # 硅基流动语音识别（服务端）
│   │   └── auth/                  # Supabase Auth 回调
│   ├── auth/                      # 登录 / 注册 / 改密页面
│   ├── page.tsx                   # 首页（语音待办主界面）
│   ├── layout.tsx                 # 根布局（暗色主题、防翻译注入）
│   └── globals.css
├── components/                   # UI 组件、表单、徽章等
├── lib/
│   ├── supabase/                 # client / server / session 三件套
│   └── utils.ts                  # cn() + hasEnvVars 环境变量探测
├── sql/
│   └── init.sql                  # 建表 + RLS 策略 + Realtime 发布
├── .env.example                  # 环境变量模板（已脱敏）
├── .gitignore
├── .nvmrc                        # Node 版本（Vercel 读取）
├── vercel.json                   # Vercel 构建 / 区域 / 函数 / 响应头配置
├── package-lock.json             # 锁定依赖，保证线上构建可复现
├── next.config.ts
└── package.json
```

---

## 🚀 快速开始（本地）

### 1. 前置条件

- Node.js 20+（推荐 22 LTS）
- 一个 Supabase 项目（免费版即可）
- 一个 SiliconFlow API Key（语音识别）
- 一个 DeepSeek API Key（AI 解析）

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制模板并填入真实值（`.env.local` 已被 `.gitignore` 忽略，不会上传）：

```bash
cp .env.example .env.local
```

```bash
# 服务端密钥 —— 严禁加 NEXT_PUBLIC_ 前缀（只在服务端 /api 路由使用）
SILICONFLOW_API_KEY=sk-xxxx           # 硅基流动：语音识别
DEEPSEEK_API_KEY=sk-xxxx              # DeepSeek：自然语言解析

# Supabase —— 前端可读，必须带 NEXT_PUBLIC_ 前缀
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...           # anon / publishable key
```

> ⚠️ 项目代码读取的是 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
> 如果你习惯用经典命名 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，两者填同一个值即可（它们是同一个 anon JWT 的新旧命名）。

### 4. 初始化 Supabase

在 Supabase 控制台 **SQL Editor** 中粘贴并运行 `sql/init.sql`，它将一次性创建：

- `public.todos` 表（`priority` 约束 + 用户索引）
- 4 条 RLS 策略（select / insert / update / delete 均限定 `auth.uid() = user_id`）
- `my-todo` 私有存储桶 + 3 条 storage 策略
- `supabase_realtime` 订阅 `public.todos`

### 5. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000 。先注册账号 → 录音或粘贴文字 → 体验 AI 解析与云端同步。

---

## 🔧 环境变量一览

| 变量名 | 必填 | 说明 | 暴露范围 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 项目 URL | 浏览器（前端必须） |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | anon / publishable key | 浏览器（前端必须） |
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API Key | **仅服务端** |
| `SILICONFLOW_API_KEY` | ✅ | 硅基流动 API Key | **仅服务端** |

> 服务端密钥**不要**加 `NEXT_PUBLIC_` 前缀，否则会被打包进前端 bundle 泄露。

---

## 🌐 部署到 Vercel

### 1. 导入项目

在 [vercel.com](https://vercel.com) 点击 **Add New → Project**，导入 `xy7-M/todo-list`。

Vercel 会自动读取仓库里的配置，**无需手动改任何构建设置**：

| 配置项 | 值 | 来源 |
|---|---|---|
| Framework Preset | Next.js | `vercel.json` 的 `framework` |
| Build Command | `next build` | `vercel.json` 的 `buildCommand` |
| Install Command | `npm install` | `vercel.json` 的 `installCommand` |
| Node.js Version | 22 | `.nvmrc` + `package.json` 的 `engines` |
| Root Directory | `.`（仓库根） | — |
| 部署区域 | `hkg1`（中国香港） | `vercel.json` 的 `regions` |

> 为什么选 hkg1：Supabase / DeepSeek / 硅基流动的调用链路在亚太区延迟更低，
> 国内访问也比默认的 `iad1` 快。如需改到别处，编辑 `vercel.json` 的 `regions` 即可。

### 2. 配置环境变量

展开 **Environment Variables**，把下面 4 个变量全部粘进去，
**Production / Preview / Development 三个环境都勾上**：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
DEEPSEEK_API_KEY=sk-xxxx
SILICONFLOW_API_KEY=sk-xxxx
```

> ⚠️ 两个不带 `NEXT_PUBLIC_` 前缀的密钥**只能配在服务端**（Vercel 环境变量即满足），
> 绝不要加 `NEXT_PUBLIC_` 前缀，否则会被打包进前端 bundle。
> 本地开发用 `.env.local`（已被 `.gitignore` 忽略）。

### 3. 部署

点击 **Deploy**。构建产物：

```text
Route (app)                              Size  First Load JS
┌ ○ /                                 6.73 kB         188 kB
├ ƒ /api/parse-todo                    137 B         103 kB
├ ƒ /api/transcribe                    137 B         103 kB
├ ƒ /auth/confirm                      137 B         103 kB
├ ○ /auth/login                      4.14 kB         185 kB
├ ○ /auth/sign-up                    4.19 kB         185 kB
└ ƒ Middleware                       92.7 kB
```

部署完成后，只要在 Supabase 里跑过 `sql/init.sql`，即可直接访问。

### 4. 绑定自定义域名后必须做的事

如果绑定了自定义域名，需要到 **Supabase → Authentication → URL Configuration**，
把生产域名加到 **Site URL** 与 **Redirect URLs**：

```text
https://your-domain.com/**
https://your-project.vercel.app/**
```

否则注册确认邮件里的链接会跳回 `localhost:3000`。

---

## 🔧 Vercel 兼容性说明

本项目为兼容 Vercel 做了以下调整：

| 项 | 做法 | 原因 |
|---|---|---|
| **Node 运行时** | 两个 API 路由显式声明 `export const runtime = "nodejs"` | `/api/transcribe` 用到 `node:fs`、`node:child_process`，Edge Runtime 不支持 |
| **函数超时** | `parse-todo` 30s / `transcribe` 60s（同时写进 `vercel.json` 与路由的 `maxDuration`） | 语音转写 + ffmpeg 回退转码较慢，默认 10s 不够 |
| **禁止缓存** | 路由声明 `dynamic = "force-dynamic"`，并在 `vercel.json` 给 `/api/*` 加 `no-store` | 读登录态、写数据库，绝不能被静态化 |
| **密钥注入** | 移除 `next.config.ts` 里的 `env` 内联，改由 Vercel 原生注入 `process.env` | 内联会把服务端密钥编译进产物；Vercel 不需要这种变通 |
| **依赖可复现** | `@supabase/ssr` / `@supabase/supabase-js` 由 `latest` 改为固定范围，并提交 `package-lock.json` | `latest` 每次构建解析到不同版本，线上行为不可复现 |
| **Node 版本** | `.nvmrc` + `engines.node` 锁 20.9 ~ 22 | 与 Vercel 默认运行时对齐，避免构建机版本漂移 |
| **Next.js 版本** | 15.5.24 | Vercel 会直接拒绝部署含 CVE-2025-66478 的版本（15.0.0–16.0.6 中的受影响区间）；15.5.24 已修复 |
| **会话刷新** | `lib/supabase/session.ts` 用官方标准写法，同时写回 request + response cookie | 保证同一次请求内下游代码能读到刷新后的 token，避免用户被随机登出 |

---

## 🔒 安全说明

- 所有密钥只在 `.env.local` 中，且被 `.gitignore` 忽略，**从未进入 git 历史或 GitHub 仓库**。
- 源码通过 `process.env.*` 读取密钥，无任何硬编码。
- 带 `NEXT_PUBLIC_` 前缀的变量是设计上必须暴露给浏览器的；`DEEPSEEK_API_KEY` / `SILICONFLOW_API_KEY` 只在服务端运行，不会出现在前端 bundle。
- 数据库层通过 RLS 强制隔离：每个登录用户只能读写自己的 `todos` 行。

---

## 🪪 License

MIT © 梦逍遥 (Felix)
