export const dynamic = 'force-dynamic'; // Force dynamic rendering for this route

import { NextResponse } from 'next/server'
import { aiModelConfigService } from '@/lib/services/ai-model-config-service'

export async function GET(request: Request) {
  try {
    // 获取请求中的类型参数
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    
    let config = null
    
    // 根据类型参数选择不同的获取方法
    if (type === 'vision') {
      console.log('开始获取默认视觉模型配置')
      config = await aiModelConfigService.getDefaultVisionConfig()
    } else {
      // 默认获取语言模型配置
      console.log('开始获取默认语言模型配置')
      config = await aiModelConfigService.getDefaultConfig()
    }

    if (!config) {
      console.log(`未找到${type === 'vision' ? '视觉' : '语言'}模型的默认配置`)
      return NextResponse.json({ config: null })
    }

    return NextResponse.json({ config })
  } catch (error) {
    console.error('获取默认AI配置失败:', error)
    return NextResponse.json({ error: '获取默认AI配置失败' }, { status: 500 })
  }
} 