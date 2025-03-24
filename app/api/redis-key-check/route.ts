import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    // 获取Redis客户端
    const redis = getRedisClient();
    
    // 测试连接是否正常
    try {
      const pingResult = await redis.ping();
      console.log('Redis连接测试:', pingResult);
    } catch (pingError) {
      return NextResponse.json({
        success: false,
        message: '无法连接到Redis',
        error: pingError instanceof Error ? pingError.message : String(pingError)
      }, { status: 500 });
    }
    
    // 获取所有AI配置相关的键
    const aiConfigKeys = await redis.keys('ai:config:*');
    
    // 获取默认配置键的值
    let defaultConfigId = null;
    if (aiConfigKeys.includes('ai:config:default')) {
      defaultConfigId = await redis.get('ai:config:default');
    }
    
    // 读取默认配置（如果存在）
    let defaultConfig = null;
    if (defaultConfigId) {
      const defaultConfigKey = `ai:config:${defaultConfigId}`;
      const configJson = await redis.get(defaultConfigKey);
      if (configJson) {
        try {
          defaultConfig = JSON.parse(configJson);
          // 出于安全考虑，隐藏API密钥
          if (defaultConfig && defaultConfig.apiKey) {
            defaultConfig.apiKey = '******';
          }
        } catch (parseError) {
          console.error('解析默认配置失败:', parseError);
        }
      }
    }
    
    // 返回结果
    return NextResponse.json({
      success: true,
      message: '已读取Redis键信息',
      data: {
        totalKeys: aiConfigKeys.length,
        keys: aiConfigKeys,
        defaultConfigId,
        defaultConfig,
        environment: {
          REDIS_URL: process.env.REDIS_URL ? '已设置' : '未设置',
          NODE_ENV: process.env.NODE_ENV
        }
      }
    });
  } catch (error) {
    console.error('Redis键检查失败:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Redis键检查失败',
      error: error instanceof Error ? error.message : String(error),
      environment: {
        REDIS_URL: process.env.REDIS_URL ? '已设置' : '未设置',
        NODE_ENV: process.env.NODE_ENV
      }
    }, { status: 500 });
  }
} 