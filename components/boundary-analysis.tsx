'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Map, Target, ArrowRight, Loader2, History, Pencil, Save, X, ArrowLeft, ChevronRight, Copy } from 'lucide-react'
import { getDefaultConfig, streamingAICall } from '@/lib/ai-service'
import type { AIModelConfig } from '@/lib/ai-service'
import ReactMarkdown from 'react-markdown'
import { userJourneyPromptTemplate, boundaryAnalysisPromptTemplate, optimizeRequirementsPromptTemplate } from '@/lib/prompts'
import remarkGfm from 'remark-gfm'

interface AnalysisStep {
  id: 1 | 2 | 3 | 4
  title: string
  icon: any
  type: 'boundary' | 'journey' | 'optimize'
  isEdit?: boolean
  description?: string
}

const STEPS: AnalysisStep[] = [
  {
    id: 1,
    title: '需求边界分析',
    icon: Target,
    type: 'boundary'
  },
  {
    id: 2,
    title: '用户旅程分析',
    icon: Map,
    type: 'journey'
  },
  {
    id: 3,
    title: '基于旅程的边界分析',
    icon: Target,
    type: 'boundary'
  },
  {
    id: 4,
    title: '优化需求描述',
    icon: Pencil,
    type: 'optimize'
  }
]

// 从知识库获取规则表格内容
const getRulesTable = async () => {
  const storedRules = localStorage.getItem('boundaryRules')
  if (!storedRules) return ''
  
  const rules = JSON.parse(storedRules)
  
  // 构建表格头
  let table = '| 检查项 | 适用场景 | 检查要点 | 需求示例 | 边界示例 |\n'
  table += '|---------|------------|------------|------------|------------|\n'
  
  // 添加表格内容
  table += rules.map((rule: any) => {
    // 处理每个字段中可能存在的换行符，替换为空格
    const checkItem = rule.checkItem?.replace(/\n/g, ' ') || ''
    const scenario = rule.scenario?.replace(/\n/g, ' ') || ''
    const checkPoints = rule.checkPoints?.replace(/\n/g, ' ') || ''
    const example = rule.example?.replace(/\n/g, ' ') || ''
    const boundaryExample = rule.boundaryExample?.replace(/\n/g, ' ') || ''
    
    // 处理可能包含 | 符号的内容，使用 \ 转义
    return `| ${checkItem.replace(/\|/g, '\\|')} | ${scenario.replace(/\|/g, '\\|')} | ${checkPoints.replace(/\|/g, '\\|')} | ${example.replace(/\|/g, '\\|')} | ${boundaryExample.replace(/\|/g, '\\|')} |`
  }).join('\n')
  
  console.log('=== 边界识别知识表格 ===')
  console.log(table)
  console.log('========================')
  
  return table
}

