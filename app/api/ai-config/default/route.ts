import { NextResponse } from 'next/server'
import { aiModelConfigService } from '@/lib/services/ai-model-config-service'

export async function GET(request: Request) {
  try {
    console.log(`开始获取默认配置`)
    
    const config = await aiModelConfigService.getDefaultConfig()

    if (!config) {
      console.log('未找到默认配置')
      return NextResponse.json({ config: null })
    }

    return NextResponse.json({ config })
  } catch (error) {
    console.error('获取默认AI配置失败:', error)
    return NextResponse.json({ error: '获取默认AI配置失败' }, { status: 500 })
  }
} 