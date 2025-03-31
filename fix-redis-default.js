const Redis = require('ioredis');

async function fixRedisDefaultConfig() {
  const redis = new Redis(process.env.REDIS_URL);
  
  try {
    // 1. 获取当前的默认配置数据
    const defaultConfigJson = await redis.get('ai:config:default');
    if (!defaultConfigJson) {
      console.log('没有找到默认配置数据');
      return;
    }
    
    // 2. 解析默认配置
    const defaultConfig = JSON.parse(defaultConfigJson);
    const configId = defaultConfig.id;
    
    // 3. 保存配置到正确的键
    await redis.set(`ai:config:${configId}`, defaultConfigJson);
    
    // 4. 更新默认配置键，只存储ID
    await redis.set('ai:config:default', configId);
    
    console.log('修复完成：');
    console.log('- 配置已保存到:', `ai:config:${configId}`);
    console.log('- 默认配置ID已更新');
    
  } catch (error) {
    console.error('修复过程出错:', error);
  } finally {
    // 关闭Redis连接
    redis.quit();
  }
}

// 运行修复脚本
fixRedisDefaultConfig(); 