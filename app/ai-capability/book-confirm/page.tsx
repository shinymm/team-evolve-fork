'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { StructuredRequirement, StructuredScene } from '@/lib/services/requirement-export-service'
import { createArchitectureSuggestionTask, createArchitectureConfirmTask } from '@/lib/services/task-control'
import { generateArchitectureSuggestions } from '@/lib/services/architecture-suggestion-service'
import { updateTask } from '@/lib/services/task-service'
import { useSystemStore } from '@/lib/stores/system-store'
import type { ArchitectureItem } from '@/types/product-info'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function BookConfirmPage() {
  const [requirement, setRequirement] = useState<StructuredRequirement | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()
  const [currentArchitecture, setCurrentArchitecture] = useState<ArchitectureItem[]>([])
  
  // 从 store 获取系统信息
  const selectedSystemId = useSystemStore(state => state.selectedSystemId)
  const systems = useSystemStore(state => state.systems)
  const currentSystem = systems.find(sys => sys.id === selectedSystemId)

  // 清理分隔线的函数
  const cleanSeparators = (content: string): string => {
    // 移除文本中的Markdown分隔线
    return content.replace(/^\s*---\s*$/gm, '');
  }

  useEffect(() => {
    // 从localStorage加载结构化需求数据
    try {
      const storedReq = localStorage.getItem('structuredRequirement')
      if (!storedReq) {
        console.log('未找到存储的需求数据')
        return
      }

      // 验证JSON格式
      const parsedReq = JSON.parse(storedReq)
      
      // 验证数据结构
      if (!parsedReq || typeof parsedReq !== 'object') {
        throw new Error('需求数据格式无效')
      }

      if (!parsedReq.reqBackground || !parsedReq.reqBrief || !Array.isArray(parsedReq.sceneList)) {
        throw new Error('需求数据结构不完整')
      }

      // 验证场景列表并清理分隔线
      parsedReq.sceneList.forEach((scene: any, index: number) => {
        if (!scene.sceneName || !scene.content) {
          console.error(`场景 ${index + 1} 数据不完整:`, scene);
          throw new Error(`场景 ${index + 1} 数据不完整: 缺少必要字段`)
        }
        // 清理场景内容中的分隔线
        scene.content = cleanSeparators(scene.content);
      })

      setRequirement(parsedReq)
      console.log('需求数据加载成功:', {
        reqBackgroundLength: parsedReq.reqBackground.length,
        reqBriefLength: parsedReq.reqBrief.length,
        sceneCount: parsedReq.sceneList.length,
        scenes: parsedReq.sceneList.map((scene: StructuredScene) => ({
          name: scene.sceneName,
          contentLength: scene.content.length
        }))
      })
    } catch (e) {
      console.error('加载需求数据失败:', e)
      toast({
        title: "加载失败",
        description: e instanceof Error ? e.message : "无法加载需求数据",
        variant: "destructive",
        duration: 3000
      })
    }
  }, [])

  // 加载当前系统的信息架构
  useEffect(() => {
    const loadArchitecture = async () => {
      if (!selectedSystemId) {
        toast({
          title: "错误",
          description: "未选择系统",
          variant: "destructive",
          duration: 3000
        })
        return
      }

      try {
        const response = await fetch(`/api/systems/${selectedSystemId}/product-info`)
        if (!response.ok) {
          throw new Error('加载系统信息架构失败')
        }
        const data = await response.json()
        setCurrentArchitecture(data.architecture || [])
      } catch (error) {
        console.error('加载系统信息架构失败:', error)
        toast({
          title: "错误",
          description: "加载系统信息架构失败",
          variant: "destructive",
          duration: 3000
        })
      }
    }

    if (selectedSystemId) {
      loadArchitecture()
    }
  }, [selectedSystemId])

  const handleExport = () => {
    if (!requirement) return

    // 生成Markdown格式的需求书
    const mdContent = generateMarkdown(requirement)
    
    // 创建Blob对象
    const blob = new Blob([mdContent], { type: 'text/markdown' })
    
    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '需求书.md'
    
    // 触发下载
    document.body.appendChild(a)
    a.click()
    
    // 清理
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "导出成功",
      description: "需求书已导出",
      duration: 3000
    })
  }

  const handleUpdateKnowledge = async () => {
    if (!requirement) {
      toast({
        title: "无法更新",
        description: "未找到需求数据",
        variant: "destructive",
        duration: 3000
      })
      return
    }

    if (!selectedSystemId) {
      toast({
        title: "无法更新",
        description: "未选择系统",
        variant: "destructive",
        duration: 3000
      })
      return
    }

    setIsUpdating(true)
    toast({
      title: "更新任务已启动",
      description: "系统正在分析需求并生成架构调整建议，您可以稍后在产品信息架构页面查看结果",
      duration: 8000
    })

    try {
      // 1. 创建产品知识更新建议任务
      const suggestionTask = await createArchitectureSuggestionTask(requirement)

      // 2. 调用架构建议服务获取建议
      const suggestions = await generateArchitectureSuggestions(requirement, currentArchitecture)

      // 3. 更新建议任务状态为已完成
      await updateTask(suggestionTask.id, {
        status: 'completed'
      })

      // 4. 创建产品知识更新确认任务
      await createArchitectureConfirmTask(suggestions)

      // 5. 跳转到信息架构页面
      window.location.href = '/knowledge/information-architecture'

    } catch (error) {
      console.error('更新产品知识失败:', error)
      let errorMessage = "请稍后重试"
      
      if (error instanceof Error) {
        if (error.message === '未配置AI模型') {
          errorMessage = "请先配置AI模型"
        } else if (error.message === 'AI服务返回为空') {
          errorMessage = "AI服务未返回有效建议"
        } else if (error.message.includes('Invalid')) {
          errorMessage = "AI返回的建议格式不正确"
        } else {
          errorMessage = error.message
        }
      }
      
      toast({
        title: "更新失败",
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      })
    } finally {
      setIsUpdating(false)
    }
  }

  // 生成Markdown格式的需求书
  const generateMarkdown = (req: StructuredRequirement): string => {
    let md = '# 需求书\n\n'
    
    md += '## 需求背景\n\n'
    md += cleanSeparators(req.reqBackground) + '\n\n'
    
    md += '## 需求概述\n\n'
    md += cleanSeparators(req.reqBrief) + '\n\n'
    
    md += '## 需求详情\n\n'
    
    req.sceneList.forEach((scene, index) => {
      md += `### ${index + 1}. ${scene.sceneName}\n\n`
      // 确保场景内容没有分隔线
      const cleanContent = cleanSeparators(scene.content);
      md += cleanContent + '\n\n'
    })
    
    return md
  }

  if (!requirement) {
    return (
      <div className="mx-auto py-6 w-[90%] space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">需求书确认</h1>
          <p className="text-sm text-muted-foreground mt-1">
            确认生成的需求书内容，并导出最终版本
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>加载需求数据中...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto py-6 w-[90%] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">需求书确认</h1>
          <p className="text-xs text-muted-foreground mt-1">
            确认生成的需求书内容，并导出最终版本
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} className="bg-orange-500 hover:bg-orange-600">
            导出需求书
          </Button>
          <Button 
            onClick={handleUpdateKnowledge} 
            className="bg-blue-500 hover:bg-blue-600"
            disabled={true}
          >
            更新产品相关知识（重构中）
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">需求背景</h3>
            <div className="text-sm">
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
                  code: ({children}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>
                }}
              >
                {cleanSeparators(requirement.reqBackground)}
              </ReactMarkdown>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-2">需求概述</h3>
            <div className="text-sm">
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
                  code: ({children}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>
                }}
              >
                {cleanSeparators(requirement.reqBrief)}
              </ReactMarkdown>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">场景列表</h3>
            <div className="space-y-6">
              {requirement.sceneList.map((scene, index) => (
                <Card key={index} className="border-gray-200">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {index + 1}. {scene.sceneName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
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
                          code: ({children}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>
                        }}
                      >
                        {cleanSeparators(scene.content)}
                      </ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Toaster />
    </div>
  )
} 