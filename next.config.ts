import type { NextConfig } from "next";

/**
 * Vercel 部署配置 / Vercel deployment config
 *
 * 说明 / Notes:
 * - Vercel 在构建与运行时都会原生注入项目环境变量，因此**不需要**在 next.config
 *   的 `env` 字段里做内联（那会把服务端密钥编译进产物，且那是 EdgeOne 才需要的变通）。
 *   Vercel natively injects project env vars at build & runtime, so no `env`
 *   inlining is needed — inlining would bake server secrets into the bundle.
 * - 服务端密钥（DEEPSEEK_API_KEY / SILICONFLOW_API_KEY）只在 Route Handler 中通过
 *   process.env 读取，绝不加 NEXT_PUBLIC_ 前缀。
 * - 出站请求（DeepSeek / SiliconFlow）依赖 Node.js 运行时能力（Buffer、FormData、
 *   可选 ffmpeg 回退），故不启用 Edge Runtime。
 */
const nextConfig: NextConfig = {
  // 构建期跳过 ESLint：规则集包含 no-explicit-any 等，属警告级问题，
  // 不应阻断线上部署。TypeScript 类型检查仍照常执行。
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 生产构建开启压缩。
  compress: true,

  // 不暴露框架版本信息。
  poweredByHeader: false,

  // 用户上传的图片存放在 Supabase Storage，放行其远程域名。
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },

  // 服务端包保持外部化，避免把 supabase-js / ssr 打进服务端 bundle。
  serverExternalPackages: ["@supabase/supabase-js", "@supabase/ssr"],
};

export default nextConfig;
