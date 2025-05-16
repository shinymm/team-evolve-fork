import { NextResponse } from 'next/server'
import * as yaml from 'js-yaml'

// 解析异常函数
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

// 提供示例日志文件
export async function GET() {
  try {
    // 示例日志内容
    const sampleLogContent = `全局错误::/api/users/profile
exception::TypeError: Cannot read properties of undefined (reading 'id')
    at getUserProfile (/app/api/users/profile/route.ts:15:23)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async handler (/node_modules/next/dist/server/api-utils/index.js:176:28)

全局错误::/api/data/fetch
exception::Error: Database connection failed
    at connectToDatabase (/app/lib/db.ts:45:11)
    at fetchData (/app/api/data/fetch/route.ts:8:27)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)

全局错误::/api/auth/login
exception::AuthError: Invalid credentials
    at validateUser (/app/lib/auth.ts:78:9)
    at loginUser (/app/api/auth/login/route.ts:23:19)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)

全局错误::/api/products/search
exception::TypeError: items.filter is not a function
    at searchProducts (/app/api/products/search/route.ts:31:22)
    at handler (/app/api/products/search/route.ts:12:35)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`

    const exceptions = parseExceptions(sampleLogContent)
    const yamlResult = yaml.dump(exceptions)
    
    return new NextResponse(yamlResult, {
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  } catch (error) {
    console.error('Error providing example log:', error)
    return NextResponse.json({ error: '提供示例日志时出错' }, { status: 500 })
  }
} 