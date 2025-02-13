'use client'

import { Bot, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface Assistant {
  id: string
  name: string
  icon: React.ReactNode
  avatarColor?: string
}

const defaultAssistants: Assistant[] = [
  {
    id: "calendar",
    name: "日程助理",
    icon: <Bot className="w-5 h-5" />,
    avatarColor: "bg-zinc-700"
  }
]

export function AiTeamSidebar() {
  return (
    <div className="fixed right-0 top-0 bottom-0 w-16 flex flex-col items-center py-20 space-y-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-l">
      {defaultAssistants.map((assistant) => (
        <button
          key={assistant.id}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110",
            assistant.avatarColor || "bg-muted",
            "text-zinc-200 hover:shadow-lg hover:brightness-110"
          )}
          title={assistant.name}
        >
          {assistant.icon}
        </button>
      ))}
      <button
        className="w-10 h-10 rounded-full bg-zinc-200 hover:bg-zinc-300 flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg"
        title="添加新助手"
      >
        <Plus className="w-5 h-5 text-zinc-700" />
      </button>
    </div>
  )
} 