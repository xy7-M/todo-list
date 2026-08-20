import type { NextConfig } from "next";

// EdgeOne Pages 部署：云函数运行时不自动注入环境变量，
// 通过 next.config 的 env 字段在 build 时从 .env.local（不入库）
// 读取并内联进 server bundle，密钥不硬编码在源码里。
const nextConfig: NextConfig = {
  cacheComponents: true,
  env: {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ?? "",
    SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY ?? "",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  },
};

export default nextConfig;
