import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        user: null
      })
    }

    return NextResponse.json({
      authenticated: true,
      user: session.user
    })

  } catch (error) {
    console.error('获取会话状态错误:', error)
    return NextResponse.json(
      { error: '获取会话状态时发生错误' },
      { status: 500 }
    )
  }
} 