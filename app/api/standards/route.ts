import { NextRequest, NextResponse } from 'next/server';
import { StandardService, StandardInput } from '@/lib/services/standard-service';

// 获取所有规范或根据条件过滤
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || undefined;
    const tagsParam = searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',') : undefined;
    const systemId = searchParams.get('systemId') || undefined;
    
    const filters = {
      name,
      tags,
      systemId,
    };
    
    // 必须提供systemId，强制按系统ID过滤
    if (!systemId) {
      console.warn('请求未提供systemId参数，拒绝处理');
      return NextResponse.json(
        { error: '必须指定systemId参数' },
        { status: 400 }
      );
    }
    
    console.log(`处理GET /api/standards请求, 系统ID: ${systemId}, 其他过滤条件:`, {name, tags: tags?.join(',')});
    
    const standards = await StandardService.getStandards(filters);
    console.log(`成功获取规范数据: ${standards.length}条记录`);
    
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
    const { name, description, content, tags, systemId } = body;
    
    console.log('创建规范请求数据:', { name, systemId });
    
    // 简单验证
    if (!name || !content) {
      return NextResponse.json(
        { error: '名称和内容为必填项' },
        { status: 400 }
      );
    }
    
    // 验证systemId
    if (!systemId) {
      return NextResponse.json(
        { error: 'systemId为必填项' },
        { status: 400 }
      );
    }
    
    const standardData: StandardInput = {
      name,
      description,
      content,
      tags: tags || [],
      systemId,
    };
    
    try {
      const newStandard = await StandardService.createStandard(standardData);
      return NextResponse.json(newStandard, { status: 201 });
    } catch (serviceError: any) {
      console.error('规范服务创建失败:', serviceError);
      // 检查是否是外键约束错误
      if (serviceError.message && serviceError.message.includes('Foreign key constraint failed')) {
        return NextResponse.json(
          { error: `系统ID不存在: ${systemId}` },
          { status: 400 }
        );
      }
      throw serviceError; // 重新抛出其他错误
    }
  } catch (error) {
    console.error('创建规范失败，详细错误:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `创建规范失败: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: '创建规范失败' },
      { status: 500 }
    );
  }
} 