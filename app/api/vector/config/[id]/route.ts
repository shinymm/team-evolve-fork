import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    // 返回更新后的配置
    return NextResponse.json({
      ...body,
      id: params.id
    })
  } catch (error) {
    console.error('更新向量模型配置失败:', error)
    return NextResponse.json(
      { error: '更新向量模型配置失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 直接返回成功
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除向量模型配置失败:', error)
    return NextResponse.json(
      { error: '删除向量模型配置失败' },
      { status: 500 }
    )
  }
} 