'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Map, Target, ArrowRight, Loader2, History, Pencil, Save, X, ArrowLeft } from 'lucide-react'
import { getDefaultConfig, streamingAICall } from '@/lib/ai-service'
import type { AIModelConfig } from '@/lib/ai-service'
import ReactMarkdown from 'react-markdown'
import { userJourneyPromptTemplate, boundaryAnalysisPromptTemplate } from '@/lib/prompts'

interface AnalysisStep {
  id: 1 | 2 | 3 | 4 | 5
  title: string
  icon: any
  type: 'boundary' | 'journey'
  isEdit?: boolean
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
  }
]

// 从知识库获取规则表格内容
const getRulesTable = async () => {
  const storedRules = localStorage.getItem('boundaryRules')
  if (!storedRules) return ''
  
  const rules = JSON.parse(storedRules)
  return rules.map((rule: any) => 
    `${rule.checkItem}\n场景：${rule.scenario}\n检查要点：${rule.checkPoints}\n示例：${rule.example}\n边界示例：${rule.boundaryExample}\n\n`
  ).join('')
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
      const prompt = step.type === 'journey' 
        ? userJourneyPromptTemplate.replace('{requirements_doc}', requirements)
        : boundaryAnalysisPromptTemplate
            .replace('{requirements_doc}', step.id === 5 
              ? `原始需求：\n${requirements}\n\n用户旅程分析结果：\n${results[3]}` 
              : requirements)
            .replace('{rules_table}', await getRulesTable())

      await streamingAICall(
        prompt,
        {
          model: aiConfig.model,
          apiKey: aiConfig.apiKey,
          baseURL: aiConfig.baseURL,
          temperature: aiConfig.temperature
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
        description: `${step.title}已完成，请查看分析结果`,
      })
      
      if (step.id === 1 || step.id === 3) {
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

  return (
    <div className="max-w-[95%] mx-auto px-2">
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
          <h2 className="text-lg font-semibold">请输入需要分析的需求描述：</h2>
          <Textarea
            placeholder="请输入需求描述..."
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            className="min-h-[100px] w-full"
          />
        </div>

        <nav className="flex items-center my-2" aria-label="Progress">
          <ol role="list" className="flex items-center w-full">
            {STEPS.map((step, stepIdx) => (
              <li key={step.id} className={`relative flex-1 ${stepIdx !== STEPS.length - 1 ? 'pr-4' : ''}`}>
                {stepIdx !== 0 && (
                  <div className="absolute left-0 right-4 top-4 -mt-px h-0.5 bg-gray-200" aria-hidden="true" />
                )}
                <div className="flex items-center">
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
              </li>
            ))}
          </ol>
        </nav>

        <div className="border-t pt-2">
          <div className="flex items-center justify-center gap-2 ml-8">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || isAnalyzing}
              className="w-28 border-orange-200 text-orange-700 hover:bg-orange-50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              上一步
            </Button>

            <Button
              onClick={handleAnalysis}
              disabled={!requirements.trim() || isAnalyzing || !aiConfig}
              className="w-32 bg-orange-600 hover:bg-orange-700 text-white"
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

            {results[currentStep] && !isEditing && currentStep < STEPS.length && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="w-28 border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                下一步
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-gray-50 min-h-[400px] w-full">
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
              <div className="flex justify-end">
                {results[currentStep] && (
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
                )}
              </div>
              <div className="prose prose-gray max-w-none">
                <ReactMarkdown>{results[currentStep] || ''}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 