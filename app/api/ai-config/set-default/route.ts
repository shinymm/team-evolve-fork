import { NextRequest, NextResponse } from 'next/server';
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

    // 设置数据库中的默认配置
    const updatedConfig = await aiModelConfigService.setDefaultConfig(id);
    
    return NextResponse.json({
      success: true,
      config: updatedConfig
    });
  } catch (error) {
    console.error('设置默认配置API错误:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '设置默认配置失败' },
      { status: 500 }
    );
  }
} 