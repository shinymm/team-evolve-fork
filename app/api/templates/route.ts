import { NextRequest, NextResponse } from 'next/server';
import { TemplateService, TemplateInput } from '@/lib/services/template-service';

// 获取所有模板或根据条件过滤
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
    
    const templates = await TemplateService.getTemplates(filters);
    return NextResponse.json(templates);
  } catch (error) {
    console.error('获取模板失败:', error);
    return NextResponse.json(
      { error: '获取模板失败' },
      { status: 500 }
    );
  }
}

// 创建新模板
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
    
    const templateData: TemplateInput = {
      name,
      description,
      content,
      tags: tags || [],
    };
    
    const newTemplate = await TemplateService.createTemplate(templateData);
    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error('创建模板失败:', error);
    return NextResponse.json(
      { error: '创建模板失败' },
      { status: 500 }
    );
  }
} 