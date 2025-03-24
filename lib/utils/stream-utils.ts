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
  // 构造FormData
  const formData = new FormData()
  fileIds.forEach(fileId => {
    formData.append('fileIds', fileId)
  })
  formData.append('systemPrompt', systemPrompt)
  formData.append('userPrompt', userPrompt)

  // 调用API端点
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

  // 处理流式响应
  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk
      .split('\n')
      .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]')

    for (const line of lines) {
      if (line.includes('data: ')) {
        try {
          const data = JSON.parse(line.replace('data: ', ''))
          
          if (data.error) {
            throw new Error(data.error)
          }
          
          if (data.content) {
            onContent(data.content)
          }
        } catch (e) {
          console.error('解析响应数据失败:', e)
        }
      }
    }
  }
} 