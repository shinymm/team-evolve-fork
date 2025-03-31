import { NextResponse } from 'next/server'
import { aiModelConfigService } from '@/lib/services/ai-model-config-service'

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