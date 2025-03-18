import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 获取所有用户
export async function GET() {
  try {
    const users = await prisma.user.findMany()
    return NextResponse.json(users)
  } catch (error) {
    console.error('获取用户失败:', error)
    return NextResponse.json(
      { error: '获取用户失败' },
      { status: 500 }
    )
  }
}

// 创建新用户
export async function POST(request: Request) {
  try {
    const { email, name } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { error: '邮箱是必填项' },
        { status: 400 }
      )
    }
    
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      return NextResponse.json(
        { error: '该邮箱已被注册' },
        { status: 409 }
      )
    }
    
    const newUser = await prisma.user.create({
      data: {
        email,
        name
      }
    })
    
    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error('创建用户失败:', error)
    return NextResponse.json(
      { error: '创建用户失败' },
      { status: 500 }
    )
  }
} 