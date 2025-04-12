interface ToolCall {
  id: string
  type: string
  name: string
  arguments?: Record<string, any>
  status?: 'running' | 'success' | 'error'
  result?: any
}

// 解析服务器事件流中的工具调用数据
export function parseToolCallFromStreamData(data: any): ToolCall | null {
  if (!data || data.type !== 'tool_state') return null
  
  try {
    const toolState = data.state
    if (!toolState || !toolState.id || !toolState.type || !toolState.name) {
      console.warn('无效的工具调用状态数据:', toolState)
      return null
    }
    
    // 确保工具名称没有被错误连接，检查是否包含多个工具名
    let toolName = toolState.name
    
    // 检测常见的工具名称模式，确保没有被错误连接
    const knownToolPrefixes = [
      'get_system_',
      'search_',
      'query_',
      'fetch_',
      'create_',
      'update_',
      'delete_'
    ]
    
    // 检查是否有多个工具前缀被连接在一起
    for (const prefix of knownToolPrefixes) {
      const firstIndex = toolName.indexOf(prefix)
      if (firstIndex > 0) {
        // 如果前缀出现在非字符串开始位置，说明可能有工具名称被错误连接
        console.warn(`检测到可能的工具名称连接问题: "${toolName}"，尝试修复...`)
        toolName = toolName.substring(firstIndex)
        console.log(`修复后的工具名称: "${toolName}"`)
        break
      }
    }
    
    return {
      id: toolState.id,
      type: toolState.type,
      name: toolName, // 使用可能修复过的工具名
      arguments: toolState.arguments,
      status: toolState.status,
      result: toolState.result
    }
  } catch (error) {
    console.error('解析工具调用数据出错:', error)
    return null
  }
}

// 解析服务器事件流中的多个工具调用数据
export function parseToolCallsFromStreamData(data: any): ToolCall[] {
  if (!data || data.type !== 'tool_state') return []
  
  const toolCalls: ToolCall[] = []
  
  try {
    // 情况1：单个工具状态
    if (data.state && data.state.id) {
      const toolCall = parseToolCallFromStreamData(data)
      if (toolCall) {
        toolCalls.push(toolCall)
      }
    }
    // 情况2：多个工具状态的数组
    else if (Array.isArray(data.states)) {
      for (const state of data.states) {
        // 为每个状态创建一个临时的tool_state对象并解析
        const tempData = { type: 'tool_state', state }
        const toolCall = parseToolCallFromStreamData(tempData)
        if (toolCall) {
          toolCalls.push(toolCall)
        }
      }
    }
    
    console.log(`从事件流解析出 ${toolCalls.length} 个工具调用`)
    return toolCalls
  } catch (error) {
    console.error('解析多个工具调用数据出错:', error)
    return []
  }
}

