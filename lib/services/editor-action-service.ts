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
    console.log(`🔄 [processStream] 开始处理流，期望字段: ${contentKey}`);
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log(`✅ [processStream] 流读取完成`);
        break;
      }
      
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      // 按行处理数据
      const lines = buffer.split('\n').filter(line => line.trim() !== '');
      // 保留最后一行（可能不完整）作为新的buffer
      buffer = lines.pop() || '';
      
      // 跟踪是否有内容更新
      let hasUpdate = false;
      
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
              // 尝试使用正则表达式提取内容
              const extracted = extractFieldFromText(jsonStr, contentKey);
              if (extracted) {
                resultText += extracted;
                onChunk(resultText);
                hasUpdate = true;
              }
              // 继续处理下一行，不中断流程
              continue;
            }
          } else {
            // 非SSE格式，先尝试使用JSON对象解析
            try {
              data = JSON.parse(line);
            } catch (parseError) {
              // 如果无法解析为单个JSON对象，尝试提取连续的JSON对象
              try {
                let remainingLine = line;
                
                while (remainingLine.trim().length > 0) {
                  // 尝试解析第一个完整的JSON对象
                  const firstObject = tryParseFirstJSON(remainingLine);
                  if (!firstObject.success) {
                    // 无法解析，尝试正则表达式提取
                    const extracted = extractFieldFromText(remainingLine, contentKey);
                    if (extracted) {
                      resultText += extracted;
                      onChunk(resultText);
                      hasUpdate = true;
                    }
                    break;
                  }
                  
                  // 处理成功解析的对象
                  const parsedData = firstObject.data;
                  if (parsedData && parsedData[contentKey]) {
                    resultText += parsedData[contentKey];
                    onChunk(resultText);
                    hasUpdate = true;
                  } else if (parsedData && parsedData.error) {
                    onError(parsedData.error);
                  }
                  
                  // 更新剩余行数据
                  remainingLine = remainingLine.substring(firstObject.endPos);
                }
              } catch (lineParseError) {
                console.warn('处理行数据时出错:', lineParseError);
                // 最后尝试正则表达式提取
                const extracted = extractFieldFromText(line, contentKey);
                if (extracted) {
                  resultText += extracted;
                  onChunk(resultText);
                  hasUpdate = true;
                }
              }
              // 无论成功与否，继续处理下一行
              continue;
            }
          }
          
          // 成功解析数据后处理内容
          if (data && data[contentKey]) {
            resultText += data[contentKey];
            onChunk(resultText);
            hasUpdate = true;
          } else if (data && data.error) {
            onError(data.error);
          }
        } catch (lineError) {
          console.warn('处理数据行时出错:', lineError);
          // 尝试使用正则表达式提取
          const extracted = extractFieldFromText(line, contentKey);
          if (extracted) {
            resultText += extracted;
            onChunk(resultText);
            hasUpdate = true;
          }
        }
      }
      
      // 如果本轮处理有更新，记录日志
      if (hasUpdate) {
        console.log(`📄 [processStream] 收到内容更新，当前长度: ${resultText.length} 字符`);
      }
    }
    
    // 处理可能残留在buffer中的数据
    if (buffer.trim()) {
      try {
        // 尝试正则表达式提取
        const extracted = extractFieldFromText(buffer, contentKey);
        if (extracted) {
          resultText += extracted;
          onChunk(resultText);
          console.log(`📄 [processStream] 从残留buffer提取内容，当前长度: ${resultText.length} 字符`);
        }
        
        // 也尝试JSON解析
        if (buffer.startsWith('data:')) {
          try {
            const jsonStr = buffer.substring(5).trim();
            if (jsonStr && jsonStr !== '[DONE]') {
              const data = JSON.parse(jsonStr);
              if (data[contentKey]) {
                resultText += data[contentKey];
                onChunk(resultText);
              }
            }
          } catch (e) {
            console.warn('处理残留buffer时JSON解析错误:', e);
          }
        } else {
          try {
            // 尝试JSON解析
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
    
    console.log(`🏁 [processStream] 处理完成，最终内容长度: ${resultText.length} 字符`);
    return resultText;
  } catch (error) {
    console.error('处理流失败:', error);
    throw error;
  }
}

/**
 * 从文本中提取指定字段的辅助函数
 */
function extractFieldFromText(text: string, fieldName: string): string {
  let extracted = '';
  
  // 匹配字段模式，如"polishedText":"内容"
  const fieldPattern = new RegExp(`"${fieldName}":"([^"]*)"`, 'g');
  let match;
  while ((match = fieldPattern.exec(text)) !== null) {
    if (match && match[1]) {
      extracted += match[1];
    }
  }
  
  return extracted;
}

// 添加辅助函数，用于尝试解析buffer中的第一个完整JSON对象
function tryParseFirstJSON(buffer: string): { success: boolean; data: any; endPos: number } {
  if (!buffer.trim().startsWith('{')) {
    return { success: false, data: null, endPos: 0 };
  }
  
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < buffer.length; i++) {
    const char = buffer[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        
        // 找到完整的JSON对象
        if (braceCount === 0) {
          const jsonStr = buffer.substring(0, i + 1);
          try {
            const data = JSON.parse(jsonStr);
            return { success: true, data, endPos: i + 1 };
          } catch (e) {
            console.warn('❌ JSON解析失败:', jsonStr, e);
            return { success: false, data: null, endPos: 0 };
          }
        }
      }
    }
  }
  
  console.log('⚠️ 未找到完整的JSON对象，buffer开头:', buffer.substring(0, 50));
  // 未找到完整的JSON对象
  return { success: false, data: null, endPos: 0 };
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
                // 有任何更新都立即传递出去
                onReasoning(reasoning);
              }
              
              // 处理delta.content（最终答案）
              if (delta.content) {
                content += delta.content;
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
            console.warn('JSON解析错误，尝试使用正则表达式提取内容:', parseError);
            
            // 使用正则表达式提取内容
            const extractedReasoning = extractReasoningContentFromText(jsonStr);
            if (extractedReasoning) {
              reasoning += extractedReasoning;
              onReasoning(reasoning);
            }
            
            const extractedContent = extractContentFromText(jsonStr);
            if (extractedContent) {
              content += extractedContent;
              hasReceivedFinalContent = true;
              onContent(content);
            }
          }
        } else if (line.trim()) {
          // 尝试解析非data:开头但非空的行
          try {
            const data = JSON.parse(line);
            
            // 处理各种可能的数据格式
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
            
            if (data.error) {
              onError(data.error);
              console.error("🚫 [processReasoningStream] 接收到非标准错误:", data.error);
              throw new Error(data.error);
            }
          } catch (parseError) {
            console.warn('非标准格式JSON解析错误，尝试使用正则表达式提取内容:', parseError);
            
            // 使用正则表达式提取内容
            const extractedReasoning = extractReasoningContentFromText(line);
            if (extractedReasoning) {
              reasoning += extractedReasoning;
              onReasoning(reasoning);
            }
            
            const extractedContent = extractContentFromText(line);
            if (extractedContent) {
              content += extractedContent;
              hasReceivedFinalContent = true;
              onContent(content);
              console.log(`📝 [processReasoningStream] 从非标准行正则提取内容: +${extractedContent.length} 字符`);
            }
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
            try {
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
            } catch (parseError) {
              console.warn('剩余buffer JSON解析错误，尝试使用正则表达式提取内容:', parseError);
              
              // 使用正则表达式提取内容
              const extractedReasoning = extractReasoningContentFromText(jsonStr);
              if (extractedReasoning) {
                reasoning += extractedReasoning;
                onReasoning(reasoning);
              }
              
              const extractedContent = extractContentFromText(jsonStr);
              if (extractedContent) {
                content += extractedContent;
                hasReceivedFinalContent = true;
                onContent(content);
              }
            }
          }
        } else {
          // 对于非data:开头的buffer，尝试使用正则表达式提取内容
          const extractedReasoning = extractReasoningContentFromText(buffer);
          if (extractedReasoning) {
            reasoning += extractedReasoning;
            onReasoning(reasoning);
          }
          
          const extractedContent = extractContentFromText(buffer);
          if (extractedContent) {
            content += extractedContent;
            hasReceivedFinalContent = true;
            onContent(content);
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
 * 从文本中提取reasoning_content内容的辅助函数
 */
function extractReasoningContentFromText(text: string): string {
  let extracted = '';
  
  // 匹配直接的reasoning_content字段
  const reasoningPattern = /"reasoning_content":"([^"]*)"/g;
  let match;
  while ((match = reasoningPattern.exec(text)) !== null) {
    if (match && match[1]) {
      extracted += match[1];
    }
  }
  
  // 匹配嵌套在delta中的reasoning_content
  const deltaReasoningPattern = /"delta":[^}]*"reasoning_content":"([^"]*)"/g;
  let deltaMatch;
  while ((deltaMatch = deltaReasoningPattern.exec(text)) !== null) {
    if (deltaMatch && deltaMatch[1]) {
      extracted += deltaMatch[1];
    }
  }
  
  return extracted;
}

