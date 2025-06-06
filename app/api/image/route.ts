import { NextRequest, NextResponse } from 'next/server';
import { AliyunOSSService } from '@/lib/services/aliyun-oss-service';
import { prisma } from '@/lib/prisma';
import { getJsonCache, setJsonCache, deleteCache, CACHE_KEYS, CACHE_EXPIRE } from '@/lib/redis';

// 确保API路由配置是正确的
export const dynamic = 'force-dynamic'; // 确保路由不会被缓存
export const runtime = 'nodejs'; // 明确指定使用Node.js运行时
export const maxDuration = 60; // 设置最大执行时间为60秒

// 定义一个接口来描述服务器端接收的文件对象
interface FormDataFile {
  type: string;
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  slice(start?: number, end?: number, contentType?: string): FormDataFile;
  stream(): ReadableStream;
}

// 定义图片类型接口
interface UploadedImage {
  id: string;
  name: string;
  url: string;
  uploadTime: Date | string;
  selected?: boolean;
  provider: string;
  fileSize?: number;
  fileType?: string;
}

/**
 * GET方法用于获取系统的图片列表
 */
export async function GET(request: NextRequest) {
  try {
    // 从URL查询参数获取系统ID
    const url = new URL(request.url);
    const systemId = url.searchParams.get('systemId');
    
    if (!systemId) {
      return NextResponse.json(
        { error: '缺少必要参数: systemId' },
        { status: 400 }
      );
    }

    console.log(`获取系统[${systemId}]的图片列表`);

    // 尝试从缓存获取
    const cacheKey = `${CACHE_KEYS.IMAGE_LIST}${systemId}`;
    const cachedImages = await getJsonCache<UploadedImage[]>(cacheKey);
    
    if (cachedImages && cachedImages.length > 0) {
      console.log(`从缓存获取到 ${cachedImages.length} 张图片`);
      return NextResponse.json({
        images: cachedImages
      });
    }

    // 缓存未命中，从数据库查询
    console.log(`缓存未命中，从数据库查询图片列表`);
    const images = await prisma.$queryRaw<any[]>`
      SELECT * FROM "UploadedImage" 
      WHERE "systemId" = ${systemId}
      ORDER BY "uploadTime" DESC
    `;

    // 转换为前端需要的格式
    const formattedImages: UploadedImage[] = images.map((img) => ({
      id: img.ossKey,
      name: img.name,
      url: img.url,
      uploadTime: img.uploadTime,
      selected: false,
      provider: img.provider,
      fileSize: img.fileSize || undefined,
      fileType: img.fileType || undefined
    }));

    // 保存到缓存
    await setJsonCache(cacheKey, formattedImages, CACHE_EXPIRE.ONE_HOUR);
    console.log(`已将 ${formattedImages.length} 张图片保存到缓存`);

    // 返回结果
    return NextResponse.json({
      images: formattedImages
    });
  } catch (error) {
    console.error('获取图片列表失败:', error);
    return NextResponse.json(
      { error: `获取图片列表失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE方法用于删除图片
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const systemId = url.searchParams.get('systemId'); // 获取systemId
    
    if (!key) {
      return NextResponse.json({ error: '缺少必要参数: key' }, { status: 400 });
    }
    
    if (!systemId) {
      return NextResponse.json({ error: '缺少必要参数: systemId' }, { status: 400 });
    }

    console.log(`准备删除OSS文件，key: ${key}`);
    
    // 从OSS删除文件
    await AliyunOSSService.getInstance().deleteFile(key);
    console.log(`文件 ${key} 已从OSS删除`);

    // 从数据库删除记录
    try {
      await prisma.uploadedImage.delete({
        where: { ossKey: key },
      });
      console.log(`文件记录 ${key} 已从数据库删除`);
      
      // 清除此系统的缓存
      await deleteCache(`${CACHE_KEYS.IMAGE_LIST}${systemId}`);
      console.log(`已清除系统 ${systemId} 的图片缓存`);
    } catch (dbError) {
      console.warn(`数据库记录删除失败（可能已被删除）:`, dbError);
    }

    return NextResponse.json({ message: '文件删除成功' });
  } catch (error) {
    console.error('删除图片失败:', error);
    return NextResponse.json(
      { error: `删除失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
} 