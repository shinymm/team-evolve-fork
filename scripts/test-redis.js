// 脚本用于测试Redis连接
require('dotenv').config();
const Redis = require('ioredis');

async function testRedisConnection() {
  console.log('测试Redis连接...');
  
  // 检查环境变量
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('错误: REDIS_URL环境变量未定义');
    process.exit(1);
  }
  
  console.log(`尝试连接到Redis: ${redisUrl.replace(/\/\/(.+?):.+?@/, '//***:***@')}`);
  
  const redis = new Redis(redisUrl, {
    connectTimeout: 5000,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 1000),
  });
  
  redis.on('error', (err) => {
    console.error('Redis连接错误:', err);
    process.exit(1);
  });
  
  redis.on('ready', async () => {
    console.log('Redis连接成功!');
    
    try {
      // 尝试设置和获取一个值
      const testKey = 'test:connection:' + Date.now();
      const testValue = 'Redis连接测试: ' + new Date().toISOString();
      
      await redis.set(testKey, testValue);
      console.log(`设置测试键 "${testKey}" 成功`);
      
      const retrievedValue = await redis.get(testKey);
      console.log(`获取测试键值: "${retrievedValue}"`);
      
      if (retrievedValue === testValue) {
        console.log('测试成功: 读写操作正常');
      } else {
        console.error('测试失败: 获取的值与设置的值不匹配');
      }
      
      // 清理测试键
      await redis.del(testKey);
      console.log('已清理测试键');
      
      // 关闭连接
      await redis.quit();
      console.log('已关闭Redis连接');
      process.exit(0);
    } catch (error) {
      console.error('Redis操作发生错误:', error);
      process.exit(1);
    }
  });
}

testRedisConnection(); 