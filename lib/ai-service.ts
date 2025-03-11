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
}

export async function streamingAICall(
  prompt: string,
  config: AIModelConfig,
  onContent: (content: string) => void
) {
  try {
    console.log('Calling AI with config:', {
      baseURL: config.baseURL,
      model: config.model,
      temperature: config.temperature
    })

    // 使用我们的API路由代理请求
    const response = await fetch('/api/ai', {
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
      console.error('API error response:', error)
      throw new Error(`API 请求失败 (${response.status}): ${error}`)
    }

    if (response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        // console.log('Raw chunk:', chunk)  // 调试日志

        const lines = chunk.split('\n').filter(line => line.trim() !== '')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                onContent(parsed.content)
              } else if (parsed.error) {
                throw new Error(parsed.error)
              }
            } catch (e) {
              console.error('解析响应数据失败:', e)
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
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        ...config,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to call AI API')
    }

    const data = await response.json()
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
    console.log('开始处理文件，配置:', {
      baseURL: apiConfig.baseURL,
      model: apiConfig.model,
      temperature: apiConfig.temperature
    });

    // 创建OpenAI客户端
    const client = new OpenAI({
      apiKey: apiConfig.apiKey,
      baseURL: apiConfig.baseURL
    });

    // 获取文件内容
    const fileContents = await Promise.all(
      fileIds.map(async (fileId) => {
        try {
          const fileContent = await client.files.retrieveContent(fileId);
          return fileContent;
        } catch (error) {
          console.error(`获取文件 ${fileId} 内容失败:`, error);
          throw error;
        }
      })
    );

    // 移除末尾的斜杠
    const baseURL = apiConfig.baseURL.replace(/\/+$/, '');
    
    // 根据不同的 AI 服务提供商使用不同的 endpoint 和请求头
    let endpoint = '';
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (baseURL.includes('open.bigmodel.cn')) {
      // 智谱 AI
      endpoint = `${baseURL}/chat/completions`;
      headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
    } else if (baseURL.includes('openai.com')) {
      // OpenAI
      endpoint = `${baseURL}/chat/completions`;
      headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
    } else {
      // 其他服务，使用默认 endpoint
      endpoint = baseURL.endsWith('/chat/completions') ? baseURL : `${baseURL}/chat/completions`;
      headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
    }
    
    console.log('使用endpoint:', endpoint);
    
    // 构建完整的用户提示，包含文件内容
    const fullUserPrompt = `${userPrompt}\n\n文件内容：\n${fileContents.join('\n---\n')}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: apiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullUserPrompt }
        ],
        temperature: apiConfig.temperature ?? 0.7,
        stream: true
      }),
      cache: 'no-cache',
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
            const content = data.choices[0]?.delta?.content || '';
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