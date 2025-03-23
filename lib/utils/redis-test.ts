import { getRedisClient, setRedisValue, getRedisValue, closeRedisConnections } from '../redis';

/**
 * 测试Redis连接和基本操作的函数
 */
export async function testRedisConnection() {
  try {
    // 获取Redis客户端
    const redis = getRedisClient();
    console.log('Redis客户端实例已创建');
    
    // 测试设置值
    const testKey = 'test:connection';
    const testValue = 'Redis连接测试 - ' + new Date().toISOString();
    
    await setRedisValue(testKey, testValue);
    console.log(`成功设置键 "${testKey}" 的值`);
    
    // 测试获取值
    const retrievedValue = await getRedisValue(testKey);
    console.log(`成功获取键 "${testKey}" 的值: "${retrievedValue}"`);
    
    // 验证值是否匹配
    if (retrievedValue === testValue) {
      console.log('测试成功: 设置和获取的值匹配');
    } else {
      console.error('测试失败: 设置和获取的值不匹配');
    }
    
    // 测试超时设置
    const expiryKey = 'test:expiry';
    await setRedisValue(expiryKey, '这个值将在3秒后过期', 3);
    console.log(`成功设置带过期时间的键 "${expiryKey}"`);
    
    // 清理测试键
    await redis.del(testKey);
    console.log(`已删除测试键 "${testKey}"`);
    
    return true;
  } catch (error) {
    console.error('Redis测试失败:', error);
    return false;
  } finally {
    // 测试完成后不关闭连接，因为在应用中我们会保持连接
    // await closeRedisConnections();
  }
}

// 允许直接运行此文件进行测试
if (require.main === module) {
  testRedisConnection()
    .then(success => {
      console.log(`Redis测试${success ? '成功' : '失败'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(err => {
      console.error('Redis测试遇到错误:', err);
      process.exit(1);
    });
} 