import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteCache, CACHE_KEYS } from '@/lib/redis';

// 定义请求格式
interface MigrateImageRequest {
  systemId: string;
  ossKey: string;
  name: string;
  url: string;
  provider: string;
  uploadTime?: Date | string;
  fileSize?: number;
  fileType?: string;
  createdBy?: string;
}

/**
 * 仅限管理员使用的API端点
 * 用于将localStorage中的图片元数据迁移到数据库
 */
export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const data = await request.json() as MigrateImageRequest;
    
    // 验证必填字段
    if (!data.systemId || !data.ossKey || !data.name || !data.url) {
      return NextResponse.json(
        { error: '缺少必要字段 (systemId, ossKey, name, url)' },
        { status: 400 }
      );
    }

    // 检查系统ID是否存在
    const system = await prisma.system.findUnique({
      where: { id: data.systemId },
      select: { id: true }
    });

    if (!system) {
      return NextResponse.json(
        { error: `系统ID不存在: ${data.systemId}` },
        { status: 404 }
      );
    }

    // 检查此图片是否已存在（通过ossKey）
    const existingImage = await prisma.$queryRaw<any[]>`
      SELECT id FROM "UploadedImage" WHERE "ossKey" = ${data.ossKey}
    `;

    if (existingImage && existingImage.length > 0) {
      return NextResponse.json(
        { 
          message: '该图片已存在于数据库中', 
          imageId: existingImage[0].id 
        },
        { status: 200 }
      );
    }

    // 执行插入操作
    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO "UploadedImage" 
        ("id", "systemId", "name", "ossKey", "url", "provider", "fileSize", "fileType", "uploadTime", "createdBy")
      VALUES 
        (gen_random_uuid(), ${data.systemId}, ${data.name}, ${data.ossKey}, ${data.url}, 
        ${data.provider}, ${data.fileSize || null}, ${data.fileType || null}, 
        ${data.uploadTime ? new Date(data.uploadTime) : new Date()}, 
        ${data.createdBy || 'migration'})
      RETURNING id
    `;
    
    // 清除该系统的图片列表缓存
    await deleteCache(`${CACHE_KEYS.IMAGE_LIST}${data.systemId}`);

    // 返回成功结果
    return NextResponse.json({
      success: true,
      message: '图片元数据已成功迁移到数据库',
      imageId: result[0]?.id
    });
    
  } catch (error) {
    console.error('迁移图片元数据失败:', error);
    
    // 返回错误信息
    return NextResponse.json(
      { 
        error: '迁移图片元数据失败', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 防止缓存
export const dynamic = 'force-dynamic'; 