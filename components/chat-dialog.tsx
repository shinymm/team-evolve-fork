import { Bot, X } from "lucide-react"
import { Assistant } from "./ai-team-sidebar"
import { cn } from "../lib/utils"
import { useToast } from "@/components/ui/use-toast"

interface ChatDialogProps {
  assistant: Assistant
  onClose: () => void
}

export function ChatDialog({ assistant, onClose }: ChatDialogProps) {
  const { toast } = useToast()

  const handleSend = () => {
    toast({
      description: "功能开发中...",
      duration: 2000,
    })
  }

  return (
    <div className="fixed top-20 right-20 w-96 h-[500px] bg-background rounded-lg shadow-lg border flex flex-col z-[9999]">
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
        <div className="flex items-start space-x-2">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-zinc-100", assistant.avatarColor)}>
            {assistant.icon}
          </div>
          <div className="bg-muted p-3 rounded-lg max-w-[80%]">
            <p className="whitespace-pre-line">{assistant.welcomeMessage || `你好！我是${assistant.name}，有什么可以帮你的吗？`}</p>
          </div>
        </div>
      </div>
      
      {/* 输入框区域 */}
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="输入消息..."
            className="flex-1 min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button 
            onClick={handleSend}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
} 