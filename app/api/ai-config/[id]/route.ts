import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { aiModelConfigService } from '@/lib/services/ai-model-config-service'

const prisma = new PrismaClient()

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    
    console.log(`获取配置 ID: ${id}`)
    
    const config = await aiModelConfigService.getConfigById(id)

    if (!config) {
      return NextResponse.json({ success: false, error: '未找到配置' }, { status: 404 })
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('获取AI配置失败:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取AI配置失败' 
    }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const body = await request.json()
    
    console.log(`更新配置 ID: ${id}, 内容:`, JSON.stringify(body))
    
    const updatedConfig = await aiModelConfigService.updateConfig(id, body)
    
    return NextResponse.json({ 
      success: true, 
      config: updatedConfig 
    })
  } catch (error) {
    console.error('更新AI配置失败:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '更新AI配置失败' 
    }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    
    await aiModelConfigService.deleteConfig(id)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除AI配置失败:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '删除AI配置失败' 
    }, { status: 500 })
  }
} 