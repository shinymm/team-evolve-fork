'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, ArrowRight, Loader2, Check, X, FileEdit, Copy } from "lucide-react"
import { RequirementParserService } from '@/lib/services/requirement-parser-service'
import { SceneBoundaryService } from '@/lib/services/scene-boundary-service'
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createTask, updateTask } from '@/lib/services/task-service'
import { cn } from '@/lib/utils'
import { streamingAICall, AIModelConfig } from '@/lib/ai-service'
import { SceneRequirementService } from '@/lib/services/scene-requirement-service'
import { getAIConfig } from '@/lib/ai-config-service'
import { RequirementExportService } from '@/lib/services/requirement-export-service'

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
  isEditing?: boolean  // 新增：是否处于编辑状态
  isOptimizing?: boolean  // 新增：是否正在优化需求描述
  optimizeResult?: string  // 新增：优化后的需求描述结果
  isOptimizeConfirming?: boolean  // 新增：是否在等待确认优化结果
  isHideOriginal?: boolean  // 新增：是否隐藏原始卡片
}

interface EditingScene {
  name: string
  overview: string
  userJourney: string[]
  analysisResult?: string
}

export default function SceneAnalysisPage() {
  const [content, setContent] = useState<RequirementContent | null>(null)
  const [mdContent, setMdContent] = useState<string>('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null)
  const [analysisResult, setAnalysisResult] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [sceneStates, setSceneStates] = useState<Record<string, SceneAnalysisState>>({})
  const [editingScene, setEditingScene] = useState<EditingScene | null>(null)
  const [optimizeResult, setOptimizeResult] = useState<string>('')
  const [isOptimizing, setIsOptimizing] = useState(false)
  const { toast } = useToast()
  
  // 使用 useEffect 在客户端加载数据
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
    
    // 加载需求书内容
    const storedMdContent = localStorage.getItem('requirement-book-content')
    if (storedMdContent) {
      setMdContent(storedMdContent)
    }

    // 加载场景状态
    const storedSceneStates = localStorage.getItem('scene-analysis-states')
    if (storedSceneStates) {
      try {
        setSceneStates(JSON.parse(storedSceneStates))
      } catch (e) {
        console.error('Failed to parse stored scene states:', e)
      }
    }
  }, [])

  // 当场景状态改变时保存到 localStorage
  useEffect(() => {
    if (Object.keys(sceneStates).length > 0) {
      localStorage.setItem('scene-analysis-states', JSON.stringify(sceneStates))
    }
  }, [sceneStates])

  const handleParse = () => {
    if (!mdContent.trim()) {
      toast({
        title: "解析失败",
        description: "请先确保有需求书内容",
        variant: "destructive",
        duration: 3000
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
        duration: 3000
      })
    } catch (error) {
      console.error('解析失败:', error)
      toast({
        title: "解析失败",
        description: error instanceof Error ? error.message : "解析过程中出现错误",
        variant: "destructive",
        duration: 3000
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
        type: 'scene-boundary-analysis',
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
        duration: 3000
      })
    } catch (error) {
      console.error('分析失败:', error)
      toast({
        title: "分析失败",
        description: error instanceof Error ? error.message : "分析过程中出现错误",
        variant: "destructive",
        duration: 3000
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
      const updatedStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          isConfirming: false,
          isCompleted: true,
          analysisResult: analysisResult  // 保存当前的分析结果
        }
      }
      setSceneStates(updatedStates)
      localStorage.setItem('scene-analysis-states', JSON.stringify(updatedStates))

      // 清空当前的实时分析结果
      setAnalysisResult('')
      setSelectedScene(null)

      toast({
        title: "已接受分析结果",
        description: `场景"${scene.name}"的边界分析结果已确认`,
        duration: 3000
      })
    } catch (error) {
      console.error('确认失败:', error)
      toast({
        title: "确认失败",
        description: error instanceof Error ? error.message : "操作过程中出现错误",
        variant: "destructive",
        duration: 3000
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
          isCompleted: false,
          tempResult: undefined,  // 清空临时结果
          analysisResult: undefined  // 清空分析结果
        }
      }))

      // 清空当前的实时分析结果
      setAnalysisResult('')
      setSelectedScene(null)

      toast({
        title: "已拒绝分析结果",
        description: `场景"${scene.name}"的边界分析结果已拒绝，可重新分析`,
        duration: 3000
      })
    } catch (error) {
      console.error('拒绝失败:', error)
      toast({
        title: "操作失败",
        description: error instanceof Error ? error.message : "操作过程中出现错误",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  // 开始编辑场景
  const handleStartEdit = (scene: Scene, index: number) => {
    setEditingScene({
      name: scene.name,
      overview: scene.overview,
      userJourney: [...scene.userJourney],
      analysisResult: sceneStates[scene.name]?.analysisResult
    })
    setSceneStates(prev => ({
      ...prev,
      [scene.name]: {
        ...prev[scene.name],
        isEditing: true
      }
    }))
  }

  // 保存编辑的场景
  const handleSaveEdit = (scene: Scene, index: number) => {
    if (!editingScene || !content) return

    // 更新场景内容
    const updatedScenes = [...content.scenes]
    updatedScenes[index] = {
      name: scene.name,  // 保持原有的场景名称
      overview: editingScene.overview,
      userJourney: editingScene.userJourney
    }

    // 更新content并保存到localStorage
    const updatedContent = {
      ...content,
      scenes: updatedScenes
    }
    setContent(updatedContent)
    localStorage.setItem('requirement-structured-content', JSON.stringify(updatedContent))

    // 更新场景状态，保持分析结果不变
    setSceneStates(prev => {
      const currentState = prev[scene.name] || {}
      return {
        ...prev,
        [scene.name]: {
          ...currentState,
          isEditing: false,
          analysisResult: editingScene.analysisResult || currentState.analysisResult
        }
      }
    })

    // 如果当前选中的场景是被编辑的场景，也需要更新选中的场景
    if (selectedScene?.name === scene.name) {
      setSelectedScene(updatedScenes[index])
    }

    setEditingScene(null)

    toast({
      title: "保存成功",
      description: "场景信息已更新",
      duration: 3000
    })
  }

  // 取消编辑
  const handleCancelEdit = (scene: Scene) => {
    setEditingScene(null)
    setSceneStates(prev => ({
      ...prev,
      [scene.name]: {
        ...prev[scene.name],
        isEditing: false
      }
    }))
  }

  const handleOptimizeRequirement = async (scene: Scene, index: number) => {
    if (!content) return
    setIsOptimizing(true)
    setOptimizeResult('')
    setSelectedScene(scene)

    // 立即更新场景状态，显示优化中的卡片
    setSceneStates(prev => ({
      ...prev,
      [scene.name]: {
        ...prev[scene.name],
        taskId: prev[scene.name]?.taskId,
        isOptimizing: true,
        isOptimizeConfirming: false,
        optimizeResult: undefined
      } as SceneAnalysisState
    }))

    try {
      // 创建任务
      const task = await createTask({
        title: `完善场景${index + 1}需求`,
        description: `优化场景"${scene.name}"的需求描述`,
        type: 'requirement-optimize',
        assignee: 'system',
        status: 'pending'
      })

      // 更新任务ID
      setSceneStates(prev => ({
        ...prev,
        [scene.name]: {
          ...prev[scene.name],
          taskId: task.id,
        } as SceneAnalysisState
      }))

      const config = getAIConfig()
      if (!config) {
        throw new Error('未配置AI模型')
      }

      const service = new SceneRequirementService(config)
      
      await service.optimize(
        {
          reqBackground: content.reqBackground,
          reqBrief: content.reqBrief,
          scene: scene,
          boundaryAnalysis: sceneStates[scene.name]?.analysisResult || ''
        },
        (content: string) => {
          setOptimizeResult(prev => prev + content)
          // 同时更新场景状态中的优化结果
          setSceneStates(prev => ({
            ...prev,
            [scene.name]: {
              ...prev[scene.name],
              optimizeResult: prev[scene.name]?.optimizeResult 
                ? prev[scene.name].optimizeResult + content 
                : content
            } as SceneAnalysisState
          }))
        }
      )

      // 更新场景状态为等待确认
      setSceneStates(prev => ({
        ...prev,
        [scene.name]: {
          ...prev[scene.name],
          isOptimizeConfirming: true,
          isOptimizing: false
        } as SceneAnalysisState
      }))

      toast({
        title: "优化完成",
        description: `场景"${scene.name}"的需求描述已优化完成，请确认结果`,
        duration: 3000
      })
    } catch (error) {
      console.error('优化失败:', error)
      toast({
        title: "优化失败",
        description: error instanceof Error ? error.message : "优化过程中出现错误",
        variant: "destructive",
        duration: 3000
      })
      // 发生错误时，重置场景状态
      setSceneStates(prev => ({
        ...prev,
        [scene.name]: {
          ...prev[scene.name],
          isOptimizing: false,
          isOptimizeConfirming: false,
          optimizeResult: undefined
        } as SceneAnalysisState
      }))
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleAcceptOptimize = async (scene: Scene, index: number) => {
    const state = sceneStates[scene.name]
    if (!state?.taskId || !content || !state.optimizeResult) return

    try {
      // 更新任务状态
      await updateTask(state.taskId, {
        status: 'completed'
      })

      // 更新场景状态
      const updatedStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          isOptimizing: false,
          isOptimizeConfirming: false,
          optimizeResult: state.optimizeResult,
          isHideOriginal: true
        }
      }
      setSceneStates(updatedStates)
      localStorage.setItem('scene-analysis-states', JSON.stringify(updatedStates))

      // 清空选中的场景和优化结果
      setSelectedScene(null)
      setOptimizeResult('')

      toast({
        title: "已接受优化结果",
        description: `场景"${scene.name}"的需求描述已更新`,
        duration: 3000
      })
    } catch (error) {
      console.error('确认失败:', error)
      toast({
        title: "确认失败",
        description: error instanceof Error ? error.message : "操作过程中出现错误",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  const handleRejectOptimize = async (scene: Scene) => {
    const state = sceneStates[scene.name]
    if (!state?.taskId) return

    try {
      // 重置场景状态
      setSceneStates(prev => ({
        ...prev,
        [scene.name]: {
          ...prev[scene.name],
          isOptimizing: false,
          isOptimizeConfirming: false,
          optimizeResult: undefined
        } as SceneAnalysisState
      }))

      toast({
        title: "已拒绝优化结果",
        description: `场景"${scene.name}"的需求描述优化已取消，可重新优化`,
        duration: 3000
      })
    } catch (error) {
      console.error('拒绝失败:', error)
      toast({
        title: "操作失败",
        description: error instanceof Error ? error.message : "操作过程中出现错误",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  const handleExport = () => {
    RequirementExportService.saveStructuredRequirementToStorage(content!, sceneStates)
    toast({
      title: "导出成功",
      description: "需求书内容已导出",
      duration: 3000
    })
  }

  const handleConfirmAndContinue = async () => {
    if (!content) {
      toast({
        title: "确认失败",
        description: "请先确保有需求内容",
        variant: "destructive",
        duration: 3000
      })
      return
    }

    try {
      // 保存结构化数据到localStorage
      RequirementExportService.saveStructuredRequirementToStorage(content, sceneStates)

      // 更新场景边界分析任务状态为已完成
      // await updateTask('scene-analysis', {
      //   status: 'completed'
      // })

      // 创建需求书确认任务
      await createTask({
        title: "需求书确认",
        description: "确认生成的需求书内容",
        type: "requirement-book-confirm",
        assignee: "SQ",
        status: "pending"
      })

      toast({
        title: "确认成功",
        description: "已创建需求书确认任务",
        duration: 3000
      })

      // 跳转到需求书确认页面
      window.location.href = "/ai-capability/book-confirm"
    } catch (error) {
      console.error('确认失败:', error)
      toast({
        title: "确认失败",
        description: error instanceof Error ? error.message : "操作过程中出现错误",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  if (!content) {
    return (
      <div className="mx-auto py-6 w-[90%] space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">场景边界分析</h1>
          <p className="text-sm text-muted-foreground mt-1">
            基于需求书中的场景描述，分析每个场景的边界条件和异常情况
          </p>
        </div>

        {/* MD内容输入区域 */}
        <div>
          <Card className="bg-gray-50/50">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium text-gray-500">需求书初稿</CardTitle>
                  <span className="text-xs text-gray-400">(请输入或粘贴需求书内容)</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-0 pb-3">
              <div className="space-y-3">
                <textarea
                  className="w-full min-h-[200px] p-3 text-sm text-gray-600 bg-white rounded-md border resize-y"
                  value={mdContent}
                  onChange={(e) => setMdContent(e.target.value)}
                  placeholder="请在此输入需求书内容..."
                />
                <Button 
                  onClick={handleParse}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  size="sm"
                  disabled={!mdContent.trim()}
                >
                  解析需求书
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-gray-500 mt-6">
          请先输入需求书内容并解析，生成结构化内容
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto py-6 w-[90%] space-y-6">
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
                <span className="text-xs text-gray-400">(点击展开进行编辑)</span>
              </div>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
            </div>
          </CardHeader>
          {isExpanded && (
            <CardContent className="py-0 pb-3">
              <div className="space-y-3">
                <textarea
                  className="w-full min-h-[200px] p-3 text-sm text-gray-600 bg-white rounded-md border resize-y"
                  value={mdContent}
                  onChange={(e) => {
                    setMdContent(e.target.value)
                    localStorage.setItem('requirement-book-content', e.target.value)
                  }}
                  placeholder="请在此输入需求书内容..."
                />
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
              <div key={index} className="flex gap-4">
                {/* 原始场景卡片 */}
                {!sceneStates[scene.name]?.isHideOriginal && (
                  <Card 
                    className={cn(
                      "hover:shadow-lg transition-all duration-300",
                      (sceneStates[scene.name]?.isOptimizing || sceneStates[scene.name]?.optimizeResult) ? "w-1/2" : "w-full"
                    )}
                  >
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">{scene.name}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">场景概述</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {sceneStates[scene.name]?.isEditing ? (
                            <>
                              <Button
                                onClick={() => handleSaveEdit(scene, index)}
                                className="bg-green-500 hover:bg-green-600"
                                size="sm"
                              >
                                <Check className="mr-2 h-3.5 w-3.5" />
                                保存修改
                              </Button>
                              <Button
                                onClick={() => handleCancelEdit(scene)}
                                variant="outline"
                                size="sm"
                                className="border-gray-200"
                              >
                                <X className="mr-2 h-3.5 w-3.5" />
                                取消
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={() => handleStartEdit(scene, index)}
                                variant="outline"
                                size="sm"
                                className="border-blue-200 text-blue-900 hover:bg-blue-50"
                              >
                                <FileEdit className="mr-2 h-3.5 w-3.5" />
                                编辑场景
                              </Button>
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
                              {sceneStates[scene.name]?.isCompleted && !sceneStates[scene.name]?.isOptimizing && (
                                <Button
                                  onClick={() => handleOptimizeRequirement(scene, index)}
                                  variant="default"
                                  size="sm"
                                  className={cn(
                                    "bg-blue-500 hover:bg-blue-600 text-white",
                                    "transition-all duration-200 ease-in-out transform hover:scale-105"
                                  )}
                                  disabled={isOptimizing}
                                >
                                  {isOptimizing && selectedScene?.name === scene.name ? (
                                    <>
                                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                      优化中...
                                    </>
                                  ) : (
                                    <>
                                      <FileEdit className="mr-2 h-3.5 w-3.5" />
                                      完善场景需求描述
                                    </>
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="py-0 pb-3 space-y-3">
                      <div>
                        {sceneStates[scene.name]?.isEditing ? (
                          <textarea
                            className="w-full p-2 text-sm border rounded-md"
                            value={editingScene?.overview}
                            onChange={(e) => setEditingScene(prev => prev ? {...prev, overview: e.target.value} : null)}
                            rows={2}
                          />
                        ) : (
                          <p className="text-sm text-gray-600">{scene.overview}</p>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1.5">用户旅程 ({scene.userJourney.length} 步)</h4>
                        <div className="space-y-1">
                          {sceneStates[scene.name]?.isEditing ? (
                            editingScene?.userJourney.map((step, stepIndex) => (
                              <div key={stepIndex} className="flex gap-2">
                                <input
                                  className="flex-1 p-1 text-sm border rounded-md"
                                  value={step}
                                  onChange={(e) => {
                                    const newJourney = [...editingScene.userJourney]
                                    newJourney[stepIndex] = e.target.value
                                    setEditingScene(prev => prev ? {...prev, userJourney: newJourney} : null)
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="px-2 h-8"
                                  onClick={() => {
                                    const newJourney = editingScene.userJourney.filter((_, i) => i !== stepIndex)
                                    setEditingScene(prev => prev ? {...prev, userJourney: newJourney} : null)
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))
                          ) : (
                            scene.userJourney.map((step, stepIndex) => (
                              <p key={stepIndex} className="text-sm text-gray-600">
                                {stepIndex + 1}. {step}
                              </p>
                            ))
                          )}
                          {sceneStates[scene.name]?.isEditing && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => {
                                const newJourney = [...editingScene?.userJourney || [], '']
                                setEditingScene(prev => prev ? {...prev, userJourney: newJourney} : null)
                              }}
                            >
                              添加步骤
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* 显示分析结果：如果有分析结果就显示 */}
                      {(sceneStates[scene.name]?.analysisResult || selectedScene?.name === scene.name) && (
                        <div className="mt-4 border-t pt-4">
                          <div className="text-sm text-gray-600">
                            {sceneStates[scene.name]?.isEditing ? (
                              <textarea
                                className="w-full p-2 text-sm border rounded-md"
                                value={editingScene?.analysisResult || ''}
                                onChange={(e) => setEditingScene(prev => prev ? {...prev, analysisResult: e.target.value} : null)}
                                rows={10}
                              />
                            ) : (
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h3: ({children}) => <h3 className="text-base font-semibold text-gray-900 mb-2">{children}</h3>,
                                  h4: ({children}) => <h4 className="text-sm font-medium text-gray-700 mb-1.5">{children}</h4>,
                                  ul: ({children}) => <ul className="space-y-1 mb-3">{children}</ul>,
                                  li: ({children}) => <li className="text-sm mb-1 text-orange-700">{children}</li>,
                                  p: ({children}) => <p className="text-sm mb-2 text-orange-700">{children}</p>
                                }}
                              >
                                {sceneStates[scene.name]?.analysisResult || analysisResult || ''}
                              </ReactMarkdown>
                            )}
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
                )}

                {/* 优化后的场景卡片 */}
                {(sceneStates[scene.name]?.isOptimizing || sceneStates[scene.name]?.optimizeResult) && (
                  <Card className={cn(
                    "hover:shadow-lg transition-all duration-300",
                    sceneStates[scene.name]?.isHideOriginal ? "w-full" : "w-1/2"
                  )}>
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base text-blue-600">优化后的场景描述</CardTitle>
                          <CardDescription className="text-xs mt-0.5">基于边界分析结果的完善建议</CardDescription>
                        </div>
                        {sceneStates[scene.name]?.isOptimizeConfirming && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleAcceptOptimize(scene, index)}
                              className="bg-blue-500 hover:bg-blue-600"
                              size="sm"
                            >
                              <Check className="mr-2 h-3.5 w-3.5" />
                              接受优化结果
                            </Button>
                            <Button
                              onClick={() => handleRejectOptimize(scene)}
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-700 hover:bg-red-50"
                            >
                              <X className="mr-2 h-3.5 w-3.5" />
                              拒绝并重新优化
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="py-0 pb-3">
                      <div className="text-sm text-gray-600">
                        {sceneStates[scene.name]?.isOptimizing ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <span className="ml-3 text-blue-600">正在优化场景描述...</span>
                          </div>
                        ) : (
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({children}) => <h1 className="text-xl font-bold mb-2 pb-1 border-b">{children}</h1>,
                              h2: ({children}) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
                              h3: ({children}) => <h3 className="text-base font-medium mb-1 mt-2">{children}</h3>,
                              p: ({children}) => <p className="text-gray-600 my-1 leading-normal text-sm">{children}</p>,
                              ul: ({children}) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
                              li: ({children}) => <li className="text-gray-600 text-sm">{children}</li>,
                              blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1 italic text-sm">{children}</blockquote>,
                              code: ({children}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>,
                              pre: ({children}) => (
                                <div className="relative">
                                  <pre className="bg-gray-50 rounded-lg p-3 my-2 overflow-auto text-sm">{children}</pre>
                                  <div className="absolute top-0 right-0 p-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-1.5 text-gray-500 hover:text-gray-700"
                                      onClick={() => {
                                        const codeContent = children?.toString() || '';
                                        navigator.clipboard.writeText(codeContent);
                                      }}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )
                            }}
                          >
                            {sceneStates[scene.name]?.optimizeResult || optimizeResult || ''}
                          </ReactMarkdown>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end mt-8">
        <Button onClick={handleConfirmAndContinue} className="w-full bg-orange-500 hover:bg-orange-600">
          <ArrowRight className="mr-2 h-4 w-4" />
          确认并继续
        </Button>
      </div>
      <Toaster />
    </div>
  )
} 