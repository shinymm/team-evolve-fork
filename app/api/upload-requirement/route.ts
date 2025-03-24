import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/utils/encryption-utils'
import OpenAI from 'openai'

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
      'text/x-markdown', // md (别名)
      'image/jpeg', // jpg/jpeg
      'image/png', // png
      'image/gif'// gif
    ]
    
    // 检查文件扩展名作为备选验证方式
    const fileExtension = filename.split('.').pop()?.toLowerCase()
    const validExtensions = ['docx', 'txt', 'pdf', 'xlsx', 'md', 'jpg', 'jpeg', 'png', 'gif']
    
    // 检查文件类型是否有效
    const isValidType = validTypes.some(type => file.type.includes(type))
    const isValidExtension = validExtensions.includes(fileExtension || '')
    
    if (!isValidType && !isValidExtension) {
      return NextResponse.json(
        { error: '不支持的文件格式，请上传 Word、TXT、PDF、Excel、Markdown 或图片文件' },
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

    // 从 Redis 获取默认配置
    const { getDefaultConfigFromRedis } = await import('@/lib/utils/ai-config-redis')
    const config = await getDefaultConfigFromRedis()
    
    if (!config || !config.apiKey) {
      return NextResponse.json(
        { error: '未找到有效的AI模型配置，请先在设置中配置模型' },
        { status: 404 }
      )
    }
    
    try {
      // 只在这里解密 API Key
      const decryptedApiKey = await decrypt(config.apiKey)
      
      // 初始化 OpenAI 客户端
      const openai = new OpenAI({
        apiKey: decryptedApiKey,
        baseURL: config.baseURL
      })
      
      // 使用 OpenAI 兼容的 API 上传文件
      const response = await openai.files.create({
        file,
        purpose: 'file-extract' as unknown as OpenAI.FilePurpose
      })
      
      // 返回文件信息
      return NextResponse.json({
        success: true,
        message: `文件 ${filename} 上传成功`,
        file: {
          id: response.id,
          name: filename,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
          provider: 'dashscope'
        }
      })
    } catch (uploadError: any) {
      console.error('文件上传失败:', uploadError)
      const errorMessage = uploadError.message || '未知错误'
      return NextResponse.json(
        { error: `文件上传失败: ${errorMessage}` },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('处理文件上传出错:', error)
    return NextResponse.json(
      { error: `上传处理失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    )
  }
} 

