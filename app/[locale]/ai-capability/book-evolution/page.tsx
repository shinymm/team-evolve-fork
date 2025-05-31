'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { streamingAICall } from '@/lib/services/ai-service'
import { Card } from "@/components/ui/card"
import { Loader2, Copy, Download, Edit2, Save, ArrowRight, Pin, PinOff } from "lucide-react"
import { requirementAnalysisPrompt } from '@/lib/prompts/requirement-analysis'
import { updateTask } from '@/lib/services/task-service'
import { Toaster } from "@/components/ui/toaster"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { recordRequirementAction } from '@/lib/services/requirement-action-service'
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store'
import { useSystemStore, type System } from '@/lib/stores/system-store'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SystemInfoService } from '@/lib/services/system-info-service'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'

export default function RequirementAnalysis() {
  const t = useTranslations('RequirementEvolutionPage')
  const locale = useLocale()
  
  // 获取当前选中的系统
  const { systems, selectedSystemId } = useSystemStore()
  const selectedSystem = systems.find(s => s.id === selectedSystemId) || null
  
  // 使用新的 store 结构，直接获取当前激活系统的字段
  const { 
    currentSystemId,
    requirement,
    pinnedAnalysis,
    isPinned,
    setCurrentSystem,
    setRequirement, 
    pinAnalysis, 
    unpinAnalysis,
    getActiveAnalysis
  } = useRequirementAnalysisStore()

  // 自定义函数保存到localStorage - 修复linter错误
  const saveCurrentSystemToRedis = async (): Promise<void> => {
    if (!currentSystemId) {
      console.error('无法保存：没有选中的系统ID')
      return
    }

    try {
      // 从store获取当前相关字段并保存
      const store = useRequirementAnalysisStore.getState()
      
      // 确保当前系统的ID匹配
      if (store.currentSystemId !== currentSystemId) {
        console.error('系统ID不匹配，无法保存')
        return
      }

      // 构建需要保存的数据
      const systemData = {
        requirement: store.requirement,
        pinnedAnalysis: store.pinnedAnalysis,
        requirementBook: store.requirementBook,
        pinnedRequirementBook: store.pinnedRequirementBook,
        isPinned: store.isPinned,
        isRequirementBookPinned: store.isRequirementBookPinned,
        imageDraft: store.imageDraft,
      }
      
      // 保存到localStorage
      const systemKey = `req_analysis_system_${currentSystemId}`
      localStorage.setItem(systemKey, JSON.stringify(systemData))
      console.log(`已保存系统 ${currentSystemId} 的状态到 localStorage`)
    } catch (error) {
      console.error('保存到localStorage失败:', error)
      throw error
    }
  }

  // 确保已设置当前系统
  useEffect(() => {
    if (selectedSystem?.id && selectedSystem.id !== currentSystemId) {
      console.log('设置当前系统:', selectedSystem.id)
      setCurrentSystem(selectedSystem.id)

      // 尝试从localStorage获取数据，检查是否有缓存的数据
      try {
        const storageKey = `req_analysis_system_${selectedSystem.id}`
        const cachedData = localStorage.getItem(storageKey)
        if (cachedData) {
          console.log('找到缓存的需求分析数据:', storageKey)
          // localStorage中存在数据，会通过setCurrentSystem自动加载
        } else {
          console.log('未找到缓存的需求分析数据:', storageKey)
        }
      } catch (error) {
        console.error('读取localStorage缓存失败:', error)
      }
    }
  }, [selectedSystem, currentSystemId, setCurrentSystem])

  // 使用本地state管理当前分析结果
  const [analysis, setAnalysis] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedAnalysis, setEditedAnalysis] = useState('')
  const [editStartTime, setEditStartTime] = useState<number | null>(null)
  const [editTarget, setEditTarget] = useState<'main' | 'pinned'>('main')
  const originalContent = useRef<string>('')
  const { toast } = useToast()
  const router = useRouter()

  // 页面卸载时保存数据到Redis
  useEffect(() => {
    return () => {
      if (currentSystemId) {
        saveCurrentSystemToRedis()
          .catch((err: Error) => console.error('保存到Redis失败:', err))
      }
    }
  }, [currentSystemId])

  // 当需求内容变化时，保存到 store
  const handleRequirementChange = (value: string) => {
    if (selectedSystem?.id) {
      setRequirement(value)
    }
  }

  const handleSubmit = async () => {
    if (!selectedSystem?.id) {
      toast({
        title: t('selectSystemFirst'),
        description: t('pleaseInputRequirement'),
        variant: "destructive",
        duration: 3000
      })
      return
    }

    if (!requirement.trim()) {
      toast({
        title: t('pleaseInputRequirement'),
        description: t('requirementCannotBeEmpty'),
        variant: "destructive",
        duration: 3000
      })
      return
    }

    setIsAnalyzing(true)
    setAnalysis('')

    try {
      // 获取系统特定的模板数据
      console.log(`正在获取系统 ${selectedSystem.id} 的模板数据...`)
      const templateData = await SystemInfoService.prepareRequirementAnalysisTemplateData(selectedSystem.id)
      
      // 生成提示词 - 传递系统特定的模板数据
      console.log('正在生成提示词...')
      const prompt = requirementAnalysisPrompt(requirement, templateData)
      
      let currentAnalysis = '';
      await streamingAICall(
        prompt,
        (content: string) => {
          currentAnalysis += content;
          setAnalysis(currentAnalysis);
        },
        (error: string) => {
          toast({
            title: t('analysisFailed'),
            description: error,
            variant: "destructive",
            duration: 3000
          })
        }
      )
    } catch (error) {
      console.error('需求分析失败:', error)
      toast({
        title: t('analysisFailed'),
        description: error instanceof Error ? error.message : t('pleaseTryAgain'),
        variant: "destructive",
        duration: 3000
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast({
        title: t('copySuccess'),
        description: t('copyDesc'),
        duration: 3000
      })
    } catch (error) {
      toast({
        title: t('copyFailed'),
        description: t('copyFailedDesc'),
        variant: "destructive",
        duration: 3000
      })
    }
  }

  const handleDownload = (content: string, suffix: string = '') => {
    try {
      const blob = new Blob([content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `${t('title')}${suffix}-${timestamp}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: t('downloadSuccess'),
        description: t('downloadDesc'),
        duration: 3000
      })
    } catch (error) {
      toast({
        title: t('downloadFailed'),
        description: t('downloadFailedDesc'),
        variant: "destructive",
        duration: 3000
      })
    }
  }

  const handleEdit = (target: 'main' | 'pinned' = 'main') => {
    setIsEditing(true)
    setEditTarget(target)
    
    if (target === 'main') {
      setEditedAnalysis(analysis)
      originalContent.current = analysis
    } else {
      setEditedAnalysis(pinnedAnalysis || '')
      originalContent.current = pinnedAnalysis || ''
    }
    
    setEditStartTime(Date.now())
  }

  const handleSave = () => {
    if (editTarget === 'main') {
      setAnalysis(editedAnalysis)
    } else if (pinnedAnalysis !== editedAnalysis) {
      pinAnalysis(editedAnalysis)
    }
    
    setIsEditing(false)
    
    // 如果内容有变更，记录编辑操作
    if (originalContent.current !== editedAnalysis && editStartTime !== null && selectedSystem?.id) {
      try {
        const editDuration = Date.now() - editStartTime
        recordRequirementAction(
          selectedSystem.id,
          {
            type: 'edit',
            duration: editDuration,
            contentBefore: originalContent.current,
            contentAfter: editedAnalysis
          }
        ).catch(e => console.error('记录编辑操作失败:', e))
      } catch (error) {
        console.error('记录编辑操作失败:', error)
      }
    }
    
    toast({
      title: t('saveSuccess'),
      description: t('saveDesc'),
      duration: 3000
    })
  }

  const handleTogglePin = () => {
    if (isPinned) {
      unpinAnalysis()
      toast({
        title: t('unpinSuccess'),
        description: t('unpinDesc'),
        duration: 3000
      })
    } else {
      pinAnalysis(analysis)
      setAnalysis('')
      toast({
        title: t('pinSuccess'),
        description: t('pinDesc'),
        duration: 3000
      })
    }
  }

  const handleConfirm = async () => {
    if (!selectedSystemId) {
      toast({
        title: t('selectSystemFirst'),
        description: t('pleaseInputRequirement'),
        variant: "destructive",
        duration: 3000
      })
      return
    }
    
    try {
      // 记录用户行为
      if (getActiveAnalysis()) {
        recordRequirementAction(
          selectedSystemId,
          {
            type: 'analyze',
            duration: 0,
            contentBefore: '',
            contentAfter: getActiveAnalysis() || '',
          }
        ).catch(e => console.error('记录确认操作失败:', e))
      }
      
      // 导航到下一页，使用国际化路由
      router.push(`/ai-capability/book`)
    } catch (error) {
      console.error('确认任务状态更新失败:', error)
      toast({
        title: t('analysisFailed'),
        description: error instanceof Error ? error.message : t('pleaseTryAgain'),
        variant: "destructive",
        duration: 3000
      })
    }
  }

  const handleConfirmWithDialog = async () => {
    if (isPinned && pinnedAnalysis && analysis) {
      if (confirm(t('confirmAndContinue'))) {
        await handleConfirm()
      } else {
        pinAnalysis(analysis)
        await handleConfirm()
      }
    } else {
      await handleConfirm()
    }
  }

  const renderIconButton = (icon: React.ReactNode, label: string, onClick: () => void, className: string = "", disabled: boolean = false) => {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClick}
              className={`h-8 w-8 rounded-full ${className}`}
              disabled={disabled}
            >
              {icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <>
      <div className="mx-auto py-6 w-[90%]">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground text-sm mt-2">
              {t('subtitle')}
            </p>
          </div>
          <div className="space-y-4">
            <Textarea
              placeholder={t('pleaseInputRequirement')}
              className="min-h-[200px]"
              value={requirement}
              onChange={(e) => handleRequirementChange(e.target.value)}
              disabled={isAnalyzing}
            />
            <Button
              onClick={handleSubmit}
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={isAnalyzing || !selectedSystemId}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('analyzing')}
                </>
              ) : !selectedSystemId ? (
                t('selectSystemFirst')
              ) : (
                t('startAnalysis')
              )}
            </Button>
            {isPinned && pinnedAnalysis && analysis ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="flex justify-end gap-1">
                      {renderIconButton(<Copy className="h-4 w-4" />, t('copy'), () => handleCopy(pinnedAnalysis), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                      {renderIconButton(<Download className="h-4 w-4" />, t('download'), () => handleDownload(pinnedAnalysis, '-fixed'), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                      {renderIconButton(<Edit2 className="h-4 w-4" />, t('edit'), () => handleEdit('pinned'), "text-gray-500 hover:text-gray-700", isAnalyzing || isEditing)}
                      {renderIconButton(<PinOff className="h-4 w-4" />, t('unpin'), handleTogglePin, "text-orange-600 hover:text-orange-700", isAnalyzing)}
                    </div>
                    <Card className="p-6 mt-4 border-orange-300 border-2">
                      <div className="text-sm font-medium text-orange-600 mb-2">{t('fixedContent')}</div>
                      {isEditing && editTarget === 'pinned' ? (
                        <Textarea
                          value={editedAnalysis}
                          onChange={(e) => setEditedAnalysis(e.target.value)}
                          className="min-h-[600px] w-full resize-y"
                          disabled={isAnalyzing}
                        />
                      ) : (
                        <div className="space-y-4">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{pinnedAnalysis}</ReactMarkdown>
                        </div>
                      )}
                    </Card>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-end gap-1">
                      {renderIconButton(<Copy className="h-4 w-4" />, t('copy'), () => handleCopy(analysis), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                      {renderIconButton(<Download className="h-4 w-4" />, t('download'), () => handleDownload(analysis, '-new'), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                      {renderIconButton(<Edit2 className="h-4 w-4" />, t('edit'), () => handleEdit('main'), "text-gray-500 hover:text-gray-700", isAnalyzing || isEditing)}
                      {renderIconButton(<Pin className="h-4 w-4" />, t('pin'), handleTogglePin, "text-gray-500 hover:text-gray-700", isAnalyzing)}
                    </div>
                    <Card className="p-6 mt-4">
                      <div className="text-sm font-medium text-gray-600 mb-2">{t('newContent')}</div>
                      {isEditing && editTarget === 'main' ? (
                        <Textarea
                          value={editedAnalysis}
                          onChange={(e) => setEditedAnalysis(e.target.value)}
                          className="min-h-[600px] w-full resize-y"
                          disabled={isAnalyzing}
                        />
                      ) : (
                        <div className="space-y-4">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
                        </div>
                      )}
                    </Card>
                  </div>
                </div>
                {!isEditing && (
                  <Button
                    onClick={handleConfirmWithDialog}
                    className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
                    disabled={isAnalyzing}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    {t('confirmAndContinue')}
                  </Button>
                )}
              </div>
            ) : ((isPinned && pinnedAnalysis) || analysis ? (
              <div className="space-y-4">
                <div className="flex justify-end gap-1">
                  {renderIconButton(<Copy className="h-4 w-4" />, t('copy'), () => handleCopy(isPinned && pinnedAnalysis ? pinnedAnalysis : analysis), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                  {renderIconButton(<Download className="h-4 w-4" />, t('download'), () => handleDownload(isPinned && pinnedAnalysis ? pinnedAnalysis : analysis), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                  {!isEditing ? (
                    <>
                      {renderIconButton(<Edit2 className="h-4 w-4" />, t('edit'), () => handleEdit(isPinned ? 'pinned' : 'main'), "text-gray-500 hover:text-gray-700", isAnalyzing)}
                      {isPinned ?
                        renderIconButton(<PinOff className="h-4 w-4" />, t('unpin'), handleTogglePin, "text-orange-600 hover:text-orange-700", isAnalyzing) :
                        renderIconButton(<Pin className="h-4 w-4" />, t('pin'), handleTogglePin, "text-gray-500 hover:text-gray-700", isAnalyzing)
                      }
                    </>
                  ) : (
                    renderIconButton(<Save className="h-4 w-4" />, t('saveEdit'), handleSave, "text-orange-600 hover:text-orange-700", isAnalyzing)
                  )}
                </div>
                <Card className={`p-6 mt-4 ${isPinned ? 'border-orange-300 border-2' : ''}`}>
                  {isPinned && <div className="text-sm font-medium text-orange-600 mb-2">{t('fixedContent')}</div>}
                  {isEditing ? (
                    <Textarea
                      value={editedAnalysis}
                      onChange={(e) => setEditedAnalysis(e.target.value)}
                      className="min-h-[600px] w-full resize-y"
                      disabled={isAnalyzing}
                    />
                  ) : (
                    <div className="space-y-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{isPinned && pinnedAnalysis ? pinnedAnalysis : analysis}</ReactMarkdown>
                    </div>
                  )}
                </Card>
                {!isEditing && (
                  <Button
                    onClick={handleConfirmWithDialog}
                    className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
                    disabled={isAnalyzing}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    {t('confirmAndContinue')}
                  </Button>
                )}
              </div>
            ) : null)}
          </div>
        </div>
      </div>
      <Toaster />
    </>
  );
} 