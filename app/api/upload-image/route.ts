import { NextRequest, NextResponse } from 'next/server';
import { AliyunOSSService } from '@/lib/services/aliyun-oss-service';

export const runtime = 'nodejs'; // 必须是 nodejs

/**
 * 获取OSS上传的表单参数
 * 前端通过这些参数使用表单方式上传到OSS
 */
export async function POST(req: NextRequest) {
  try {
    const { fileName, fileType, systemName } = await req.json();

    if (!fileName || !fileType) {
      return NextResponse.json({ error: '缺少文件名或文件类型' }, { status: 400 });
    }
    
    if (!systemName) {
      return NextResponse.json({ error: '缺少系统名称' }, { status: 400 });
    }

    // 使用新的服务生成表单上传参数
    const ossService = AliyunOSSService.getInstance();
    const { uploadUrl, accessUrl, key, formData } = await ossService.createPresignedPutUrl(fileName, fileType, systemName);

    // 返回给前端的信息（包含表单数据）
    return NextResponse.json({
      uploadUrl,
      accessUrl,
      key,
      formData
    });
  } catch (e: any) {
    console.error('获取表单上传参数失败:', e);
    return NextResponse.json({ error: e?.message || '获取表单上传参数失败' }, { status: 500 });
  }
} 