import { NextRequest, NextResponse } from 'next/server';
import { uploadToOSS, deleteFromOSS } from '@/lib/utils/oss-utils';
import { v4 as uuidv4 } from 'uuid';

// 确保API路由配置是正确的
export const dynamic = 'force-dynamic'; // 确保路由不会被缓存
export const runtime = 'nodejs'; // 明确指定使用Node.js运行时
export const maxDuration = 60; // 设置最大执行时间为60秒

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: '没有提供文件' }, { status: 400 });
    }
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '仅支持图片文件' }, { status: 400 });
    }
    
    // 从URL查询参数获取系统名称
    const url = new URL(request.url);
    const systemName = url.searchParams.get('systemName');
    
    // 上传到OSS
    console.log(`开始上传图片到OSS${systemName ? `(系统: ${systemName})`: ''}: ${file.name}, 大小: ${(file.size / 1024).toFixed(2)}KB`);
    const { url: fileUrl, key } = await uploadToOSS(file, file.name, systemName || undefined);
    console.log(`图片上传成功: ${fileUrl}`);
    
    // 返回成功响应
    return NextResponse.json({
      file: {
        id: key,  // 使用OSS的key作为ID
        name: file.name,
        url: fileUrl,  // 返回公开访问URL
        provider: 'aliyun-oss',
        size: file.size,
        type: file.type
      }
    });
  } catch (error) {
    console.error('图片上传错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '图片上传失败' },
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