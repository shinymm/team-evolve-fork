import { NextRequest, NextResponse } from 'next/server';
import { setDefaultConfigInRedis } from '@/lib/utils/ai-config-redis';
import { aiModelConfigService } from '@/lib/services/ai-model-config-service';

// 优化的API端点，实现快速响应，Redis操作在后台处理
export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    const { id } = body as { id: string };

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少配置ID' },
        { status: 400 }
      );
    }

    console.log('设置默认配置ID:', id);

    // 快速响应，不等待操作完成
    const response = NextResponse.json({
      success: true,
      message: '设置默认配置操作已触发'
    });

    // 在后台处理设置默认配置操作
    Promise.resolve().then(async () => {
      try {
        // 设置数据库中的默认配置（不获取API密钥）
        await aiModelConfigService.setDefaultConfig(id);
        
        // 设置Redis中的默认配置（只处理加密数据）
        await setDefaultConfigInRedis(id);
        
        console.log('设置默认配置完成');
      } catch (error) {
        console.error('设置默认配置失败:', error);
      }
    });

    return response;
  } catch (error) {
    console.error('设置默认配置API错误:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '设置默认配置失败' },
      { status: 500 }
    );
  }
} 