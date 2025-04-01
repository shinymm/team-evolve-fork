import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateGlossaryEmbedding } from '@/lib/services/embedding-service'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

// 获取术语列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '15')
    const term = searchParams.get('term')
    const status = searchParams.get('status')
    const domain = searchParams.get('domain')
    const isApprovedOnly = searchParams.get('approvedOnly') === 'true'
    const format = searchParams.get('format') // 新增：用于控制返回格式

    // 构建查询条件
    const where: any = {}
    
    if (term) {
      where.term = {
        contains: term,
        mode: 'insensitive'
      }
    }
    
    if (status) {
      where.status = status
    }
    
    if (domain) {
      where.domain = {
        contains: domain,
        mode: 'insensitive'  // 添加不区分大小写的搜索
      }
    }

    // 如果请求仅获取已审核的术语
    if (isApprovedOnly) {
      where.status = 'approved'
    }

    // 如果是导出格式，不需要分页
    if (format === 'export') {
      const items = await prisma.glossary.findMany({
        where,
        orderBy: {
          updatedAt: 'desc'
        },
        select: {
          term: true,
          aliases: true,
          explanation: true
        }
      })

      // 转换为导出格式
      const formattedItems = items.map((item: { term: string; aliases: string | null; explanation: string }) => ({
        "术语名称": item.term,
        "别名": item.aliases || "",
        "解释说明": item.explanation
      }))

      return NextResponse.json(formattedItems)
    }

    // 获取总数
    const total = await prisma.glossary.count({ where })
    
    // 获取分页数据
    const items = await prisma.glossary.findMany({
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
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('获取术语列表失败:', error)
    return NextResponse.json(
      { error: '获取术语列表失败' },
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
    const { terms } = await request.json()

    if (!Array.isArray(terms) || terms.length === 0) {
      return NextResponse.json(
        { error: '无效的术语数据' },
        { status: 400 }
      )
    }

    // 使用事务处理批量导入
    const results = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const operations = terms.map(async term => {
        // 先查询现有记录
        const existing = await tx.glossary.findUnique({
          where: {
            term_domain: {
              term: term.term,
              domain: term.domain
            }
          }
        })

        // 如果存在记录，合并内容
        const mergedExplanation = existing 
          ? `${existing.explanation}\n\n新增内容：\n${term.explanation}`
          : term.explanation

        // 合并别名，处理可能为 null 的情况
        let mergedAliases: string | null = null
        if (existing?.aliases && term.aliases) {
          mergedAliases = `${existing.aliases}\n${term.aliases}`
        } else if (existing?.aliases) {
          mergedAliases = existing.aliases
        } else if (term.aliases) {
          mergedAliases = term.aliases
        }

        // 构建更新数据
        const updateData: any = {
          explanation: mergedExplanation,
          status: 'pending',
          updatedAt: new Date(),
          createdBy: term.createdBy,
          aliases: mergedAliases
        }

        // 构建创建数据
        const createData: any = {
          term: term.term,
          explanation: term.explanation,
          domain: term.domain,
          status: 'pending',
          createdBy: term.createdBy,
          aliases: term.aliases || null
        }

        return await tx.glossary.upsert({
          where: {
            term_domain: {
              term: term.term,
              domain: term.domain
            }
          },
          update: updateData,
          create: createData
        })
      })

      return await Promise.all(operations)
    })

    return NextResponse.json({
      message: `成功导入 ${results.length} 个术语`,
      results
    })
  } catch (error) {
    console.error('批量导入术语失败:', error)
    return NextResponse.json(
      { error: '批量导入术语失败' },
      { status: 500 }
    )
  }
} 