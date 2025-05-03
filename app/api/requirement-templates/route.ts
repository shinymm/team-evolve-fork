import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const systemId = url.searchParams.get('systemId')

  if (!systemId) {
    return NextResponse.json({ error: '缺少系统ID参数' }, { status: 400 })
  }

  try {
    const template = await prisma.requirementTemplate.findUnique({
      where: { systemId },
    })

    return NextResponse.json({ template })
  } catch (error) {
    console.error('获取需求书模板失败:', error)
    return NextResponse.json({ error: '获取需求书模板失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { systemId, content } = body

    if (!systemId) {
      return NextResponse.json({ error: '缺少系统ID' }, { status: 400 })
    }

    if (!content) {
      return NextResponse.json({ error: '缺少模板内容' }, { status: 400 })
    }

    // 使用upsert进行创建或更新操作
    const template = await prisma.requirementTemplate.upsert({
      where: { systemId },
      update: { content, updatedAt: new Date() },
      create: {
        systemId,
        content,
      },
    })

    return NextResponse.json({ success: true, template })
  } catch (error) {
    console.error('保存需求书模板失败:', error)
    return NextResponse.json({ error: '保存需求书模板失败' }, { status: 500 })
  }
} 