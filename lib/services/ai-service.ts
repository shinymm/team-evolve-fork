import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client';
import { decrypt } from '@/lib/utils/encryption-utils'
import { join } from 'path'
import { readFile } from 'fs/promises'

const prisma = new PrismaClient();

export interface AIModelConfig {
  id: string
  name: string
  baseURL: string
  apiKey: string
  model: string
  description?: string
  temperature?: number
  isDefault?: boolean
  type?: string // 模型类型："language" 或 "vision"
  createdAt?: string
  updatedAt?: string
}

export interface ModelConfig {
  model: string
  temperature?: number
  apiKey?: string
  baseURL?: string
}

/**
 * 获取API端点和请求头
 * @param config AI模型配置
 * @returns 包含endpoint和headers的对象
 */
export function getApiEndpointAndHeaders(config: AIModelConfig) {


  // 检查是否是 Gemini 模型
  if (isGeminiModel(config.model)) {
    console.log('使用Gemini配置:', {
      endpoint: `${config.baseURL}/models/${config.model}:streamGenerateContent`,
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey?.length || 0
    })
    return {
      endpoint: `${config.baseURL}/models/${config.model}:streamGenerateContent`,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey
      }
    }
  }

  // 标准 OpenAI 兼容的 API
  let endpoint = config.baseURL
  if (!endpoint.endsWith('/chat/completions')) {
    // 移除尾部的斜杠（如果有）
    endpoint = endpoint.replace(/\/+$/, '')
    // 添加 chat/completions 路径
    endpoint = `${endpoint}/chat/completions`
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  }
  
  return { endpoint, headers }
}

/**
 * 检查是否是Google Gemini模型
 * @param modelName 模型名称
 * @returns 是否是Google Gemini模型
 */
export function isGeminiModel(modelName: string): boolean {
  return modelName.toLowerCase().startsWith('gemini')
}

/**
 * 流式AI调用
 * @param prompt 用户提示
 * @param onData 处理回复内容的回调函数
 * @param onError 处理错误信息的回调函数
 */
export async function streamingAICall(
  prompt: string,
  onData: (content: string) => void,
  onError: (error: string) => void
) {
  try {

    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    })

    console.log('🔄 [streamingAICall] 收到响应:', {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API 请求失败 (${response.status}): ${error}`)
    }

    if (!response.body) {
      throw new Error('响应中没有数据流')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    
    console.log('🔄 [streamingAICall] 准备读取数据流')
    let buffer = ''
    let counter = 0
    
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        console.log('🔄 [streamingAICall] 数据流读取完成')
        break
      }

      counter++
      const chunk = decoder.decode(value)
      buffer += chunk

      // 按行分割并处理
      const lines = buffer.split('\n')
      // 保留最后一行（可能不完整）
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine || trimmedLine === 'data: [DONE]') {
          continue
        }

        if (trimmedLine.startsWith('data: ')) {
          try {
            const jsonStr = trimmedLine.slice(6)
            const data = JSON.parse(jsonStr)

            if (data.error) {
              console.error('🔄 [streamingAICall] 收到错误:', data.error)
              onError(data.error)
              continue
            }

            const content = data.choices?.[0]?.delta?.content
            if (content) {
              onData(content)
            }
          } catch (e) {
            console.error('🔄 [streamingAICall] 解析JSON失败:', e)
            console.error('🔄 [streamingAICall] 问题行:', trimmedLine)
          }
        } else {
          console.log('🔄 [streamingAICall] 跳过非data行:', trimmedLine)
        }
      }
    }
  } catch (error: unknown) {
    console.error('🔄 [streamingAICall] 发生错误:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    onError(errorMessage)
  }
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 聊天完成调用
 * @param messages 消息数组
 * @param config 可选的模型配置，如果不提供则使用默认配置
 * @returns 聊天响应文本或null（如果出错）
 * @deprecated config参数已弃用，将使用Redis中的默认配置
 */
export const callChatCompletion = async (
  messages: Message[],
  config?: ModelConfig
): Promise<string | null> => {
  try {
    console.log('聊天调用请求:', {
      messagesCount: messages.length,
      configProvided: !!config
    })
    
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('聊天API错误响应:', errorText)
      throw new Error(`聊天API请求失败 (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    console.log('聊天API响应:', data)
    return data.content
  } catch (error) {
    console.error('Error calling AI API:', error)
    return null
  }
}

/**
 * 处理文件的流式AI调用
 * 处理文件的流式AI调用
 * @param params 调用参数
 * @returns Promise<void>
 */
export async function streamingFileAICall(params: {
  fileIds: string[]
  systemPrompt: string
  userPrompt: string
  onContent: (content: string) => void
  apiConfig?: AIModelConfig
}) {
  const { fileIds, systemPrompt, userPrompt, onContent, apiConfig } = params;
  
  try {
    console.log(`🔄 开始执行文件AI调用，文件数: ${fileIds.length}`);
    
    // 创建FormData对象
    const formData = new FormData()
    formData.append('systemPrompt', systemPrompt)
    formData.append('userPrompt', userPrompt)
    
    // 如果提供了配置，则添加到请求中
    if (apiConfig) {
      formData.append('config', JSON.stringify(apiConfig))
    }
    
    // 添加文件ID
    fileIds.forEach(fileId => {
      formData.append('fileIds', fileId)
    });
    
    // 发送请求到后端
    const response = await fetch('/api/ai/file', {
      method: 'POST',
      body: formData,
      // 确保不缓存
      cache: 'no-store'
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`🔄 API响应错误:`, error);
      throw new Error(`API请求失败 (${response.status}): ${error}`);
    }

    if (!response.body) {
      throw new Error('响应中没有body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    console.log(`🔄 开始读取流式数据...`);
    
    // 简化的流处理逻辑
    let counter = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log(`🔄 流读取完成，共处理 ${counter} 个数据块`);
        break;
      }

      counter++;
      const chunk = decoder.decode(value);
      
      // 处理接收到的数据块
      const lines = chunk
        .split('\n')
        .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]');

      for (const line of lines) {
        if (line.includes('data: ')) {
          try {
            const jsonStr = line.replace('data: ', '');
            const data = JSON.parse(jsonStr);
            
            // 直接处理错误
            if (data.error) {
              console.error(`🔄 收到错误:`, data.error);
              onContent(`\n\n[错误] ${data.error}`);
              continue;
            }
            
            // 提取并直接发送内容 - 不做任何缓存或延迟处理
            if (data.content) {
              console.log(`🔄 立即处理内容块 #${counter}，长度: ${data.content.length}字符`);
              // 直接调用回调，立即传递内容
              onContent(data.content);
            }
          } catch (e) {
            console.error(`🔄 解析数据出错:`, e);
          }
        }
      }
    }
    
    console.log(`🔄 文件AI调用完成`);
  } catch (error) {
    console.error(`🔄 AI服务错误:`, error);
    
    // 向前端发送错误消息
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    onContent(`\n\n[错误] ${errorMessage}`);
    
    throw error;
  }
} 