'use client'

import { useState } from 'react'
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

export default function RequirementEvolution() {
  const [requirement, setRequirement] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedAnalysis, setEditedAnalysis] = useState('')
  const { toast } = useToast()
  const router = useRouter()

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
      const prompt = requirementEvolutionPrompt(requirement)
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
      <div className="container mx-auto py-6 w-[90%]">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">原始需求分析</h1>
            <p className="text-muted-foreground mt-2">
              请输入您的初步需求想法，我们将帮助您逐步细化和完善它。
            </p>
          </div>
          
          <div className="space-y-4">
            <Textarea
              placeholder="请描述您的需求想法..."
              className="min-h-[100px]"
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
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
                    <div className="prose prose-slate max-w-none dark:prose-invert
                      prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b
                      prose-h2:text-xl prose-h2:font-semibold prose-h2:mb-3 prose-h2:mt-6
                      prose-h3:text-lg prose-h3:font-medium prose-h3:mb-2 prose-h3:mt-4
                      prose-p:my-2 prose-p:leading-relaxed
                      prose-ul:my-2 prose-ul:list-disc prose-ul:pl-6
                      prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-6
                      prose-li:my-1
                      prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic
                      prose-pre:bg-gray-50 prose-pre:p-4 prose-pre:rounded-lg
                      prose-code:text-sm prose-code:bg-gray-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                      prose-strong:font-semibold
                      prose-table:border-collapse prose-table:w-full
                      prose-th:border prose-th:border-gray-300 prose-th:p-2 prose-th:bg-gray-50
                      prose-td:border prose-td:border-gray-300 prose-td:p-2
                    ">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
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