import { NextRequest, NextResponse } from 'next/server'
import { AIModelConfig, getApiEndpointAndHeaders, isGeminiModel } from '@/lib/ai-service'
import OpenAI from 'openai'
import { writeFile, readFile, stat, readdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { mkdir } from 'fs/promises'
import fs from 'fs'
import { Readable } from 'stream'
import { GoogleGenerativeAI, Part } from '@google/generative-ai'
import { GoogleAIFileManager } from '@google/generative-ai/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 设置最大执行时间为60秒，符合 Vercel hobby 计划限制

// 临时文件存储目录
const TEMP_DIR = join(process.cwd(), 'tmp')

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const fileIds = formData.getAll('fileIds') as string[]
    const systemPrompt = formData.get('systemPrompt') as string
    const userPrompt = formData.get('userPrompt') as string
    const configJson = formData.get('config') as string
    
    if ((!files.length && !fileIds.length) || !systemPrompt || !userPrompt || !configJson) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }
    
    const config = JSON.parse(configJson) as AIModelConfig
    
    // 检查是否是Google Gemini模型
    const isGemini = isGeminiModel(config.model)
    
    console.log('文件API配置:', {
      model: config.model,
      isGemini,
      baseURL: config.baseURL ? '已设置' : '未设置',
      apiKey: config.apiKey ? '已设置' : '未设置',
      temperature: config.temperature,
      files: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
      fileIds
    })
    
    // 创建一个新的响应流
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    
    // 确保临时目录存在
    await mkdir(TEMP_DIR, { recursive: true })
    
    // 处理文件：可能是新上传的文件，也可能是已经上传的文件ID
    let savedFiles: Array<{ id: string, name: string, path: string, type: string, size: number }> = []
    
    // 处理新上传的文件
    if (files.length > 0) {
      savedFiles = await Promise.all(
        files.map(async (file) => {
          const fileId = uuidv4()
          const filePath = join(TEMP_DIR, fileId)
          const arrayBuffer = await file.arrayBuffer()
          await writeFile(filePath, new Uint8Array(arrayBuffer))
          return {
            id: fileId,
            name: file.name,
            path: filePath,
            type: file.type,
            size: file.size
          }
        })
      )
    }
    
    // 处理已上传的文件ID
    if (fileIds.length > 0) {
      const existingFiles = await Promise.all(
        fileIds.map(async (fileId) => {
          const filePath = join(TEMP_DIR, fileId)
          
          // 检查文件是否存在
          try {
            const stats = await stat(filePath)
            
            // 尝试获取文件名和类型
            let fileName = fileId
            let fileType = 'application/octet-stream'
            
            // 根据文件扩展名推断MIME类型
            const dirFiles = await readdir(TEMP_DIR)
            const matchingFile = dirFiles.find(name => name === fileId || name.startsWith(fileId + '.'))
            
            if (matchingFile) {
              fileName = matchingFile
              const ext = matchingFile.split('.').pop()?.toLowerCase()
              if (ext === 'jpg' || ext === 'jpeg') fileType = 'image/jpeg'
              else if (ext === 'png') fileType = 'image/png'
              else if (ext === 'pdf') fileType = 'application/pdf'
              else if (ext === 'txt') fileType = 'text/plain'
              else if (ext === 'docx') fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            }
            
            return {
              id: fileId,
              name: fileName,
              path: filePath,
              type: fileType,
              size: stats.size
            } as { id: string, name: string, path: string, type: string, size: number }
          } catch (error) {
            console.error(`文件不存在或无法访问: ${filePath}`, error)
            return null
          }
        })
      )
      
      // 过滤掉不存在的文件
      const validFiles = existingFiles.filter((file): file is { id: string, name: string, path: string, type: string, size: number } => file !== null)
      savedFiles = [...savedFiles, ...validFiles]
    }
    
    if (savedFiles.length === 0) {
      return NextResponse.json(
        { error: '没有有效的文件' },
        { status: 400 }
      )
    }
    
    if (isGemini) {
      // 处理Google Gemini模型的文件请求
      handleGeminiFileStream(savedFiles, systemPrompt, userPrompt, config, writer)
    } else {
      // 处理标准OpenAI兼容API的文件请求
      handleStandardFileStream(savedFiles, systemPrompt, userPrompt, config, writer)
    }
    
    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    console.error('API路由处理错误:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

// 处理标准OpenAI兼容API的文件流式请求
async function handleStandardFileStream(
  files: Array<{ id: string, name: string, path: string, type: string, size: number }>,
  systemPrompt: string,
  userPrompt: string,
  config: AIModelConfig,
  writer: WritableStreamDefaultWriter
) {
  try {
    // 创建OpenAI客户端
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    })
    
    console.log('标准文件流式请求:', {
      baseURL: config.baseURL ? '已设置' : '未设置',
      model: config.model,
      temperature: config.temperature,
      files: files.length
    })
    
    // 上传文件到OpenAI
    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        try {
          // 创建一个可读流作为OpenAI API的输入
          const fileStream = fs.createReadStream(file.path)
          
          const uploadedFile = await client.files.create({
            file: fileStream,
            purpose: 'assistants'
          })
          return uploadedFile.id
        } catch (error) {
          console.error(`上传文件 ${file.name} 失败:`, error)
          throw error
        }
      })
    )
    
    // 获取文件内容
    const fileContents = await Promise.all(
      uploadedFiles.map(async (fileId) => {
        try {
          const fileContent = await client.files.retrieveContent(fileId)
          return fileContent
        } catch (error) {
          console.error(`获取文件 ${fileId} 内容失败:`, error)
          throw error
        }
      })
    )
    
    // 获取API端点和请求头
    const { endpoint, headers } = getApiEndpointAndHeaders(config)
    
    // 构建完整的用户提示，包含文件内容
    const fullUserPrompt = `${userPrompt}\n\n文件内容：\n${fileContents.join('\n---\n')}`
    
    // 发送请求到AI服务
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullUserPrompt }
        ],
        temperature: config.temperature ?? 0.7,
        stream: true
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('标准API错误响应:', errorText)
      writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: `API 请求失败 (${response.status}): ${errorText}` })}\n\n`))
      writer.close()
      return
    }
    
    const reader = response.body?.getReader()
    if (!reader) {
      writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: '无法读取响应流' })}\n\n`))
      writer.close()
      return
    }
    
    const decoder = new TextDecoder()
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim() !== '')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              if (content) {
                writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`))
              }
            } catch (e) {
              console.error('解析响应数据失败:', e, data)
            }
          }
        }
      }
    } catch (error) {
      console.error('处理流数据时出错:', error)
      writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: '处理响应流时出错' })}\n\n`))
    } finally {
      writer.close()
      
      // 清理上传的文件
      try {
        for (const fileId of uploadedFiles) {
          await client.files.del(fileId)
        }
      } catch (error) {
        console.error('清理文件时出错:', error)
      }
    }
  } catch (error) {
    console.error('请求AI服务时出错:', error)
    writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : '未知错误' })}\n\n`))
    writer.close()
  }
}

// 处理Google Gemini模型的文件流式请求
async function handleGeminiFileStream(
  files: Array<{ id: string, name: string, path: string, type: string, size: number }>,
  systemPrompt: string,
  userPrompt: string,
  config: AIModelConfig,
  writer: WritableStreamDefaultWriter
) {
  try {
    console.log('Gemini文件流式请求:', {
      model: config.model,
      apiKey: config.apiKey ? '已设置' : '未设置',
      temperature: config.temperature,
      files: files.length
    })
    
    // 初始化Google Generative AI客户端
    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({ model: config.model })
    
    // 准备内容数组
    const contents = []
    
    // 处理所有文件
    for (const file of files) {
      try {
        console.log(`处理文件: ${file.name}, 路径: ${file.path}`)
        
        // 读取文件内容
        const fileBuffer = await readFile(file.path)
        
        // 确定MIME类型
        let mimeType = file.type
        if (!mimeType || mimeType === 'application/octet-stream') {
          // 根据文件扩展名推断MIME类型
          const ext = file.name.split('.').pop()?.toLowerCase()
          if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
          else if (ext === 'png') mimeType = 'image/png'
          else if (ext === 'pdf') mimeType = 'application/pdf'
          else if (ext === 'txt') mimeType = 'text/plain'
          else if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          else mimeType = 'application/octet-stream'
        }
        
        // 添加文件到内容数组
        contents.push({
          inlineData: {
            data: fileBuffer.toString('base64'),
            mimeType
          }
        })
        
        console.log(`文件 ${file.name} 处理完成，MIME类型: ${mimeType}`)
      } catch (error) {
        console.error(`处理文件 ${file.name} 失败:`, error)
        throw error
      }
    }
    
    // 添加换行符
    contents.push("\n\n")
    
    // 添加系统提示和用户提示
    if (systemPrompt) {
      contents.push(systemPrompt + "\n\n")
    }
    
    contents.push(userPrompt)
    
    console.log('准备调用Gemini API，请求内容结构:', {
      model: config.model,
      contentsParts: contents.length,
      hasFiles: files.length > 0
    })
    
    // 生成内容
    try {
      console.log('调用generateContentStream...')
      
      // 按照示例代码的格式构建请求
      const result = await model.generateContentStream(contents)
      
      console.log('开始接收响应流...')
      
      // 处理流式响应
      for await (const chunk of result.stream) {
        const chunkText = chunk.text()
        if (chunkText) {
          writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ content: chunkText })}\n\n`))
        }
      }
      
      console.log('响应流处理完成')
    } catch (error) {
      console.error('调用Gemini API时出错:', error)
      writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: `调用Gemini API时出错: ${error instanceof Error ? error.message : '未知错误'}` })}\n\n`))
    } finally {
      writer.close()
    }
  } catch (error) {
    console.error('请求Gemini服务时出错:', error)
    writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : '未知错误' })}\n\n`))
    writer.close()
  }
} 