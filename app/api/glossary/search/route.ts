import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getEmbedding } from '@/lib/services/embedding-service'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

// 定义通用术语类型
type GlossaryItem = {
  id: number;
  term: string;
  aliases: string | null;
  explanation: string;
  domain: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdBy: string | null;
}

// 定义扩展的术语类型（包含相似度等额外信息）
type GlossaryItemWithSimilarity = GlossaryItem & {
  matchType: string;
  similarity: number;
  _distance?: number;
  embedding?: number[];
}

// 定义导出格式类型
type ExportFormat = {
  术语名称: string;
  别名: string;
  解释说明: string;
}

// 语义搜索API
// 注意：这需要集成OpenAI等向量嵌入服务来实现完整功能
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // 验证请求体
    const schema = z.object({
      query: z.string().min(1, "搜索查询不能为空"),
      domains: z.array(z.string()).optional(),
      status: z.enum(["pending", "approved", "all"]).optional(),
      type: z.enum(["exact", "vector", "all"]).default("all"),
      page: z.number().int().positive().optional(),
      limit: z.number().int().positive().optional(),
      minSimilarity: z.number().min(0).max(1).optional(),
      vectorConfig: z.object({
        baseURL: z.string(),
        model: z.string(),
        apiKey: z.string(),
        name: z.string().optional(),
        id: z.string().optional(),
        isDefault: z.boolean().optional()
      }).optional()
    })
    
    const { 
      query, 
      domains, 
      status, 
      type = 'all',
      page = 1, 
      limit = 20,
      minSimilarity = 0.7
    } = schema.parse(body)
    
    // 默认使用精确匹配和向量搜索
    const useExactMatch = type === 'exact' || type === 'all'
    const useVectorSearch = type === 'vector' || type === 'all'
    
    // 构建基本过滤条件
    const baseWhere: any = {}
    
    // 添加状态过滤
    if (status && status !== 'all') {
      baseWhere.status = status
    }
    
    // 添加领域过滤
    if (domains && domains.length > 0 && !domains.includes('all')) {
      baseWhere.domain = { in: domains }
    }
    
    // 结果合并与排序
    let allResults: GlossaryItemWithSimilarity[] = []
    
    // 1. 精确匹配搜索
    if (useExactMatch) {
      console.log(`[${new Date().toISOString()}] 执行精确匹配搜索，查询词: "${query}"`)
      const exactResults = await prisma.glossary.findMany({
        where: {
          ...baseWhere,
          OR: [
            { term: { contains: query, mode: 'insensitive' } },
            { aliases: { contains: query, mode: 'insensitive' } },
            { explanation: { contains: query, mode: 'insensitive' } }
          ]
        }
      })
      
      console.log(`[${new Date().toISOString()}] 精确匹配搜索完成，找到 ${exactResults.length} 条结果`)
      
      // 添加相似度信息
      const exactResultsWithSimilarity = exactResults.map((item: GlossaryItem) => ({
        ...item,
        matchType: 'exact',
        similarity: 1.0, // 精确匹配给满分
        aliases: item.aliases || null // 确保类型一致
      }))
      
      allResults = [...exactResultsWithSimilarity]
    }
    
    // 2. 向量语义搜索
    if (useVectorSearch) {
      try {
        console.log(`[${new Date().toISOString()}] 开始向量语义搜索，查询词: "${query}"`)
        
        // 从请求体中获取向量配置
        const vectorConfig = body.vectorConfig
        
        if (!vectorConfig) {
          console.log(`[${new Date().toISOString()}] 请求中未提供向量配置，跳过向量搜索`)
          return
        }
        
        if (!vectorConfig.baseURL || !vectorConfig.apiKey || !vectorConfig.model) {
          console.log(`[${new Date().toISOString()}] 向量配置不完整，跳过向量搜索`)
          return
        }
        
        // 生成查询向量
        console.log(`[${new Date().toISOString()}] 使用配置生成查询向量:`, {
          baseURL: vectorConfig.baseURL,
          model: vectorConfig.model,
          apiKey: '***'
        })
        const queryEmbedding = await getEmbedding(query, vectorConfig)
        console.log(`[${new Date().toISOString()}] 成功生成查询向量`)
        
        // 执行向量搜索
        console.log(`[${new Date().toISOString()}] 执行向量相似度搜索`)
        
        const vectorResults = await prisma.$queryRaw`
          WITH vector_query AS (
            SELECT array[${queryEmbedding.join(',')}]::float[]::vector(1536) as query_vector
          )
          SELECT 
            g.id,
            g.term,
            g.aliases,
            g.explanation,
            g.domain,
            g.status,
            g."createdAt",
            g."updatedAt",
            g."approvedAt",
            g."approvedBy",
            g."createdBy",
            1 - (g.embedding <=> (SELECT query_vector FROM vector_query)) as _distance
          FROM "Glossary" g
          WHERE g.embedding IS NOT NULL
          ${baseWhere.status ? `AND g.status = '${baseWhere.status}'` : ''}
          ${baseWhere.domain?.in ? `AND g.domain IN (${baseWhere.domain.in.map((d: string) => `'${d}'`).join(',')})` : ''}
          ORDER BY g.embedding <=> (SELECT query_vector FROM vector_query)
          LIMIT ${limit * 2}
        ` as (GlossaryItem & { _distance: number })[]
        
        console.log(`[${new Date().toISOString()}] 向量搜索结果: ${vectorResults.length} 条`)
        
        // 计算余弦相似度并筛选符合相似度阈值的结果
        const vectorResultsWithSimilarity = vectorResults
          .map((item: GlossaryItem & { _distance: number }) => {
            const similarity = item._distance
            return {
              ...item,
              matchType: 'vector',
              similarity,
              aliases: item.aliases || null // 确保类型一致
            }
          })
          .filter((item: GlossaryItemWithSimilarity) => item.similarity >= minSimilarity)
        
        console.log(`[${new Date().toISOString()}] 符合阈值(${(minSimilarity * 100).toFixed(0)}%)的结果数: ${vectorResultsWithSimilarity.length}`)
        if (vectorResultsWithSimilarity.length > 0) {
          console.log(`[${new Date().toISOString()}] 相似度范围:`, {
            最高相似度: Math.max(...vectorResultsWithSimilarity.map((item: GlossaryItemWithSimilarity) => item.similarity)),
            最低相似度: Math.min(...vectorResultsWithSimilarity.map((item: GlossaryItemWithSimilarity) => item.similarity)),
            平均相似度: vectorResultsWithSimilarity.reduce((acc: number, item: GlossaryItemWithSimilarity) => acc + item.similarity, 0) / vectorResultsWithSimilarity.length
          })
        }
        
        // 合并结果
        allResults = [...allResults, ...vectorResultsWithSimilarity]
      } catch (vectorError) {
        console.error(`[${new Date().toISOString()}] 向量搜索失败:`, vectorError)
        // 即使向量搜索失败，也会返回精确匹配的结果
      }
    }
    
    // 去重 - 以ID为唯一标识，但保留匹配类型信息
    const resultMap = new Map<number, GlossaryItemWithSimilarity>()
    
    // 处理所有结果
    allResults.forEach((item: GlossaryItemWithSimilarity) => {
      const existing = resultMap.get(item.id)
      if (!existing) {
        resultMap.set(item.id, item)
      } else if (item.matchType === 'exact' && existing.matchType === 'vector') {
        // 如果当前项是精确匹配，且已存在的是向量匹配，则更新为精确匹配
        resultMap.set(item.id, { ...item, similarity: 1.0 })
      }
    })
    
    const uniqueResults = Array.from(resultMap.values())
    
    // 分别统计精确匹配和向量匹配的原始数量（去重前）
    const exactMatchCount = allResults.filter(item => item.matchType === 'exact').length
    const vectorMatchCount = allResults.filter(item => item.matchType === 'vector').length
    
    console.log(`[${new Date().toISOString()}] 搜索完成，结果统计:`, {
      原始精确匹配数: exactMatchCount,
      原始向量匹配数: vectorMatchCount,
      去重后总数: uniqueResults.length,
      去重后精确匹配数: uniqueResults.filter(item => item.matchType === 'exact').length,
      去重后向量匹配数: uniqueResults.filter(item => item.matchType === 'vector').length
    })
    
    // 排序 - 先按相似度降序，再按创建时间降序
    uniqueResults.sort((a, b) => {
      if (a.similarity !== b.similarity) {
        return b.similarity - a.similarity
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    
    // 分页
    const skip = (page - 1) * limit
    const paginatedResults = uniqueResults.slice(skip, skip + limit)
    
    return NextResponse.json({
      results: paginatedResults,
      total: uniqueResults.length,
      page,
      limit,
      hasMore: uniqueResults.length > skip + limit
    })
  } catch (error) {
    console.error('术语搜索失败:', error)
    return NextResponse.json(
      { error: '搜索失败' },
      { status: 500 }
    )
  }
}

// 导出术语列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')

    // 构建查询条件
    const where: any = {
      status: 'approved'
    }

    if (domain) {
      where.domain = domain
    }

    // 查询数据
    const items = await prisma.glossary.findMany({
      where,
      select: {
        term: true,
        aliases: true,
        explanation: true
      },
      orderBy: {
        term: 'asc'
      }
    })

    // 转换为指定的返回格式
    const formattedItems = items.map((item: { term: string; aliases: string | null; explanation: string }): ExportFormat => ({
      "术语名称": item.term,
      "别名": item.aliases || "",
      "解释说明": item.explanation
    }))

    return NextResponse.json(formattedItems)
  } catch (error) {
    console.error('导出术语列表失败:', error)
    return NextResponse.json(
      { error: '导出失败' },
      { status: 500 }
    )
  }
} 