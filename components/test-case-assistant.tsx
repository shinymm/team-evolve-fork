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
import { testCasePromptTemplate } from '@/lib/prompts'
import yaml from 'js-yaml'

interface TestCase {
  type: string
  summary: string
  preconditions: string
  steps: string
  expected_result: string
}

export function TestCaseAssistant() {
  const [requirements, setRequirements] = useState('')
  const [result, setResult] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiConfig, setAiConfig] = useState<AIModelConfig | null>(null)
  const [parsedTestCases, setParsedTestCases] = useState<TestCase[]>([])
  const { toast } = useToast()
  const [isOutputComplete, setIsOutputComplete] = useState(false)

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
    let yamlContent = ''

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
          yamlContent += content
          
          // 尝试解析当前累积的内容
          if (yamlContent.includes('test_cases:')) {
            try {
              // 提取YAML部分
              const yamlMatch = yamlContent.match(/test_cases:[\s\S]*/)
              if (yamlMatch) {
                const yamlStr = yamlMatch[0]
                const parsed = yaml.load(yamlStr, {
                  json: true,
                  schema: yaml.JSON_SCHEMA
                }) as any;

                if (parsed && Array.isArray(parsed.test_cases)) {
                  const testCases = parsed.test_cases.map((tc: any) => ({
                    type: tc.type || '',
                    summary: tc.summary || '',
                    preconditions: tc.preconditions || '',
                    steps: tc.steps || '',
                    expected_result: tc.expected_result || ''
                  }));
                  
                  if (testCases.length > 0) {
                    setParsedTestCases(testCases);
                  }
                }
              }
            } catch (e) {
              // 解析错误时继续累积
            }
          }
          
          // 始终更新原始结果，用于在解析失败时显示
          setResult(generatedResult)
        }
      )

      setIsOutputComplete(true)
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

  const handleCopyYaml = async () => {
    try {
      await navigator.clipboard.writeText(result)
      toast({
        title: "复制成功",
        description: "YAML内容已复制到剪贴板",
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

  const handleCopyTable = async () => {
    try {
      // 生成TSV格式（Excel可以直接粘贴）
      const header = ['类型', '用例概述', '前提条件', '用例步骤', '预期结果'].join('\t')
      const rows = parsedTestCases.map(testCase => {
        // 处理步骤中的换行，将其替换为分号加空格
        const steps = testCase?.steps?.replace(/\n/g, '; ') || ''
        
        return [
          testCase?.type || '',
          testCase?.summary || '',
          testCase?.preconditions || '',
          steps,
          testCase?.expected_result || ''
        ].join('\t')
      })
      
      const tableContent = [header, ...rows].join('\n')
      await navigator.clipboard.writeText(tableContent)
      
      toast({
        title: "复制成功",
        description: "表格内容已复制到剪贴板",
      })
    } catch (error) {
      console.error('Copy table error:', error)
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
        <h2 className="text-lg font-semibold">请输入需求描述：</h2>
        <Textarea
          placeholder="请输入需求描述、核心功能、边界场景及处理方式等信息..."
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          className="min-h-[100px] w-full"
        />
      </div>

      <div className="flex justify-center mt-1 w-full">
        <Button
          onClick={handleGenerate}
          disabled={!requirements.trim() || isGenerating || !aiConfig}
          className="w-full bg-orange-600 hover:bg-orange-700"
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

      <div className="text-xs text-gray-500">
        Debug: {parsedTestCases.length} test cases parsed
      </div>

      {parsedTestCases.length > 0 && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex justify-end gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyTable}
              title="复制为表格格式"
              disabled={!isOutputComplete}
            >
              <Copy className="h-4 w-4 mr-1" />
              复制表格
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyYaml}
              title="复制YAML格式"
              disabled={!isOutputComplete}
            >
              <Copy className="h-4 w-4 mr-1" />
              复制YAML
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">概述</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">前提条件</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">步骤</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">预期结果</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {parsedTestCases.map((testCase, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{testCase.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{testCase.summary}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{testCase.preconditions}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-pre-line">{testCase.steps}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{testCase.expected_result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!parsedTestCases.length && result && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <pre className="whitespace-pre-wrap">{result}</pre>
        </div>
      )}
    </div>
  )
} 