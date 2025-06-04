import { NextRequest, NextResponse } from 'next/server';
import { StandardService } from '@/lib/services/standard-service';

interface RouteParams {
  params: {
    id: string;
  };
}

// 获取单个规范
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const standard = await StandardService.getStandardById(id);
    
    if (!standard) {
      return NextResponse.json(
        { error: '规范不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(standard);
  } catch (error) {
    console.error('获取规范详情失败:', error);
    return NextResponse.json(
      { error: '获取规范详情失败' },
      { status: 500 }
    );
  }
}

// 更新规范
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, description, content, tags } = body;
    
    // 检查规范是否存在
    const existingStandard = await StandardService.getStandardById(id);
    if (!existingStandard) {
      return NextResponse.json(
        { error: '规范不存在' },
        { status: 404 }
      );
    }
    
    // 更新规范
    const updatedStandard = await StandardService.updateStandard(id, {
      name,
      description,
      content,
      tags,
    });
    
    return NextResponse.json(updatedStandard);
  } catch (error) {
    console.error('更新规范失败:', error);
    return NextResponse.json(
      { error: '更新规范失败' },
      { status: 500 }
    );
  }
}

// 删除规范
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    
    // 检查规范是否存在
    const existingStandard = await StandardService.getStandardById(id);
    if (!existingStandard) {
      return NextResponse.json(
        { error: '规范不存在' },
        { status: 404 }
      );
    }
    
    // 删除规范
    await StandardService.deleteStandard(id);
    
    return NextResponse.json(
      { message: '规范已成功删除' },
      { status: 200 }
    );
  } catch (error) {
    console.error('删除规范失败:', error);
    return NextResponse.json(
      { error: '删除规范失败' },
      { status: 500 }
    );
  }
} 