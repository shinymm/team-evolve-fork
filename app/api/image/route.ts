import { NextRequest, NextResponse } from 'next/server';
import { uploadToOSS, deleteFromOSS } from '@/lib/utils/oss-utils';
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
 * POST方法用于上传图片
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    // 获取上传的文件
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json({ error: '没有提供文件' }, { status: 400 });
    }
    
    // 检查是否是有效的文件对象
    if (typeof file !== 'object' || !('type' in file) || !('name' in file) || !('size' in file) || !('arrayBuffer' in file)) {
      console.error('无效的文件对象:', file);
      return NextResponse.json({ error: '无效的文件格式' }, { status: 400 });
    }
    
    // 使用类型断言让TypeScript知道我们已经验证了file对象的结构
    const fileObject = file as FormDataFile;
    
    // 验证文件类型
    const fileType = String(fileObject.type || '');
    if (!fileType.startsWith('image/')) {
      return NextResponse.json({ error: '仅支持图片文件' }, { status: 400 });
    }
    
    // 确保文件名是字符串类型
    const fileName = typeof fileObject.name === 'string' ? fileObject.name : `image_${Date.now()}`;
    
    // 从URL查询参数获取系统名称
    const url = new URL(request.url);
    const systemName = url.searchParams.get('systemName');
    
    // 上传到OSS
    console.log(`开始上传图片到OSS${systemName ? `(系统: ${systemName})`: ''}: ${fileName}, 类型: ${fileType}, 大小: ${(Number(fileObject.size) / 1024).toFixed(2)}KB`);
    
    try {
      // 先将文件内容转换为Buffer
      // FormData中的文件对象有arrayBuffer方法，可以获取文件内容
      const arrayBuffer = await fileObject.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // 使用Buffer和文件名调用uploadToOSS函数
      const { url: fileUrl, key } = await uploadToOSS(buffer, fileName, systemName || undefined);
      console.log(`图片上传成功: ${fileUrl}`);
      
      // 返回成功响应
      return NextResponse.json({
        file: {
          id: key,  // 使用OSS的key作为ID
          name: fileName,
          url: fileUrl,  // 返回公开访问URL
          provider: 'aliyun-oss',
          size: Number(fileObject.size),
          type: fileType
        }
      });
    } catch (ossError) {
      console.error('OSS上传错误:', ossError);
      return NextResponse.json(
        { error: `OSS上传失败: ${ossError instanceof Error ? ossError.message : '未知错误'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('图片上传处理错误:', error);
    return NextResponse.json(
      { error: `图片上传失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE方法用于删除OSS中的图片
 */
export async function DELETE(request: NextRequest) {
  try {
    // 从URL中获取图片ID (key)
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const systemId = url.searchParams.get('systemId');
    
    if (!key) {
      return NextResponse.json({ error: '未提供图片ID' }, { status: 400 });
    }
    
    console.log(`准备删除OSS图片: ${key}${systemId ? `, 系统ID: ${systemId}` : ''}`);
    
    // 调用OSS删除方法
    const result = await deleteFromOSS(key);
    
    // 如果提供了systemId，同时删除数据库记录
    if (systemId && result) {
      try {
        // 从数据库中删除图片记录
        const deleteResult = await prisma.$executeRaw`
          DELETE FROM "UploadedImage" 
          WHERE "ossKey" = ${key} AND "systemId" = ${systemId}
        `;
        
        // 清除此系统的缓存
        await deleteCache(`${CACHE_KEYS.IMAGE_LIST}${systemId}`);
        
        console.log(`已从数据库删除图片记录: ${key}, 系统ID: ${systemId}`);
      } catch (dbError) {
        console.error('从数据库删除图片记录失败:', dbError);
        // 继续返回成功，因为OSS删除已成功
      }
    }
    
    if (result) {
      console.log(`图片删除成功: ${key}`);
      return NextResponse.json({ success: true, message: '图片删除成功' });
    } else {
      console.error(`图片删除失败: ${key}`);
      return NextResponse.json({ error: '图片删除失败' }, { status: 500 });
    }
  } catch (error) {
    console.error('删除图片时出错:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除图片失败' },
      { status: 500 }
    );
  }
} 