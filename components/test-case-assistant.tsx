'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Copy, Pencil, Trash2, RotateCcw, GanttChartSquare, Archive, ExternalLink } from 'lucide-react'
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
import { JiraTasksModal } from '@/components/jira-tasks-modal'
import { useSystemStore } from '@/lib/stores/system-store'

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
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false)
  const { selectedSystemId } = useSystemStore()

  useEffect(() => {
    // 从localStorage获取结构化需求
    // 考虑系统ID
    if (!selectedSystemId) {
      setScenes([]);
      return;
    }

    const storageKey = `requirement-structured-content-${selectedSystemId}`;
    const storedRequirement = localStorage.getItem(storageKey);
    
    if (storedRequirement) {
      try {
        const requirement = JSON.parse(storedRequirement);
        
        // 尝试多种可能的场景数据位置
        let scenesArray = null;
        if (requirement && Array.isArray(requirement.scenes)) {
          scenesArray = requirement.scenes;
          console.log('[TestCaseAssistant] 使用requirement.scenes作为场景列表，数据:', JSON.stringify(scenesArray.slice(0, 1)));
        } else if (requirement && Array.isArray(requirement.sceneList)) {
          scenesArray = requirement.sceneList;
          console.log('[TestCaseAssistant] 使用requirement.sceneList作为场景列表，数据:', JSON.stringify(scenesArray.slice(0, 1)));
        } else if (requirement && Array.isArray(requirement)) {
          scenesArray = requirement;
          console.log('[TestCaseAssistant] 直接使用requirement数组作为场景列表，数据:', JSON.stringify(scenesArray.slice(0, 1)));
        } else {
          console.warn('[TestCaseAssistant] 无法找到场景列表。存储数据结构:', JSON.stringify(requirement).substring(0, 300));
        }
        
        if (scenesArray && scenesArray.length > 0) {
          console.log(`[TestCaseAssistant] 找到${scenesArray.length}个场景`);
          setScenes(scenesArray);
        } else {
          console.warn(`[TestCaseAssistant] 无法找到有效的场景列表。存储键: ${storageKey}`);
          setScenes([]);
        }
      } catch (error) {
        console.error(`[TestCaseAssistant] 解析存储的需求失败，系统ID: ${selectedSystemId}`, error);
        setScenes([]);
        toast({
          title: t('loadError'),
          description: t('copyFailedDesc'),
          variant: "destructive",
          duration: 3000
        });
      }
    } else {
      console.log(`[TestCaseAssistant] 未找到系统 ${selectedSystemId} 的存储需求数据`);
      setScenes([]);
    }
  }, [selectedSystemId, t, toast]);

  useEffect(() => {
    setEditableTestCases(parsedTestCases)
  }, [parsedTestCases])

  const handleSceneSelect = (sceneIndex: string) => {
    const scene = scenes[parseInt(sceneIndex)]
    if (scene) {
      console.log('[TestCaseAssistant] 选择的场景数据:', scene);
      
      // 获取场景内容，考虑不同的字段名
      let sceneContent = '';
      
      // 将scene转为any类型，处理可能的不同字段名
      const anyScene = scene as any;
      
      if (typeof anyScene.content === 'string') {
        sceneContent = anyScene.content;
      } else if (anyScene.sceneContent && typeof anyScene.sceneContent === 'string') {
        sceneContent = anyScene.sceneContent;
      } else if (anyScene.description) {
        sceneContent = anyScene.description;
      } else if (anyScene.content) {
        sceneContent = String(anyScene.content);
      } else {
        // 如果无法获取内容，提示用户
        console.error('[TestCaseAssistant] 无法获取场景内容:', scene);
        toast({
          title: t('loadError'),
          description: '无法获取场景内容，请检查场景数据格式',
          variant: "destructive",
          duration: 3000
        });
        return;
      }
      
      // 将场景内容设置到文本框
      setRequirements(sceneContent);
      setSelectedScene(sceneIndex);
      setIsDialogOpen(false);
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

  const handleJiraTaskSelect = (summary: string, description?: string) => {
    if (description) {
      // 如果有描述，将描述设置到文本框
      setRequirements(`${description}`);
    } else {
      // 如果没有描述，只设置摘要
      setRequirements(summary);
    }
  }

  // 添加打开Jira的函数
  const handleOpenJira = () => {
    const jiraDomain = process.env.NEXT_PUBLIC_JIRA_DOMAIN || 'thoughtworks-team-evolve.atlassian.net'
    window.open(`https://${jiraDomain}/jira/your-work`, '_blank')
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
          <div className="flex items-center gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-sm flex items-center gap-1"
                >
                  <Archive className="h-4 w-4" />
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
                    {scenes.length > 0 ? (
                      scenes.map((scene: StructuredScene, index: number) => {
                        // 尝试从多个可能的属性中获取场景名称
                        const anyScene = scene as any;
                        let sceneName = '';
                        
                        console.log(`[TestCaseAssistant] 场景${index+1}数据:`, JSON.stringify({
                          hasSceneName: !!anyScene.sceneName,
                          hasName: !!anyScene.name,
                          hasTitle: !!anyScene.title,
                          hasContent: !!anyScene.content,
                          contentPreview: anyScene.content ? anyScene.content.substring(0, 100) : 'N/A'
                        }));
                        
                        if (anyScene.sceneName) {
                          sceneName = anyScene.sceneName;
                        } else if (anyScene.name) {
                          sceneName = anyScene.name;
                        } else if (anyScene.title) {
                          sceneName = anyScene.title;
                        } else {
                          // 尝试从内容中提取场景名称
                          const content = anyScene.content || '';
                          
                          // 尝试多种可能的场景标题格式
                          // 格式1: "### 1. 场景1: 配置满意度调研功能"
                          let sceneNameMatch = content.match(/^#+\s*\d+\.\s*场景\d+[:：]\s*(.+?)$/m);
                          
                          // 格式2: "### 场景1: 配置满意度调研功能"
                          if (!sceneNameMatch) {
                            sceneNameMatch = content.match(/^#+\s*场景\d+[:：]\s*(.+?)$/m);
                          }
                          
                          // 格式3: "### 1.1 场景概述"
                          if (!sceneNameMatch) {
                            sceneNameMatch = content.match(/^#+\s*\d+\.\d+\s+(.+?)$/m);
                          }
                          
                          // 格式4: 直接取第一行作为标题
                          if (!sceneNameMatch && content) {
                            const firstLine = content.split('\n')[0].trim();
                            if (firstLine) {
                              // 如果第一行是标题格式(以#开头)，去掉#号
                              if (firstLine.startsWith('#')) {
                                sceneNameMatch = [null, firstLine.replace(/^#+\s*/, '')];
                              } else {
                                sceneNameMatch = [null, firstLine];
                              }
                            }
                          }
                          
                          if (sceneNameMatch && sceneNameMatch[1]) {
                            sceneName = sceneNameMatch[1].trim();
                          } else {
                            sceneName = `场景 ${index + 1}`;
                          }
                        }
                        
                        console.log(`[TestCaseAssistant] 场景${index+1}的名称:`, sceneName);
                        
                        return (
                          <SelectItem key={index} value={String(index)}>
                            {`${t('scene')}${index + 1}: ${sceneName}`}
                          </SelectItem>
                        );
                      })
                    ) : (
                      <div className="px-2 py-4 text-center text-sm text-gray-500">
                        {t('noSceneFound')}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </DialogContent>
            </Dialog>
            
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-sm flex items-center gap-1"
              onClick={() => setIsJiraModalOpen(true)}
            >
              <GanttChartSquare className="h-4 w-4" />
              {t('loadFromJira')}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-sm flex items-center gap-1"
              onClick={handleOpenJira}
            >
              <ExternalLink className="h-4 w-4" />
              {t('openJira')}
            </Button>
          </div>
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

      {/* Add Jira Tasks Modal */}
      <JiraTasksModal 
        open={isJiraModalOpen} 
        onOpenChange={setIsJiraModalOpen} 
        onSelectTask={handleJiraTaskSelect} 
      />
    </div>
  )
} 