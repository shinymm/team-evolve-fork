'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { streamingAICall } from '@/lib/ai-service'
import { getAIConfig } from '@/lib/ai-config-service'
import { Card } from "@/components/ui/card"
import { Loader2, Copy, Download, Edit2, Save, ArrowRight } from "lucide-react"
import { requirementBookPrompt } from '@/lib/prompts/requirement-book'
import { updateTask } from '@/lib/services/task-service'
import { createRequirementStructureTask, createSceneAnalysisTask } from '@/lib/services/task-control'
import { RequirementParserService } from '@/lib/services/requirement-parser-service'
import { useRouter } from 'next/navigation'
import { Toaster } from "@/components/ui/toaster"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getTasks } from '@/lib/services/task-service'

export default function RequirementBook() {
  const [originalRequirement, setOriginalRequirement] = useState('')
  const [requirementBook, setRequirementBook] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedBook, setEditedBook] = useState('')
  const { toast } = useToast()
  const router = useRouter()

  // 页面加载时检查前置任务状态并获取数据
  useEffect(() => {
    const checkPreviousTaskAndLoadData = async () => {
      try {
        const allTasks = await getTasks()
        const requirementAnalysisTask = allTasks.find(t => t.id === 'requirement-analysis')
        
        // 只有当原始需求分析任务完成时，才加载历史数据
        if (requirementAnalysisTask?.status === 'completed') {
          const savedAnalysis = localStorage.getItem('requirement-analysis-content')
          if (savedAnalysis) {
            setOriginalRequirement(savedAnalysis)
          }
        } 
      } catch (error) {
        console.error('Error checking task status:', error)
      }
    }

    checkPreviousTaskAndLoadData()
  }, [])

  // 自动生成的处理函数，与handleSubmit类似但接受内容参数
  const handleAutoGenerate = async (content: string) => {
    const aiConfig = getAIConfig()
    if (!aiConfig) {
      toast({
        title: "配置错误",
        description: "请先配置AI模型参数",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setRequirementBook('')

    try {
      const prompt = requirementBookPrompt(content)
      await streamingAICall(
        prompt,
        aiConfig,
        (content) => {
          setRequirementBook(prev => prev + content)
        }
      )
    } catch (error) {
      toast({
        title: "生成失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = async () => {
    if (!originalRequirement.trim()) {
      toast({
        title: "请输入原始需求分析结果",
        description: "需求内容不能为空",
        variant: "destructive",
      })
      return
    }

    const aiConfig = getAIConfig()
    if (!aiConfig) {
      toast({
        title: "配置错误",
        description: "请先配置AI模型参数",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setRequirementBook('')

    try {
      const prompt = requirementBookPrompt(originalRequirement)
      await streamingAICall(
        prompt,
        aiConfig,
        (content) => {
          setRequirementBook(prev => prev + content)
        }
      )
    } catch (error) {
      toast({
        title: "生成失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(requirementBook)
      toast({
        title: "复制成功",
        description: "需求书内容已复制到剪贴板",
      })
    } catch (error) {
      toast({
        title: "复制失败",
        description: "请手动选择并复制内容",
        variant: "destructive",
      })
    }
  }

  const handleDownload = () => {
    try {
      const blob = new Blob([requirementBook], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `需求书-${timestamp}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: "下载成功",
        description: "需求书已保存为 Markdown 文件",
      })
    } catch (error) {
      toast({
        title: "下载失败",
        description: "请手动复制内容并保存",
        variant: "destructive",
      })
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
    setEditedBook(requirementBook)
  }

  const handleSave = () => {
    setRequirementBook(editedBook)
    setIsEditing(false)
    toast({
      title: "保存成功",
      description: "需求书内容已更新",
    })
  }

  const handleConfirm = async () => {
    try {
      console.log('开始更新任务状态...');
      
      // 保存需求书MD内容到localStorage
      localStorage.setItem('requirement-book-content', requirementBook);
      
      // 1. 更新需求书任务状态为完成
      console.log('更新需求书任务状态...');
      await updateTask('requirement-book', {
        status: 'completed'
      })
      
      // 2. 创建需求书结构化任务
      console.log('创建需求书结构化任务...');
      const structureTask = await createRequirementStructureTask(requirementBook)
      
      // 3. 解析需求书内容
      console.log('解析需求书内容...');
      const parser = new RequirementParserService()
      const parsedRequirement = parser.parseRequirement(requirementBook)
      
      // 4. 标记结构化任务完成
      console.log('更新结构化任务状态...');
      await updateTask(structureTask.id, {
        status: 'completed'
      })
      
      // 5. 创建场景边界分析任务
      console.log('创建场景边界分析任务...');
      await createSceneAnalysisTask(parsedRequirement)
      
      console.log('所有任务状态更新完成');
      
      toast({
        title: "需求初稿衍化与结构化已完成",
        description: "已创建后续场景边界分析任务",
      })
      
      // 直接使用 window.location.replace 进行导航
      window.location.replace('/collaboration/tactical-board')
    } catch (error) {
      console.error('任务状态更新失败:', error);
      toast({
        title: "处理失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <div className=" mx-auto py-6 w-[90%]">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">需求初稿衍化</h1>
            <div className="flex items-center justify-between mt-2">
              <p className="text-muted-foreground text-sm">
                请输入原始需求分析结果，我们将帮助您生成一份结构化的需求书初稿。
              </p>
              <div className="flex gap-1 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOriginalRequirement('')}
                  className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                  disabled={isGenerating}
                >
                  清空内容
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const savedAnalysis = localStorage.getItem('requirement-analysis-content')
                    if (savedAnalysis) {
                      setOriginalRequirement(savedAnalysis)
                      toast({
                        title: "加载成功",
                        description: "已重新加载需求分析内容",
                      })
                    } else {
                      toast({
                        title: "加载失败",
                        description: "未找到保存的需求分析内容",
                        variant: "destructive",
                      })
                    }
                  }}
                  className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                  disabled={isGenerating}
                >
                  重新加载
                </Button>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <Textarea
              placeholder="请粘贴原始需求分析结果（Markdown格式）..."
              className="min-h-[200px]"
              value={originalRequirement}
              onChange={(e) => setOriginalRequirement(e.target.value)}
              disabled={isGenerating}
            />
            <Button 
              onClick={handleSubmit} 
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在生成...
                </>
              ) : (
                '需求书衍化'
              )}
            </Button>

            {requirementBook && (
              <div className="space-y-4">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="text-gray-500 hover:text-gray-700"
                    disabled={isGenerating}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    复制内容
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="text-gray-500 hover:text-gray-700"
                    disabled={isGenerating}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    下载需求书
                  </Button>
                  {!isEditing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEdit}
                      className="text-gray-500 hover:text-gray-700"
                      disabled={isGenerating}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      编辑内容
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSave}
                      className="text-orange-600 hover:text-orange-700"
                      disabled={isGenerating}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      保存修改
                    </Button>
                  )}
                </div>
                <Card className="p-6 mt-4">
                  {isEditing ? (
                    <Textarea
                      value={editedBook}
                      onChange={(e) => setEditedBook(e.target.value)}
                      className="min-h-[600px] w-full resize-y"
                      disabled={isGenerating}
                    />
                  ) : (
                    <div className="space-y-4">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({children}) => <h1 className="text-2xl font-bold mb-4 pb-2 border-b">{children}</h1>,
                          h2: ({children}) => <h2 className="text-xl font-semibold mb-3 mt-6">{children}</h2>,
                          h3: ({children}) => <h3 className="text-lg font-medium mb-2 mt-4">{children}</h3>,
                          p: ({children}) => <p className="text-gray-600 my-2 leading-relaxed">{children}</p>,
                          ul: ({children}) => <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>,
                          ol: ({children}) => <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>,
                          li: ({children}) => <li className="text-gray-600">{children}</li>,
                          blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 pl-4 my-2 italic">{children}</blockquote>,
                          code: ({children}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-sm">{children}</code>,
                          pre: ({children}) => <pre className="bg-gray-50 rounded-lg p-4 my-4 overflow-auto">{children}</pre>
                        }}
                      >
                        {requirementBook}
                      </ReactMarkdown>
                    </div>
                  )}
                </Card>
                {!isEditing && (
                  <Button 
                    onClick={handleConfirm}
                    className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
                    disabled={isGenerating}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    确认并继续
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </>
  )
} 