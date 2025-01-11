'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from 'lucide-react'
import { getDefaultConfig, streamingAICall } from '@/lib/ai-service'
import type { AIModelConfig } from '@/lib/ai-service'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { testCasePromptTemplate } from '@/lib/prompts'

export function TestCaseAssistant() {
  const [requirements, setRequirements] = useState('')
  const [result, setResult] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiConfig, setAiConfig] = useState<AIModelConfig | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const config = getDefaultConfig()
    if (config) {
      setAiConfig(config)
    }
  }, [])

  const handleGenerate = async () => {
    if (!requirements.trim() || !aiConfig) return

    setIsGenerating(true)
    let generatedResult = ''

    try {
      const prompt = testCasePromptTemplate.replace('{requirements_doc}', requirements)

      await streamingAICall(
        prompt,
        {
          model: aiConfig.model,
          apiKey: aiConfig.apiKey,
          baseURL: aiConfig.baseURL,
          temperature: 0.7
        },
        (content: string) => {
          generatedResult += content
          setResult(generatedResult)
        }
      )

      toast({
        title: "生成完成",
        description: "测试用例已生成，请查看结果",
      })
    } catch (error) {
      console.error('Generation error:', error)
      toast({
        variant: "destructive",
        title: "生成失败",
        description: error instanceof Error ? error.message : "未知错误",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      {!aiConfig && (
        <Alert>
          <AlertTitle>提示</AlertTitle>
          <AlertDescription>
            请先在设置中配置并选择默认的 AI 模型
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">请输入需求描述：</h2>
        <Textarea
          placeholder="请输入需求描述、核心功能、边界场景及处理方式等信息..."
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          className="min-h-[200px]"
        />
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleGenerate}
          disabled={!requirements.trim() || isGenerating || !aiConfig}
          className="w-40 bg-blue-600 hover:bg-blue-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              生成中...
            </>
          ) : (
            '生成测试用例'
          )}
        </Button>
      </div>

      {result && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="prose prose-gray max-w-none overflow-x-auto">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              className="markdown-body"
            >
              {result}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
} 