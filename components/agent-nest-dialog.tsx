import { Bot, Plus, Brain, ExternalLink, Code2, Paintbrush, FileSearch, Coffee, MessageSquare, Briefcase, BookOpen, Target, TestTube, Bug, GitBranch, Rocket, Box, Cpu, HelpCircle, Network, Lightbulb, FileText, Sparkles, Layers, Wand2, Zap, Clock } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Assistant } from "./ai-team-sidebar"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface AgentNestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectAgent: (agent: Assistant) => void
}

const developmentAgents: Assistant[] = [
  {
    id: "dev",
    name: "开发助理",
    icon: <Code2 className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是开发助理。我可以帮你：\n• 代码审查\n• 技术选型建议\n• 调试问题分析\n• API 文档生成\n\n需要我做什么？"
  },
  {
    id: "architect",
    name: "架构助理",
    icon: <Box className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是架构助理。我可以帮你：\n• 架构设计评审\n• 技术方案建议\n• 系统扩展性分析\n• 性能瓶颈识别\n\n需要我做什么？"
  },
  {
    id: "tech-advisor",
    name: "技术顾问",
    icon: <Cpu className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是技术顾问。我可以帮你：\n• 解答技术问题\n• 最佳实践建议\n• 新技术调研\n• 技术趋势分析\n\n需要我做什么？"
  },
  {
    id: "design",
    name: "设计助理",
    icon: <Paintbrush className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是设计助理。我可以帮你：\n• 设计评审\n• 原型建议\n• 设计规范检查\n• 素材管理\n\n需要我做什么？"
  },
  {
    id: "product",
    name: "产品助理",
    icon: <Target className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是产品助理。我可以帮你：\n• 收集用户反馈\n• 分析产品数据\n• 撰写产品文档\n• 规划产品路线\n\n需要我做什么？"
  },
  {
    id: "user-persona",
    name: "用户画像助手",
    icon: <Clock className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "Hi，我是您的用户研究专家助手，可以帮助您创建详细的用户细分和用户画像描述！\n请告诉我您想要分析的产品和用户群体，我将通过四个步骤指导您完成用户研究：\n- 生成结构化的用户画像基础描述\n- 分析用户群体的细分维度\n- 提出具体的用户群体建议\n- 为每个用户群体创建详细画像\n准备好了吗？请提供您的产品和用户群体信息，我们一起开始吧！"
  },
  {
    id: "test",
    name: "测试助理",
    icon: <TestTube className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是测试助理。我可以帮你：\n• 设计测试用例\n• 自动化测试建议\n• 性能测试分析\n• Bug追踪管理\n\n需要我做什么？"
  },
  {
    id: "debug",
    name: "调试助理",
    icon: <Bug className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是调试助理。我可以帮你：\n• 问题诊断分析\n• 日志解读\n• 性能优化建议\n• 异常处理方案\n\n需要我做什么？"
  },
  {
    id: "devops",
    name: "运维助理",
    icon: <GitBranch className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是运维助理。我可以帮你：\n• CI/CD配置\n• 部署流程优化\n• 监控告警处理\n• 环境问题排查\n\n需要我做什么？"
  },
  {
    id: "devops-coach",
    name: "DevOps教练",
    icon: <Network className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是DevOps教练。我可以帮你：\n• DevOps最佳实践\n• 流程优化建议\n• 工具链集成\n• 团队协作指导\n\n需要我做什么？"
  },
  {
    id: "tech-support",
    name: "技术支持",
    icon: <HelpCircle className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是技术支持。我可以帮你：\n• 问题快速定位\n• 解决方案推荐\n• 常见问题解答\n• 技术文档查询\n\n需要我做什么？"
  }
]

