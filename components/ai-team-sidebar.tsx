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
    id: "timesheet",
    name: "工时助理",
    icon: <Clock className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "Hi，我是工时助理。我可以帮你：\n• 对接Timesheet填报工时\n• 生成工作日报\n• 生成周报\n\n要我现在就帮你处理今天的工时记录吗？"
  }
]

export function AiTeamSidebar() {
  const [activeAssistant, setActiveAssistant] = useState<Assistant | null>(null)
  const [showAgentNest, setShowAgentNest] = useState(false)
  const [myAssistants, setMyAssistants] = useState<Assistant[]>(defaultAssistants)

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
          <button
            key={assistant.id}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110",
              assistant.avatarColor || "bg-muted",
              "text-zinc-200 hover:shadow-lg hover:brightness-110"
            )}
            title={assistant.name}
            onClick={() => setActiveAssistant(assistant)}
          >
            {assistant.icon}
          </button>
        ))}
        <button
          className="w-10 h-10 rounded-full bg-zinc-200 hover:bg-zinc-300 flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg"
          title="添加新助手"
          onClick={() => setShowAgentNest(true)}
        >
          <Plus className="w-5 h-5 text-zinc-700" />
        </button>
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