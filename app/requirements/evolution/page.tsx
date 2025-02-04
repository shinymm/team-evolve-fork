'use client'

import { useState, useEffect } from 'react'
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

export default function RequirementAnalysis() {
  const [analysis, setAnalysis] = useState<string>('')
  const [requirement, setRequirement] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedAnalysis, setEditedAnalysis] = useState('')
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
  }

  const handleSave = () => {
    setAnalysis(editedAnalysis)
    setIsEditing(false)
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