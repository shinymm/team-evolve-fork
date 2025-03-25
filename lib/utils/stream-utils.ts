/**
 * 处理流式响应的工具函数
 * @param fileIds 文件ID列表
 * @param systemPrompt 系统提示词
 * @param userPrompt 用户提示词
 * @param onContent 内容回调函数
 */
export async function handleStreamingResponse(
  fileIds: string[],
  systemPrompt: string,
  userPrompt: string,
  onContent: (content: string) => void
): Promise<void> {
  try {
    console.log('开始处理流式响应，文件数:', fileIds.length)
    
    // 构造FormData
    const formData = new FormData()
    fileIds.forEach(fileId => {
      formData.append('fileIds', fileId)
    })
    formData.append('systemPrompt', systemPrompt)
    formData.append('userPrompt', userPrompt)

    // 发送请求
    const response = await fetch('/api/ai/file', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API请求失败 (${response.status}): ${error}`)
    }

    if (!response.body) {
      throw new Error('响应中没有body')
    }

    // 读取响应流
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulatedContent = ''

    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        console.log('流读取完成，累计内容长度:', accumulatedContent.length)
        break
      }

      // 解码并处理数据
      const chunk = decoder.decode(value, { stream: true })
      console.log('收到原始数据块:', chunk)
      buffer += chunk
      
      // 处理完整的消息
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留最后一个不完整的行

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine) {
          console.log('跳过空行')
          continue
        }
        if (trimmedLine === 'data: [DONE]') {
          console.log('收到结束标记')
          continue
        }
        
        if (trimmedLine.startsWith('data: ')) {
          try {
            const jsonStr = trimmedLine.slice(6)
            console.log('解析JSON:', jsonStr)
            const data = JSON.parse(jsonStr)
            
            if (data.error) {
              console.error('收到错误消息:', data.error)
              throw new Error(data.error)
            }
            
            // 检查 Qwen API 的响应格式
            if (data.choices?.[0]?.delta?.content) {
              const content = data.choices[0].delta.content
              console.log('收到内容片段，长度:', content.length)
              accumulatedContent += content
              onContent(accumulatedContent)
            } else if (data.content) {
              console.log('收到内容片段，长度:', data.content.length)
              accumulatedContent = data.content
              onContent(data.content)
            }
          } catch (e) {
            console.warn('解析消息失败:', e instanceof Error ? e.message : '未知错误', '原始消息:', trimmedLine)
            continue
          }
        } else {
          console.log('未知格式的行:', trimmedLine)
        }
      }
    }

    // 如果没有累积到任何内容，抛出错误
    if (!accumulatedContent) {
      throw new Error('未收到任何有效内容')
    }

  } catch (error) {
    console.error('流处理错误:', error)
    throw error
  }
} 