import OpenAI from 'openai'

export interface AIModelConfig {
  model: string        // 模型名称
  apiKey: string      // API密钥
  baseURL: string     // API基础URL
  temperature?: number // 温度参数
  id?: string         // 配置项ID（仅用于UI管理）
  name?: string       // 配置项显示名称（仅用于UI管理）
  isDefault?: boolean // 是否为默认配置（仅用于UI管理）
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
export function getApiEndpointAndHeaders(config: AIModelConfig): { endpoint: string, headers: Record<string, string> } {
  // 移除末尾的斜杠
  const baseURL = config.baseURL.replace(/\/+$/, '')
  
  // 根据不同的 AI 服务提供商使用不同的 endpoint 和请求头
  let endpoint = ''
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (baseURL.includes('open.bigmodel.cn')) {
    // 智谱 AI
    endpoint = `${baseURL}/chat/completions`
    headers['Authorization'] = `Bearer ${config.apiKey}`
  } else if (baseURL.includes('openai.com')) {
    // OpenAI
    endpoint = `${baseURL}/chat/completions`
    headers['Authorization'] = `Bearer ${config.apiKey}`
  } else {
    // 其他服务，使用默认 endpoint
    endpoint = baseURL.endsWith('/chat/completions') ? baseURL : `${baseURL}/chat/completions`
    headers['Authorization'] = `Bearer ${config.apiKey}`
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

export async function streamingAICall(
  prompt: string,
  config: AIModelConfig,
  onContent: (content: string) => void
) {
  try {
    console.log('AI调用配置:', {
      model: config.model,
      baseURL: config.baseURL,
      apiKey: config.apiKey ? '已设置' : '未设置',
      temperature: config.temperature
    })
    
    // 使用统一的API路由处理请求
    const apiEndpoint = '/api/ai'
    console.log('使用API端点:', apiEndpoint)

    // 使用我们的API路由代理请求
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        config
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('API错误响应:', error)
      throw new Error(`API 请求失败 (${response.status}): ${error}`)
    }

    if (response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        console.log('原始响应块:', chunk)  // 调试日志

        const lines = chunk.split('\n').filter(line => line.trim() !== '')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              console.log('解析前的数据:', data)  // 调试日志
              const parsed = JSON.parse(data)
              console.log('解析后的数据:', parsed)  // 调试日志
              
              if (parsed.content) {
                onContent(parsed.content)
              } else if (parsed.error) {
                throw new Error(parsed.error)
              }
            } catch (e) {
              console.error('解析响应数据失败:', e, data)
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('AI service error:', error)
    throw error
  }
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export const callChatCompletion = async (
  messages: Message[],
  config: ModelConfig
): Promise<string | null> => {
  try {
    // 检查是否是Google Gemini模型
    const isGemini = isGeminiModel(config.model)
    
    console.log('聊天调用配置:', {
      model: config.model,
      isGemini,
      baseURL: config.baseURL ? '已设置' : '未设置',
      apiKey: config.apiKey ? '已设置' : '未设置',
      temperature: config.temperature
    })
    
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model: config.model,
        temperature: config.temperature,
        apiKey: config.apiKey,
        baseURL: config.baseURL
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
  apiConfig: AIModelConfig
  onContent: (content: string) => void
}) {
  const { fileIds, systemPrompt, userPrompt, apiConfig, onContent } = params;
  
  try {
    // 检查是否是Google Gemini模型
    const isGemini = isGeminiModel(apiConfig.model)
    
    console.log('文件AI调用配置:', {
      model: apiConfig.model,
      isGemini,
      baseURL: apiConfig.baseURL,
      apiKey: apiConfig.apiKey ? '已设置' : '未设置',
      temperature: apiConfig.temperature,
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
    formData.append('config', JSON.stringify(apiConfig));
    
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