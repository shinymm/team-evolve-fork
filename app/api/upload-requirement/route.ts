import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import type { AIModelConfig } from '@/lib/ai-service'

/**
 * 注意：在服务器端API路由中无法使用localStorage，
 * 这是因为localStorage只在浏览器环境中可用。
 * 必须从前端传递所需的配置参数（apiKey和baseURL）。
 */

// 生成唯一ID
function generateUniqueId(): string {
  return `${Date.now()}-${randomBytes(8).toString('hex')}`
}

/**
 * 处理需求文档上传
 */
export async function POST(request: NextRequest) {
  try {
    // 解析表单数据
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: '请选择文件' },
        { status: 400 }
      )
    }

    // 获取文件名
    const filename = formData.get('filename') as string || file.name
    
    // 检查文件类型 - 支持多种格式
    const validTypes = [
      'openxmlformats-officedocument.wordprocessingml', // docx
      'text/plain', // txt
      'application/pdf', // pdf
      'openxmlformats-officedocument.spreadsheetml', // xlsx
      'text/markdown', // md
      'text/x-markdown' // md (别名)
    ];
    
    // 检查文件扩展名作为备选验证方式
    const fileExtension = filename.split('.').pop()?.toLowerCase();
    const validExtensions = ['docx', 'txt', 'pdf', 'xlsx', 'md'];
    
    // 检查文件类型是否有效
    const isValidType = validTypes.some(type => file.type.includes(type));
    const isValidExtension = validExtensions.includes(fileExtension || '');
    
    if (!isValidType && !isValidExtension) {
      return NextResponse.json(
        { error: '不支持的文件格式，请上传 Word、TXT、PDF、Excel 或 Markdown 文件' },
        { status: 400 }
      )
    }

    // 从请求中获取AI配置
    const apiKey = formData.get('apiKey') as string
    const baseURL = formData.get('baseURL') as string

    if (!apiKey || !baseURL) {
      return NextResponse.json(
        { error: 'AI模型配置不完整，请检查配置' },
        { status: 400 }
      )
    }

    // 生成文件ID
    const fileId = generateUniqueId()

    // TODO: 这里可以将文件保存到服务器、对象存储等
    // 此处仅示例，不做实际文件存储，仅返回成功信息

    return NextResponse.json({
      success: true,
      id: fileId,
      message: `文件 ${filename} 上传成功`,
      // 返回一些文件信息
      file: {
        id: fileId,
        name: filename,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('处理文件上传出错:', error)
    return NextResponse.json(
      { error: `上传处理失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    )
  }
} 