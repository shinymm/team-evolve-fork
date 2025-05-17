/**
 * 编辑器动作服务 - 处理TiptapEditor中的AI辅助功能API调用
 */

interface StreamResponse {
  content: string;
  error?: string;
}

/**
 * 处理流式响应的通用方法
 */
async function processStream(
  response: Response, 
  contentKey: string,
  onChunk: (content: string) => void,
  onError: (error: string) => void
): Promise<string> {
  if (!response.body) {
    throw new Error('未收到流式响应');
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let resultText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      
      // 尝试解析JSON
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data[contentKey]) {
            resultText += data[contentKey];
            onChunk(resultText);
          } else if (data.error) {
            onError(data.error);
            throw new Error(data.error);
          }
        } catch (lineError) {
          if (lineError instanceof Error && lineError.message !== "Unexpected end of JSON input") {
            console.error('JSON解析错误:', lineError);
          }
        }
      }
    }
    
    return resultText;
  } catch (error) {
    console.error('处理流失败:', error);
    throw error;
  }
}

/**
 * 润色文本API
 */
export async function polishText(
  text: string,
  fullText: string,
  systemId: string | null,
  onProgress: (content: string) => void,
  onError: (error: string) => void
): Promise<string> {
  try {
    const response = await fetch('/api/ai-editor-action/polish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text,
        fullText,
        systemId
      })
    });

    if (!response.ok) {
      throw new Error('润色API调用失败');
    }

    return await processStream(response, 'polishedText', onProgress, onError);
  } catch (error) {
    const errorMessage = `润色请求失败: ${error instanceof Error ? error.message : '未知错误'}`;
    onError(errorMessage);
    throw error;
  }
}

/**
 * 扩写文本API
 */
export async function expandText(
  text: string,
  fullText: string,
  systemId: string | null,
  onProgress: (content: string) => void,
  onError: (error: string) => void
): Promise<string> {
  try {
    const response = await fetch('/api/ai-editor-action/expand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text,
        fullText,
        systemId
      })
    });

    if (!response.ok) {
      throw new Error('扩写API调用失败');
    }

    return await processStream(response, 'expandedText', onProgress, onError);
  } catch (error) {
    const errorMessage = `扩写请求失败: ${error instanceof Error ? error.message : '未知错误'}`;
    onError(errorMessage);
    throw error;
  }
}

/**
 * 边界分析API
 */
export async function analyzeBoundary(
  text: string,
  fullText: string,
  systemId: string | null,
  onProgress: (content: string) => void,
  onError: (error: string) => void
): Promise<string> {
  try {
    const response = await fetch('/api/ai-editor-action/boundary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text,
        fullText,
        systemId
      })
    });

    if (!response.ok) {
      throw new Error('边界分析API调用失败');
    }

    return await processStream(response, 'boundaryAnalysis', onProgress, onError);
  } catch (error) {
    const errorMessage = `边界分析请求失败: ${error instanceof Error ? error.message : '未知错误'}`;
    onError(errorMessage);
    throw error;
  }
}

/**
 * 边界优化API
 */
export async function optimizeBoundary(
  text: string,
  fullText: string,
  systemId: string | null,
  onProgress: (content: string) => void,
  onError: (error: string) => void
): Promise<string> {
  try {
    const response = await fetch('/api/ai-editor-action/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text,
        fullText,
        systemId
      })
    });

    if (!response.ok) {
      throw new Error('边界优化API调用失败');
    }

    return await processStream(response, 'optimizedText', onProgress, onError);
  } catch (error) {
    const errorMessage = `边界优化请求失败: ${error instanceof Error ? error.message : '未知错误'}`;
    onError(errorMessage);
    throw error;
  }
}

/**
 * AI聊天API
 */
export async function chatWithAI(
  instruction: string,
  selectedText: string,
  systemId: string | null,
  onProgress: (content: string) => void,
  onError: (error: string) => void
): Promise<string> {
  try {
    // 准备发送到API的数据
    const prompt = `用户指令: ${instruction}\n\n选中的文本内容:\n${selectedText}`;

    const response = await fetch('/api/ai-editor-action/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt,
        systemId
      })
    });

    if (!response.ok) {
      throw new Error('AI对话API调用失败');
    }

    return await processStream(response, 'result', onProgress, onError);
  } catch (error) {
    const errorMessage = `对话请求失败: ${error instanceof Error ? error.message : '未知错误'}`;
    onError(errorMessage);
    throw error;
  }
} 