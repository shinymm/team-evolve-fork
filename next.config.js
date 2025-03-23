/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 不在客户端导入服务器端模块
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
      };
      
      // 忽略ioredis
      config.externals.push({
        'ioredis': 'ioredis'
      });
    }
    
    return config;
  },
  env: {
    // 确保环境变量可用
    REDIS_URL: process.env.REDIS_URL,
  },
  experimental: {
    serverComponentsExternalPackages: ['ioredis'],
  },
}

module.exports = nextConfig 