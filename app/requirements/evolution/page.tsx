'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { streamingAICall } from '@/lib/ai-service'
import { getAIConfig } from '@/lib/ai-config-service'
import { Card } from "@/components/ui/card"
import { Loader2, Copy, Download } from "lucide-react"
import { requirementEvolutionPrompt } from '@/lib/prompts/requirement-evolution'

export default function RequirementEvolution() {
  const [requirement, setRequirement] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const { toast } = useToast()

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

  return (
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
                >
                  <Copy className="mr-2 h-4 w-4" />
                  复制内容
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <Download className="mr-2 h-4 w-4" />
                  下载分析
                </Button>
              </div>
              <Card className="p-6 mt-4 whitespace-pre-wrap">
                {analysis}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 