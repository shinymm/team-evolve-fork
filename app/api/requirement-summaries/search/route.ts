import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { getEmbedding } from '@/lib/embedding'

const prisma = new PrismaClient()

// 定义类型
type RequirementSummary = {
  id: number
  name: string
  summary: string
  domain: string
  relatedModules: string[]
  createdAt: string
  updatedAt: string
  createdBy: string | null
  embedding: number[] | null
}

type SearchResult = RequirementSummary & {
  similarity?: number
  matchType: 'exact' | 'semantic'
}

// 搜索参数验证
const SearchSchema = z.object({
  query: z.string().min(1, '搜索关键词不能为空'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  vectorConfig: z.object({
    baseURL: z.string(),
    apiKey: z.string(),
    model: z.string(),
    dimension: z.number(),
  }).optional(),
  minSimilarity: z.number().min(0).max(1).default(0.7),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { query, page, limit, vectorConfig, minSimilarity } = SearchSchema.parse(body)
    
    let allResults: SearchResult[] = []
    
    // 1. 先进行精确/模糊匹配
    console.log('执行精确/模糊匹配搜索...')
    const exactResults = await prisma.requirementSummary.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { summary: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })
    
    console.log(`找到 ${exactResults.length} 条精确/模糊匹配结果`)
    allResults.push(...exactResults.map((item: RequirementSummary) => ({
      ...item,
      matchType: 'exact' as const,
      similarity: 1.0,
    })))
    
    // 2. 如果有向量配置，进行向量检索
    if (vectorConfig) {
      try {
        console.log('开始向量检索...')
        const queryVector = await getEmbedding(query, vectorConfig)
        
        if (!queryVector) {
          throw new Error('无法生成查询向量')
        }
        
        console.log('执行向量相似度搜索...')
        const vectorResults = await prisma.$queryRaw`
          SELECT 
            id,
            name,
            summary,
            domain,
            "relatedModules",
            created_at as "createdAt",
            updated_at as "updatedAt",
            created_by as "createdBy",
            embedding,
            1 - (embedding::vector <=> ${queryVector}::vector) as similarity
          FROM requirement_summaries
          WHERE embedding IS NOT NULL
          AND array_length(embedding, 1) > 0
          AND 1 - (embedding::vector <=> ${queryVector}::vector) >= ${minSimilarity}
          ORDER BY similarity DESC
        `
        
        console.log(`找到 ${(vectorResults as any[]).length} 条向量检索结果`)
        
        // 将向量检索结果添加到总结果中，注意去重并保留最高相似度
        const existingIds = new Set()
        const finalResults: SearchResult[] = []
        
        // 先处理精确匹配结果
        for (const result of allResults) {
          existingIds.add(result.id)
          finalResults.push(result)
        }
        
        // 处理向量检索结果
        for (const item of vectorResults as any[]) {
          const similarity = Number(item.similarity)
          if (existingIds.has(item.id)) {
            // 如果已存在，比较相似度，保留较高的
            const existingIndex = finalResults.findIndex(r => r.id === item.id)
            if (existingIndex !== -1 && similarity > (finalResults[existingIndex].similarity || 0)) {
              finalResults[existingIndex] = {
                ...item,
                similarity,
                matchType: 'semantic' as const,
              }
            }
          } else {
            // 如果不存在，直接添加
            finalResults.push({
              ...item,
              similarity,
              matchType: 'semantic' as const,
            })
          }
        }
        
        allResults = finalResults
      } catch (error) {
        console.error('向量检索失败:', error)
      }
    }
    
    // 3. 对结果进行排序和分页
    console.log('对结果进行排序和分页处理...')
    allResults.sort((a, b) => {
      // 优先按相似度排序
      const similarityA = a.similarity || 0
      const similarityB = b.similarity || 0
      if (similarityA !== similarityB) {
        return similarityB - similarityA
      }
      
      // 相似度相同时，精确匹配优先
      if (a.matchType === 'exact' && b.matchType !== 'exact') return -1
      if (a.matchType !== 'exact' && b.matchType === 'exact') return 1
      
      // 最后按创建时间排序
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    
    const total = allResults.length
    const paginatedResults = allResults.slice((page - 1) * limit, page * limit)
    
    console.log(`返回第 ${page} 页结果，每页 ${limit} 条，总计 ${total} 条`)
    return NextResponse.json({
      results: paginatedResults,
      total,
      page,
      limit,
    })
  } catch (error) {
    console.error('搜索失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '搜索失败' },
      { status: 500 }
    )
  }
} 