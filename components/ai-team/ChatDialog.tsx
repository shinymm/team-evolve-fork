import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { v4 as uuidv4 } from 'uuid'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import { Message } from './message-item'
import { parseToolCallFromStreamData, parseToolCallsFromStreamData, updateMessageToolCalls, updateMessageWithMultipleToolCalls } from './tool-call-service'
import { useTranslations } from 'next-intl'

interface AITeamMember {
  id: string
  name: string
  introduction: string
  role: string
  responsibilities: string
  greeting?: string | null
  category?: string | null
  mcpConfigJson?: string | null
  aiModelName?: string | null
  aiModelBaseUrl?: string | null
  aiModelApiKey?: string | null
  aiModelTemperature?: number | null
}

interface ChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: AITeamMember | null
}

export function ChatDialog({ open, onOpenChange, member }: ChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isSessionReady, setIsSessionReady] = useState(false)
  const { toast } = useToast()
  const t = useTranslations('ai-team-factory.ChatDialog')

  // 当对话框打开或成员变化时，重置聊天状态
  useEffect(() => {
    if (open && member) {
      handleInitializeChat()
    }
  }, [open, member])

  // 当对话框关闭时，关闭会话
  useEffect(() => {
    console.log('对话框状态变更:', open)
    if (!open && sessionId) {
      handleCloseChat()
    }
  }, [open])

  // 初始化聊天会话
  const handleInitializeChat = async () => {
    if (!member) return
    
    setIsSessionReady(false)
    setMessages([{ id: uuidv4(), role: 'assistant', content: t('preparingSession') }])
    setInputValue('')
    setSessionId(null)
    
    let welcomeMessage = member.greeting || t('welcomeMessage', { name: member.name })
    
    if (member.mcpConfigJson) {
      try {
        console.log('开始创建MCP会话...')
        
        let newSessionId: string | null = null
        let retryCount = 0
        const maxRetries = 3
        
        while (retryCount < maxRetries && !newSessionId) {
          try {
            // 解析MCP配置
            const config = JSON.parse(member.mcpConfigJson)
            if (!config || typeof config.mcpServers !== 'object' || Object.keys(config.mcpServers).length === 0) {
              throw new Error('无效或空的MCP配置')
            }
            
            const serverName = Object.keys(config.mcpServers)[0]
            const serverConfig = config.mcpServers[serverName]
            if (!serverConfig) {
                throw new Error(`未找到名为 "${serverName}" 的服务器配置`)
            }
            
            // 准备成员信息
            const memberInfo = {
              name: member.name,
              role: member.role,
              responsibilities: member.responsibilities
            }
            const userSessionKey = `mcp-session-${member.id}`
            
            // 根据配置类型构造请求体
            let requestBody: any
            if (serverConfig.url && typeof serverConfig.url === 'string') {
              // Streamable HTTP 类型
              console.log(`[handleOpenChat] 检测到 Streamable HTTP 配置: ${serverConfig.url}`)
              requestBody = {
                command: '_STREAMABLE_HTTP_', // 特殊标识符
                url: serverConfig.url,
                memberInfo,
                userSessionKey
              }
            } else if (serverConfig.command && Array.isArray(serverConfig.args)) {
              // 命令行类型
              console.log(`[handleOpenChat] 检测到命令行配置: ${serverConfig.command} ${serverConfig.args.join(' ')}`)
              requestBody = {
                command: serverConfig.command,
                args: serverConfig.args,
                memberInfo,
                userSessionKey
              }
            } else {
              // 配置格式无效
              throw new Error('MCP服务器配置无效: 必须包含 url 或 command/args')
            }
            
            console.log(`[handleOpenChat] 发送到 /api/mcp/session 的请求体:`, requestBody)

            // 创建MCP会话
            const response = await fetch('/api/mcp/session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            })
            
            if (!response.ok) {
              throw new Error(`创建MCP会话失败 (${response.status})`)
            }
            
            const result = await response.json()
            if (result.sessionId) {
                console.log('已创建MCP会话:', result.sessionId)
                newSessionId = result.sessionId
            } else {
                throw new Error('创建会话响应无效: 缺少 sessionId')
            }
          } catch (error) {
            console.error(`创建会话失败(尝试 ${retryCount + 1}/${maxRetries}):`, error)
            retryCount++
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000))
              console.log(`重试创建会话 (${retryCount}/${maxRetries})...`)
            }
          }
        }
        
        if (newSessionId) {
          setSessionId(newSessionId)
          console.log('会话ID已设置:', newSessionId)
          welcomeMessage = t('welcomeWithTools', { welcomeMessage })
        } else {
          welcomeMessage = t('welcomeWithoutTools', { welcomeMessage })
          throw new Error('多次尝试后仍无法配置会话')
        }
      } catch (error) {
        console.error('初始化MCP会话失败:', error)
        toast({ 
          title: '警告', 
          description: t('warnings.toolServiceUnavailable'), 
          variant: 'destructive' 
        })
      }
    }
    
    setMessages([{ id: uuidv4(), role: 'assistant', content: welcomeMessage }])
    setIsSessionReady(true)
  }

  // 关闭聊天会话
  const handleCloseChat = async () => {
    console.log('执行handleCloseChat函数')
    
    // 只有在有会话ID的情况下才尝试关闭会话
    if (sessionId) {
      console.log('正在关闭MCP会话:', sessionId)
      let retryCount = 0
      const maxRetries = 2
      let successfullyClosed = false
      
      try {
        // 先验证会话是否存在
        const checkResponse = await fetch(`/api/mcp/session?sessionId=${sessionId}`, {
          method: 'GET',
        })
        
        if (checkResponse.status === 404) {
          // 会话不存在，无需关闭
          console.log('会话已不存在，无需关闭:', sessionId)
          successfullyClosed = true
        } else if (checkResponse.ok) {
          // 会话存在，尝试关闭
          const response = await fetch(`/api/mcp/session?sessionId=${sessionId}`, {
            method: 'DELETE',
          })
          
          if (response.ok) {
            const result = await response.json()
            console.log('已成功关闭MCP会话:', sessionId, result)
            successfullyClosed = true
          } else {
            // 如果状态码为404，表示会话不存在，也视为关闭成功
            if (response.status === 404) {
              console.log('会话不存在，视为已关闭:', sessionId)
              successfullyClosed = true
            } else {
              // 其他错误状态码，需要重试
              throw new Error(`关闭会话失败 (${response.status})`)
            }
          }
        }
      } catch (error) {
        console.error('关闭MCP会话出现异常:', error)
        
        if (!successfullyClosed) {
          console.log('无法关闭会话，但不显示警告以避免影响用户体验')
        }
      }
    } else {
      console.log('没有活跃会话，无需关闭')
    }
    
    // 无论会话关闭是否成功，都清理UI状态
    setMessages([])
    setSessionId(null)
  }

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !member) return
    
    // 创建用户消息
    const userMessage: Message = { id: uuidv4(), role: 'user', content: inputValue }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    
    // 创建初始助手消息
    const assistantMessageId = uuidv4()
    const initialAssistantMessage: Message = { id: assistantMessageId, role: 'assistant', content: '' }
    setMessages(prev => [...prev, initialAssistantMessage])
    
    try {
      console.log('[SendMessage] 会话状态:', {
        sessionId,
        member: member?.name
      })

      // 更新requestData对象，添加所有必要信息
      const requestData: any = {
        userMessage: userMessage.content,
        memberInfo: {
          name: member.name,
          role: member.role,
          responsibilities: member.responsibilities,
        }
      }

      // 添加MCP配置信息(如果有)
      if (member.mcpConfigJson) {
        requestData.memberInfo.mcpConfigJson = member.mcpConfigJson;
      }

      // 添加模型配置信息(必须有)
      if (member.aiModelName || member.aiModelBaseUrl || member.aiModelApiKey || member.aiModelTemperature !== null) {
        requestData.modelConfig = {
          model: member.aiModelName,
          baseURL: member.aiModelBaseUrl,
          apiKey: member.aiModelApiKey,
          temperature: member.aiModelTemperature !== null ? member.aiModelTemperature : 0.2
        }
        console.log('[SendMessage] 使用成员自定义模型配置')
      }

      // 只添加 sessionId
      if (sessionId) {
        requestData.sessionId = sessionId
      }

      // 创建可取消的请求
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000) // 2分钟超时

      // 在关闭对话框时取消请求
      const handleDialogClose = () => {
        controller.abort()
        console.log('对话关闭，取消流式请求')
      }
      
      // 添加对话框关闭事件监听器
      const dialogCloseListener = () => {
        if (!open) handleDialogClose()
      }
      window.addEventListener('dialog-close', dialogCloseListener)

      try {
        const response = await fetch('/api/mcp/conversation/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || t('errors.conversationError', { message: '' }))
        }

        // 处理流式响应
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('无法读取响应流')
        }

        // 标志：下一条 'content' 是否应开始新消息
        let startNewMessageNext = false
        let currentMessageId = assistantMessageId

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = new TextDecoder().decode(value)
          const lines = chunk.split('\n').filter(line => line.trim() !== '')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6))

                if (data.type === 'content') {
                  const newContent = data.content || ''
                  
                  // 过滤工具调用相关的内容，不添加到消息中
                  if (newContent.includes('🔧 正在使用工具') || 
                      newContent.includes('处理中...') ||
                      newContent.includes('⚙️ 工具') ||
                      newContent.startsWith('工具调用') ||
                      newContent.includes('执行结果:')) {
                    console.log('[Flow] 过滤工具相关内容:', newContent.substring(0, 50));
                    // 不添加工具相关内容到消息
                    continue;
                  }
                  
                  // 决定是追加还是创建新消息
                  if (startNewMessageNext) {
                    // 创建新消息
                    const newId = uuidv4()
                    setMessages(prevMessages => [
                      ...prevMessages,
                      { id: newId, role: 'assistant', content: newContent }
                    ])
                    currentMessageId = newId
                    startNewMessageNext = false
                  } else {
                    // 追加到最后一条消息
                    setMessages(prevMessages => {
                      const newMessages = [...prevMessages]
                      const lastMessageIndex = newMessages.length - 1
                      if (lastMessageIndex >= 0 && newMessages[lastMessageIndex].role === 'assistant') {
                        const updatedLastMessage = {
                          ...newMessages[lastMessageIndex],
                          content: newMessages[lastMessageIndex].content + newContent
                        }
                        newMessages[lastMessageIndex] = updatedLastMessage
                        return newMessages
                      } else {
                        console.warn('[Flow] 尝试追加内容，但最后一条消息不是助手的。创建新消息。')
                        const newId = uuidv4()
                        newMessages.push({ id: newId, role: 'assistant', content: newContent })
                        currentMessageId = newId
                        return newMessages
                      }
                    })
                  }
                } else if (data.type === 'new_turn') {
                  console.log('[Flow] 收到 new_turn 信号')
                  startNewMessageNext = true
                } else if (data.type === 'error') {
                  console.error('[Flow] 收到错误:', data.content)
                  setMessages(prevMessages => {
                      const newMessages = [...prevMessages]
                      newMessages.push({ id: uuidv4(), role: 'assistant', content: t('errors.conversationError', { message: data.content }) })
                      return newMessages
                  })
                  startNewMessageNext = false
                } else if (data.type === 'tool_state') {
                  // 使用新的parseToolCallsFromStreamData解析多工具状态
                  const toolCalls = parseToolCallsFromStreamData(data)
                  if (toolCalls && toolCalls.length > 0) {
                    console.log(`[工具调用] 收到${toolCalls.length}个工具状态更新`)
                    
                    // 对每个工具打印更详细的日志
                    toolCalls.forEach(toolCall => {
                      const toolStatus = toolCall.status || 'unknown';
                      
                      // 记录工具调用详细信息
                      console.log(`[工具调用状态] 名称:${toolCall.name}, ID:${toolCall.id}, 状态:${toolStatus}`, 
                        toolCall.arguments ? `参数:${JSON.stringify(toolCall.arguments).substring(0, 50)}...` : '无参数',
                        toolCall.result ? `结果长度:${typeof toolCall.result === 'string' ? toolCall.result.length : 'N/A'}` : '无结果'
                      );
                    })
                    
                    // 使用新的批量更新函数并确保进行状态合并
                    setMessages(prevMessages => {
                      // 先找到当前消息
                      const currentMessage = prevMessages.find(m => m.id === currentMessageId);
                      if (!currentMessage) {
                        console.warn('[工具调用] 未找到当前消息:', currentMessageId);
                        return updateMessageWithMultipleToolCalls(prevMessages, currentMessageId, toolCalls);
                      }
                      
                      // 获取现有工具调用
                      const existingToolCalls = currentMessage.toolCalls || [];
                      
                      // 将新工具调用与现有调用合并，确保相同工具不会显示为多个
                      let updatedToolCalls = [...existingToolCalls];
                      
                      for (const newTool of toolCalls) {
                        // 尝试查找匹配的现有工具调用
                        const existingIndex = updatedToolCalls.findIndex(tc => 
                          tc.id === newTool.id || // 首先按ID匹配
                          (tc.name === newTool.name && // 然后按名称+参数匹配
                            (
                              // 如果newTool有参数，进行完整比较
                              (newTool.arguments && 
                                JSON.stringify(tc.arguments || {}) === JSON.stringify(newTool.arguments || {})) ||
                              // 如果newTool没有参数但现有工具有，则视为同一工具的状态更新
                              (!newTool.arguments && tc.arguments)
                            )
                          )
                        );
                        
                        // 如果找到了匹配的工具，或者新工具是成功/失败状态，进行处理
                        if (existingIndex >= 0) {
                          // 更新现有工具状态
                          const existingTool = updatedToolCalls[existingIndex];
                          
                          // 如果现有工具是running状态，而新工具是success/error状态，优先使用新状态
                          if (existingTool.status === 'running' && 
                              (newTool.status === 'success' || newTool.status === 'error')) {
                            // 完全替换，保留ID
                            updatedToolCalls[existingIndex] = { 
                              ...newTool,
                              id: existingTool.id // 保持ID一致
                            };
                            console.log(`[工具合并] 工具 ${newTool.name} 从执行中更新为 ${newTool.status}`);
                          } else if (newTool.status === 'running' && 
                                   (existingTool.status === 'success' || existingTool.status === 'error')) {
                            // 如果新工具是执行中状态，但现有工具已经是成功/失败状态，保留现有工具状态
                            console.log(`[工具合并] 忽略工具 ${newTool.name} 的执行中状态更新，保留已有的 ${existingTool.status} 状态`);
                            // 不做任何更改
                          } else {
                            // 其他情况，合并属性但优先保留成功/失败状态
                            updatedToolCalls[existingIndex] = { 
                              ...existingTool, 
                              ...newTool,
                              // 保留原始ID
                              id: existingTool.id,
                              // 如果新工具没有提供结果但现有工具有，保留现有结果
                              result: newTool.result || existingTool.result,
                              // 如果现有工具已有成功/失败状态，优先保留该状态
                              status: (existingTool.status === 'success' || existingTool.status === 'error') 
                                ? existingTool.status 
                                : newTool.status
                            };
                            console.log(`[工具合并] 合并工具 ${newTool.name} 状态和结果`);
                          }
                        } else {
                          // 添加新工具调用（只有当它不是执行中状态，或者找不到匹配的工具时）
                          if (newTool.status !== 'running') {
                            updatedToolCalls.push(newTool);
                            console.log(`[工具合并] 添加新的最终状态工具: ${newTool.name} (${newTool.status})`);
                          } else {
                            // 对于执行中状态的新工具，直接添加
                            updatedToolCalls.push(newTool);
                            console.log(`[工具合并] 添加新的执行中工具: ${newTool.name}`);
                          }
                        }
                      }
                      
                      // 替换当前消息中的工具调用
                      return prevMessages.map(msg => 
                        msg.id === currentMessageId 
                          ? { ...msg, toolCalls: updatedToolCalls } 
                          : msg
                      );
                    });
                  }
                }
              } catch (error) {
                console.error('解析流数据出错:', error, line)
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('请求被取消:', error.message)
        } else {
          console.error('对话错误:', error)
          setMessages(prevMessages => {
            const newMessages = [...prevMessages]
            const errorText = error instanceof Error ? 
              t('errors.conversationError', { message: error.message }) : 
              t('errors.unknownError')
            newMessages.push({ id: uuidv4(), role: 'assistant', content: errorText })
            return newMessages
          })
          toast({
            title: '错误',
            description: t('errors.processingError'),
            variant: 'destructive',
          })
        }
      } finally {
        window.removeEventListener('dialog-close', dialogCloseListener)
        clearTimeout(timeoutId)
        setIsLoading(false)
      }
    } catch (error: any) {
      console.error('对话错误:', error)
      setMessages(prevMessages => {
        const newMessages = [...prevMessages]
        const errorText = error instanceof Error ? 
          t('errors.conversationError', { message: error.message }) : 
          t('errors.unknownError')
        newMessages.push({ id: uuidv4(), role: 'assistant', content: errorText })
        return newMessages
      })
      toast({
        title: '错误',
        description: t('errors.processingError'),
        variant: 'destructive',
      })
      setIsLoading(false)
    }
  }

  // 监听浏览器关闭/刷新事件
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sessionId) {
        console.log('页面关闭/刷新前尝试关闭会话:', sessionId)
        
        const xhr = new XMLHttpRequest()
        xhr.open('DELETE', `/api/mcp/session?sessionId=${sessionId}`, false)
        try {
          xhr.send()
          console.log('页面关闭前已发送会话关闭请求')
        } catch (err) {
          console.error('页面关闭前发送会话关闭请求失败:', err)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [sessionId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-h-[80dvh] max-w-[1000px] flex flex-col space-y-4 p-4">
        <DialogHeader className="p-2">
          <DialogTitle className="text-xl font-bold">
            {member?.name || 'AI助手'}
          </DialogTitle>
          <DialogDescription>
            {member?.introduction || '与AI团队成员进行对话'}
          </DialogDescription>
        </DialogHeader>

        <MessageList 
          messages={messages} 
          memberName={member?.name}
          memberInitial={member?.name?.charAt(0).toUpperCase()}
        />

        <div className="flex-shrink-0 bg-background">
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            loading={isLoading}
            disabled={!isSessionReady}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
} 