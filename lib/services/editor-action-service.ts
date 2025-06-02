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
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      // 记录原始数据，帮助调试
      console.log('🔍 [processStream] 接收到原始数据:', buffer);
      
      // 按行处理数据
      const lines = buffer.split('\n').filter(line => line.trim() !== '');
      // 保留最后一行（可能不完整）作为新的buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        try {
          // 尝试处理数据行
          let data;
          
          // 检查是否为SSE格式（data: 前缀）
          if (line.startsWith('data:')) {
            const jsonStr = line.substring(5).trim();
            // 跳过空data行
            if (!jsonStr || jsonStr === '[DONE]') continue;
            
            try {
              data = JSON.parse(jsonStr);
            } catch (parseError) {
              console.warn('SSE格式JSON解析错误，尝试容错处理:', parseError);
              console.log('问题数据:', jsonStr);
              // 继续处理下一行，不中断流程
              continue;
            }
          } else {
            // 非SSE格式，直接尝试解析整行
            try {
              data = JSON.parse(line);
            } catch (parseError) {
              console.warn('非SSE格式JSON解析错误:', parseError);
              console.log('问题数据:', line);
              // 继续处理下一行，不中断流程
              continue;
            }
          }
          
          // 成功解析数据后处理内容
          if (data && data[contentKey]) {
            resultText += data[contentKey];
            onChunk(resultText);
          } else if (data && data.error) {
            onError(data.error);
            console.error('API返回错误:', data.error);
          }
        } catch (lineError) {
          // 捕获所有可能的错误，但不中断处理
          console.warn('处理数据行时出错:', lineError);
          console.log('问题行数据:', line);
        }
      }
    }
    
    // 处理可能残留在buffer中的数据
    if (buffer.trim()) {
      try {
        if (buffer.startsWith('data:')) {
          const jsonStr = buffer.substring(5).trim();
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const data = JSON.parse(jsonStr);
              if (data[contentKey]) {
                resultText += data[contentKey];
                onChunk(resultText);
              }
            } catch (e) {
              console.warn('处理残留buffer时JSON解析错误:', e);
            }
          }
        } else {
          try {
            const data = JSON.parse(buffer);
            if (data[contentKey]) {
              resultText += data[contentKey];
              onChunk(resultText);
            }
          } catch (e) {
            console.warn('处理非SSE残留buffer时JSON解析错误:', e);
          }
        }
      } catch (bufferError) {
        console.warn('处理剩余buffer时出错:', bufferError);
      }
    }
    
    return resultText;
  } catch (error) {
    console.error('处理流失败:', error);
    throw error;
  }
}

/**
 * 处理推理模型的流式响应，同时处理思考过程和最终结果
 */
