import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { aiModelConfigService } from '@/lib/services/ai-model-config-service'

const prisma = new PrismaClient()

export async function GET() {
  try {
    // 获取配置，API密钥保持加密状态
    const configs = await aiModelConfigService.getAllConfigs()
    // 返回正确的JSON格式
    return NextResponse.json(configs)
  } catch (error) {
    console.error('获取AI配置失败:', error)
    return NextResponse.json({ error: '获取AI配置失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // 解析请求体
    const body = await request.json()
    
    // 记录请求体，便于调试
    console.log('收到添加AI配置请求:', JSON.stringify(body))
    
    // 验证必填字段
    if (!body.name || !body.model || !body.baseURL || !body.apiKey) {
      console.error('请求缺少必要字段:', body)
      return NextResponse.json({ 
        success: false, 
        error: '请求缺少必要字段' 
      }, { status: 400 })
    }
    
    // 使用服务添加配置
    const newConfig = await aiModelConfigService.addConfig(body)
    
    // 返回正确格式的响应，包含config属性
    return NextResponse.json({ 
      success: true, 
      config: newConfig 
    })
  } catch (error) {
    // 详细记录错误
    console.error('添加AI配置失败:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '添加AI配置失败' 
    }, { status: 500 })
  }
}

// PUT方法转移到[id]/route.ts文件中处理

// DELETE方法转移到[id]/route.ts文件中处理
// 此处的DELETE方法已废弃，请使用[id]/route.ts中的DELETE方法

// 设置默认配置的专用接口转移到[id]/default/route.ts文件中处理
// 此处的PATCH方法已废弃，请使用[id]/default/route.ts中的PATCH方法 