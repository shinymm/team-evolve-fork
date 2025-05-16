import { NextRequest, NextResponse } from 'next/server'
import * as yaml from 'js-yaml'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: '未找到文件' }, { status: 400 })
    }

    const text = await file.text()
    const exceptions = parseExceptions(text)
    const yamlResult = yaml.dump(exceptions)
    
    return new NextResponse(yamlResult, {
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  } catch (error) {
    console.error('Error processing file:', error)
    return NextResponse.json({ error: '处理文件时出错' }, { status: 500 })
  }
}

interface Exception {
  request: string
  error: string
  stackTrace: string[]
}

function parseExceptions(text: string): Exception[] {
  // 以"全局错误"为分隔符分割文本
  const blocks = text.split('全局错误::').filter(Boolean)
  const exceptions: Exception[] = []
  
  // 只处理前150个异常
  const maxExceptions = Math.min(blocks.length, 150)
  
  for (let i = 0; i < maxExceptions; i++) {
    const block = blocks[i].trim()
    const lines = block.split('\n')
    
    // 第一行包含请求信息
    const requestLine = lines[0].trim()
    
    // 解析异常信息
    const exceptionLines = lines.slice(1)
    const errorMessage = exceptionLines[0]?.replace('exception::', '').trim() || ''
    const stackTrace = exceptionLines.slice(1).map(line => line.trim()).filter(Boolean)
    
    exceptions.push({
      request: requestLine,
      error: errorMessage,
      stackTrace: stackTrace
    })
  }
  
  return exceptions
} 