// 更新工具调用状态
export function updateToolCall(toolCalls: ToolCall[], newToolCall: ToolCall): ToolCall[] {
  // 如果没有工具调用列表，创建一个新列表
  if (!toolCalls) return [newToolCall]
  
  // 查找可能匹配的工具（先按ID，再按名称+参数）
  let existingIndex = toolCalls.findIndex(tc => tc.id === newToolCall.id)
  
  // 如果找不到相同ID的工具，尝试通过名称和参数匹配
  if (existingIndex < 0) {
    // 1. 先尝试找完全匹配的（名称+参数）
    existingIndex = toolCalls.findIndex(tc => 
      tc.name === newToolCall.name && 
      JSON.stringify(tc.arguments || {}) === JSON.stringify(newToolCall.arguments || {})
    )
    
    // 2. 如果仍然找不到，使用宽松匹配：只要名称相同就认为是同一个工具的状态更新
    if (existingIndex < 0) {
      existingIndex = toolCalls.findIndex(tc => tc.name === newToolCall.name)
    }
  }
  
  if (existingIndex >= 0) {
    // 找到了现有工具，更新其状态
    const updatedToolCalls = [...toolCalls]
    const existingTool = updatedToolCalls[existingIndex]
    
    // 优先级处理:
    // 1. 如果新工具是执行中状态，但现有工具已经是成功/失败状态，保留现有状态（忽略更新）
    if (newToolCall.status === 'running' && 
        (existingTool.status === 'success' || existingTool.status === 'error')) {
      console.log(`[工具调用服务] 忽略工具 ${newToolCall.name} 的执行中状态更新，保留已有的 ${existingTool.status} 状态`)
      return toolCalls // 直接返回原列表，不做修改
    }
    // 2. 如果现有工具是running状态，而新工具是success/error状态，完全替换但保留ID
    else if (existingTool.status === 'running' && 
        (newToolCall.status === 'success' || newToolCall.status === 'error')) {
      updatedToolCalls[existingIndex] = { 
        ...newToolCall,
        id: existingTool.id // 保持ID一致
      }
      console.log(`[工具调用服务] 工具 ${newToolCall.name} 状态从 'running' 更新为 '${newToolCall.status}'`)
    } 
    // 3. 如果现有工具已有成功/失败状态，且参数不同，可能是同名不同工具，添加为新工具
    else if ((existingTool.status === 'success' || existingTool.status === 'error') && 
             newToolCall.arguments && 
             JSON.stringify(existingTool.arguments || {}) !== JSON.stringify(newToolCall.arguments || {})) {
      console.log(`[工具调用服务] 检测到同名但参数不同的工具: ${newToolCall.name}，添加为新工具`)
      return [...toolCalls, newToolCall]
    }
    // 4. 其他情况下，智能合并，保留重要信息
    else {
      updatedToolCalls[existingIndex] = { 
        ...existingTool,
        ...newToolCall,
        // 保留原工具ID
        id: existingTool.id,
        // 如果新工具没有提供结果，但现有工具有，保留现有结果
        result: newToolCall.result || existingTool.result,
        // 如果现有工具已有成功/失败状态，保留该状态
        status: (existingTool.status === 'success' || existingTool.status === 'error') 
          ? existingTool.status : newToolCall.status || existingTool.status
      }
      console.log(`[工具调用服务] 合并工具 ${newToolCall.name} 的状态和结果`)
    }
    
    return updatedToolCalls
  } else {
    // 添加新工具调用
    console.log(`[工具调用服务] 添加新工具: ${newToolCall.name} (状态: ${newToolCall.status || '未知'})`)
    return [...toolCalls, newToolCall]
  }
}

// 批量更新工具调用状态
export function updateToolCalls(existingToolCalls: ToolCall[], newToolCalls: ToolCall[]): ToolCall[] {
  if (!existingToolCalls || existingToolCalls.length === 0) return newToolCalls
  if (!newToolCalls || newToolCalls.length === 0) return existingToolCalls
  
  // 创建一个副本以进行更新
  let updatedToolCalls = [...existingToolCalls]
  
  // 逐个更新或添加新的工具调用
  for (const newToolCall of newToolCalls) {
    updatedToolCalls = updateToolCall(updatedToolCalls, newToolCall)
  }
  
  return updatedToolCalls
}

// 更新消息中的工具调用
export function updateMessageToolCalls<T extends { id: string, toolCalls?: ToolCall[] }>(
  messages: T[],
  messageId: string,
  toolCall: ToolCall
): T[] {
  return messages.map(message => {
    if (message.id === messageId) {
      return {
        ...message,
        toolCalls: updateToolCall(message.toolCalls || [], toolCall)
      }
    }
    return message
  })
}

// 批量更新消息中的多个工具调用
export function updateMessageWithMultipleToolCalls<T extends { id: string, toolCalls?: ToolCall[] }>(
  messages: T[],
  messageId: string,
  newToolCalls: ToolCall[]
): T[] {
  if (!newToolCalls || newToolCalls.length === 0) return messages
  
  return messages.map(message => {
    if (message.id === messageId) {
      return {
        ...message,
        toolCalls: updateToolCalls(message.toolCalls || [], newToolCalls)
      }
    }
    return message
  })
}

// 获取工具调用的当前状态摘要
export function getToolCallsStatus(toolCalls: ToolCall[] | undefined): {
  running: number;
  success: number;
  error: number;
  total: number;
} {
  if (!toolCalls || toolCalls.length === 0) {
    return { running: 0, success: 0, error: 0, total: 0 }
  }
  
  return {
    running: toolCalls.filter(tc => tc.status === 'running').length,
    success: toolCalls.filter(tc => tc.status === 'success').length,
    error: toolCalls.filter(tc => tc.status === 'error').length,
    total: toolCalls.length
  }
} 