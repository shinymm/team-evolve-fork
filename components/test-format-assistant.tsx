'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Copy } from 'lucide-react'
import { getDefaultConfig, streamingAICall } from '@/lib/ai-service'
import type { AIModelConfig } from '@/lib/ai-service'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { testFormatPromptTemplate } from '@/lib/prompts'

export function TestFormatAssistant() {
  const [testDescription, setTestDescription] = useState('')
  const [result, setResult] = useState('')
  const [isFormatting, setIsFormatting] = useState(false)
  const [aiConfig, setAiConfig] = useState<AIModelConfig | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const config = getDefaultConfig()
    if (config) {
      setAiConfig(config)
    }
  }, [])

  const handleFormat = async () => {
    if (!testDescription.trim() || !aiConfig) return

    setIsFormatting(true)
    let formattedResult = ''

    try {
      const prompt = testFormatPromptTemplate.replace('{test_description}', testDescription)

      await streamingAICall(
        prompt,
        {
          model: aiConfig.model,
          apiKey: aiConfig.apiKey,
          baseURL: aiConfig.baseURL,
          temperature: 0.7
        },
        (content: string) => {
          formattedResult += content
          setResult(formattedResult)
        }
      )

      toast({
        title: "格式化完成",
        description: "测试用例已格式化，请查看结果",
      })
    } catch (error) {
      console.error('Format error:', error)
      toast({
        variant: "destructive",
        title: "格式化失败",
        description: error instanceof Error ? error.message : "未知错误",
      })
    } finally {
      setIsFormatting(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result)
      toast({
        title: "复制成功",
        description: "内容已复制到剪贴板",
      })
    } catch (error) {
      console.error('Copy error:', error)
      toast({
        variant: "destructive",
        title: "复制失败",
        description: "无法访问剪贴板",
      })
    }
  }

  return (
    <div className="space-y-2">
      {!aiConfig && (
        <Alert>
          <AlertTitle>提示</AlertTitle>
          <AlertDescription>
            请先在设置中配置并选择默认的 AI 模型
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <h2 className="text-lg font-semibold">请输入测试描述：</h2>
        <Textarea
          placeholder="请输入需要格式化的测试描述..."
          value={testDescription}
          onChange={(e) => setTestDescription(e.target.value)}
          className="min-h-[100px] w-full"
        />
      </div>

      <div className="flex justify-center mt-1 w-full">
        <Button
          onClick={handleFormat}
          disabled={!testDescription.trim() || isFormatting || !aiConfig}
          className="w-full bg-orange-600 hover:bg-orange-700"
        >
          {isFormatting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              格式化中...
            </>
          ) : (
            '测试用例格式化'
          )}
        </Button>
      </div>

      {result && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex justify-end mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              title="复制到剪贴板"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
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