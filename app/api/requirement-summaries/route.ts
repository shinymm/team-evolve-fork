import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

// 验证模式
const RequirementSummarySchema = z.object({
  name: z.string().min(1, '需求名称不能为空'),
  summary: z.string().min(1, '需求摘要不能为空'),
  domain: z.string().min(1, '领域不能为空'),
  relatedModules: z.array(z.string()),
  createdBy: z.string(),
})

// 查询参数验证
const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  term: z.string().optional(),
  domain: z.string().optional(),
  vectorized: z.enum(['true', 'false']).optional(),
})

// 获取需求摘要列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '15')
    const term = searchParams.get('term')
    const domain = searchParams.get('domain')
    const vectorized = searchParams.get('vectorized')
    
    // 构建查询条件
    const where: any = {}
    
    if (term) {
      where.OR = [
        {
          name: {
            contains: term,
            mode: 'insensitive'
          }
        },
        {
          summary: {
            contains: term,
            mode: 'insensitive'
          }
        }
      ]
    }
    
    if (domain) {
      where.domain = {
        contains: domain,
        mode: 'insensitive'  // 添加不区分大小写的搜索
      }
    }
    
    if (vectorized === 'true') {
      where.embedding = {
        not: null
      }
    } else if (vectorized === 'false') {
      where.embedding = null
    }
    
    // 获取总数
    const total = await prisma.requirementSummary.count({ where })
    
    // 获取分页数据
    const items = await prisma.requirementSummary.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    return NextResponse.json({
      items,
      pagination: {
        total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('获取需求摘要列表失败:', error)
    return NextResponse.json(
      { error: '获取需求摘要列表失败' },
      { status: 500 }
    )
  }
}

// 创建需求摘要
export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('收到创建需求摘要请求:', body)
    
    // 验证请求数据
    const validatedData = RequirementSummarySchema.parse(body)
    console.log('数据验证通过:', validatedData)
    
    // 创建数据
    const result = await prisma.requirementSummary.create({
      data: {
        name: validatedData.name,
        summary: validatedData.summary,
        domain: validatedData.domain,
        relatedModules: validatedData.relatedModules,
        createdBy: validatedData.createdBy,
        embedding: [], // 添加默认的空向量
      }
    })
    
    console.log('需求摘要创建成功:', result)
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('创建需求摘要失败:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: '数据验证失败', 
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }
    
    // 检查是否是 Prisma 错误
    if (error instanceof PrismaClientKnownRequestError) {
      return NextResponse.json(
        { 
          error: '数据库错误', 
          code: error.code,
          details: error.message 
        },
        { status: 500 }
      )
    }
    
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json(
      { error: '创建需求摘要失败', details: errorMessage },
      { status: 500 }
    )
  }
} 