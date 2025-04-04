import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET - 获取所有应用
export async function GET() {
  try {
    const applications = await prisma.aiTeamApplication.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })
    return NextResponse.json(applications)
  } catch (error) {
    console.error('Error fetching applications:', error)
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }
}

// POST - 创建新应用
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const json = await request.json()
    const { name, introduction, entryUrl, category } = json

    // 验证必填字段
    if (!name || !introduction || !entryUrl) {
      return NextResponse.json(
        { error: 'Name, introduction and entryUrl are required' },
        { status: 400 }
      )
    }

    const application = await prisma.aiTeamApplication.create({
      data: {
        name,
        introduction,
        entryUrl,
        category,
        createdBy: session.user.email
      }
    })

    return NextResponse.json(application)
  } catch (error) {
    console.error('Error creating application:', error)
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 })
  }
} 