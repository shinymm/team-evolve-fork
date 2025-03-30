/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
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
    
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    })
    
    return config;
  },
  env: {
    // 确保环境变量可用
    REDIS_URL: process.env.REDIS_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  },
  experimental: {
    serverComponentsExternalPackages: ['ioredis'],
    serverActions: true,
  },
  // 添加字体加载配置
  onDemandEntries: {
    // 页面保持在内存中的时间
    maxInactiveAge: 60 * 1000,
    // 同时保持在内存中的页面数
    pagesBufferLength: 5,
  },
  // 增加资源请求的超时时间
  staticPageGenerationTimeout: 120,
  async redirects() {
    return [
      {
        source: '/page/:path*',
        destination: '/:path*',
        permanent: true,
      }
    ]
  },
}

module.exports = nextConfig 