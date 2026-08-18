# 🎙️ Todo · 语音待办

> 一句话语音、一段话，自动解析成带**时间**和**优先级**的待办清单。
> 基于 Next.js 16 + Supabase，支持语音输入、AI 自然语言解析、账号同步与实时更新。

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
| 框架 | Next.js 16 (App Router, Turbopack) · React 19 |
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
│   ├── supabase/                 # client / server / proxy 三件套
│   └── utils.ts                  # Supabase 客户端工厂
├── sql/
│   └── init.sql                  # 建表 + RLS 策略 + Realtime 发布
├── .env.example                  # 环境变量模板（已脱敏）
├── .gitignore
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

1. 在 [vercel.com](https://vercel.com) 点击 **Add New → Project**，导入 `xy7-M/todo-list`。
2. **Framework Preset** 选 `Next.js`（自动识别）。
3. **Root Directory** 保持默认 `.`（仓库根就是 Next.js 项目）。
4. 展开 **Environment Variables**，把上表 4 个变量全部粘进去，**Production / Preview / Development 三个环境都勾上**。
5. 点击 **Deploy**。

部署完成后，Supabase 里已经跑过 `sql/init.sql` 即可直接访问。

---

## 🔒 安全说明

- 所有密钥只在 `.env.local` 中，且被 `.gitignore` 忽略，**从未进入 git 历史或 GitHub 仓库**。
- 源码通过 `process.env.*` 读取密钥，无任何硬编码。
- 带 `NEXT_PUBLIC_` 前缀的变量是设计上必须暴露给浏览器的；`DEEPSEEK_API_KEY` / `SILICONFLOW_API_KEY` 只在服务端运行，不会出现在前端 bundle。
- 数据库层通过 RLS 强制隔离：每个登录用户只能读写自己的 `todos` 行。

---

## 🪪 License

MIT © 梦逍遥 (Felix)
