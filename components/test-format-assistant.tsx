'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Copy, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { streamingAICall } from '@/lib/services/ai-service'
import yaml from 'yaml'
import { testFormatPromptTemplate } from '@/lib/prompts'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

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
  const [isOutputComplete, setIsOutputComplete] = useState(false)
  const [editableTestCases, setEditableTestCases] = useState<TestCase[]>([])
  const { toast } = useToast()

  // 监听结果变化，尝试解析YAML
  useEffect(() => {
    if (result) {
      handleParseYaml(result)
    }
  }, [result])

  const handleFormat = async () => {
    if (!testDescription.trim()) return

    setIsFormatting(true)
    setResult('')
    setParsedResult([])
    setIsOutputComplete(false)
    let formattedResult = ''

    try {
      const prompt = testFormatPromptTemplate.replace('{test_description}', testDescription)

      await streamingAICall(
        prompt,
        (content: string) => {
          formattedResult += content
          setResult(formattedResult)
        },
        (error: string) => {
          throw new Error(`测试用例格式化失败: ${error}`)
        }
      )

      setIsOutputComplete(true)
      toast({
        title: "格式化完成",
        description: "测试用例已格式化，请查看结果",
        duration: 3000
      })
    } catch (error) {
      console.error('Format error:', error)
      toast({
        variant: "destructive",
        title: "格式化失败",
        description: error instanceof Error ? error.message : "未知错误",
        duration: 3000
      })
    } finally {
      setIsFormatting(false)
    }
  }

  const handleParseYaml = (content: string) => {
    try {
      const parsed: YamlData = yaml.parse(content)
      if (parsed?.test_cases && Array.isArray(parsed.test_cases)) {
        const validTestCases = parsed.test_cases.filter(testCase => 
          testCase && typeof testCase === 'object'
        ) as TestCase[]
        
        if (validTestCases.length > 0) {
          setParsedResult(validTestCases)
          setEditableTestCases(validTestCases)
          return true
        }
      }
    } catch {
      // 静默处理解析错误
      return false
    }
    return false
  }

  const handleCopyYaml = async () => {
    try {
      await navigator.clipboard.writeText(result)
      toast({
        title: "复制成功",
        description: "YAML内容已复制到剪贴板",
        duration: 3000
      })
    } catch (error) {
      console.error('Copy error:', error)
      toast({
        variant: "destructive",
        title: "复制失败",
        description: "无法访问剪贴板",
        duration: 3000
      })
    }
  }

  const handleCopyTable = async () => {
    try {
      // 生成TSV格式（Excel可以直接粘贴）
      const header = ['类型', '用例概述', '前提条件', '用例步骤', '预期结果'].join('\t')
      const rows = parsedResult.map(testCase => {
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
        duration: 3000
      })
    } catch (error) {
      console.error('Copy table error:', error)
      toast({
        variant: "destructive",
        title: "复制失败",
        description: "无法访问剪贴板",
        duration: 3000
      })
    }
  }

  return (
    <div className="space-y-2">
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
          disabled={!testDescription.trim() || isFormatting}
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

      {editableTestCases.length > 0 && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex justify-end gap-2 mb-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  title="重置所有修改"
                  disabled={!isOutputComplete}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  重置
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认重置?</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作将丢弃所有修改，恢复到原始内容。此操作无法撤销。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={() => {
                    setEditableTestCases(parsedResult)
                    setIsOutputComplete(false)
                  }}>确认重置</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">类型</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">用例概述</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">前提条件</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">用例步骤</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">预期结果</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {editableTestCases.map((testCase, index) => (
                  <tr key={index} className="even:bg-gray-50">
                    {(['type', 'summary', 'preconditions', 'steps', 'expected_result'] as const).map((field) => (
                      <td key={field} className="px-3 py-2 text-sm">
                        {testCase[field]}
                      </td>
                    ))}
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除?</AlertDialogTitle>
                            <AlertDialogDescription>
                              此操作将删除该测试用例。此操作无法撤销。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                              const newTestCases = editableTestCases.filter((_, i) => i !== index)
                              setEditableTestCases(newTestCases)
                            }}>
                              确认删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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