import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/requirement-actions
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { systemId, type, duration, contentBefore, contentAfter } = body;
    
    // 验证必要字段
    if (!systemId || !type) {
      return NextResponse.json(
        { error: '缺少必要字段：systemId, type' },
        { status: 400 }
      );
    }

    // 生成唯一ID
    const uniqueId = `ra_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // 记录到数据库
    await prisma.$executeRawUnsafe(
      `INSERT INTO "RequirementAction" ("id", "systemId", "type", "duration", "contentBefore", "contentAfter", "processed", "timestamp")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      uniqueId,
      systemId,
      type,
      duration || 0,
      contentBefore || null,
      contentAfter || null,
      false,
      new Date()
    );
    
    return NextResponse.json({ 
      success: true, 
      id: uniqueId,
      message: '需求动作记录成功'
    });
  } catch (error) {
    console.error('记录需求动作失败:', error);
    return NextResponse.json(
      { error: '记录需求动作失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// GET /api/requirement-actions?processed=false&type=edit
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const processed = searchParams.get('processed') === 'false' ? false : undefined;
    const type = searchParams.get('type') || undefined;
    
    const whereClause = [];
    const params = [];
    
    if (processed !== undefined) {
      whereClause.push(`"processed" = $${params.length + 1}`);
      params.push(processed);
    }
    
    if (type) {
      whereClause.push(`"type" = $${params.length + 1}`);
      params.push(type);
    }
    
    const whereSQL = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
    
    const actions = await prisma.$queryRawUnsafe(
      `SELECT * FROM "RequirementAction" ${whereSQL} ORDER BY "timestamp" DESC`,
      ...params
    );
    
    return NextResponse.json(actions);
  } catch (error) {
    console.error('获取需求动作记录失败:', error);
    return NextResponse.json(
      { error: '获取需求动作记录失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// PATCH /api/requirement-actions/:id
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: '缺少必要参数：id' },
        { status: 400 }
      );
    }
    
    await prisma.$executeRawUnsafe(
      `UPDATE "RequirementAction" SET "processed" = $1 WHERE "id" = $2`,
      true,
      id
    );
    
    return NextResponse.json({ 
      success: true, 
      message: '需求动作状态更新成功'
    });
  } catch (error) {
    console.error('更新需求动作状态失败:', error);
    return NextResponse.json(
      { error: '更新需求动作状态失败', details: (error as Error).message },
      { status: 500 }
    );
  }
} 