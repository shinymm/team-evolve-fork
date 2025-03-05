import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import type { AIModelConfig } from '@/lib/ai-service'
import OpenAI from 'openai'

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

    // 检查文件大小，防止空文件
    if (file.size === 0) {
      return NextResponse.json(
        { error: '文件内容为空，请选择有效文件' },
        { status: 400 }
      )
    }

    console.log(`上传文件: ${filename}, 大小: ${file.size} 字节, 类型: ${file.type}`)
    
    // 创建OpenAI客户端，用于与兼容的API交互
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL
    })
    
    let fileId;
    
    try {
      // 将文件内容转换为Buffer，以便上传
      const arrayBuffer = await file.arrayBuffer()
      
      // 创建一个符合OpenAI格式要求的文件对象
      const fileObject = new File(
        [arrayBuffer], 
        filename, 
        { type: file.type }
      )
      
      console.log(`正在上传文件到 ${baseURL}...`)
      
      // 无论是DashScope还是OpenAI，都使用相同的文件上传API
      // 因为DashScope提供了兼容OpenAI的接口
      const uploadResponse = await client.files.create({
        file: fileObject,
        purpose: "file-extract"  // 使用OpenAI SDK支持的purpose值
      })
      
      // 从上传响应中获取文件ID
      fileId = uploadResponse.id
      console.log(`文件上传成功，获取到ID: ${fileId}`)
    } catch (uploadError: any) {
      console.error('文件上传失败:', uploadError)
      const errorMessage = uploadError.message || '未知错误'
      return NextResponse.json(
        { error: `文件上传失败: ${errorMessage}` },
        { status: 400 }
      )
    }

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