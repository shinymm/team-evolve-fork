'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { streamingAICall } from '@/lib/services/ai-service'
import { getDefaultAIConfig } from '@/lib/services/ai-config-service'
import { Card } from "@/components/ui/card"
import { Loader2, Copy, Download } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Toaster } from "@/components/ui/toaster"
import { boundaryAnalysisPrompt } from '@/lib/prompts/boundary-analysis'
import { boundaryAnalysisPrompt as boundarySuggestionPrompt } from '@/lib/prompts/boundary-suggestion'
import { boundaryAnalysisPrompt as boundaryAnalysisNewPrompt } from '@/lib/prompts/boundary-analysis-new'
import { boundaryAnalysisPrompt as boundarySuggestionNewPrompt } from '@/lib/prompts/boundary-suggestion-new'

export default function BoundaryAnalysis() {
  const [requirement, setRequirement] = useState('')
  const [relatedRequirements, setRelatedRequirements] = useState('')
  const [relatedTerms, setRelatedTerms] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [isAnalyzingNew, setIsAnalyzingNew] = useState(false)
  const [isSuggestingNew, setIsSuggestingNew] = useState(false)
  const { toast } = useToast()

  const handleAnalysis = async (type: 'analysis' | 'suggestion' | 'analysis-new' | 'suggestion-new') => {
    if (!requirement.trim()) {
      toast({
        title: "请输入需求内容",
        description: "需求内容不能为空",
        variant: "destructive",
        duration: 3000
      })
      return
    }

    const aiConfig = await getDefaultAIConfig()
    if (!aiConfig) {
      toast({
        title: "配置错误",
        description: "请先配置AI模型参数",
        variant: "destructive",
        duration: 3000
      })
      return
    }

    // 设置对应的加载状态
    switch (type) {
      case 'analysis':
        setIsAnalyzing(true)
        break
      case 'suggestion':
        setIsSuggesting(true)
        break
      case 'analysis-new':
        setIsAnalyzingNew(true)
        break
      case 'suggestion-new':
        setIsSuggestingNew(true)
        break
    }
    setAnalysis('')

    try {
      // 根据类型使用不同的提示词模板
      let prompt
      switch (type) {
        case 'analysis':
          prompt = boundaryAnalysisPrompt(
            requirement,
            relatedRequirements || '无相关需求摘要',
            relatedTerms || '无相关术语'
          )
          break
        case 'suggestion':
          prompt = boundarySuggestionPrompt(
            requirement,
            relatedRequirements || '无相关需求摘要',
            relatedTerms || '无相关术语'
          )
          break
        case 'analysis-new':
          prompt = boundaryAnalysisNewPrompt(
            requirement,
            relatedRequirements || '无相关需求摘要',
            relatedTerms || '无相关术语'
          )
          break
        case 'suggestion-new':
          prompt = boundarySuggestionNewPrompt(
            requirement,
            relatedRequirements || '无相关需求摘要',
            relatedTerms || '无相关术语'
          )
          break
      }

      let currentAnalysis = '';
      await streamingAICall(
        prompt,
        aiConfig,
        (content: string) => {
          currentAnalysis += content;
          setAnalysis(currentAnalysis);
        },
        (error: string) => {
          toast({
            title: "分析失败",
            description: error,
            variant: "destructive",
            duration: 3000
          })
        }
      )
    } catch (error) {
      toast({
        title: "分析失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
        duration: 3000
      })
    } finally {
      // 重置所有加载状态
      setIsAnalyzing(false)
      setIsSuggesting(false)
      setIsAnalyzingNew(false)
      setIsSuggestingNew(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(analysis)
      toast({
        title: "复制成功",
        description: "分析内容已复制到剪贴板",
        duration: 3000
      })
    } catch (error) {
      toast({
        title: "复制失败",
        description: "请手动选择并复制内容",
        variant: "destructive",
        duration: 3000
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
      a.download = `需求边界分析-${timestamp}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: "下载成功",
        description: "分析内容已保存为 Markdown 文件",
        duration: 3000
      })
    } catch (error) {
      toast({
        title: "下载失败",
        description: "请手动复制内容并保存",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  return (
    <div className="mx-auto py-6 w-[90%]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">需求边界分析建议</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            通过分析需求内容、相关需求和术语，帮助您更好地理解和定义需求边界。
          </p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              需求内容
            </label>
            <Textarea
              placeholder="请输入需要分析的需求内容..."
              className="min-h-[100px]"
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              相关需求摘要参考（可选）
            </label>
            <Textarea
              placeholder="请输入相关的需求摘要，帮助分析需求边界..."
              className="min-h-[100px]"
              value={relatedRequirements}
              onChange={(e) => setRelatedRequirements(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              相关术语参考（可选）
            </label>
            <Textarea
              placeholder="请输入相关的术语定义，帮助明确概念边界..."
              className="min-h-[100px]"
              value={relatedTerms}
              onChange={(e) => setRelatedTerms(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">旧版本</h3>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleAnalysis('analysis')} 
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  disabled={isAnalyzing || isSuggesting || isAnalyzingNew || isSuggestingNew}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在分析...
                    </>
                  ) : (
                    '需求边界分析（旧版本）'
                  )}
                </Button>

                <Button 
                  onClick={() => handleAnalysis('suggestion')} 
                  className="flex-1 bg-blue-500 hover:bg-blue-600"
                  disabled={isAnalyzing || isSuggesting || isAnalyzingNew || isSuggestingNew}
                >
                  {isSuggesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在生成建议...
                    </>
                  ) : (
                    '需求优化建议（旧版本）'
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">新版本</h3>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleAnalysis('analysis-new')} 
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  disabled={isAnalyzing || isSuggesting || isAnalyzingNew || isSuggestingNew}
                >
                  {isAnalyzingNew ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在分析...
                    </>
                  ) : (
                    '需求边界分析（新版本）'
                  )}
                </Button>

                <Button 
                  onClick={() => handleAnalysis('suggestion-new')} 
                  className="flex-1 bg-blue-500 hover:bg-blue-600"
                  disabled={isAnalyzing || isSuggesting || isAnalyzingNew || isSuggestingNew}
                >
                  {isSuggestingNew ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在生成建议...
                    </>
                  ) : (
                    '需求优化建议（新版本）'
                  )}
                </Button>
              </div>
            </div>
          </div>

          {analysis && (
            <div className="space-y-4">
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  className="h-8 w-8 rounded-full"
                  disabled={isAnalyzing || isSuggesting || isAnalyzingNew || isSuggestingNew}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDownload}
                  className="h-8 w-8 rounded-full"
                  disabled={isAnalyzing || isSuggesting || isAnalyzingNew || isSuggestingNew}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              
              <Card className="p-6">
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
              </Card>
            </div>
          )}
        </div>
      </div>
      <Toaster />
    </div>
  )
} 