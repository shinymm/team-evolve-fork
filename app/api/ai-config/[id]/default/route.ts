import { NextResponse } from 'next/server'
import { aiModelConfigService } from '@/lib/services/ai-model-config-service'
import { setDefaultConfigInRedis } from '@/lib/utils/ai-config-redis'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    
    // 记录操作
    console.log(`设置默认配置 ID: ${id}`)
    
    // 使用服务设置默认配置
    const updatedConfig = await aiModelConfigService.setDefaultConfig(id)
    
    // 尝试同步到Redis
    try {
      await setDefaultConfigInRedis(id)
    } catch (redisError) {
      console.error('更新Redis默认配置失败:', redisError)
      // 继续处理，不影响主流程
    }
    
    // 返回正确格式的JSON
    return NextResponse.json({ 
      success: true, 
      config: updatedConfig 
    })
  } catch (error) {
    console.error('设置默认配置失败:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '设置默认配置失败' 
    }, { status: 500 })
  }
} 