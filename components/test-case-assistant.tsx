'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Copy, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { streamingAICall } from '@/lib/services/ai-service'
import { getAIConfig } from '@/lib/services/ai-config-service'
import type { AIModelConfig } from '@/lib/services/ai-service'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { testCasePromptTemplate } from '@/lib/prompts'
import yaml from 'js-yaml'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StructuredRequirement, StructuredScene } from '@/lib/services/requirement-export-service'

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
  const [editableTestCases, setEditableTestCases] = useState<TestCase[]>([])
  const [editingCell, setEditingCell] = useState<{
    index: number;
    field: keyof TestCase;
  } | null>(null)
  const [scenes, setScenes] = useState<StructuredScene[]>([])
  const [selectedScene, setSelectedScene] = useState<string>('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    const config = getAIConfig()
    if (config) {
      setAiConfig(config)
    }

    // 从localStorage获取结构化需求
    const storedRequirement = localStorage.getItem('structuredRequirement')
    if (storedRequirement) {
      const requirement = JSON.parse(storedRequirement)
      setScenes(requirement.sceneList || [])
    }
  }, [])

  useEffect(() => {
    setEditableTestCases(parsedTestCases)
  }, [parsedTestCases])

  const handleSceneSelect = (sceneIndex: string) => {
    const scene = scenes[parseInt(sceneIndex)]
    if (scene) {
      // 将场景的所有相关信息组合成文本
      const sceneContent = [
        `场景名称：${scene.sceneName}`,
        `场景概述：${scene.sceneOverview}`,
        `前置条件：${scene.preconditions}`,
        `用户旅程：\n${scene.sceneUserJourney}`
      ]

      // 只有在有全局约束条件且不是'N/A'时才添加
      if (scene.globalConstraints && scene.globalConstraints !== 'N/A') {
        sceneContent.push(`全局约束条件：${scene.globalConstraints}`)
      }
      
      setRequirements(sceneContent.join('\n\n'))
      setSelectedScene(sceneIndex)
      setIsDialogOpen(false)
    }
  }

  const handleCellEdit = (index: number, field: keyof TestCase, value: string) => {
    const newTestCases = [...editableTestCases]
    newTestCases[index] = {
      ...newTestCases[index],
      [field]: value
    }
    setEditableTestCases(newTestCases)
  }

  const handleDeleteTestCase = (index: number) => {
    const newTestCases = editableTestCases.filter((_, i) => i !== index)
    setEditableTestCases(newTestCases)
  }

  const handleReset = () => {
    setEditableTestCases(parsedTestCases)
    setEditingCell(null)
  }

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
        duration: 3000
      })
    } catch (error) {
      console.error('Generation error:', error)
      toast({
        variant: "destructive",
        title: "生成失败",
        description: error instanceof Error ? error.message : "未知错误",
        duration: 3000
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
      {!aiConfig && (
        <Alert>
          <AlertTitle>提示</AlertTitle>
          <AlertDescription>
            请先在设置中配置并选择默认的 AI 模型
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">请输入需求描述：</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
              >
                从缓存中加载场景
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>选择要加载的场景</DialogTitle>
              </DialogHeader>
              <Select value={selectedScene} onValueChange={handleSceneSelect} name="test-case-scene-select">
                <SelectTrigger>
                  <SelectValue placeholder="选择要拆解的场景" />
                </SelectTrigger>
                <SelectContent>
                  {scenes.map((scene: StructuredScene, index: number) => (
                    <SelectItem key={index} value={String(index)}>
                      {`场景${index + 1}: ${scene.sceneName}` || `场景 ${index + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DialogContent>
          </Dialog>
        </div>
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
                  <AlertDialogAction onClick={handleReset}>确认重置</AlertDialogAction>
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
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">概述</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">前提条件</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">步骤</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">预期结果</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {editableTestCases.map((testCase, index) => (
                  <tr key={index}>
                    {(['type', 'summary', 'preconditions', 'steps', 'expected_result'] as const).map((field) => (
                      <td key={field} className="px-6 py-4 text-sm">
                        {editingCell?.index === index && editingCell?.field === field ? (
                          <Textarea
                            autoFocus
                            defaultValue={testCase[field]}
                            className="w-full min-h-[60px]"
                            onBlur={(e) => {
                              handleCellEdit(index, field, e.target.value)
                              setEditingCell(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleCellEdit(index, field, e.currentTarget.value)
                                setEditingCell(null)
                              }
                            }}
                          />
                        ) : (
                          <div 
                            className="group relative whitespace-pre-line cursor-pointer hover:bg-gray-50"
                            onClick={() => setEditingCell({ index, field })}
                          >
                            {testCase[field]}
                            <Pencil className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                            <AlertDialogAction onClick={() => handleDeleteTestCase(index)}>
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

      {!parsedTestCases.length && result && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <pre className="whitespace-pre-wrap">{result}</pre>
        </div>
      )}
    </div>
  )
} 