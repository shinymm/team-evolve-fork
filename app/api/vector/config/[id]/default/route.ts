import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 直接返回成功
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('设置默认向量模型配置失败:', error)
    return NextResponse.json(
      { error: '设置默认向量模型配置失败' },
      { status: 500 }
    )
  }
} 