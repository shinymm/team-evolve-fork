import { NextResponse } from 'next/server';
import { getAllConfigsFromRedis, clearRedisConfigs } from '@/lib/utils/ai-config-redis';

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
    
    // 直接返回配置，保持API密钥的加密状态
    return NextResponse.json(configs);
  } catch (error) {
    console.error('从Redis获取所有配置时出错:', error);
    
    return NextResponse.json(
      { error: '获取配置失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * 清除Redis中的所有AI模型配置
 */
export async function DELETE() {
  try {
    await clearRedisConfigs();
    return NextResponse.json({ message: 'Redis配置已清空' });
  } catch (error) {
    console.error('清除Redis配置时出错:', error);
    return NextResponse.json(
      { error: '清除配置失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 