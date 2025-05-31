'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Copy, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { streamingAICall } from '@/lib/services/ai-service'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { testCasePromptTemplate } from '@/lib/prompts'
import yaml from 'js-yaml'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StructuredRequirement, StructuredScene } from '@/lib/services/requirement-export-service'
import { useTranslations } from 'next-intl'

interface TestCase {
  type: string
  summary: string
  preconditions: string
  steps: string
  expected_result: string
}

export function TestCaseAssistant() {
  const t = useTranslations('TestCaseAssistant')
  const [requirements, setRequirements] = useState('')
  const [result, setResult] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [parsedTestCases, setParsedTestCases] = useState<TestCase[]>([])
  const { toast } = useToast()
  const [isOutputComplete, setIsOutputComplete] = useState(false)
  const [editableTestCases, setEditableTestCases] = useState<TestCase[]>([])
  const [scenes, setScenes] = useState<StructuredScene[]>([])
  const [selectedScene, setSelectedScene] = useState<string>('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
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
      // 将场景内容直接作为需求文本
      setRequirements(scene.content)
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
  }

  const handleGenerate = async () => {
    if (!requirements.trim()) return

    setIsGenerating(true)
    let generatedResult = ''
    let yamlContent = ''

    try {
      const prompt = testCasePromptTemplate.replace('{requirements_doc}', requirements)

      await streamingAICall(
        prompt,
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
        },
        (error: string) => {
          throw new Error(`${t('generateFailed')}: ${error}`)
        }
      )

      setIsOutputComplete(true)
      toast({
        title: t('generateSuccess'),
        description: t('generateSuccessDesc'),
        duration: 3000
      })
    } catch (error) {
      console.error('Generation error:', error)
      toast({
        variant: "destructive",
        title: t('generateFailed'),
        description: error instanceof Error ? error.message : t('unknownError'),
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
        title: t('copySuccess'),
        description: t('copyYAMLSuccessDesc'),
        duration: 3000
      })
    } catch (error) {
      console.error('Copy error:', error)
      toast({
        variant: "destructive",
        title: t('copyFailed'),
        description: t('copyFailedDesc'),
        duration: 3000
      })
    }
  }

  const handleCopyTable = async () => {
    try {
      // 生成TSV格式（Excel可以直接粘贴）
      const header = [t('type'), t('summary'), t('preconditions'), t('steps'), t('expectedResult')].join('\t')
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
        title: t('copySuccess'),
        description: t('copyTableSuccessDesc'),
        duration: 3000
      })
    } catch (error) {
      console.error('Copy table error:', error)
      toast({
        variant: "destructive",
        title: t('copyFailed'),
        description: t('copyFailedDesc'),
        duration: 3000
      })
    }
  }

  return (
    <div className="space-y-2">
      {!parsedTestCases.length && result && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <pre className="whitespace-pre-wrap">{result}</pre>
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-m font-semibold">{t('inputTitle')}</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-sm text-gray-500 hover:text-gray-700"
              >
                {t('loadFromCache')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('selectSceneTitle')}</DialogTitle>
              </DialogHeader>
              <Select value={selectedScene} onValueChange={handleSceneSelect} name="test-case-scene-select">
                <SelectTrigger>
                  <SelectValue placeholder={t('selectScenePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {scenes.map((scene: StructuredScene, index: number) => (
                    <SelectItem key={index} value={String(index)}>
                      {`${t('scene')}${index + 1}: ${scene.sceneName}` || `${t('scene')} ${index + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DialogContent>
          </Dialog>
        </div>
        <Textarea
          placeholder={t('inputPlaceholder')}
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          className="min-h-[100px] w-full"
        />
      </div>

      <div className="flex justify-center mt-1 w-full">
        <Button
          onClick={handleGenerate}
          disabled={!requirements.trim() || isGenerating}
          className="w-full bg-orange-600 hover:bg-orange-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('generating')}
            </>
          ) : (
            t('generateButton')
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
                  title={t('reset')}
                  disabled={!isOutputComplete}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {t('reset')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('confirmReset')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('resetConfirmDesc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>{t('confirmReset')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyTable}
              title={t('copyTable')}
              disabled={!isOutputComplete}
            >
              <Copy className="h-4 w-4 mr-1" />
              {t('copyTable')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyYaml}
              title={t('copyYAML')}
              disabled={!isOutputComplete}
            >
              <Copy className="h-4 w-4 mr-1" />
              {t('copyYAML')}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('type')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('summary')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('preconditions')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('steps')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('expectedResult')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {editableTestCases.map((testCase, index) => (
                  <tr key={index}>
                    {(['type', 'summary', 'preconditions', 'steps', 'expected_result'] as const).map((field) => (
                      <td key={field} className="px-6 py-4 text-sm">
                        <div 
                          className="group relative whitespace-pre-line cursor-pointer hover:bg-gray-50"
                          onClick={() => handleCellEdit(index, field, testCase[field])}
                        >
                          {testCase[field]}
                          <Pencil className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
                        </div>
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
                            <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('deleteConfirmDesc')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTestCase(index)}>
                              {t('confirmDelete')}
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