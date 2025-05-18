import Redis from 'ioredis';

// 确保只在服务器端运行
const isServer = typeof window === 'undefined';
const REDIS_CONNECTION_POOL_SIZE = 5; // 连接池大小

// 全局变量，确保只创建一次Redis客户端实例
let redisPool: Redis[] = [];

/**
 * 获取Redis客户端实例
 * 此函数已优化，使用连接池和更快的超时设置
 */
export function getRedisClient(): Redis {
  // 非服务器环境返回虚拟客户端
  if (!isServer) {
    return getVirtualRedisClient();
  }

  // 连接池中有可用连接，返回第一个
  if (redisPool.length > 0) {
    // 轮转策略，将使用的连接移到队列末尾
    const client = redisPool.shift()!;
    redisPool.push(client);
    return client;
  }

  // 初始化连接池
  initializeRedisPool();
  return redisPool[0];
}

/**
 * 初始化Redis连接池
 */
function initializeRedisPool() {
  if (redisPool.length > 0) return;

  // 从环境变量获取Redis连接URL
  const redisUrl = process.env.REDIS_URL;
  
  // 调试输出（保护密码安全）
  if (redisUrl) {
    console.log('Redis URL已配置:', redisUrl.replace(/\/\/(.+?):.+?@/, '//***:***@'));
  } else {
    console.warn('未找到REDIS_URL环境变量');
  }

  if (!redisUrl) {
    console.error('REDIS_URL环境变量未定义，无法连接到Redis');
    // 创建虚拟客户端避免应用崩溃
    redisPool.push(getVirtualRedisClient());
    return;
  }

  try {
    // 创建连接池
    for (let i = 0; i < REDIS_CONNECTION_POOL_SIZE; i++) {
      const redis = new Redis(redisUrl, {
        // 性能优化设置
        connectTimeout: 5000, // 减少连接超时时间为5秒
        maxRetriesPerRequest: 3, // 最多重试3次
        retryStrategy: (times) => {
          // 更激进的重试策略
          return Math.min(times * 100, 1000); // 100ms, 200ms, 300ms...但最多1秒
        },
        // 启用自动流水线功能
        enableAutoPipelining: true,
        // 启用离线队列
        enableOfflineQueue: true,
        // 设置更高的命令超时
        commandTimeout: 3000,
      });

      // 错误处理
      redis.on('error', (err) => {
        console.error('Redis连接错误:', err);
      });

      // 准备好时的处理
      redis.on('ready', () => {
        console.log('Redis连接已就绪 - 已连接到', redisUrl.replace(/\/\/(.+?):.+?@/, '//***:***@'));
      });

      redisPool.push(redis);
    }
  } catch (error) {
    console.error('初始化Redis连接池失败:', error);
    // 创建虚拟客户端避免应用崩溃
    redisPool.push(getVirtualRedisClient());
  }
}

/**
 * 获取虚拟Redis客户端（用于客户端环境或连接失败情况）
 */
function getVirtualRedisClient(): Redis {
  // 创建一个代理对象模拟Redis客户端
  const virtualRedis = {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
    keys: async () => [],
    mget: async () => [],
    pipeline: () => ({
      get: () => virtualRedis,
      set: () => virtualRedis,
      del: () => virtualRedis,
      exec: async () => [],
    }),
  } as unknown as Redis;

  return virtualRedis;
}

/**
 * 关闭所有Redis连接
 */
export async function closeRedisConnections(): Promise<void> {
  if (!isServer || redisPool.length === 0) return;

  // 断开所有连接
  const disconnectPromises = redisPool.map(client => client.quit());
  await Promise.all(disconnectPromises);
  redisPool = [];
}

// 简单的包装函数，用于在应用中设置键值
export const setRedisValue = async (key: string, value: string, expiryInSeconds?: number) => {
  if (!isServer) {
    console.warn('Redis操作仅支持在服务器端执行');
    return null;
  }
  
  const client = getRedisClient();
  
  if (expiryInSeconds) {
    return client.set(key, value, 'EX', expiryInSeconds);
  }
  
  return client.set(key, value);
};

// 获取键值的包装函数
export const getRedisValue = async (key: string) => {
  if (!isServer) {
    console.warn('Redis操作仅支持在服务器端执行');
    return null;
  }
  
  const client = getRedisClient();
  return client.get(key);
};

/**
 * 缓存键前缀常量，避免不同功能键名冲突
 */
export const CACHE_KEYS = {
  // 图片存储相关缓存前缀
  IMAGE_LIST: 'img:list:', // 图片列表缓存前缀

  // AI配置相关缓存前缀（复用ai-config-redis.ts中的前缀）
  AI_CONFIG: 'ai:config:',
  
  // 其他缓存前缀可以在这里添加...
};

/**
 * 缓存过期时间常量（秒）
 */
export const CACHE_EXPIRE = {
  ONE_MINUTE: 60,
  FIVE_MINUTES: 60 * 5,
  TEN_MINUTES: 60 * 10,
  THIRTY_MINUTES: 60 * 30,
  ONE_HOUR: 60 * 60,
  THREE_HOURS: 60 * 60 * 3,
  SIX_HOURS: 60 * 60 * 6,
  TWELVE_HOURS: 60 * 60 * 12,
  ONE_DAY: 60 * 60 * 24,
  THREE_DAYS: 60 * 60 * 24 * 3,
  ONE_WEEK: 60 * 60 * 24 * 7,
};

/**
 * 设置JSON对象缓存
 * @param key 缓存键
 * @param value 缓存值（会被JSON序列化）
 * @param expiryInSeconds 过期时间(秒)
 */
export const setJsonCache = async <T>(key: string, value: T, expiryInSeconds = CACHE_EXPIRE.ONE_HOUR): Promise<string | null> => {
  if (!isServer) {
    console.warn('Redis操作仅支持在服务器端执行');
    return null;
  }
  
  try {
    const jsonValue = JSON.stringify(value);
    return setRedisValue(key, jsonValue, expiryInSeconds);
  } catch (error) {
    console.error(`序列化对象到Redis失败 (键: ${key}):`, error);
    return null;
  }
};

/**
 * 获取并解析JSON对象缓存
 * @param key 缓存键
 * @returns 解析后的对象或null
 */
export const getJsonCache = async <T>(key: string): Promise<T | null> => {
  if (!isServer) {
    console.warn('Redis操作仅支持在服务器端执行');
    return null;
  }
  
  try {
    const value = await getRedisValue(key);
    if (!value) return null;
    
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`从Redis解析JSON失败 (键: ${key}):`, error);
    return null;
  }
};

/**
 * 删除缓存
 * @param key 缓存键
 */
export const deleteCache = async (key: string): Promise<number> => {
  if (!isServer) {
    console.warn('Redis操作仅支持在服务器端执行');
    return 0;
  }
  
  const client = getRedisClient();
  return client.del(key);
}; 