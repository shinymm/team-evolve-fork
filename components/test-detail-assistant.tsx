'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Wand2, Check, X, Copy } from 'lucide-react'
import { streamingAICall } from '@/lib/services/ai-service'
import { generateDetailPromptTemplate, generateSummaryPromptTemplate, optimizeSummaryPromptTemplate, generateFromStepsPromptTemplate } from '@/lib/prompts'
import yaml from 'js-yaml'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { RotateCcw } from 'lucide-react'
import { PathInputDialog } from "@/components/path-input-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getFormattedArchitecture } from '@/lib/services/architecture-service'
import { useTranslations } from 'next-intl'

interface TestCaseDetail {
  summary: string
  preconditions: string
  steps: string
  expected_result: string
}

interface SummaryOptimization {
  optimized_summary: string
  analysis: string
  improvements: string
}

interface TestCaseGeneration {
  preconditions: string
  steps: string
  expected_result: string
}

export function TestDetailAssistant() {
  const t = useTranslations('TestDetailAssistant')
  const [testCase, setTestCase] = useState<TestCaseDetail>({
    summary: '',
    preconditions: '',
    steps: '',
    expected_result: ''
  })
  const [isGenerating, setIsGenerating] = useState<{
    optimize: boolean;
    generate: boolean;
    steps: boolean;
  }>({
    optimize: false,
    generate: false,
    steps: false
  })
  
  const { toast } = useToast()
  const [summaryOptimization, setSummaryOptimization] = useState<SummaryOptimization | null>(null)
  const [caseGeneration, setCaseGeneration] = useState<TestCaseGeneration | null>(null)
  const [isPathDialogOpen, setIsPathDialogOpen] = useState(false)
  const [stepsGeneration, setStepsGeneration] = useState<{ steps: string } | null>(null)

  // 添加未定义翻译的默认值
  const translations = {
    summaryPlaceholder: t('summaryPlaceholder', {defaultValue: '请输入用例概述，如：验证知识库创建功能...'}),
    preconditionsPlaceholder: t('preconditionsPlaceholder', {defaultValue: '请输入前提条件...'}),
    stepsPlaceholder: t('stepsPlaceholder', {defaultValue: '请输入用例步骤，可以是简单路径如：知识库-添加-意图...'}),
    expectedResultPlaceholder: t('expectedResultPlaceholder', {defaultValue: '请输入预期结果...'}),
    summaryRequiredTooltip: t('summaryRequiredTooltip', {defaultValue: '需要先填写用例概述才能使用此功能'}),
    unknownError: t('unknownError', {defaultValue: '未知错误'}),
    noArchitectureInfo: t('noArchitectureInfo', {defaultValue: '暂无产品功能架构信息'}),
    cancel: t('cancel', {defaultValue: '取消'}),
    generate: t('generate', {defaultValue: '生成'}),
    generateStepsFailed: t('generateStepsFailed', {defaultValue: '生成步骤失败'}),
    optimizationFailed: t('optimizationFailed', {defaultValue: '优化失败'}),
    generationFailed: t('generationFailed', {defaultValue: '生成失败'}),
    generateComplete: t('generateComplete', {defaultValue: '生成完成'}),
    generateCompleteDesc: t('generateCompleteDesc', {defaultValue: '请查看生成的用例细节'}),
    optimizationComplete: t('optimizationComplete', {defaultValue: '优化完成'}),
    optimizationCompleteDesc: t('optimizationCompleteDesc', {defaultValue: '请查看优化建议'})
  }

  const handleInputChange = (field: keyof TestCaseDetail) => (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setTestCase(prev => ({
      ...prev,
      [field]: e.target.value
    }))
  }

  const handleGenerateFromSummary = async () => {
    if (!testCase.summary.trim() || isGenerating.generate) return
    setIsGenerating(prev => ({ ...prev, generate: true }))
    setCaseGeneration(null)

    try {
      const architectureInfo = getFormattedArchitecture()
      const prompt = generateDetailPromptTemplate
        .replace('{architecture_info}', architectureInfo || translations.noArchitectureInfo)
        .replace('{summary}', testCase.summary.trim())

      let generatedResult = ''

      await streamingAICall(
        prompt,
        (content: string) => {
          generatedResult += content
          try {
            const cleanContent = generatedResult
              .replace(/```yaml\n/g, '')
              .replace(/```(\n)?$/g, '')
              .trim()

            const parsed = yaml.load(cleanContent) as TestCaseGeneration
            if (parsed?.preconditions && parsed?.steps && parsed?.expected_result) {
              setCaseGeneration(parsed)
            }
          } catch (e) {
            // 解析错误时继续累积内容
          }
        },
        (error: string) => {
          throw new Error(`${translations.generationFailed}: ${error}`)
        }
      )

      toast({
        title: translations.generateComplete,
        description: translations.generateCompleteDesc,
        duration: 3000
      })
    } catch (error) {
      console.error('Generation error:', error)
      toast({
        variant: "destructive",
        title: t('generationFailed'),
        description: error instanceof Error ? error.message : translations.unknownError,
        duration: 3000
      })
    } finally {
      setIsGenerating(prev => ({ ...prev, generate: false }))
    }
  }

  const handleOptimizeSummary = async () => {
    if (!testCase.summary.trim() || isGenerating.optimize) return
    setIsGenerating(prev => ({ ...prev, optimize: true }))
    setSummaryOptimization(null)

    try {
      const prompt = optimizeSummaryPromptTemplate.replace(
        '{current_summary}',
        testCase.summary
      )
      let generatedResult = ''

      await streamingAICall(
        prompt,
        (content: string) => {
          generatedResult += content
          try {
            // 清理 markdown 代码块标记
            const cleanContent = generatedResult
              .replace(/```yaml\n/g, '')  // 移除开始标记
              .replace(/```(\n)?$/g, '')  // 移除结束标记
              .trim()

            const parsed = yaml.load(cleanContent) as SummaryOptimization
            if (parsed?.optimized_summary) {
              setSummaryOptimization(parsed)
            }
          } catch (e) {
            // 解析错误时继续累积内容
          }
        },
        (error: string) => {
          throw new Error(`${translations.optimizationFailed}: ${error}`)
        }
      )

      toast({
        title: translations.optimizationComplete,
        description: translations.optimizationCompleteDesc,
        duration: 3000
      })
    } catch (error) {
      console.error('Optimization error:', error)
      toast({
        variant: "destructive",
        title: t('optimizationFailed'),
        description: error instanceof Error ? error.message : translations.unknownError,
        duration: 3000
      })
    } finally {
      setIsGenerating(prev => ({ ...prev, optimize: false }))
    }
  }

  const handleAcceptGeneration = () => {
    if (caseGeneration) {
      setTestCase(prev => ({
        ...prev,
        preconditions: caseGeneration.preconditions,
        steps: caseGeneration.steps,
        expected_result: caseGeneration.expected_result
      }))
      setCaseGeneration(null)
      toast({
        title: t('accepted'),
        description: t('acceptedDesc'),
        duration: 3000
      })
    }
  }

  const handleRejectGeneration = () => {
    setCaseGeneration(null)
    toast({
      title: t('rejected'),
      description: t('rejectedDesc'),
      duration: 3000
    })
  }

  const handleAcceptOptimization = () => {
    if (summaryOptimization) {
      setTestCase(prev => ({
        ...prev,
        summary: summaryOptimization.optimized_summary
      }))
      setSummaryOptimization(null)
      toast({
        title: t('accepted'),
        description: t('acceptedDesc'),
        duration: 3000
      })
    }
  }

  const handleRejectOptimization = () => {
    setSummaryOptimization(null)
    toast({
      title: t('rejected'),
      description: t('rejectedDesc'),
      duration: 3000
    })
  }

  const handleReset = () => {
    setTestCase({
      summary: '',
      preconditions: '',
      steps: '',
      expected_result: ''
    })
    setSummaryOptimization(null)
    setCaseGeneration(null)
    toast({
      title: t('resetSuccess'),
      description: t('resetSuccessDesc'),
      duration: 3000
    })
  }

  const handleCopyAsTable = async () => {
    try {
      // 处理文本内容，将换行符替换为分号
      const formatContent = (content: string) => {
        return content
          .replace(/\n+/g, '; ')  // 将一个或多个换行符替换为分号加空格
          .replace(/;\s*;\s*/g, '; ')  // 处理连续的分号
          .replace(/\。\s*;\s*/g, '. ')  // 如果句号后面跟着分号，只保留句号
          .replace(/;\s*$/g, '')  // 移除末尾的分号
          .trim()
      }

      // 格式化每个字段的内容
      const tsvContent = [
        formatContent(testCase.summary),
        formatContent(testCase.preconditions),
        formatContent(testCase.steps),
        formatContent(testCase.expected_result)
      ].join('\t')

      await navigator.clipboard.writeText(tsvContent)
      
      toast({
        title: t('copySuccess'),
        description: t('copySuccessDesc'),
        duration: 3000
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('copyFailed'),
        description: t('copyFailedDesc'),
        duration: 3000
      })
    }
  }

  const handleGenerateFromPath = async (path: string) => {
    if (!path.trim() || isGenerating.steps) return
    setIsGenerating(prev => ({ ...prev, steps: true }))
    setStepsGeneration(null)

    try {
      const prompt = generateFromStepsPromptTemplate.replace('{path}', path.trim())
      let generatedResult = ''

      await streamingAICall(
        prompt,
        (content: string) => {
          generatedResult += content
          try {
            const cleanContent = generatedResult
              .replace(/```yaml\n/g, '')
              .replace(/```(\n)?$/g, '')
              .trim()

            const parsed = yaml.load(cleanContent) as { steps: string }
            if (parsed?.steps) {
              setStepsGeneration(parsed)
            }
          } catch (e) {
            // 解析错误时继续累积内容
          }
        },
        (error: string) => {
          throw new Error(`${translations.generateStepsFailed}: ${error}`)
        }
      )

      toast({
        title: translations.generateComplete,
        description: translations.generateCompleteDesc,
        duration: 3000
      })
    } catch (error) {
      console.error('Generation error:', error)
      toast({
        variant: "destructive",
        title: t('generationFailed'),
        description: error instanceof Error ? error.message : translations.unknownError,
        duration: 3000
      })
    } finally {
      setIsGenerating(prev => ({ ...prev, steps: false }))
    }
  }

  const handleAcceptSteps = () => {
    if (stepsGeneration) {
      setTestCase(prev => ({
        ...prev,
        steps: stepsGeneration.steps
      }))
      setStepsGeneration(null)
      toast({
        title: t('accepted'),
        description: t('acceptedDesc'),
        duration: 3000
      })
    }
  }

  const handleRejectSteps = () => {
    setStepsGeneration(null)
    toast({
      title: t('rejected'),
      description: t('rejectedDesc'),
      duration: 3000
    })
  }

  return (
    <div className="space-y-2">
      <>
        <div className="flex justify-between mb-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAsTable}
              className="text-gray-500 hover:text-gray-700"
            >
              <Copy className="h-4 w-4 mr-2" />
              {t('copyAsTable')}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
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
                  <AlertDialogCancel>{translations.cancel}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>{t('confirmReset')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <div className="flex gap-2">
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold">{t('caseSummary')}</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOptimizeSummary}
                    disabled={!testCase.summary.trim() || isGenerating.optimize}
                    className="h-8"
                  >
                    {isGenerating.optimize ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('optimizing')}
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        {t('optimizeDescription')}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateFromSummary}
                    disabled={!testCase.summary.trim() || isGenerating.generate}
                    className="h-8"
                  >
                    {isGenerating.generate ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('generating')}
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        {t('generateFromSummary')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <Textarea
                placeholder={translations.summaryPlaceholder}
                value={testCase.summary}
                onChange={handleInputChange('summary')}
                className="min-h-[40px] max-h-[40px] mb-1"
                rows={1}
              />
              {summaryOptimization && (
                <div className="mt-2 border rounded-md p-4 bg-orange-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-orange-800 text-sm">{t('optimizationSuggestion')}</span>
                        <span className="text-sm">{summaryOptimization.optimized_summary}</span>
                      </div>
                      <div className="text-xs space-y-1 text-gray-600">
                        <div>
                          <span className="font-medium">{t('existingIssues')}</span>
                          <span>{summaryOptimization.analysis}</span>
                        </div>
                        <div>
                          <span className="font-medium">{t('improvementSuggestions')}</span>
                          <span>{summaryOptimization.improvements}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white hover:bg-red-50 text-red-600 hover:text-red-700"
                        onClick={handleRejectOptimization}
                      >
                        <X className="h-4 w-4 mr-1" />
                        {t('reject')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white hover:bg-green-50 text-green-600 hover:text-green-700"
                        onClick={handleAcceptOptimization}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {t('accept')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {caseGeneration && (
                <div className="mt-2 border rounded-md p-4 bg-orange-50">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-orange-800 text-sm">{t('generatedDetails')}</h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white hover:bg-red-50 text-red-600 hover:text-red-700"
                        onClick={handleRejectGeneration}
                      >
                        <X className="h-4 w-4 mr-1" />
                        {t('reject')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white hover:bg-green-50 text-green-600 hover:text-green-700"
                        onClick={handleAcceptGeneration}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {t('accept')}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">{t('preconditions')}</span>
                      <div className="mt-1 text-gray-600 whitespace-pre-line">
                        {caseGeneration.preconditions}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{t('steps')}</span>
                      <div className="mt-1 text-gray-600 whitespace-pre-line">
                        {caseGeneration.steps}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{t('expectedResult')}</span>
                      <div className="mt-1 text-gray-600 whitespace-pre-line">
                        {caseGeneration.expected_result}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-1">{t('preconditions')}</h2>
            <Textarea
              placeholder={translations.preconditionsPlaceholder}
              value={testCase.preconditions}
              onChange={handleInputChange('preconditions')}
              className="min-h-[96px]"
              rows={4}
            />
          </div>

          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold">{t('steps')}</h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsPathDialogOpen(true)}
                        disabled={!testCase.summary.trim() || isGenerating.steps}
                        className="h-8"
                      >
                        {isGenerating.steps ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('generating')}
                          </>
                        ) : (
                          <>
                            <Wand2 className="mr-2 h-4 w-4" />
                            {t('generateFromPath')}
                          </>
                        )}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{translations.summaryRequiredTooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Textarea
                placeholder={translations.stepsPlaceholder}
                value={testCase.steps}
                onChange={handleInputChange('steps')}
                className="min-h-[168px]"
                rows={7}
              />
              {stepsGeneration && (
                <div className="mt-2 border rounded-md p-4 bg-orange-50">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-orange-800 text-sm">{t('generatedSteps')}</h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white hover:bg-red-50 text-red-600 hover:text-red-700"
                        onClick={handleRejectSteps}
                      >
                        <X className="h-4 w-4 mr-1" />
                        {t('reject')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white hover:bg-green-50 text-green-600 hover:text-green-700"
                        onClick={handleAcceptSteps}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {t('accept')}
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 whitespace-pre-line">
                    {stepsGeneration.steps}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-1">{t('expectedResult')}</h2>
            <Textarea
              placeholder={translations.expectedResultPlaceholder}
              value={testCase.expected_result}
              onChange={handleInputChange('expected_result')}
              className="min-h-[96px]"
              rows={4}
            />
          </div>
        </div>

        <PathInputDialog
          isOpen={isPathDialogOpen}
          onOpenChange={setIsPathDialogOpen}
          onSubmit={handleGenerateFromPath}
          isLoading={isGenerating.steps}
        />
      </>
    </div>
  )
} 