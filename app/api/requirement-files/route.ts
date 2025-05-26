import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

// 请求体验证schema
const createFileSchema = z.object({
  name: z.string().min(1, '文件名不能为空'),
  systemId: z.string().min(1, '系统ID不能为空'),
  qwenFileId: z.string().min(1, 'Qwen文件ID不能为空'),
  mimeType: z.string().min(1, '文件类型不能为空'),
  uploadedBy: z.string().min(1, '上传者ID不能为空'),
})

// GET /api/requirement-files?systemId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const systemId = searchParams.get('systemId')

    // 验证systemId
    if (!systemId) {
      return NextResponse.json(
        { error: '系统ID是必需的' },
        { status: 400 }
      )
    }

    // 检查系统是否存在
    const system = await prisma.system.findUnique({
      where: { id: systemId }
    })

    if (!system) {
      return NextResponse.json(
        { error: '系统不存在' },
        { status: 404 }
      )
    }

    // 获取文件列表
    const files = await prisma.requirementFile.findMany({
      where: { systemId },
      orderBy: { uploadedAt: 'desc' }
    })

    return NextResponse.json({ files })
  } catch (error) {
    console.error('获取需求文件列表失败:', error)
    return NextResponse.json(
      { error: '获取文件列表失败' },
      { status: 500 }
    )
  }
}

// POST /api/requirement-files
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // 验证请求体
    const validatedData = createFileSchema.parse(body)
    
    const dataToCreate: any = { // 使用 any 绕过复杂的类型体操，依赖 zod 验证的正确性
      name: validatedData.name,
      systemId: validatedData.systemId,
      qwenFileId: validatedData.qwenFileId,
      mimeType: validatedData.mimeType,
      uploadedBy: validatedData.uploadedBy,
    };

    // 检查系统是否存在
    const system = await prisma.system.findUnique({
      where: { id: validatedData.systemId }
    })

    if (!system) {
      return NextResponse.json(
        { error: '系统不存在' },
        { status: 404 }
      )
    }

    // 创建文件记录
    const file = await prisma.requirementFile.create({
      data: dataToCreate 
    });

    return NextResponse.json(file, { status: 201 });
  } catch (error) {
    console.error('创建需求文件记录失败:', error)
    
    // 处理验证错误
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '请求数据验证失败', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: '创建文件记录失败' },
      { status: 500 }
    )
  }
} 