async function processReasoningStream(
  response: Response,
  onContent: (content: string) => void,
  onReasoning: (reasoning: string) => void,
  onError: (error: string) => void
): Promise<{content: string, reasoning: string}> {
  if (!response.body) {
    throw new Error('未收到流式响应');
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let reasoning = '';
  let buffer = '';

  try {
    console.log("🔄 [processReasoningStream] 开始处理推理流");
    let hasReceivedFinalContent = false;
    
    // 立即发送初始状态，让用户看到思考中...
    onReasoning("正在思考中...");

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("✅ [processReasoningStream] 流读取完成");
        break;
      }
      
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
           
      // 按行处理SSE数据
      const lines = buffer.split('\n');
      // 保留最后一行（可能不完整）作为新的buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        // 忽略空行
        if (!line.trim()) continue;
        
        // 忽略注释行
        if (line.startsWith(':')) continue;
        
        // 处理[DONE]标记
        if (line.includes('[DONE]')) {
          console.log('🏁 [processReasoningStream] 流传输完成: [DONE]标记');
          continue;
        }
        
        // 处理data:前缀的行
        if (line.startsWith('data:')) {
          const jsonStr = line.substring(5).trim();
          
          // 跳过空data行
          if (!jsonStr) continue;
          
          try {
            const data = JSON.parse(jsonStr);
            
            // 处理来自API的reasoning_content字段 - 直接格式
            if (data.reasoning_content) {
              reasoning = data.reasoning_content;
              console.log(`🧠 [processReasoningStream] 收到推理过程(直接格式): ${reasoning.length} 字符`);
              // 立即传递思考过程
              onReasoning(reasoning);
            }
            
            // 处理来自API的content字段 - 直接格式
            if (data.content) {
              content = data.content;
              hasReceivedFinalContent = true;
              onContent(content);
            }
            
            // 处理Deepseek Reasoner特定的格式
            if (data.choices && data.choices[0] && data.choices[0].delta) {
              const delta = data.choices[0].delta;
              
              // 处理delta.reasoning_content（推理过程）
              if (delta.reasoning_content) {
                reasoning += delta.reasoning_content;
                console.log(`🧠 [processReasoningStream] 收到delta推理更新: +${delta.reasoning_content.length} 字符`);
                // 有任何更新都立即传递出去
                onReasoning(reasoning);
              }
              
              // 处理delta.content（最终答案）
              if (delta.content) {
                content += delta.content;
                console.log(`📝 [processReasoningStream] 收到delta内容更新: +${delta.content.length} 字符`);
                hasReceivedFinalContent = true;
                onContent(content);
              }
            }
            
            if (data.error) {
              onError(data.error);
              console.error("🚫 [processReasoningStream] 接收到错误:", data.error);
              throw new Error(data.error);
            }
          } catch (parseError) {
            console.error('JSON解析错误:', parseError, '原始数据:', jsonStr);
            // 不抛出错误，继续处理后续数据
          }
        } else if (line.trim()) {
          // 尝试解析非data:开头但非空的行
          try {
            console.log("🔍 [processReasoningStream] 尝试解析非标准行:", line);
            const data = JSON.parse(line);
            
            // 处理各种可能的数据格式
            if (data.content) {
              content = data.content;
              console.log(`📝 [processReasoningStream] 收到非标准内容: ${content.length} 字符`);
              hasReceivedFinalContent = true;
              onContent(content);
            }
            
            if (data.reasoning_content) {
              reasoning = data.reasoning_content;
              console.log(`🧠 [processReasoningStream] 收到非标准推理过程: ${reasoning.length} 字符`);
              onReasoning(reasoning);
            }
            
            // 处理Deepseek格式
            if (data.choices && data.choices[0] && data.choices[0].delta) {
              const delta = data.choices[0].delta;
              console.log(`🔄 [processReasoningStream] 非标准行中检测到Deepseek格式:`, delta);
              if (delta.content) {
                content += delta.content;
                console.log(`📝 [processReasoningStream] 收到非标准delta内容: +${delta.content.length} 字符`);
                hasReceivedFinalContent = true;
                onContent(content);
              }
              if (delta.reasoning_content) {
                reasoning += delta.reasoning_content;
                console.log(`🧠 [processReasoningStream] 收到非标准delta推理: +${delta.reasoning_content.length} 字符`);
                onReasoning(reasoning);
              }
            }
            
            if (data.error) {
              onError(data.error);
              console.error("🚫 [processReasoningStream] 接收到非标准错误:", data.error);
              throw new Error(data.error);
            }
          } catch (parseError) {
            console.error('非标准格式JSON解析错误:', parseError, '原始数据:', line);
            // 继续处理后续数据
          }
        }
      }
    }
    
    // 处理buffer中剩余的数据
    if (buffer.trim()) {
      try {
        if (buffer.startsWith('data:')) {
          const jsonStr = buffer.substring(5).trim();
          if (jsonStr && !jsonStr.includes('[DONE]')) {
            const data = JSON.parse(jsonStr);
            
            if (data.content) {
              content = data.content;
              hasReceivedFinalContent = true;
              onContent(content);
            }
            
            if (data.reasoning_content) {
              reasoning = data.reasoning_content;
              onReasoning(reasoning);
            }
            
            // 处理Deepseek格式
            if (data.choices && data.choices[0] && data.choices[0].delta) {
              const delta = data.choices[0].delta;
              if (delta.content) {
                content += delta.content;
                hasReceivedFinalContent = true;
                onContent(content);
              }
              if (delta.reasoning_content) {
                reasoning += delta.reasoning_content;
                onReasoning(reasoning);
              }
            }
          }
        }
      } catch (parseError) {
        console.error('处理剩余数据时出错:', parseError);
      }
    }
    
    // 如果没有收到最终内容但有推理过程，使用推理过程作为最终内容
    if (!hasReceivedFinalContent && reasoning) {
      console.log('⚠️ [processReasoningStream] 未收到最终内容，使用推理过程作为结果');
      content = reasoning + "\n\n总结：思考过程已结束。";
      onContent(content);
    }
    
    console.log(`🏆 [processReasoningStream] 处理完成，最终内容长度: ${content.length}，推理过程长度: ${reasoning.length}`);
    return { content, reasoning };
  } catch (error) {
    console.error('处理推理流失败:', error);
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
    
    console.log("📝 [快思考] 发送对话请求，准备处理响应");
    console.log("📄 [快思考] 提示词内容:", prompt);

    const response = await fetch('/api/ai-editor-action/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt,
        systemId
      })
    });

    if (!response.ok) {
      const errorMessage = `AI对话API调用失败: ${response.status} ${response.statusText}`;
      console.error("🔴 [快思考] API请求失败:", errorMessage);
      onError(errorMessage);
      throw new Error(errorMessage);
    }
    
    console.log("✅ [快思考] 收到API响应，开始处理数据流");

    return await processStream(
      response, 
      'result', 
      // 进度回调
      (content) => {
        console.log(`📄 [快思考] 收到内容更新: ${content.length} 字符`);
        onProgress(content);
      },
      // 错误回调
      (error) => {
        console.error("🔴 [快思考] 处理流时出错:", error);
        onError(error);
      }
    );
  } catch (error) {
    const errorMessage = `对话请求失败: ${error instanceof Error ? error.message : '未知错误'}`;
    console.error("🔴 [快思考] 请求处理失败:", errorMessage);
    onError(errorMessage);
    throw error;
  }
}

