import { NextResponse } from 'next/server';
import { getAllConfigsFromRedis } from '@/lib/utils/ai-config-redis';
import { decrypt } from '@/lib/utils/encryption-utils';

/**
 * 从Redis获取所有AI模型配置的API
 * 用于性能敏感场景，避免数据库查询
 */
export async function GET() {
  try {
    // 从Redis获取所有配置
    const configs = await getAllConfigsFromRedis();
    
    if (!configs || configs.length === 0) {
      return NextResponse.json(
        [],
        { status: 200 }
      );
    }
    
    // 解密所有配置的API密钥
    const configsWithDecryptedKeys = await Promise.all(
      configs.map(async (config) => ({
        ...config,
        apiKey: await decrypt(config.apiKey)
      }))
    );
    
    return NextResponse.json(configsWithDecryptedKeys);
  } catch (error) {
    console.error('从Redis获取所有配置时出错:', error);
    
    return NextResponse.json(
      { error: '获取配置失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 