import { NextRequest, NextResponse } from 'next/server';
import { uploadToOSS, deleteFromOSS } from '@/lib/utils/oss-utils';
import { v4 as uuidv4 } from 'uuid';

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

// 添加DELETE方法用于删除OSS中的图片
export async function DELETE(request: NextRequest) {
  try {
    // 从URL中获取图片ID (key)
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    
    if (!key) {
      return NextResponse.json({ error: '未提供图片ID' }, { status: 400 });
    }
    
    console.log(`准备删除OSS图片: ${key}`);
    
    // 调用OSS删除方法
    const result = await deleteFromOSS(key);
    
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