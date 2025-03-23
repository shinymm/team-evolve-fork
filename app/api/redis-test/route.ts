import { NextResponse } from 'next/server';
import { getRedisClient, setRedisValue, getRedisValue } from '@/lib/redis';

export async function GET() {
  try {
    // 检查Redis连接
    const redis = getRedisClient();
    
    // 设置一个测试值
    const testKey = 'api:test:' + Date.now();
    const testValue = '通过API访问Redis测试 - ' + new Date().toISOString();
    
    await setRedisValue(testKey, testValue);
    
    // 读取测试值
    const retrievedValue = await getRedisValue(testKey);
    
    // 清理测试键
    await redis.del(testKey);
    
    // 返回结果
    return NextResponse.json({
      success: true,
      message: 'Redis连接测试成功',
      data: {
        key: testKey,
        originalValue: testValue,
        retrievedValue: retrievedValue,
        match: testValue === retrievedValue
      }
    });
  } catch (error) {
    console.error('Redis API测试失败:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Redis连接测试失败',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 