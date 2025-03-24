import { NextRequest, NextResponse } from 'next/server';
import { saveAllConfigsToRedis } from '@/lib/utils/ai-config-redis';
import { aiModelConfigService } from '@/lib/services/ai-model-config-service';

/**
 * 将所有配置同步到Redis的API端点
 * 修改为同步操作，等待Redis同步完成后再返回响应
 */
export async function POST() {
  try {
    // 检查环境变量
    if (!process.env.REDIS_URL) {
      console.warn('REDIS_URL环境变量未定义，Redis同步将被跳过');
      return NextResponse.json({
        success: true,
        message: 'Redis同步已跳过（未配置REDIS_URL）',
      });
    }

    // 获取所有配置（保留加密的API密钥）
    const configs = await aiModelConfigService.getAllConfigs();
    
    // 直接等待Redis操作完成，确保在serverless环境中不会被中断
    try {
      console.log('开始Redis同步，配置数量:', configs.length);
      await saveAllConfigsToRedis(configs);
      console.log('Redis同步完成');
    } catch (syncError) {
      console.error('Redis同步失败:', syncError);
      throw syncError; // 将错误抛出到外层catch处理
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '已成功将配置同步到Redis' 
    });
  } catch (error) {
    console.error('同步Redis失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '同步Redis失败' 
    }, { status: 500 });
  }
} 