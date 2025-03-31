import Redis from 'ioredis';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error('REDIS_URL 环境变量未设置');
}

async function fixRedisConfig() {
  const redis = new Redis(REDIS_URL);
  
  try {
    console.log('开始修复 Redis 配置...');
    
    // 1. 获取当前的默认配置
    const defaultConfigJson = await redis.get('ai:config:default');
    if (!defaultConfigJson) {
      console.log('未找到默认配置，无需修复');
      return;
    }
    
    // 2. 尝试解析默认配置
    try {
      const defaultConfig = JSON.parse(defaultConfigJson);
      const configId = defaultConfig.id;
      
      console.log('找到默认配置:', {
        id: configId,
        name: defaultConfig.name
      });
      
      // 3. 保存配置到正确的键
      await redis.set(`ai:config:${configId}`, defaultConfigJson);
      console.log(`已保存配置到: ai:config:${configId}`);
      
      // 4. 更新默认配置键，只存储ID
      await redis.set('ai:config:default', configId);
      console.log('已更新默认配置键为ID');
      
      console.log('修复完成！');
      
    } catch (parseError) {
      console.log('默认配置已经是正确的格式（仅ID），无需修复');
    }
    
  } catch (error) {
    console.error('修复过程出错:', error);
  } finally {
    // 关闭 Redis 连接
    redis.quit();
  }
}

// 运行修复脚本
fixRedisConfig(); 