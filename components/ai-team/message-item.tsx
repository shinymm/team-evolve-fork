import React from 'react'
import { UserCircle2, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { getToolCallsStatus } from './tool-call-service'

interface ToolCall {
  id: string
  type: string
  name: string
  arguments?: Record<string, any>
  status?: 'running' | 'success' | 'error'
  result?: any
  timestamp?: number
  index?: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' 
  content: string
  toolCalls?: ToolCall[]
  timestamp?: number
}

interface MessageItemProps {
  message: Message
  memberName?: string
  memberInitial?: string
}

export function MessageItem({ message, memberName, memberInitial }: MessageItemProps) {
  // 过滤出非执行中状态的工具调用
  const finalToolCalls = message.toolCalls?.filter(tc => tc.status !== 'running')
  const hasToolCalls = finalToolCalls && finalToolCalls.length > 0
  const [expandTools, setExpandTools] = React.useState(true)
  
  // 获取工具调用状态统计
  const toolCallsStatus = hasToolCalls ? getToolCallsStatus(finalToolCalls) : null
  const hasMultipleTools = hasToolCalls && finalToolCalls!.length > 1
  
  return (
    <div className={`flex items-start space-x-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
      {message.role === 'assistant' && (
        <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white">
          {memberInitial || '?'}
        </div>
      )}
      
      <div className={`p-3 rounded-lg max-w-[80%] ${
        message.role === 'assistant' ? "bg-muted" : "bg-primary text-primary-foreground"
      }`}>
        <p className="whitespace-pre-line">{message.content}</p>
        
        {/* 工具调用内容展示 */}
        {hasToolCalls && (
          <div className="mt-1 pt-1">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500 mb-1 flex items-center">
                <span className="mr-1">工具调用</span>
                {hasMultipleTools && (
                  <span className="text-2xs bg-gray-100 rounded-full px-2 py-0.5 ml-1">
                    {finalToolCalls!.length}个
                  </span>
                )}
              </div>
              
              {/* 工具调用状态统计显示 - 总是显示折叠/展开按钮 */}
              <div className="flex items-center space-x-1">
                {/* 折叠/展开按钮 */}
                <button 
                  onClick={() => setExpandTools(!expandTools)}
                  className="flex items-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {expandTools ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span className="ml-1">{expandTools ? '收起' : '展开'}</span>
                </button>
                
                {/* 状态指示器 - 只在有多个工具时显示 */}
                {hasMultipleTools && toolCallsStatus && (
                  <div className="flex items-center space-x-2 px-2">
                    {/* 不再显示running状态的统计 */}
                    {toolCallsStatus.success > 0 && (
                      <span className="flex items-center text-green-600">
                        <CheckCircle size={12} className="mr-0.5" />
                        {toolCallsStatus.success}
                      </span>
                    )}
                    {toolCallsStatus.error > 0 && (
                      <span className="flex items-center text-red-600">
                        <XCircle size={12} className="mr-0.5" />
                        {toolCallsStatus.error}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* 默认展开工具列表，但每个工具卡片内容默认折叠 */}
            <div className={hasMultipleTools ? "space-y-2" : ""}>
              {finalToolCalls?.map((toolCall) => (
                <ToolCallView key={toolCall.id} toolCall={toolCall} />
              ))}
            </div>
          </div>
        )}
      </div>
      
      {message.role === 'user' && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
          <UserCircle2 className="w-5 h-5" />
        </div>
      )}
    </div>
  )
}

function ToolCallView({ toolCall }: { toolCall: ToolCall }) {
  // 工具状态对应的样式
  const statusStyles = {
    running: "text-blue-600 bg-blue-50 border-blue-200",
    success: "text-green-600 bg-green-50 border-green-200",
    error: "text-red-600 bg-red-50 border-red-200",
    default: "text-gray-600 bg-gray-50 border-gray-200"
  }
  
  const statusStyle = toolCall.status 
    ? statusStyles[toolCall.status] 
    : statusStyles.default
  
  const [expanded, setExpanded] = React.useState(false)
  
  // 格式化工具参数显示
  const formatArguments = (args: Record<string, any> | undefined) => {
    if (!args) return null
    
    try {
      return (
        <pre className="whitespace-pre-wrap text-2xs overflow-auto max-h-24">
          {JSON.stringify(args, null, 2)}
        </pre>
      )
    } catch (error) {
      return <span className="text-red-500 text-2xs">无法显示参数</span>
    }
  }
  
  // 格式化工具结果显示
  const formatResult = (result: any) => {
    if (result === undefined || result === null) return null
    
    try {
      if (typeof result === 'object') {
        return (
          <pre className="whitespace-pre-wrap text-2xs overflow-auto max-h-36">
            {JSON.stringify(result, null, 2)}
          </pre>
        )
      } else {
        return <span className="whitespace-pre-line text-2xs">{String(result)}</span>
      }
    } catch (error) {
      return <span className="text-red-500 text-2xs">无法显示结果</span>
    }
  }
  
  return (
    <div className={`text-xs rounded border p-2 ${statusStyle}`}>
      <div className="font-semibold flex justify-between items-center">
        <div className="flex items-center">
          {toolCall.status === 'running' && <Clock size={14} className="mr-1 text-blue-600" />}
          {toolCall.status === 'success' && <CheckCircle size={14} className="mr-1 text-green-600" />}
          {toolCall.status === 'error' && <XCircle size={14} className="mr-1 text-red-600" />}
          <span className="truncate max-w-[180px]" title={toolCall.name}>{toolCall.name}</span>
        </div>
        
        <div className="flex items-center">
          {toolCall.status && (
            <span className={`text-2xs rounded-full px-1.5 py-0.5 mr-1 ${
              toolCall.status === 'success' ? 'bg-green-100 text-green-800' : 
              toolCall.status === 'error' ? 'bg-red-100 text-red-800' : 
              'bg-blue-100 text-blue-800'
            }`}>
              {toolCall.status === 'running' && '执行中'}
              {toolCall.status === 'success' && '成功'}
              {toolCall.status === 'error' && '失败'}
            </span>
          )}
          
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="p-0.5 hover:bg-gray-100 rounded transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>
      
      {expanded && (
        <>
          {toolCall.arguments && (
            <div className="mt-1">
              <div className="text-2xs text-gray-500 mb-0.5">参数:</div>
              {formatArguments(toolCall.arguments)}
            </div>
          )}
          
          {toolCall.result && (
            <div className="mt-1 pt-1 border-t border-gray-200">
              <div className="text-2xs text-gray-500 mb-0.5">结果:</div>
              {formatResult(toolCall.result)}
            </div>
          )}
          
          {toolCall.status === 'error' && toolCall.result && (
            <div className="mt-1 pt-1 border-t border-red-200 text-red-600 text-2xs">
              <div className="font-medium">错误:</div>
              <div>{typeof toolCall.result === 'string' ? toolCall.result : JSON.stringify(toolCall.result)}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
} 