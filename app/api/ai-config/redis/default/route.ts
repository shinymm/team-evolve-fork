import { NextResponse } from 'next/server';
import { getDefaultConfigFromRedis } from '@/lib/utils/ai-config-redis';

// 确保路由是动态的
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 从Redis直接获取默认模型配置的API
 * 用于性能敏感场景，避免数据库查询
 * 此API仅在服务器端执行
 */
export async function GET() {
  try {
    // 从Redis获取默认配置
    const config = await getDefaultConfigFromRedis();
    
    if (!config) {
      return new NextResponse(
        JSON.stringify({ error: '未找到默认配置' }),
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        }
      );
    }
    
    // 直接返回配置，保持API密钥的加密状态
    return new NextResponse(
      JSON.stringify(config),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  } catch (error) {
    console.error('从Redis获取默认配置时出错:', error);
    
    return new NextResponse(
      JSON.stringify({ 
        error: '获取默认配置失败', 
        details: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  }
} 