export function BoundaryAnalysis() {
  const [requirements, setRequirements] = useState('')
  const [currentStep, setCurrentStep] = useState(1)
  const [results, setResults] = useState<Record<number, string>>({})
  const [editingContent, setEditingContent] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiConfig, setAiConfig] = useState<AIModelConfig | null>(null)
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [includePreviousAnalysis, setIncludePreviousAnalysis] = useState(false)

  useEffect(() => {
    const config = getDefaultConfig()
    if (config) {
      setAiConfig(config)
    }
  }, [])

  const handleAnalysis = async () => {
    if (!requirements.trim() || !aiConfig) return

    const step = STEPS[currentStep - 1]
    setIsAnalyzing(true)
    let analysisResult = ''

    try {
      let promptRequirements = requirements
      let prompt = ''

      if (step.id === 3) {
        promptRequirements = includePreviousAnalysis
          ? `原始需求：\n${requirements}\n\n用户旅程分析结果：\n${results[2]}\n\n原始需求边界分析结果：\n${results[1]}`
          : `原始需求：\n${requirements}\n\n用户旅程分析结果：\n${results[2]}`
        
        prompt = boundaryAnalysisPromptTemplate
          .replace('{requirements_doc}', promptRequirements)
          .replace('{rules_table}', await getRulesTable())
      } else if (step.id === 4) {
        prompt = optimizeRequirementsPromptTemplate
          .replace('{requirements_doc}', requirements)
          .replace('{boundary_analysis_result}', results[3])
      } else {
        prompt = step.type === 'journey'
          ? userJourneyPromptTemplate.replace('{requirements_doc}', promptRequirements)
          : boundaryAnalysisPromptTemplate
              .replace('{requirements_doc}', promptRequirements)
              .replace('{rules_table}', await getRulesTable())
      }

      console.log(`\n=== 第${step.id}步：${step.title} ===`)
      console.log('Prompt内容：')
      console.log(prompt)
      console.log('========================\n')

      await streamingAICall(
        prompt,
        {
          model: aiConfig.model,
          apiKey: aiConfig.apiKey,
          baseURL: aiConfig.baseURL,
          temperature: step.id === 4 ? 0.7 : aiConfig.temperature
        },
        (content: string) => {
          analysisResult += content
          setResults(prev => ({
            ...prev,
            [currentStep]: analysisResult
          }))
        }
      )

      toast({
        title: "分析完成",
        description: `${step.title}已完成，请查看结果`,
      })
      
      if (step.id === 1 || step.id === 3 || step.id === 4) {
        setEditingContent(analysisResult)
      }
    } catch (error) {
      console.error('Analysis error:', error)
      toast({
        variant: "destructive",
        title: "分析失败",
        description: error instanceof Error ? error.message : "未知错误",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
      const prevStep = STEPS[currentStep - 2]
      if (prevStep.isEdit) {
        setEditingContent(results[currentStep - 2] || '')
      }
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(results[currentStep] || '')
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
    <div className="max-w-[95%] mx-auto px-2">
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
          <h2 className="text-lg font-semibold">请输入需要分析的需求描述：</h2>
          <Textarea
            placeholder="请输入需求描述..."
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            className="min-h-[100px] w-full"
          />
        </div>

        <div className="flex items-center justify-between mx-8 mt-1">
          <div className="flex items-center justify-center gap-4" style={{ width: '320px', margin: '0 auto' }}>
            <div className="w-28">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || isAnalyzing}
                className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                上一步
              </Button>
            </div>

            <div className="w-32">
              <Button
                onClick={handleAnalysis}
                disabled={!requirements.trim() || isAnalyzing || !aiConfig}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    {(() => {
                      const Icon = STEPS[currentStep - 1].icon;
                      return <Icon className="mr-2 h-4 w-4" />;
                    })()}
                    开始分析
                  </>
                )}
              </Button>
            </div>

            <div className="w-28">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!results[currentStep] || isEditing || currentStep >= STEPS.length || isAnalyzing}
                className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                下一步
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          {currentStep === 3 && (
            <div className="flex items-center">
              <label className="flex items-center cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={includePreviousAnalysis}
                  onChange={(e) => setIncludePreviousAnalysis(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-orange-600 rounded border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">
                  将第一步分析结果纳入考虑
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="border-t my-1" />

        <nav className="flex items-center mb-1" aria-label="Progress">
          <ol role="list" className="flex items-center w-full">
            {STEPS.map((step, stepIdx) => (
              <li key={step.id} className="relative flex-1 flex items-center">
                <div className="flex-1">
                  <Button
                    variant={currentStep === step.id ? 'default' : 'outline'}
                    size="sm"
                    disabled={currentStep !== step.id}
                    className={`relative flex items-center justify-center w-full ${
                      currentStep === step.id 
                        ? 'bg-gray-800 text-white' 
                        : 'bg-[#1e4694] text-white'
                    }`}
                  >
                    {isAnalyzing && currentStep === step.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <step.icon className="h-4 w-4" />
                    )}
                    <span className="ml-2 text-xs font-medium">
                      {step.title}
                      <span className="block text-[10px]">{step.description}</span>
                    </span>
                  </Button>
                </div>
                {stepIdx !== STEPS.length - 1 && (
                  <div className="flex-shrink-0 w-8 flex justify-center">
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="border rounded-lg p-4 bg-gray-50 min-h-[400px] w-full mt-0">
          {isEditing ? (
            <div className="space-y-2">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setResults(prev => ({
                      ...prev,
                      [currentStep]: editingContent
                    }))
                    setIsEditing(false)
                    toast({
                      title: "保存成功",
                      description: "分析结果已更新",
                    })
                  }}
                  className="mr-2"
                >
                  <Save className="mr-2 h-4 w-4" />
                  保存
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false)
                    setEditingContent(results[currentStep] || '')
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className="min-h-[400px] font-mono text-sm w-full"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-end gap-2">
                {results[currentStep] && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      title="复制到剪贴板"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditing(true)
                        setEditingContent(results[currentStep] || '')
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              <div className="prose prose-gray max-w-none">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  className="markdown-body"
                >
                  {results[currentStep] || ''}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 