const officeAgents: Assistant[] = [
  {
    id: "calendar",
    name: "日程助理",
    icon: <Bot className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是你的日程助理。我可以帮你：\n• 查看今日会议安排\n• 创建/修改会议日程\n• 发送会议邀请\n• 设置会议提醒\n\n需要我做什么？"
  },
  {
    id: "doc",
    name: "文档助理",
    icon: <BookOpen className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是文档助理。我可以帮你：\n• 整理会议记录\n• 编写技术文档\n• 维护知识库\n• 文档格式转换\n\n需要我做什么？"
  },
  {
    id: "communication",
    name: "沟通助理",
    icon: <MessageSquare className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是沟通助理。我可以帮你：\n• 邮件撰写建议\n• 会议总结整理\n• 团队协作建议\n• 沟通要点提炼\n\n需要我做什么？"
  },
  {
    id: "break",
    name: "休息提醒",
    icon: <Coffee className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是休息提醒助理。我可以帮你：\n• 定时提醒休息\n• 建议伸展运动\n• 喝水提醒\n• 午休管理\n\n需要我做什么？"
  }
]

const utilityAgents: Assistant[] = [
  {
    id: "info-organizer",
    name: "信息整理",
    icon: <Layers className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是信息整理助理。我可以帮你：\n• 内容分类整理\n• 要点快速提取\n• 信息结构化\n• 知识图谱构建\n\n需要我做什么？"
  },
  {
    id: "doc-polish",
    name: "文档润色",
    icon: <Wand2 className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是文档润色助理。我可以帮你：\n• 文字润色优化\n• 格式规范检查\n• 专业用语建议\n• 内容逻辑梳理\n\n需要我做什么？"
  },
  {
    id: "creative",
    name: "创意助手",
    icon: <Lightbulb className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是创意助手。我可以帮你：\n• 头脑风暴\n• 创意发散\n• 方案构思\n• 灵感激发\n\n需要我做什么？"
  },
  {
    id: "quick-writer",
    name: "快速写作",
    icon: <FileText className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是快速写作助手。我可以帮你：\n• 文章结构建议\n• 内容扩充完善\n• 表达优化\n• 写作灵感激发\n\n需要我做什么？"
  },
  {
    id: "efficiency",
    name: "效率助手",
    icon: <Zap className="w-5 h-5" />,
    avatarColor: "bg-zinc-700",
    welcomeMessage: "你好！我是效率助手。我可以帮你：\n• 任务优先级规划\n• 时间管理建议\n• 工作流程优化\n• 效率工具推荐\n\n需要我做什么？"
  }
]

export function AgentNestDialog({ open, onOpenChange, onSelectAgent }: AgentNestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Agent Nest</DialogTitle>
          <DialogDescription>
            从预设助手中选择，或创建自定义助手来扩展你的AI团队
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="dev" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dev">研发助手</TabsTrigger>
            <TabsTrigger value="office">办公助手</TabsTrigger>
            <TabsTrigger value="utility">通用助手</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dev">
            <div className="mt-4">
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="grid grid-cols-3 gap-4">
                  {developmentAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-start space-x-4 p-4 rounded-lg border hover:bg-accent cursor-pointer"
                      onClick={() => onSelectAgent(agent)}
                    >
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-zinc-100", agent.avatarColor)}>
                        {agent.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{agent.name}</h4>
                        <p className="text-sm text-muted-foreground">点击邀请加入团队</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="office">
            <div className="mt-4">
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="grid grid-cols-3 gap-4">
                  {officeAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-start space-x-4 p-4 rounded-lg border hover:bg-accent cursor-pointer"
                      onClick={() => onSelectAgent(agent)}
                    >
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-zinc-100", agent.avatarColor)}>
                        {agent.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{agent.name}</h4>
                        <p className="text-sm text-muted-foreground">点击邀请加入团队</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="utility">
            <div className="mt-4">
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="grid grid-cols-3 gap-4">
                  {utilityAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-start space-x-4 p-4 rounded-lg border hover:bg-accent cursor-pointer"
                      onClick={() => onSelectAgent(agent)}
                    >
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-zinc-100", agent.avatarColor)}>
                        {agent.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{agent.name}</h4>
                        <p className="text-sm text-muted-foreground">点击邀请加入团队</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        {/* 自定义助手 */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">自定义助手</h3>
          <a 
            href="https://cloud.dify.ai/apps" 
            target="_blank"
            rel="noopener noreferrer" 
            className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent"
          >
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">训练自己的助手</h4>
                <p className="text-sm text-muted-foreground">使用 Dify.AI 创建和训练专属助手</p>
              </div>
            </div>
            <ExternalLink className="w-5 h-5 text-muted-foreground" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
} 