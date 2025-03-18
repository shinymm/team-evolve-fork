import { Bot, X, Send } from "lucide-react"
import { Assistant } from "./ai-team-sidebar"
import { cn } from "../lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { useState, useRef, useEffect } from "react"
import { getAIConfig } from "@/lib/ai-config-service"
import { streamingAICall } from "@/lib/ai-service"
import { epicDiscussionPrompt } from "@/lib/prompts/epic-discussion"
import { userPersonaPrompt } from "@/lib/prompts/user-persona"

interface ChatDialogProps {
  assistant: Assistant
  onClose: () => void
}

interface Message {
  role: 'assistant' | 'user'
  content: string
}

export function ChatDialog({ assistant, onClose }: ChatDialogProps) {
  const { toast } = useToast()
  
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: assistant.welcomeMessage || `你好！我是${assistant.name}，有什么可以帮你的吗？` }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 当assistant变化时，重置消息
  useEffect(() => {
    setMessages([
      { role: 'assistant', content: assistant.welcomeMessage || `你好！我是${assistant.name}，有什么可以帮你的吗？` }
    ])
    setInputValue('')
  }, [assistant.id])

  // 滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return

    // 添加用户消息
    const userMessage = { role: 'user' as const, content: inputValue }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // 获取AI配置
      const aiConfig = getAIConfig()
      if (!aiConfig) {
        toast({
          description: "未找到AI配置，请先在设置中配置AI模型",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      // 生成提示词
      let prompt = ''
      if (assistant.id === 'epic-discussion') {
        prompt = epicDiscussionPrompt(inputValue)
      } else if (assistant.id === 'user-persona') {
        // 解析用户输入，提取产品和用户群体信息
        let product = '未提供'
        let userGroup = '未提供'
        
        // 尝试匹配常见的格式
        const productMatch = inputValue.match(/产品[：:]\s*["'](.+?)["']/i) || 
                            inputValue.match(/产品[：:]\s*(.+?)(?=\s*用户群体|\s*$)/i)
        
        const userGroupMatch = inputValue.match(/用户群体[：:]\s*["'](.+?)["']/i) || 
                              inputValue.match(/用户群体[：:]\s*(.+?)$/i)
        
        if (productMatch) product = productMatch[1].trim()
        if (userGroupMatch) userGroup = userGroupMatch[1].trim()
        
        // 如果没有匹配到产品或用户群体，但有输入内容
        if (product === '未提供' && userGroup === '未提供' && inputValue.trim()) {
          // 假设整个输入都是用户群体描述
          userGroup = inputValue.trim()
        }
        
        // 替换prompt模板中的占位符
        let personalizedPrompt = userPersonaPrompt
          .replace(/~产品：~(\r?\n)未提供/, `~产品：~$1${product}`)
          .replace(/~用户群体：~(\r?\n)/, `~用户群体：~$1${userGroup}$1`)
        
        prompt = personalizedPrompt
      } else {
        // 默认情况，直接使用用户输入作为提示词
        prompt = inputValue
      }
      
      // 创建一个临时的响应消息
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      
      // 流式调用AI
      let accumulatedContent = ''
      await streamingAICall(
        prompt,
        aiConfig,
        (content) => {
          // 累积内容，而不是替换内容
          accumulatedContent += content
          // 更新最后一条消息的内容
          setMessages(prev => {
            const newMessages = [...prev]
            newMessages[newMessages.length - 1].content = accumulatedContent
            return newMessages
          })
        }
      )
    } catch (error) {
      console.error('AI调用错误:', error)
      toast({
        description: "AI调用出错，请稍后再试",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div 
      className="fixed top-20 right-20 w-[800px] h-[80vh] bg-background rounded-lg shadow-lg border flex flex-col z-[9999]"
    >
      {/* 对话框头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center space-x-3">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-zinc-100", assistant.avatarColor)}>
            {assistant.icon}
          </div>
          <span className="font-medium">{assistant.name}</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* 消息列表区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex items-start space-x-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
            {message.role === 'assistant' && (
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-zinc-100", assistant.avatarColor)}>
                {assistant.icon}
              </div>
            )}
            <div className={cn(
              "p-3 rounded-lg max-w-[80%]",
              message.role === 'assistant' ? "bg-muted" : "bg-primary text-primary-foreground"
            )}>
              <p className="whitespace-pre-line">{message.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* 输入框区域 */}
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder={
              assistant.id === 'epic-discussion' 
                ? "请输入您想要分析的功能需求..." 
                : assistant.id === 'user-persona'
                ? "请输入 产品:\"产品描述\" 用户群体:\"用户群体描述\"..."
                : "请输入您的问题..."
            }
            className="flex-1 min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button 
            onClick={handleSend}
            className={cn(
              "px-4 py-2 rounded-md flex items-center justify-center",
              isLoading 
                ? "bg-muted text-muted-foreground cursor-not-allowed" 
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
} 