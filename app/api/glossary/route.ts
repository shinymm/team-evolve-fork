import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateGlossaryEmbedding } from '@/lib/services/embedding-service'
import { z } from 'zod'

// 获取术语列表
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const domain = searchParams.get('domain')
  const status = searchParams.get('status')
  const term = searchParams.get('term')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  try {
    // 构建查询条件
    const where: any = {}
    
    if (domain) {
      where.domain = domain
    }
    
    if (status) {
      where.status = status
    }
    
    if (term) {
      where.term = {
        contains: term,
        mode: 'insensitive'
      }
    }
    
    // 获取总记录数
    const total = await prisma.glossary.count({ where })
    
    // 获取分页数据
    const items = await prisma.glossary.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    })
    
    return NextResponse.json({
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('获取术语失败:', error)
    return NextResponse.json(
      { error: '获取术语失败' },
      { status: 500 }
    )
  }
}

// 添加新术语
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // 定义请求格式验证
    const schema = z.object({
      term: z.string().min(1, "术语名称不能为空"),
      aliases: z.string().optional(),
      explanation: z.string().min(1, "术语解释不能为空"),
      domain: z.string().optional(),
      status: z.enum(["pending", "approved"]).default("pending"),
      createdBy: z.string().optional(),
    })
    
    // 验证请求体
    const { term, aliases, explanation, domain, status, createdBy } = schema.parse(body)
    
    // 检查是否已存在相同术语
    const existing = await prisma.glossary.findFirst({
      where: { term: { equals: term, mode: 'insensitive' } }
    })
    
    if (existing) {
      return NextResponse.json(
        { error: `术语 "${term}" 已存在` },
        { status: 400 }
      )
    }
    
    // 创建术语记录
    const glossary = await prisma.glossary.create({
      data: {
        term,
        aliases: aliases || "",
        explanation,
        domain: domain || "qare",
        status,
        createdBy: createdBy || null,
      },
    })
    
    return NextResponse.json({
      id: glossary.id,
      term: glossary.term,
      message: `术语 "${term}" 已成功添加`
    })
  } catch (error) {
    console.error('术语添加失败:', error)
    return NextResponse.json(
      { error: '术语添加失败' },
      { status: 500 }
    )
  }
}

// 批量导入术语
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    
    // 验证请求体
    const schema = z.object({
      terms: z.array(z.object({
        term: z.string().min(1, "术语名称不能为空"),
        aliases: z.string().optional(),
        explanation: z.string().min(1, "术语解释不能为空"),
        domain: z.string().optional(),
        createdBy: z.string().optional(),
      }))
    })
    
    const { terms } = schema.parse(body)
    
    // 批量创建术语
    const results = await prisma.$transaction(
      terms.map(term => 
        prisma.glossary.create({
          data: {
            term: term.term,
            aliases: term.aliases || "",
            explanation: term.explanation,
            domain: term.domain || "qare",
            status: "pending",
            createdBy: term.createdBy || "43170448",
          }
        })
      )
    )
    
    return NextResponse.json({
      message: `成功导入 ${results.length} 个术语`,
      terms: results
    })
  } catch (error) {
    console.error('批量导入术语失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量导入失败' },
      { status: 500 }
    )
  }
} 