/**
 * 从文本中提取content内容的辅助函数
 */
function extractContentFromText(text: string): string {
  let extracted = '';
  
  // 匹配直接的content字段
  const contentPattern = /"content":"([^"]*)"/g;
  let match;
  while ((match = contentPattern.exec(text)) !== null) {
    if (match && match[1]) {
      extracted += match[1];
    }
  }
  
  // 匹配嵌套在delta中的content
  const deltaContentPattern = /"delta":[^}]*"content":"([^"]*)"/g;
  let deltaMatch;
  while ((deltaMatch = deltaContentPattern.exec(text)) !== null) {
    if (deltaMatch && deltaMatch[1]) {
      extracted += deltaMatch[1];
    }
  }
  
  return extracted;
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

    // 使用与快思考相同的处理方法
    return await processStreamUnified(
      response, 
      'polishedText',
      onProgress,
      onError
    );
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

    // 使用与快思考相同的处理方法
    return await processStreamUnified(
      response, 
      'expandedText',
      onProgress,
      onError
    );
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

    // 使用与快思考相同的处理方法
    return await processStreamUnified(
      response, 
      'boundaryAnalysis',
      onProgress,
      onError
    );
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

    // 使用与快思考相同的处理方法
    return await processStreamUnified(
      response, 
      'optimizedText',
      onProgress,
      onError
    );
  } catch (error) {
    const errorMessage = `边界优化请求失败: ${error instanceof Error ? error.message : '未知错误'}`;
    onError(errorMessage);
    throw error;
  }
}

