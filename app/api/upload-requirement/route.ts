import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import type { AIModelConfig } from '@/lib/ai-service'
import OpenAI from 'openai'
import { isGeminiModel } from '@/lib/ai-service'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import fs from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAIFileManager } from '@google/generative-ai/server'
import { unlink } from 'fs/promises'

/**
 * 注意：在服务器端API路由中无法使用localStorage，
 * 这是因为localStorage只在浏览器环境中可用。
 * 必须从前端传递所需的配置参数（apiKey和baseURL）。
 */

// 临时文件存储目录
const TEMP_DIR = join(process.cwd(), 'tmp')

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
      'image/gif', // gif
      'image/webp' // webp
    ]
    
    // 检查文件扩展名作为备选验证方式
    const fileExtension = filename.split('.').pop()?.toLowerCase()
    const validExtensions = ['docx', 'txt', 'pdf', 'xlsx', 'md', 'jpg', 'jpeg', 'png', 'gif', 'webp']
    
    // 检查文件类型是否有效
    const isValidType = validTypes.some(type => file.type.includes(type))
    const isValidExtension = validExtensions.includes(fileExtension || '')
    
    if (!isValidType && !isValidExtension) {
      return NextResponse.json(
        { error: '不支持的文件格式，请上传 Word、TXT、PDF、Excel、Markdown 或图片文件' },
        { status: 400 }
      )
    }

    // 从请求中获取AI配置
    const apiKey = formData.get('apiKey') as string
    const baseURL = formData.get('baseURL') as string
    const model = formData.get('model') as string || 'gpt-4'
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API密钥不能为空，请检查配置' },
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
    
    console.log(`上传文件: ${filename}, 大小: ${file.size} 字节, 类型: ${file.type}, 模型: ${model}`)
    
    // 检查是否是Google Gemini模型
    const isGemini = isGeminiModel(model)
    
    let fileId
    
    if (isGemini) {
      // 对于Gemini模型，严格按照JavaScript示例代码实现
      try {
        console.log(`处理Gemini文件: ${filename}, 大小: ${file.size} 字节, 类型: ${file.type}`);
        
        // 1. 创建文件管理器
        const fileManager = new GoogleAIFileManager(apiKey);
        
        // 2. 准备文件 - 需要先保存为临时文件，因为API只接受文件路径
        const arrayBuffer = await file.arrayBuffer();
        const fileBytes = new Uint8Array(arrayBuffer);
        
        // 确保临时目录存在
        await mkdir(TEMP_DIR, { recursive: true });
        
        // 创建临时文件
        const tempFilePath = join(TEMP_DIR, filename);
        await writeFile(tempFilePath, fileBytes);

        // 3. 上传文件到Gemini服务
        console.log(`开始上传文件到Gemini服务: ${tempFilePath}`);
        const uploadResponse = await fileManager.uploadFile(tempFilePath, {
          mimeType: file.type || 'application/octet-stream',
          displayName: filename
        });

        if (!uploadResponse || !uploadResponse.file) {
          throw new Error('文件上传失败：未获取到file对象');
        }

        fileId = uploadResponse.file.name;
        console.log(`文件上传成功，fileId: ${fileId}`);

        // 4. 清理临时文件
        try {
          await unlink(tempFilePath);
          console.log(`临时文件已删除: ${tempFilePath}`);
        } catch (cleanupError) {
          console.error(`清理临时文件失败: ${cleanupError}`);
          // 继续执行，不中断流程
        }

        return NextResponse.json({
          success: true,
          file: {
            id: uploadResponse.file.name,
            name: filename,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString(),
            provider: 'gemini',
            uri: uploadResponse.file.uri
          }
        });
      } catch (error) {
        console.error('Gemini文件上传失败:', error);
        return NextResponse.json(
          { error: `文件上传失败: ${error instanceof Error ? error.message : '未知错误'}` },
          { status: 500 }
        );
      }
    } else {
      // 对于OpenAI兼容的API，使用标准的文件上传流程
      try {
        // 创建OpenAI客户端，用于与兼容的API交互
        const client = new OpenAI({
          apiKey: apiKey,
          baseURL: baseURL
        })
        
        // 将文件内容转换为Buffer，以便上传
        const arrayBuffer = await file.arrayBuffer()
        const buffer = new Uint8Array(arrayBuffer)
        
        // 创建一个符合OpenAI格式要求的文件对象
        const fileObject = new File(
          [buffer], 
          filename, 
          { type: file.type }
        )
        
        console.log(`正在上传文件到 ${baseURL}...`)
        
        // 上传文件到AI服务
        const uploadResponse = await client.files.create({
          file: fileObject,
          purpose: "file-extract" as any  // 使用类型断言绕过类型检查
        })
        
        // 从上传响应中获取文件ID
        fileId = uploadResponse.id
        console.log(`文件上传成功，获取到ID: ${fileId}`)
        
        return NextResponse.json({
          success: true,
          id: fileId,
          message: `文件 ${filename} 上传成功`,
          file: {
            id: fileId,
            name: filename,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString(),
            provider: 'openai'
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
    }
  } catch (error) {
    console.error('处理文件上传出错:', error)
    return NextResponse.json(
      { error: `上传处理失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    )
  }
} 