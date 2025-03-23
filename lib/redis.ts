import Redis from 'ioredis';

// 环境变量中获取Redis连接URL
const redisUrl = process.env.REDIS_URL;

// 全局变量保存Redis客户端实例
let redis: Redis | null = null;

// 获取Redis客户端的函数，实现单例模式
export const getRedisClient = () => {
  if (!redis) {
    if (!redisUrl) {
      throw new Error('REDIS_URL is not defined in the environment variables');
    }
    
    redis = new Redis(redisUrl, {
      // 连接超时设置（毫秒）
      connectTimeout: 10000,
      // 启用重试策略
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      // 最大重试次数
      maxRetriesPerRequest: 5,
    });

    // 错误处理
    redis.on('error', (error) => {
      console.error('Redis连接错误:', error);
    });

    // 连接成功事件
    redis.on('connect', () => {
      console.log('Redis连接成功');
    });
  }

  return redis;
};

// 关闭Redis连接的函数
export const closeRedisConnection = async () => {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('Redis连接已关闭');
  }
};

// 简单的包装函数，用于在应用中设置键值
export const setRedisValue = async (key: string, value: string, expiryInSeconds?: number) => {
  const client = getRedisClient();
  
  if (expiryInSeconds) {
    return client.set(key, value, 'EX', expiryInSeconds);
  }
  
  return client.set(key, value);
};

// 获取键值的包装函数
export const getRedisValue = async (key: string) => {
  const client = getRedisClient();
  return client.get(key);
}; 