/**
 * 统一处理所有流式响应的方法，确保实时更新
 */
async function processStreamUnified(
  response: Response,
  contentKey: string,
  onProgress: (content: string) => void,
  onError: (error: string) => void
): Promise<string> {
  if (!response.body) {
    throw new Error('未收到流式响应');
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let lastUpdateLength = 0;
  
  try {
    console.log(`🔄 [processStreamUnified] 开始处理流，期望字段: ${contentKey}`);
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log(`✅ [processStreamUnified] 流读取完成`);
        break;
      }
      
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      // 使用正则表达式提取指定字段的内容
      let extractedContent = '';
      
      // 尝试提取内容
      const fieldPattern = new RegExp(`"${contentKey}":"([^"]*)"`, 'g');
      let match;
      while ((match = fieldPattern.exec(buffer)) !== null) {
        if (match && match[1]) {
          extractedContent += match[1];
        }
      }
      
      // 如果提取到内容，立即更新
      if (extractedContent && extractedContent.length > 0) {
        fullContent = extractedContent;
        
        // 如果有新内容，立即回调
        if (fullContent.length > lastUpdateLength) {
          lastUpdateLength = fullContent.length;
          onProgress(fullContent);
        }
      }
    }
    
    // 最后尝试从buffer中提取完整内容
    const finalExtracted = extractFieldFromText(buffer, contentKey);
    if (finalExtracted && finalExtracted.length > fullContent.length) {
      fullContent = finalExtracted;
      onProgress(fullContent);
    }
    
    return fullContent;
  } catch (error) {
    console.error(`❌ [processStreamUnified] 处理流失败:`, error);
    onError(`处理响应流时出错: ${error instanceof Error ? error.message : '未知错误'}`);
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
    
    // 使用与其他功能相同的统一处理函数
    return await processStreamUnified(
      response,
      'result', // 快思考模式使用'result'字段
      onProgress,
      onError
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