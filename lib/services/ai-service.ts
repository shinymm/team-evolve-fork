import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client';
import { decrypt } from '@/lib/utils/encryption-utils'

const prisma = new PrismaClient();

export interface AIModelConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  temperature?: number
  isDefault?: boolean
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
    return {
      endpoint: `${config.baseUrl}/models/${config.model}:streamGenerateContent`,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey
      }
    }
  }

  // 标准 OpenAI 兼容的 API
  let endpoint = config.baseUrl
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
 * 流式AI调用，自动处理配置
 * @param prompt 用户提示
 * @param config 可选的AI模型配置
 * @param onData 处理回复内容的回调函数
 * @param onError 处理错误信息的回调函数
 * @returns 
 */
export async function streamingAICall(
  prompt: string,
  config: AIModelConfig,
  onData: (content: string) => void,
  onError: (error: string) => void
) {
  try {
    // 解密 API Key
    const decryptedApiKey = await decrypt(config.apiKey)
    const configWithDecryptedKey = {
      id: config.id,
      name: config.name,
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: decryptedApiKey,
      temperature: config.temperature,
      isDefault: config.isDefault
    }

    console.log('发起 AI 调用:', {
      model: config.model,
      hasApiKey: !!decryptedApiKey
    })

    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        config: configWithDecryptedKey
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API 请求失败 (${response.status}): ${error}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const decoder = new TextDecoder()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.trim() === '') continue
        if (!line.startsWith('data: ')) continue

        try {
          const data = JSON.parse(line.slice(6))
          if (data.error) {
            onError(data.error)
            return
          }
          if (data.content) {
            // 构造与 OpenAI API 格式兼容的响应
            const formattedData = {
              choices: [{
                delta: { content: data.content }
              }]
            }
            onData(data.content)
          }
        } catch (e) {
          console.error('解析响应数据失败:', e)
        }
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    console.error('AI 调用错误:', errorMessage)
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
 */
export const callChatCompletion = async (
  messages: Message[],
  config?: ModelConfig
): Promise<string | null> => {
  try {
    // 如果未提供配置，尝试从store获取默认配置
    let fullConfig = config as AIModelConfig;
    
    if (!config || !config.model) {
      const store = await import('../stores/ai-config-store');
      const defaultConfig = store.useAIConfigStore.getState().getConfig();
      
      if (!defaultConfig) {
        throw new Error('未找到AI模型配置，请先在设置中配置模型');
      }
      
      // 解密apiKey
      fullConfig = {
        ...defaultConfig,
        ...config,
        apiKey: await decrypt(defaultConfig.apiKey)
      };
    } else if (fullConfig.apiKey) {
      // 如果提供了配置，也需要解密apiKey
      fullConfig = {
        ...fullConfig,
        apiKey: await decrypt(fullConfig.apiKey)
      };
    }
    
    // 检查是否是Google Gemini模型
    const isGemini = isGeminiModel(fullConfig.model)
    
    console.log('聊天调用配置:', {
      model: fullConfig.model,
      isGemini,
      baseURL: fullConfig.baseUrl ? '已设置' : '未设置',
      apiKey: fullConfig.apiKey ? '已设置' : '未设置',
      temperature: fullConfig.temperature
    })
    
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model: fullConfig.model,
        temperature: fullConfig.temperature,
        apiKey: fullConfig.apiKey,
        baseURL: fullConfig.baseUrl
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
 * @param params 调用参数
 * @returns Promise<void>
 */
export async function streamingFileAICall(params: {
  fileIds: string[]
  systemPrompt: string
  userPrompt: string
  onContent: (content: string) => void
  apiConfig?: AIModelConfig // 改为可选参数
}) {
  const { fileIds, systemPrompt, userPrompt, onContent } = params;
  let { apiConfig } = params;
  
  try {
    // 如果未提供配置，尝试从store获取默认配置
    let finalConfig = apiConfig;
    
    if (!finalConfig) {
      const store = await import('../stores/ai-config-store');
      const defaultConfig = store.useAIConfigStore.getState().getConfig();
      
      if (!defaultConfig) {
        throw new Error('未找到AI模型配置，请先在设置中配置模型');
      }
      
      // 解密apiKey
      finalConfig = {
        ...defaultConfig,
        apiKey: await decrypt(defaultConfig.apiKey)
      };
    } else if (finalConfig.apiKey) {
      // 如果提供了配置，也需要解密apiKey
      finalConfig = {
        ...finalConfig,
        apiKey: await decrypt(finalConfig.apiKey)
      };
    }
    
    // 检查是否是Google Gemini模型
    const isGemini = isGeminiModel(finalConfig.model)
    
    console.log('文件AI调用配置:', {
      model: finalConfig.model,
      isGemini,
      baseURL: finalConfig.baseUrl,
      apiKey: finalConfig.apiKey ? '已设置' : '未设置',
      temperature: finalConfig.temperature,
      fileIds
    })

    // 使用新的文件API路由处理文件请求
    // 首先需要获取文件内容
    const files = await Promise.all(
      fileIds.map(async (fileId) => {
        try {
          // 这里应该实现从服务器获取文件内容的逻辑
          // 在实际应用中，可能需要从数据库或存储中获取文件
          // 这里假设我们已经有了文件对象
          return { id: fileId, name: fileId, content: `文件内容 ${fileId}` };
        } catch (error) {
          console.error(`获取文件 ${fileId} 失败:`, error);
          throw error;
        }
      })
    );
    
    // 创建FormData对象
    const formData = new FormData();
    formData.append('systemPrompt', systemPrompt);
    formData.append('userPrompt', userPrompt);
    formData.append('config', JSON.stringify(finalConfig));
    
    // 添加文件
    for (const file of files) {
      // 这里需要将文件内容转换为Blob对象
      const blob = new Blob([file.content], { type: 'text/plain' });
      formData.append('files', blob, file.name);
    }
    
    // 发送请求到文件API路由
    const response = await fetch('/api/ai/file', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('API错误响应:', error);
      throw new Error(`API请求失败 (${response.status}): ${error}`);
    }
    
    if (!response.body) {
      throw new Error('响应中没有body');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk
        .split('\n')
        .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]');
      
      for (const line of lines) {
        if (line.includes('data: ')) {
          try {
            const data = JSON.parse(line.replace('data: ', ''));
            const content = data.content || '';
            if (content) {
              onContent(content);
            }
          } catch (e) {
            console.error('解析SSE消息错误:', e, line);
          }
        }
      }
    }
  } catch (error) {
    console.error('AI服务错误:', error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('网络请求失败，请检查：\n1. API地址是否正确\n2. 网络连接是否正常\n3. 是否存在跨域限制');
    }
    throw error;
  }
} 