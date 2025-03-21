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
  endpoint = baseURL.endsWith('/chat/completions') ? baseURL : `${baseURL}/chat/completions`
  headers['Authorization'] = `Bearer ${config.apiKey}`
  
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
 * @param aiConfig 可选的AI模型配置
 * @param onContent 处理回复内容的回调函数
 * @returns 
 */
export async function streamingAICall(
  prompt: string,
  aiConfig: AIModelConfig,
  onContent: ((content: string) => void)
) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1秒
  let retryCount = 0;
  
  const makeRequest = async () => {
    try {
      // 如果未提供配置，尝试从store获取默认配置
      let finalConfig = aiConfig;
      
      if (!finalConfig) {
        const store = await import('../stores/ai-config-store');
        const defaultConfig = store.useAIConfigStore.getState().getConfig();
        
        if (!defaultConfig) {
          throw new Error('未找到AI模型配置，请先在设置中配置模型');
        }
        
        finalConfig = defaultConfig;
      }
      
      console.log('AI调用配置:', {
        model: finalConfig.model,
        baseURL: finalConfig.baseURL ? '已设置' : '未设置',
        apiKey: finalConfig.apiKey ? '已设置' : '未设置',
        temperature: finalConfig.temperature
      });

      // 使用统一的API路由处理请求
      const apiEndpoint = '/api/ai';
      console.log('使用API端点:', apiEndpoint);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000); // 5分钟超时

      // 使用我们的API路由代理请求
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          config: finalConfig
        })
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        console.error('API错误响应:', error);
        throw new Error(`API 请求失败 (${response.status}): ${error}`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // 按行处理数据
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个不完整的行
          
          for (const line of lines) {
            if (line.trim() === '') continue;
            
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                console.log('解析前的数据:', data);
                const parsed = JSON.parse(data);
                console.log('解析后的数据:', parsed);
                
                if (parsed.content) {
                  onContent(parsed.content);
                } else if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                console.error('解析响应数据失败:', e, data);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('AI service error:', error);
      
      // 对于某些错误类型进行重试
      if (retryCount < MAX_RETRIES && (
        error instanceof TypeError || // 网络错误
        (error instanceof Error && error.message.includes('timeout')) // 超时错误
      )) {
        retryCount++;
        console.log(`重试第 ${retryCount} 次...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
        return makeRequest();
      }
      
      throw error;
    }
  };

  return makeRequest();
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
      
      fullConfig = {
        ...defaultConfig,
        ...config
      };
    }
    
    // 检查是否是Google Gemini模型
    const isGemini = isGeminiModel(fullConfig.model)
    
    console.log('聊天调用配置:', {
      model: fullConfig.model,
      isGemini,
      baseURL: fullConfig.baseURL ? '已设置' : '未设置',
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
        baseURL: fullConfig.baseURL
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
      
      finalConfig = defaultConfig;
    }
    
    // 检查是否是Google Gemini模型
    const isGemini = isGeminiModel(finalConfig.model)
    
    console.log('文件AI调用配置:', {
      model: finalConfig.model,
      isGemini,
      baseURL: finalConfig.baseURL,
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