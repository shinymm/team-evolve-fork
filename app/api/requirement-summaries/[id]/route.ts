import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// 验证模式
const RequirementSummarySchema = z.object({
  name: z.string().min(1, '需求名称不能为空'),
  summary: z.string().min(1, '需求摘要不能为空'),
  domain: z.string().min(1, '领域不能为空'),
  relatedModules: z.array(z.string()),
  createdBy: z.string(),
})

// 获取单个需求摘要
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    
    const item = await prisma.requirementSummary.findUnique({
      where: { id }
    })
    
    if (!item) {
      return NextResponse.json(
        { error: '需求摘要不存在' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(item)
  } catch (error) {
    console.error('获取需求摘要失败:', error)
    return NextResponse.json(
      { error: '获取需求摘要失败' },
      { status: 500 }
    )
  }
}

// 更新需求摘要
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const body = await request.json()
    
    // 验证请求数据
    const validatedData = RequirementSummarySchema.parse(body)
    
    // 检查记录是否存在
    const existing = await prisma.requirementSummary.findUnique({
      where: { id }
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: '需求摘要不存在' },
        { status: 404 }
      )
    }
    
    // 更新数据
    const result = await prisma.requirementSummary.update({
      where: { id },
      data: {
        name: validatedData.name,
        summary: validatedData.summary,
        domain: validatedData.domain,
        relatedModules: validatedData.relatedModules,
        // 如果更新内容，清空向量
        embedding: [], // 清空向量，需要重新生成
      }
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('更新需求摘要失败:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '数据验证失败', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '更新需求摘要失败' },
      { status: 500 }
    )
  }
}

// 删除需求摘要
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    
    // 检查记录是否存在
    const existing = await prisma.requirementSummary.findUnique({
      where: { id }
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: '需求摘要不存在' },
        { status: 404 }
      )
    }
    
    // 删除数据
    await prisma.requirementSummary.delete({
      where: { id }
    })
    
    return NextResponse.json({ message: '删除成功' })
  } catch (error) {
    console.error('删除需求摘要失败:', error)
    return NextResponse.json(
      { error: '删除需求摘要失败' },
      { status: 500 }
    )
  }
} 