/**
 * AI推理聊天API（慢思考）
 */
export async function chatWithAIReasoning(
  instruction: string,
  selectedText: string,
  systemId: string | null,
  onContent: (content: string) => void,
  onReasoning: (reasoning: string) => void,
  onError: (error: string) => void
): Promise<{content: string, reasoning: string}> {
  try {
    // 准备发送到API的数据
    const prompt = `用户指令: ${instruction}\n\n选中的文本内容:\n${selectedText}`;

    console.log("📝 [慢思考] 发送推理请求，准备处理SSE流");
    console.log("📄 [慢思考] 提示词内容:", prompt);

    // 使用formData格式发送，与reasoning/route.ts的接口一致
    const formData = new FormData();
    formData.append('prompt', prompt);
    // 添加系统提示（如果需要）
    formData.append('systemPrompt', '你是一个有用的思考助手，帮助用户分析和改进文本。请先进行思考，然后给出结论。');
    
    try {
      console.log("🚀 [慢思考] 发送请求到API接口");
      const reasoningResponse = await fetch('/api/ai/reasoning', {
        method: 'POST',
        body: formData
      });

      if (!reasoningResponse.ok) {
        // 解析错误响应
        try {
          const errorData = await reasoningResponse.json();
          const errorMessage = errorData.error || `AI推理对话API调用失败: ${reasoningResponse.status} ${reasoningResponse.statusText}`;
          
          // 特殊处理"未找到推理模型"的错误
          if (errorMessage.includes("未找到可用的推理模型配置") || errorMessage.includes("无法执行慢思考")) {
            console.error("🔴 [慢思考] 推理模型配置错误:", errorMessage);
            onError("当前系统未配置推理模型，无法执行慢思考。请联系管理员配置推理模型。");
            throw new Error(errorMessage);
          }
          
          console.error(`🔴 [慢思考] API响应错误: ${errorMessage}`);
          onError(errorMessage);
          throw new Error(errorMessage);
        } catch (jsonError) {
          // 如果无法解析JSON，使用HTTP状态错误
          console.error(`🔴 [慢思考] API响应错误: ${reasoningResponse.status} ${reasoningResponse.statusText}`);
          onError(`AI推理对话API调用失败: ${reasoningResponse.status} ${reasoningResponse.statusText}`);
          throw new Error(`AI推理对话API调用失败: ${reasoningResponse.status}`);
        }
      }

      console.log("✅ [慢思考] 收到API响应，开始处理流");

      // 使用修改后的流处理函数
      return await processReasoningStream(
        reasoningResponse, 
        (content) => {
          onContent(content);
        }, 
        (reasoning) => {
          onReasoning(reasoning);
        }, 
        onError
      );
    } catch (fetchError) {
      console.error("🔴 [慢思考] 网络请求错误:", fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error("🔴 [慢思考] 处理失败:", error);
    const errorMessage = `推理对话请求失败: ${error instanceof Error ? error.message : '未知错误'}`;
    onError(errorMessage);
    throw error;
  }
} 