import { NextRequest, NextResponse } from 'next/server'
import { AIModelConfig, getApiEndpointAndHeaders, isGeminiModel } from '@/lib/ai-service'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { messages, model, temperature, apiKey, baseURL } = await request.json()

    if (!messages || !model) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 从请求中获取API配置
    const apiConfig: AIModelConfig = {
      model,
      apiKey: apiKey || '',
      baseURL: baseURL || '',
      temperature
    }
    
    console.log('API配置:', {
      model: apiConfig.model,
      baseURL: apiConfig.baseURL ? '已设置' : '未设置',
      apiKey: apiConfig.apiKey ? '已设置' : '未设置',
      temperature: apiConfig.temperature
    })

    // 统一处理所有模型的请求
    return await handleRequest(messages, apiConfig, temperature)
  } catch (error) {
    console.error('API路由处理错误:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

// 统一处理所有模型的请求
async function handleRequest(messages: any[], apiConfig: AIModelConfig, temperature?: number) {
  // 检查是否是Google Gemini模型
  const isGemini = isGeminiModel(apiConfig.model)

  if (isGemini) {
    // 使用Google API处理请求
    return await handleGeminiRequest(messages, apiConfig, temperature)
  } else {
    // 使用标准OpenAI兼容API处理请求
    return await handleStandardRequest(messages, apiConfig, temperature)
  }
}

// 处理标准OpenAI兼容API请求
async function handleStandardRequest(messages: any[], apiConfig: AIModelConfig, temperature?: number) {
  try {
    // 获取API端点和请求头
    const { endpoint, headers } = getApiEndpointAndHeaders(apiConfig)
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: apiConfig.model,
        messages,
        temperature: temperature ?? apiConfig.temperature ?? 0.7,
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `API 请求失败 (${response.status}): ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    return NextResponse.json({ content })
  } catch (error) {
    console.error('处理标准请求时出错:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

// 处理Google Gemini API请求
async function handleGeminiRequest(messages: any[], apiConfig: AIModelConfig, temperature?: number) {
  try {
    console.log('Gemini API请求配置:', {
      model: apiConfig.model,
      apiKey: apiConfig.apiKey ? '已设置' : '未设置',
      temperature: temperature ?? apiConfig.temperature
    })
    
    // 使用Google的库初始化客户端
    const genAI = new GoogleGenerativeAI(apiConfig.apiKey)
    const model = genAI.getGenerativeModel({ model: apiConfig.model })
    
    // 转换消息格式以适应Google API
    const geminiContents = messages.map(msg => ({
      role: msg.role === 'system' || msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }))
    
    console.log('转换后的消息:', JSON.stringify(geminiContents, null, 2))
    
    // 如果设置了temperature，添加生成配置
    if (temperature !== undefined || apiConfig.temperature !== undefined) {
      model.generationConfig = { 
        temperature: temperature ?? apiConfig.temperature ?? 0.7 
      }
    }
    
    // 发送请求
    const result = await model.generateContent({
      contents: geminiContents
    })
    
    console.log('Gemini API响应:', result)
    
    // 从Gemini响应中提取文本内容
    const content = result.response.text()
    
    return NextResponse.json({ content })
  } catch (error) {
    console.error('处理Gemini请求时出错:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
} 