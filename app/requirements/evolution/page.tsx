'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { streamingAICall } from '@/lib/ai-service'
import { getAIConfig } from '@/lib/ai-config-service'
import { Card } from "@/components/ui/card"
import { Loader2, Copy, Download, Edit2, Save, ArrowRight } from "lucide-react"
import { requirementAnalysisPrompt } from '@/lib/prompts/requirement-analysis'
import { updateTask } from '@/lib/services/task-service'
import { useRouter } from 'next/navigation'
import { Toaster } from "@/components/ui/toaster"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { recordRequirementAction } from '@/lib/services/requirement-action-service'

export default function RequirementAnalysis() {
  const [analysis, setAnalysis] = useState<string>('')
  const [requirement, setRequirement] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedAnalysis, setEditedAnalysis] = useState('')
  const [editStartTime, setEditStartTime] = useState<number | null>(null)
  const originalContent = useRef<string>('')
  const { toast } = useToast()
  const router = useRouter()

  // 使用 useEffect 安全地加载 localStorage 数据
  useEffect(() => {
    const savedAnalysis = localStorage.getItem('requirement-analysis-content')
    const savedRequirement = localStorage.getItem('requirement-input')
    
    if (savedAnalysis) setAnalysis(savedAnalysis)
    if (savedRequirement) setRequirement(savedRequirement)
  }, [])

  // 当需求内容变化时，保存到 localStorage
  const handleRequirementChange = (value: string) => {
    setRequirement(value)
    localStorage.setItem('requirement-input', value)
  }

  const handleSubmit = async () => {
    if (!requirement.trim()) {
      toast({
        title: "请输入需求",
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

    setIsAnalyzing(true)
    setAnalysis('')

    try {
      const prompt = requirementAnalysisPrompt(requirement)
      await streamingAICall(
        prompt,
        aiConfig,
        (content) => {
          setAnalysis(prev => prev + content)
        }
      )
    } catch (error) {
      toast({
        title: "分析失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(analysis)
      toast({
        title: "复制成功",
        description: "分析内容已复制到剪贴板",
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
      const blob = new Blob([analysis], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `需求分析-${timestamp}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: "下载成功",
        description: "分析内容已保存为 Markdown 文件",
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
    setEditedAnalysis(analysis)
    setEditStartTime(Date.now())
    originalContent.current = analysis
  }

  const handleSave = async () => {
    const editEndTime = Date.now()
    const editDuration = editStartTime ? (editEndTime - editStartTime) / 1000 : 0
    const contentDiff = editedAnalysis.length - originalContent.current.length

    // 只有当编辑时间超过30秒且内容变化超过20字时才记录
    if (editDuration > 30 && Math.abs(contentDiff) > 20) {
      try {
        await recordRequirementAction({
          type: 'edit',
          duration: editDuration,
          contentBefore: originalContent.current,
          contentAfter: editedAnalysis,
        })
      } catch (error) {
        console.error('记录编辑动作失败:', error)
      }
    }

    setAnalysis(editedAnalysis)
    setIsEditing(false)
    setEditStartTime(null)
    // 保存编辑后的内容到 localStorage
    localStorage.setItem('requirement-analysis-content', editedAnalysis)
    toast({
      title: "保存成功",
      description: "分析内容已更新",
    })
  }

  const handleConfirm = async () => {
    try {
      // 保存最终的需求分析内容到 localStorage
      localStorage.setItem('requirement-analysis-content', analysis);
      
      // 记录需求分析完成的动作
      await recordRequirementAction({
        type: 'analyze',
        duration: 0,  // 这里的持续时间不重要
        contentAfter: analysis,  // 最终的分析结果
      });
      
      await updateTask('requirement-analysis', {
        status: 'completed'
      })
      toast({
        title: "需求分析完成",
        description: "已更新任务状态",
      })
      router.push('/collaboration/tactical-board')
    } catch (error) {
      toast({
        title: "状态更新失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <div className="mx-auto py-6 w-[90%]">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">原始需求分析</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              请输入您的初步需求想法，我们将帮助您逐步细化和完善它。
            </p>
          </div>
          
          <div className="space-y-4">
            <Textarea
              placeholder="请描述您的需求想法..."
              className="min-h-[100px]"
              value={requirement}
              onChange={(e) => handleRequirementChange(e.target.value)}
            />
            <Button 
              onClick={handleSubmit} 
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在分析...
                </>
              ) : (
                '开始分析'
              )}
            </Button>

            {analysis && (
              <div className="space-y-4">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="text-gray-500 hover:text-gray-700"
                    disabled={isAnalyzing}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    复制内容
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="text-gray-500 hover:text-gray-700"
                    disabled={isAnalyzing}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    下载分析
                  </Button>
                  {!isEditing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEdit}
                      className="text-gray-500 hover:text-gray-700"
                      disabled={isAnalyzing}
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
                      disabled={isAnalyzing}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      保存修改
                    </Button>
                  )}
                </div>
                <Card className="p-6 mt-4">
                  {isEditing ? (
                    <Textarea
                      value={editedAnalysis}
                      onChange={(e) => setEditedAnalysis(e.target.value)}
                      className="min-h-[600px] w-full resize-y"
                      disabled={isAnalyzing}
                    />
                  ) : (
                    <div className="space-y-4">
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
                        {analysis}
                      </ReactMarkdown>
                    </div>
                  )}
                </Card>
                {!isEditing && (
                  <Button 
                    onClick={handleConfirm}
                    className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
                    disabled={isAnalyzing}
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