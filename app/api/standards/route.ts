import { NextRequest, NextResponse } from 'next/server';
import { StandardService, StandardInput } from '@/lib/services/standard-service';

// 获取所有规范或根据条件过滤
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || undefined;
    const tagsParam = searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',') : undefined;
    
    const filters = {
      name,
      tags,
    };
    
    const standards = await StandardService.getStandards(filters);
    return NextResponse.json(standards);
  } catch (error) {
    console.error('获取规范失败:', error);
    return NextResponse.json(
      { error: '获取规范失败' },
      { status: 500 }
    );
  }
}

// 创建新规范
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, content, tags } = body;
    
    // 简单验证
    if (!name || !content) {
      return NextResponse.json(
        { error: '名称和内容为必填项' },
        { status: 400 }
      );
    }
    
    const standardData: StandardInput = {
      name,
      description,
      content,
      tags: tags || [],
    };
    
    const newStandard = await StandardService.createStandard(standardData);
    return NextResponse.json(newStandard, { status: 201 });
  } catch (error) {
    console.error('创建规范失败:', error);
    return NextResponse.json(
      { error: '创建规范失败' },
      { status: 500 }
    );
  }
} 