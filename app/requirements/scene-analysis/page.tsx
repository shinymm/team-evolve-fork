'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, ArrowRight, Loader2, Check, X, FileEdit } from "lucide-react"
import { RequirementParserService } from '@/lib/services/requirement-parser-service'
import { SceneBoundaryService } from '@/lib/services/scene-boundary-service'
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createTask, updateTask } from '@/lib/services/task-service'
import { cn } from '@/lib/utils'

interface Scene {
  name: string
  overview: string
  userJourney: string[]
}

interface RequirementContent {
  reqBackground: string
  reqBrief: string
  scenes: Scene[]
}

interface SceneAnalysisState {
  taskId?: string
  tempResult?: string
  analysisResult?: string  // 存储已确认的分析结果
  isConfirming?: boolean
  isCompleted?: boolean
}

export default function SceneAnalysisPage() {
  const [content, setContent] = useState<RequirementContent | null>(null)
  const [mdContent, setMdContent] = useState<string>('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null)
  const [analysisResult, setAnalysisResult] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [sceneStates, setSceneStates] = useState<Record<string, SceneAnalysisState>>({})
  const { toast } = useToast()

  useEffect(() => {
    // 加载结构化内容
    const storedContent = localStorage.getItem('requirement-structured-content')
    if (storedContent) {
      try {
        setContent(JSON.parse(storedContent))
      } catch (e) {
        console.error('Failed to parse stored content:', e)
      }
    }

    // 加载MD内容
    const storedMd = localStorage.getItem('requirement-book-content')
    if (storedMd) {
      setMdContent(storedMd)
    }
  }, [])

  const handleParse = () => {
    if (!mdContent.trim()) {
      toast({
        title: "解析失败",
        description: "请先确保有需求书内容",
        variant: "destructive",
      })
      return
    }

    try {
      const parser = new RequirementParserService()
      const parsedContent = parser.parseRequirement(mdContent)
      setContent(parsedContent)
      localStorage.setItem('requirement-structured-content', JSON.stringify(parsedContent))
      
      toast({
        title: "解析成功",
        description: "需求书内容已重新解析",
      })
    } catch (error) {
      console.error('解析失败:', error)
      toast({
        title: "解析失败",
        description: error instanceof Error ? error.message : "解析过程中出现错误",
        variant: "destructive",
      })
    }
  }

  const handleAnalyzeScene = async (scene: Scene, index: number) => {
    setSelectedScene(scene)
    setIsAnalyzing(true)
    setAnalysisResult('')

    try {
      // 创建任务
      const task = await createTask({
        title: `场景${index + 1}边界分析`,
        description: `分析场景"${scene.name}"（${scene.overview}）的边界条件和异常情况`,
        type: 'boundary-analysis',
        assignee: 'system',
        status: 'pending'
      })

      // 更新场景状态
      setSceneStates(prev => ({
        ...prev,
        [scene.name]: {
          taskId: task.id,
          isConfirming: false,
          isCompleted: false
        }
      }))

      const service = new SceneBoundaryService()
      if (!content) {
        throw new Error('缺少需求内容')
      }

      await service.analyzeScene(
        {
          reqBackground: content.reqBackground,
          reqBrief: content.reqBrief,
          scene: scene
        },
        (content: string) => {
          setAnalysisResult(prev => prev + content)
        }
      )

      // 更新场景状态为等待确认
      setSceneStates(prev => ({
        ...prev,
        [scene.name]: {
          ...prev[scene.name],
          tempResult: analysisResult,
          isConfirming: true
        }
      }))

      toast({
        title: "分析完成",
        description: `场景"${scene.name}"的边界分析已完成，请确认结果`,
      })
    } catch (error) {
      console.error('分析失败:', error)
      toast({
        title: "分析失败",
        description: error instanceof Error ? error.message : "分析过程中出现错误",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAcceptResult = async (scene: Scene) => {
    const state = sceneStates[scene.name]
    if (!state?.taskId) return

    try {
      // 更新任务状态
      await updateTask(state.taskId, {
        status: 'completed'
      })

      // 更新场景状态，保存分析结果
      setSceneStates(prev => ({
        ...prev,
        [scene.name]: {
          ...prev[scene.name],
          isConfirming: false,
          isCompleted: true,
          analysisResult: analysisResult  // 保存已确认的分析结果
        }
      }))

      toast({
        title: "已接受分析结果",
        description: `场景"${scene.name}"的边界分析结果已确认`,
      })
    } catch (error) {
      console.error('确认失败:', error)
      toast({
        title: "确认失败",
        description: error instanceof Error ? error.message : "操作过程中出现错误",
        variant: "destructive",
      })
    }
  }

  const handleRejectResult = async (scene: Scene) => {
    const state = sceneStates[scene.name]
    if (!state?.taskId) return

    try {
      // 重置场景状态
      setSceneStates(prev => ({
        ...prev,
        [scene.name]: {
          taskId: prev[scene.name]?.taskId,
          isConfirming: false,
          isCompleted: false
        }
      }))

      toast({
        title: "已拒绝分析结果",
        description: `场景"${scene.name}"的边界分析结果已拒绝，可重新分析`,
      })
    } catch (error) {
      console.error('拒绝失败:', error)
      toast({
        title: "操作失败",
        description: error instanceof Error ? error.message : "操作过程中出现错误",
        variant: "destructive",
      })
    }
  }

  if (!content) {
    return (
      <div className="container mx-auto py-6 w-[90%]">
        <div className="text-center text-gray-500">
          请先完成需求分析，生成结构化内容
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 w-[90%] space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">场景边界分析</h1>
        <p className="text-sm text-muted-foreground mt-1">
          基于需求书中的场景描述，分析每个场景的边界条件和异常情况
        </p>
      </div>

      {/* MD内容展示区域 */}
      <div>
        <Card className="bg-gray-50/50">
          <CardHeader className="cursor-pointer py-3" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium text-gray-500">需求书初稿</CardTitle>
                <span className="text-xs text-gray-400">(点击展开进行调试)</span>
              </div>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
            </div>
          </CardHeader>
          {isExpanded && (
            <CardContent className="py-0 pb-3">
              <div className="space-y-3">
                <pre className="whitespace-pre-wrap text-sm text-gray-600 bg-white p-3 rounded-md border max-h-[200px] overflow-y-auto">
                  {mdContent}
                </pre>
                <Button 
                  onClick={handleParse}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  size="sm"
                >
                  重新解析需求书
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* 分割线和标题 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-sm font-medium text-gray-500">结构化内容</span>
        </div>
      </div>

      {/* 需求背景和概述 - 紧凑展示 */}
      <div className="space-y-2">
        <Card className="bg-gray-50/50">
          <CardHeader className="py-2">
            <CardTitle className="text-sm font-medium text-gray-500">需求背景</CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-2">
            <p className="text-sm text-gray-600">{content.reqBackground}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-50/50">
          <CardHeader className="py-2">
            <CardTitle className="text-sm font-medium text-gray-500">需求概述</CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-2">
            <p className="text-sm text-gray-600">{content.reqBrief}</p>
          </CardContent>
        </Card>
      </div>

      {/* 场景列表 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">场景列表 ({content.scenes.length})</h2>
        {content.scenes.length === 0 ? (
          <div className="text-center text-gray-500">
            未检测到场景信息，请检查需求书格式是否正确
          </div>
        ) : (
          <div className="space-y-3">
            {content.scenes.map((scene, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{scene.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">场景概述</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleAnalyzeScene(scene, index)}
                        className={cn(
                          "bg-orange-500 hover:bg-orange-600",
                          sceneStates[scene.name]?.isCompleted && "bg-gray-100 hover:bg-gray-200 text-gray-600"
                        )}
                        size="sm"
                        disabled={isAnalyzing || sceneStates[scene.name]?.isConfirming}
                      >
                        {isAnalyzing && selectedScene?.name === scene.name ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            分析中...
                          </>
                        ) : (
                          <>
                            <ArrowRight className="mr-2 h-3.5 w-3.5" />
                            场景边界分析
                          </>
                        )}
                      </Button>
                      {sceneStates[scene.name]?.isCompleted && (
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          <FileEdit className="mr-2 h-3.5 w-3.5" />
                          完善场景需求描述
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="py-0 pb-3 space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">{scene.overview}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1.5">用户旅程 ({scene.userJourney.length} 步)</h4>
                    <div className="space-y-1">
                      {scene.userJourney.map((step, stepIndex) => (
                        <p key={stepIndex} className="text-sm text-gray-600">
                          {stepIndex + 1}. {step}
                        </p>
                      ))}
                    </div>
                  </div>
                  {/* 显示分析结果：如果是当前选中的场景显示实时结果，否则显示已保存的结果 */}
                  {(selectedScene?.name === scene.name || sceneStates[scene.name]?.analysisResult) && (
                    <div className="mt-4 border-t pt-4">
                      <div className="text-sm text-gray-600">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h3: ({children}) => <h3 className="text-base font-semibold text-gray-900 mb-2">{children}</h3>,
                            h4: ({children}) => <h4 className="text-sm font-medium text-gray-700 mb-1.5">{children}</h4>,
                            ul: ({children}) => <ul className="space-y-1 mb-3">{children}</ul>,
                            li: ({children}) => <li className="text-sm text-gray-600">{children}</li>,
                            p: ({children}) => <p className="text-sm text-gray-600 mb-2">{children}</p>
                          }}
                        >
                          {(selectedScene?.name === scene.name ? analysisResult : sceneStates[scene.name]?.analysisResult) || ''}
                        </ReactMarkdown>
                        {sceneStates[scene.name]?.isConfirming && (
                          <div className="flex justify-end gap-2 mt-4">
                            <Button
                              onClick={() => handleAcceptResult(scene)}
                              className="bg-blue-500 hover:bg-blue-600"
                              size="sm"
                            >
                              <Check className="mr-2 h-3.5 w-3.5" />
                              接受分析结果
                            </Button>
                            <Button
                              onClick={() => handleRejectResult(scene)}
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-700 hover:bg-red-50"
                            >
                              <X className="mr-2 h-3.5 w-3.5" />
                              拒绝并重新分析
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Toaster />
    </div>
  )
} 