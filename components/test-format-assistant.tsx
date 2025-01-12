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
import yaml from 'yaml'
import { testFormatPromptTemplate } from '@/lib/prompts'

interface TestCase {
  type: string
  summary: string
  preconditions: string
  steps: string
  expected_result: string
}

interface YamlData {
  test_cases: TestCase[]
}

export function TestFormatAssistant() {
  const [testDescription, setTestDescription] = useState('')
  const [result, setResult] = useState('')
  const [parsedResult, setParsedResult] = useState<TestCase[]>([])
  const [isFormatting, setIsFormatting] = useState(false)
  const [aiConfig, setAiConfig] = useState<AIModelConfig | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const config = getDefaultConfig()
    if (config) {
      setAiConfig(config)
    }
  }, [])

  useEffect(() => {
    const tryParseYaml = (content: string) => {
      try {
        const parsed: YamlData = yaml.parse(content)
        if (parsed?.test_cases && Array.isArray(parsed.test_cases)) {
          const validTestCases = parsed.test_cases.filter(testCase => 
            testCase && typeof testCase === 'object'
          ) as TestCase[]
          
          if (validTestCases.length > 0) {
            setParsedResult(validTestCases)
            return true
          }
        }
      } catch {
        // 静默处理解析错误
        return false
      }
      return false
    }

    try {
      if (result.includes('test_cases:')) {
        // 尝试多种清理方式，直到成功解析
        const attempts = [
          // 尝试1: 只取到第一个代码块之前的内容
          () => result.substring(result.indexOf('test_cases:')).split('```')[0].trim(),
          // 尝试2: 移除所有代码块标记
          () => result.substring(result.indexOf('test_cases:')).replace(/```/g, '').trim(),
          // 尝试3: 只保留非空行且不以```开头的行
          () => result.substring(result.indexOf('test_cases:'))
            .split('\n')
            .filter(line => line.trim() && !line.trim().startsWith('```'))
            .join('\n')
        ]

        // 依次尝试不同的清理方式
        for (const attempt of attempts) {
          const yamlContent = attempt()
          if (tryParseYaml(yamlContent)) {
            break
          }
        }
      }
    } catch {
      // 完全静默处理所有错误
    }
  }, [result])

  const handleFormat = async () => {
    if (!testDescription.trim() || !aiConfig) return

    setIsFormatting(true)
    setResult('')
    setParsedResult([])
    let formattedResult = ''

    try {
      const prompt = testFormatPromptTemplate.replace('{test_description}', testDescription)

      await streamingAICall(
        prompt,
        {
          model: aiConfig.model,
          apiKey: aiConfig.apiKey,
          baseURL: aiConfig.baseURL,
          temperature: 0.5
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

      {parsedResult.length > 0 && (
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">类型</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">用例概述</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">前提条件</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">用例步骤</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">预期结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {parsedResult.map((testCase, index) => (
                  <tr key={index} className="even:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-500">{testCase?.type || ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{testCase?.summary || ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{testCase?.preconditions || ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-500 whitespace-pre-line">
                      {testCase?.steps || ''}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500">
                      {testCase?.expected_result || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
} 