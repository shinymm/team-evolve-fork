import { NextRequest, NextResponse } from 'next/server';
import { TemplateService } from '@/lib/services/template-service';

interface RouteParams {
  params: {
    id: string;
  };
}

// 获取单个模板
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const template = await TemplateService.getTemplateById(id);
    
    if (!template) {
      return NextResponse.json(
        { error: '模板不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(template);
  } catch (error) {
    console.error('获取模板详情失败:', error);
    return NextResponse.json(
      { error: '获取模板详情失败' },
      { status: 500 }
    );
  }
}

// 更新模板
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, description, content, tags } = body;
    
    // 检查模板是否存在
    const existingTemplate = await TemplateService.getTemplateById(id);
    if (!existingTemplate) {
      return NextResponse.json(
        { error: '模板不存在' },
        { status: 404 }
      );
    }
    
    // 更新模板
    const updatedTemplate = await TemplateService.updateTemplate(id, {
      name,
      description,
      content,
      tags,
    });
    
    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error('更新模板失败:', error);
    return NextResponse.json(
      { error: '更新模板失败' },
      { status: 500 }
    );
  }
}

// 删除模板
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    
    // 检查模板是否存在
    const existingTemplate = await TemplateService.getTemplateById(id);
    if (!existingTemplate) {
      return NextResponse.json(
        { error: '模板不存在' },
        { status: 404 }
      );
    }
    
    // 删除模板
    await TemplateService.deleteTemplate(id);
    
    return NextResponse.json(
      { message: '模板已成功删除' },
      { status: 200 }
    );
  } catch (error) {
    console.error('删除模板失败:', error);
    return NextResponse.json(
      { error: '删除模板失败' },
      { status: 500 }
    );
  }
} 