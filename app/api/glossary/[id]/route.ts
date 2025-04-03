import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getEmbedding } from '@/lib/services/embedding-service'
import { z } from 'zod'

// 获取单个术语详情
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: '无效的ID' },
        { status: 400 }
      )
    }

    const glossary = await prisma.glossary.findUnique({
      where: { id }
    })

    if (!glossary) {
      return NextResponse.json(
        { error: '未找到术语' },
        { status: 404 }
      )
    }

    return NextResponse.json(glossary)
  } catch (error) {
    console.error('获取术语详情失败:', error)
    return NextResponse.json(
      { error: '获取术语详情失败' },
      { status: 500 }
    )
  }
}

// 更新术语
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: '无效的ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    
    // 验证请求体
    const schema = z.object({
      term: z.string().min(1, "术语名称不能为空"),
      aliases: z.string().optional(),
      explanation: z.string().min(1, "术语解释不能为空"),
      domain: z.string().optional(),
      status: z.enum(["pending", "approved"]).optional(),
      approvedBy: z.string().optional(),
      vectorConfig: z.object({
        baseURL: z.string().min(1, "API地址不能为空"),
        model: z.string().min(1, "模型名称不能为空"),
        apiKey: z.string().min(1, "API Key不能为空"),
        name: z.string().min(1, "向量模型名称不能为空"),
        id: z.string().optional(),
        isDefault: z.boolean().optional(),
        dimension: z.number().optional()
      }).optional(),
      clearEmbedding: z.boolean().optional()
    }).refine(
      (data) => {
        // 如果状态是 approved，则必须提供向量配置
        if (data.status === 'approved') {
          return !!data.vectorConfig
        }
        return true
      },
      {
        message: "审核通过时必须提供向量模型配置",
        path: ["vectorConfig"]
      }
    )
    
    const { term, aliases, explanation, domain, status, approvedBy, vectorConfig, clearEmbedding } = schema.parse(body)
    
    // 检查是否存在相同名称的其他术语
    const existingWithSameName = await prisma.glossary.findFirst({
      where: {
        term: { equals: term, mode: 'insensitive' },
        NOT: { id }
      }
    })
    
    if (existingWithSameName) {
      return NextResponse.json(
        { error: `已存在名为 "${term}" 的术语` },
        { status: 400 }
      )
    }
    
    // 如果是审核通过，必须生成向量嵌入
    if (status === 'approved') {
      try {
        // 检查向量模型配置
        if (!vectorConfig) {
          console.error('审核通过时未提供向量模型配置')
          return NextResponse.json(
            { error: '审核通过时必须提供向量模型配置' },
            { status: 400 }
          )
        }

        console.log('开始生成向量嵌入，使用配置:', {
          ...vectorConfig,
          apiKey: '***' // 隐藏 API Key
        })

        // 生成向量嵌入
        const text = `${term}\n${explanation}`
        const embedding = await getEmbedding(text, {
          ...vectorConfig,
          dimension: 1536  // 仅保留维度设置，因为这个在schema中是可选的
        })
        
        if (!embedding) {
          console.error('生成向量嵌入失败')
          return NextResponse.json(
            { error: '生成向量嵌入失败' },
            { status: 500 }
          )
        }

        console.log('向量嵌入生成成功，长度:', embedding.length)

        // 使用原始 SQL 更新术语（包含向量嵌入）
        let result: number
        try {
          console.log('开始更新数据库')
          // 首先尝试获取现有记录，检查是否需要更新 embedding
          const existingRecord = await prisma.glossary.findUnique({
            where: { id }
          })

          if (!existingRecord) {
            return NextResponse.json(
              { error: '未找到对应的术语' },
              { status: 404 }
            )
          }

          // 构建 SQL 更新语句
          const embeddingArray = embedding.map(String)  // 将数字数组转换为字符串数组
          const embeddingString = embeddingArray.join(',')

          result = await prisma.$executeRaw`
            UPDATE "Glossary"
            SET 
              term = ${term},
              aliases = ${aliases || ''},
              explanation = ${explanation},
              domain = ${domain || 'qare'},
              status = ${status},
              "approvedAt" = ${new Date()},
              "approvedBy" = ${approvedBy || ''},
              embedding = string_to_array(${embeddingString}, ',')::float[]::vector(1536),
              "updatedAt" = ${new Date()}
            WHERE id = ${id}
          `
          console.log('SQL更新完成，影响行数:', result)
        } catch (sqlError) {
          console.error('SQL更新失败:', sqlError)
          return NextResponse.json(
            { error: sqlError instanceof Error ? sqlError.message : '数据库更新失败' },
            { status: 500 }
          )
        }
        
        if (result === 0) {
          console.error('未找到要更新的术语，ID:', id)
          return NextResponse.json(
            { error: '未找到对应的术语' },
            { status: 404 }
          )
        }
        
        console.log('术语更新成功，ID:', id)
        
        // 获取更新后的术语
        let updatedGlossary
        try {
          console.log('获取更新后的术语')
          updatedGlossary = await prisma.glossary.findUnique({
            where: { id },
            select: { id: true, term: true }
          })
          console.log('获取成功:', updatedGlossary)
        } catch (findError) {
          console.error('获取更新后的术语失败:', findError)
          // 这里我们已经知道更新成功了，所以返回基本信息
          return NextResponse.json({
            id,
            term,
            message: `术语 "${term}" 已成功更新并审核通过，但无法获取更新后的详情`
          })
        }
        
        if (!updatedGlossary) {
          console.warn('无法获取更新后的术语，ID:', id)
          return NextResponse.json({
            id,
            term,
            message: `术语 "${term}" 已成功更新并审核通过，但无法获取更新后的详情`
          })
        }
        
        return NextResponse.json({
          id: updatedGlossary.id,
          term: updatedGlossary.term,
          message: `术语 "${term}" 已成功更新并审核通过`
        })
      } catch (error) {
        console.error('审核处理失败:', error)
        return NextResponse.json(
          { error: error instanceof Error ? error.message : '审核处理失败' },
          { status: 500 }
        )
      }
    }
    
    // 如果不是审核通过，则不需要生成向量嵌入
    if (clearEmbedding) {
      // 使用原始 SQL 更新术语（包含清空向量嵌入）
      let result: number
      try {
        console.log('开始更新数据库，清空向量嵌入')
        result = await prisma.$executeRaw`
          UPDATE "Glossary"
          SET 
            term = ${term},
            aliases = ${aliases || ''},
            explanation = ${explanation},
            domain = ${domain || 'qare'},
            status = 'pending',
            "approvedAt" = null,
            "approvedBy" = '',
            embedding = null,
            "updatedAt" = ${new Date()}
          WHERE id = ${id}
        `
        console.log('SQL更新完成，影响行数:', result)

        if (result === 0) {
          return NextResponse.json(
            { error: '未找到对应的术语' },
            { status: 404 }
          )
        }

        const updatedGlossary = await prisma.glossary.findUnique({
          where: { id },
          select: { id: true, term: true }
        })

        return NextResponse.json({
          id: updatedGlossary?.id,
          term: updatedGlossary?.term,
          message: `术语 "${term}" 已成功更新`
        })
      } catch (sqlError) {
        console.error('SQL更新失败:', sqlError)
        return NextResponse.json(
          { error: sqlError instanceof Error ? sqlError.message : '数据库更新失败' },
          { status: 500 }
        )
      }
    } else {
      // 如果不需要清空向量嵌入，使用普通的 Prisma 更新
      const updatedGlossary = await prisma.glossary.update({
        where: { id },
        data: {
          term,
          aliases: aliases || "",
          explanation,
          domain: domain || "qare",
          ...(status && { status }),
          updatedAt: new Date()
        },
      })
      
      return NextResponse.json({
        id: updatedGlossary.id,
        term: updatedGlossary.term,
        message: `术语 "${term}" 已成功更新`
      })
    }
  } catch (error) {
    console.error('更新术语失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新术语失败' },
      { status: 500 }
    )
  }
}

// 删除术语
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: '无效的ID' },
        { status: 400 }
      )
    }

    // 检查术语是否存在
    const existing = await prisma.glossary.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: '未找到术语' },
        { status: 404 }
      )
    }

    // 删除术语
    await prisma.glossary.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: '术语已成功删除'
    })
  } catch (error) {
    console.error('删除术语失败:', error)
    return NextResponse.json(
      { error: '删除术语失败' },
      { status: 500 }
    )
  }
}