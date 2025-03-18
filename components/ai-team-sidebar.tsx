'use client'

import { Bot, Plus, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { ChatDialog } from "./chat-dialog"
import { AgentNestDialog } from "./agent-nest-dialog"

export interface Assistant {
  id: string
  name: string
  icon: React.ReactNode
  avatarColor?: string
  welcomeMessage?: string
}

const defaultAssistants: Assistant[] = [
  {
    id: "epic-discussion",
    name: "EpicDiscussion助手",
    icon: <Bot className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是EpicDiscussion助手，专注于需求专题研讨。我可以帮你：\n• 分析用户需求\n• 分解功能为用户故事\n• 识别核心领域对象和属性\n• 定义业务规则和交互方式\n\n请直接告诉我您想要分析的功能需求，我会基于智能客户服务平台的背景进行深入分析！"
  },
  {
    id: "user-persona",
    name: "用户画像助手",
    icon: <Clock className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "Hi，我是您的用户研究专家助手，可以帮助您创建详细的用户细分和用户画像描述！\n请告诉我您想要分析的产品和用户群体，我将通过四个步骤指导您完成用户研究：\n- 生成结构化的用户画像基础描述\n- 分析用户群体的细分维度\n- 提出具体的用户群体建议\n- 为每个用户群体创建详细画像\n准备好了吗？请提供您的产品和用户群体信息，我们一起开始吧！"
  }
]

export function AiTeamSidebar() {
  const [activeAssistant, setActiveAssistant] = useState<Assistant | null>(null)
  const [showAgentNest, setShowAgentNest] = useState(false)
  const [myAssistants, setMyAssistants] = useState<Assistant[]>(defaultAssistants)
  const [hoveredAssistant, setHoveredAssistant] = useState<Assistant | null>(null)

  const handleAssistantClick = (assistant: Assistant) => {
    if (activeAssistant) {
      setActiveAssistant(null)
      setTimeout(() => {
        setActiveAssistant(assistant)
      }, 50)
    } else {
      setActiveAssistant(assistant)
    }
  }

  const handleAddAgent = (agent: Assistant) => {
    if (!myAssistants.find(a => a.id === agent.id)) {
      setMyAssistants([...myAssistants, agent])
    }
    setShowAgentNest(false)
  }

  return (
    <>
      <div className="fixed right-0 top-0 bottom-0 w-16 flex flex-col items-center py-20 space-y-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-l">
        {myAssistants.map((assistant) => (
          <div 
            key={assistant.id} 
            className="relative"
            onMouseEnter={() => setHoveredAssistant(assistant)}
            onMouseLeave={() => setHoveredAssistant(null)}
          >
            <button
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110",
                assistant.avatarColor || "bg-muted",
                "text-zinc-200 hover:shadow-lg hover:brightness-110"
              )}
              onClick={() => handleAssistantClick(assistant)}
            >
              {assistant.icon}
            </button>
            {hoveredAssistant?.id === assistant.id && (
              <div className="absolute right-14 top-1/2 -translate-y-1/2 bg-zinc-800 text-white text-sm py-1 px-3 rounded-md whitespace-nowrap z-50">
                {assistant.name}
              </div>
            )}
          </div>
        ))}
        <div
          className="relative"
          onMouseEnter={() => setHoveredAssistant({ id: 'add-new', name: '添加新助手', icon: null })}
          onMouseLeave={() => setHoveredAssistant(null)}
        >
          <button
            className="w-10 h-10 rounded-full bg-zinc-200 hover:bg-zinc-300 flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg"
            onClick={() => setShowAgentNest(true)}
          >
            <Plus className="w-5 h-5 text-zinc-700" />
          </button>
          {hoveredAssistant?.id === 'add-new' && (
            <div className="absolute right-14 top-1/2 -translate-y-1/2 bg-zinc-800 text-white text-sm py-1 px-3 rounded-md whitespace-nowrap z-50">
              添加新助手
            </div>
          )}
        </div>
      </div>

      {activeAssistant && (
        <ChatDialog
          assistant={activeAssistant}
          onClose={() => setActiveAssistant(null)}
        />
      )}

      <AgentNestDialog
        open={showAgentNest}
        onOpenChange={setShowAgentNest}
        onSelectAgent={handleAddAgent}
      />
    </>
  )
} 