'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { streamingAICall } from '@/lib/services/ai-service'
import { Card } from "@/components/ui/card"
import { Loader2, Copy, Download, Edit2, Save, ArrowRight, Pin, PinOff } from "lucide-react"
import { requirementBookPrompt } from '@/lib/prompts/requirement-book'
import { updateTask } from '@/lib/services/task-service'
import { createRequirementStructureTask, createSceneAnalysisTask } from '@/lib/services/task-control'
import { RequirementParserService } from '@/lib/services/requirement-parser-service'
import { useRouter } from 'next/navigation'
import { Toaster } from "@/components/ui/toaster"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getTasks } from '@/lib/services/task-service'
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RequirementParseResult } from '@/lib/services/requirement-parser-service'
import { RequirementData } from '@/lib/services/task-control'
import { Scene } from '@/types/requirement'
import { useSystemStore } from '@/lib/stores/system-store'
import { RequirementBookService } from '@/lib/services/requirement-book-service'

export default function RequirementBook() {
  const [originalRequirement, setOriginalRequirement] = useState('')
  const [requirementBook, setRequirementBook] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedBook, setEditedBook] = useState('')
  const [editTarget, setEditTarget] = useState<'main' | 'pinned'>('main')
  const { toast } = useToast()
  const router = useRouter()
  
  // 获取当前系统信息
  const { systems, selectedSystemId } = useSystemStore()
  const selectedSystem = systems.find(s => s.id === selectedSystemId) || null
  
  // 从store中获取状态和方法
  const { 
    currentSystemId,
    systemRequirements,
    setCurrentSystem,
    setRequirement,
    pinAnalysis,
    pinRequirementBook, 
    unpinRequirementBook,
    getActiveRequirementBook,
    saveSystemDataToRedis
  } = useRequirementAnalysisStore()

  // 确保已设置当前系统
  useEffect(() => {
    if (selectedSystem?.id && selectedSystem.id !== currentSystemId) {
      console.log('设置当前系统:', selectedSystem.id)
      setCurrentSystem(selectedSystem.id)
    }
  }, [selectedSystem, currentSystemId, setCurrentSystem])
  
  // 从当前系统状态中获取数据
  const currentSystemData = selectedSystem?.id 
    ? (systemRequirements[selectedSystem.id] || { 
        requirement: '', 
        pinnedAnalysis: null,
        requirementBook: null,
        pinnedRequirementBook: null, 
        isPinned: false,
        isRequirementBookPinned: false
      }) 
    : { 
        requirement: '', 
        pinnedAnalysis: null,
        requirementBook: null,
        pinnedRequirementBook: null, 
        isPinned: false,
        isRequirementBookPinned: false 
      }

  const pinnedRequirementBook = currentSystemData.pinnedRequirementBook
  const isRequirementBookPinned = currentSystemData.isRequirementBookPinned || false
  const pinnedAnalysis = currentSystemData.pinnedAnalysis
  
  // 添加 AI 配置缓存
  const [cachedAIConfig, setCachedAIConfig] = useState<any>(null)
  
  // 添加内容格式化函数
  const normalizeMarkdownContent = (content: string): string => {
    if (!content) return '';
    
    // 移除多余的空行
    content = content.replace(/\n{3,}/g, '\n\n');
    
    // 确保列表项后有换行
    content = content.replace(/^[*-]\s.*$/gm, match => `${match}\n`);
    
    // 确保标题后有换行
    content = content.replace(/^#{1,6}\s.*$/gm, match => `${match}\n`);
    
    // 处理代码块
    if (content.includes('```')) {
      // 如果是代码块，保持原样
      return content;
    }
    
    // 处理普通文本
    return content.trim();
  };

  // 页面加载时检查前置任务状态并获取数据
  useEffect(() => {
    const checkPreviousTaskAndLoadData = async () => {
      try {
        const allTasks = await getTasks()
        const requirementAnalysisTask = allTasks.find(t => t.id === 'requirement-analysis')
        
        // 只有当原始需求分析任务完成时，才加载历史数据
        if (requirementAnalysisTask?.status === 'completed' && selectedSystem?.id) {
          // 从当前系统数据中获取pinnedAnalysis
          const systemData = systemRequirements[selectedSystem.id]
          if (systemData?.pinnedAnalysis) {
            setOriginalRequirement(systemData.pinnedAnalysis)
            console.log('已加载系统分析数据')
          } else {
            console.log('该系统没有分析数据')
          }
        } 
      } catch (error) {
        console.error('检查任务状态失败:', error)
      }
    }

    if (selectedSystem?.id) {
      checkPreviousTaskAndLoadData()
    }
  }, [selectedSystem, systemRequirements])

  // 页面卸载时保存数据到Redis
  useEffect(() => {
    return () => {
      if (selectedSystem?.id) {
        saveSystemDataToRedis(selectedSystem.id)
          .catch(err => console.error('保存到Redis失败:', err))
      }
    }
  }, [selectedSystem, saveSystemDataToRedis])

  // 修改 handleSubmit 函数
  const handleSubmit = async () => {
    if (!selectedSystem?.id) {
      toast({
        title: "请先选择系统",
        description: "需要先选择一个系统才能生成需求书",
        variant: "destructive",
        duration: 3000
      })
      return
    }

    // 立即设置 loading 状态
    setIsGenerating(true)
    setRequirementBook('')
    
    try {
      console.log('开始生成需求书...')
      
      // 使用RequirementBookService生成需求书
      await RequirementBookService.generateRequirementBook(
        originalRequirement,
        selectedSystem.id,
        (content) => setRequirementBook(content)
      )
      
      console.log('需求书生成完成')
    } catch (error) {
      console.error('生成失败:', error)
      toast({
        title: "生成失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
        duration: 3000
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast({
        title: "复制成功",
        description: "需求书内容已复制到剪贴板",
        duration: 3000
      })
    } catch (error) {
      toast({
        title: "复制失败",
        description: "请手动选择并复制内容",
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
      a.download = `需求书${suffix}-${timestamp}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: "下载成功",
        description: "需求书已保存为 Markdown 文件",
        duration: 3000
      })
    } catch (error) {
      toast({
        title: "下载失败",
        description: "请手动复制内容并保存",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  const handleEdit = (target: 'main' | 'pinned' = 'main') => {
    setIsEditing(true)
    setEditTarget(target)
    setEditedBook(target === 'main' ? requirementBook : (pinnedRequirementBook || ''))
  }

  const handleSave = () => {
    if (!selectedSystem?.id) return

    if (editTarget === 'main') {
      setRequirementBook(editedBook)
    } else {
      pinRequirementBook(editedBook)
    }
    setIsEditing(false)
    toast({
      title: "保存成功",
      description: "需求书内容已更新",
      duration: 3000
    })
  }

  const handleTogglePin = () => {
    if (!selectedSystem?.id) return

    if (isRequirementBookPinned) {
      // 取消固定时，如果当前没有requirementBook内容，将pinnedRequirementBook的内容移到requirementBook中
      if (!requirementBook && pinnedRequirementBook) {
        setRequirementBook(pinnedRequirementBook)
      }
      unpinRequirementBook()
      toast({
        title: "已取消固定",
        description: "需求书内容已取消固定",
        duration: 3000
      })
    } else {
      pinRequirementBook(requirementBook)
      // 固定后清空当前分析结果，这样就不会立即显示两列
      setRequirementBook('')
      toast({
        title: "已固定",
        description: "需求书内容已固定，可以生成新的需求书进行对比",
        duration: 3000
      })
    }
  }

  const handleConfirm = async () => {
    if (!selectedSystem?.id) return

    try {
      // 获取活跃的需求书内容（优先使用固定的内容）
      const activeBook = getActiveRequirementBook() || requirementBook
      
      // 如果内容没有被pin，则自动pin到store中
      if (!isRequirementBookPinned && requirementBook) {
        pinRequirementBook(requirementBook)
      }
      
      // 保存到Redis
      await saveSystemDataToRedis(selectedSystem.id)
      
      // 使用RequirementBookService处理确认逻辑，传递系统ID
      await RequirementBookService.processConfirmation(activeBook, selectedSystem.id)
      
      toast({
        title: "需求初稿衍化与结构化已完成",
        description: "已创建后续场景边界分析任务",
        duration: 3000
      })
      
      // 直接使用 window.location.replace 进行导航
      window.location.replace('/ai-capability/scene-analysis')
    } catch (error) {
      console.error('任务状态更新失败:', error)
      toast({
        title: "处理失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  // 确认对话框
  const handleConfirmWithDialog = async () => {
    if (!selectedSystem?.id) return

    if (isRequirementBookPinned && pinnedRequirementBook && requirementBook) {
      // 如果有固定的内容和新的内容，弹窗确认使用哪个
      if (confirm('您有固定的需求书内容和新的需求书内容，是否使用固定的内容继续？点击"确定"使用固定内容，点击"取消"使用新内容。')) {
        // 使用固定的内容
        await handleConfirm()
      } else {
        // 使用新内容，先更新活跃内容
        pinRequirementBook(requirementBook)
        await handleConfirm()
      }
    } else {
      // 只有一个内容，直接确认
      await handleConfirm()
    }
  }

  // 渲染图标按钮
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
    )
  }

  return (
    <>
      <div className="mx-auto py-6 w-[90%]">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">需求初稿衍化</h1>
            <div className="flex items-center justify-between mt-2">
              <p className="text-muted-foreground text-sm">
                请输入原始需求分析结果，我们将帮助您生成一份结构化的需求书初稿。系统将使用当前选择系统的需求书模版进行生成。
              </p>
              <div className="flex gap-1 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOriginalRequirement('')}
                  className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                  disabled={isGenerating}
                >
                  清空内容
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (selectedSystem?.id) {
                      // 从当前系统数据中获取pinnedAnalysis
                      const systemData = systemRequirements[selectedSystem.id]
                      if (systemData?.pinnedAnalysis) {
                        setOriginalRequirement(systemData.pinnedAnalysis)
                        toast({
                          title: "加载成功",
                          description: "已重新加载需求分析内容",
                          duration: 3000
                        })
                      } else {
                        toast({
                          title: "加载失败",
                          description: "未找到需求分析内容",
                          variant: "destructive",
                          duration: 3000
                        })
                      }
                    } else {
                      toast({
                        title: "加载失败",
                        description: "请先选择一个系统",
                        variant: "destructive",
                        duration: 3000
                      })
                    }
                  }}
                  className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                  disabled={isGenerating}
                >
                  重新加载
                </Button>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <Textarea
              placeholder="请粘贴原始需求分析结果（Markdown格式）..."
              className="min-h-[200px]"
              value={originalRequirement}
              onChange={(e) => setOriginalRequirement(e.target.value)}
              disabled={isGenerating}
            />
            <Button 
              onClick={handleSubmit} 
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={isGenerating || !selectedSystemId}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在生成...
                </>
              ) : !selectedSystemId ? (
                '请先选择一个系统'
              ) : (
                '需求书衍化'
              )}
            </Button>

            {/* 只有当有固定内容和新分析内容时才显示两列 */}
            {isRequirementBookPinned && pinnedRequirementBook && requirementBook ? (
              // 双列显示模式（固定内容 + 新内容）
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* 固定的内容（左侧） */}
                  <div className="space-y-4">
                    <div className="flex justify-end gap-1">
                      {renderIconButton(<Copy className="h-4 w-4" />, "复制内容", () => handleCopy(pinnedRequirementBook), "text-gray-500 hover:text-gray-700", isGenerating)}
                      {renderIconButton(<Download className="h-4 w-4" />, "下载需求书", () => handleDownload(pinnedRequirementBook, '-固定'), "text-gray-500 hover:text-gray-700", isGenerating)}
                      {renderIconButton(<Edit2 className="h-4 w-4" />, "编辑内容", () => handleEdit('pinned'), "text-gray-500 hover:text-gray-700", isGenerating || isEditing)}
                      {renderIconButton(<PinOff className="h-4 w-4" />, "取消固定", handleTogglePin, "text-orange-600 hover:text-orange-700", isGenerating)}
                    </div>
                    <Card className="p-6 mt-4 border-orange-300 border-2">
                      <div className="text-sm font-medium text-orange-600 mb-2">固定的需求书内容</div>
                      {isEditing && editTarget === 'pinned' ? (
                        <Textarea
                          value={editedBook}
                          onChange={(e) => setEditedBook(e.target.value)}
                          className="min-h-[600px] w-full resize-y"
                          disabled={isGenerating}
                        />
                      ) : (
                        <div className="space-y-4">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({children}) => <h1 className="text-xl font-bold mb-2 pb-1 border-b">{children}</h1>,
                              h2: ({children}) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
                              h3: ({children}) => <h3 className="text-base font-medium mb-1 mt-2">{children}</h3>,
                              p: ({children}) => <p className="text-gray-600 my-1 leading-normal text-sm">{children}</p>,
                              ul: ({children}) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
                              li: ({children}) => <li className="text-gray-600 text-sm">{children}</li>,
                              blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1 italic text-sm">{children}</blockquote>,
                              code: ({children}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>,
                              pre: ({children}) => (
                                <div className="relative">
                                  <pre className="bg-gray-50 rounded-lg p-3 my-2 overflow-auto text-sm">{children}</pre>
                                  <div className="absolute top-0 right-0 p-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-1.5 text-gray-500 hover:text-gray-700"
                                      onClick={() => {
                                        const codeContent = children?.toString() || '';
                                        navigator.clipboard.writeText(codeContent);
                                      }}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )
                            }}
                          >
                            {pinnedRequirementBook}
                          </ReactMarkdown>
                        </div>
                      )}
                    </Card>
                  </div>
                  
                  {/* 新的内容（右侧） */}
                  <div className="space-y-4">
                    <div className="flex justify-end gap-1">
                      {renderIconButton(<Copy className="h-4 w-4" />, "复制内容", () => handleCopy(requirementBook), "text-gray-500 hover:text-gray-700", isGenerating)}
                      {renderIconButton(<Download className="h-4 w-4" />, "下载需求书", () => handleDownload(requirementBook, '-新'), "text-gray-500 hover:text-gray-700", isGenerating)}
                      {renderIconButton(<Edit2 className="h-4 w-4" />, "编辑内容", () => handleEdit('main'), "text-gray-500 hover:text-gray-700", isGenerating || isEditing)}
                      {renderIconButton(<Pin className="h-4 w-4" />, "固定此版本", handleTogglePin, "text-gray-500 hover:text-gray-700", isGenerating)}
                    </div>
                    <Card className="p-6 mt-4">
                      <div className="text-sm font-medium text-gray-600 mb-2">新的需求书内容</div>
                      {isEditing && editTarget === 'main' ? (
                        <Textarea
                          value={editedBook}
                          onChange={(e) => setEditedBook(e.target.value)}
                          className="min-h-[600px] w-full resize-y"
                          disabled={isGenerating}
                        />
                      ) : (
                        <div className="space-y-4">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({children}) => <h1 className="text-xl font-bold mb-2 pb-1 border-b">{children}</h1>,
                              h2: ({children}) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
                              h3: ({children}) => <h3 className="text-base font-medium mb-1 mt-2">{children}</h3>,
                              p: ({children}) => <p className="text-gray-600 my-1 leading-normal text-sm">{children}</p>,
                              ul: ({children}) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
                              li: ({children}) => <li className="text-gray-600 text-sm">{children}</li>,
                              blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1 italic text-sm">{children}</blockquote>,
                              code: ({children}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>,
                              pre: ({children}) => (
                                <div className="relative">
                                  <pre className="bg-gray-50 rounded-lg p-3 my-2 overflow-auto text-sm">{children}</pre>
                                  <div className="absolute top-0 right-0 p-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-1.5 text-gray-500 hover:text-gray-700"
                                      onClick={() => {
                                        const codeContent = children?.toString() || '';
                                        navigator.clipboard.writeText(codeContent);
                                      }}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )
                            }}
                          >
                            {requirementBook}
                          </ReactMarkdown>
                        </div>
                      )}
                    </Card>
                  </div>
                </div>
                
                {!isEditing && (
                  <Button 
                    onClick={handleConfirmWithDialog}
                    className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
                    disabled={isGenerating}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    确认并继续
                  </Button>
                )}
              </div>
            ) : (
              // 单列显示模式 - 显示固定内容或新需求书内容
              (isRequirementBookPinned && pinnedRequirementBook) || requirementBook ? (
                <div className="space-y-4">
                  <div className="flex justify-end gap-1">
                    {renderIconButton(<Copy className="h-4 w-4" />, "复制内容", () => handleCopy(isRequirementBookPinned && pinnedRequirementBook ? pinnedRequirementBook : requirementBook), "text-gray-500 hover:text-gray-700", isGenerating)}
                    {renderIconButton(<Download className="h-4 w-4" />, "下载需求书", () => handleDownload(isRequirementBookPinned && pinnedRequirementBook ? pinnedRequirementBook : requirementBook), "text-gray-500 hover:text-gray-700", isGenerating)}
                    {!isEditing ? (
                      <>
                        {renderIconButton(<Edit2 className="h-4 w-4" />, "编辑内容", () => handleEdit(isRequirementBookPinned ? 'pinned' : 'main'), "text-gray-500 hover:text-gray-700", isGenerating)}
                        {isRequirementBookPinned ? 
                          renderIconButton(<PinOff className="h-4 w-4" />, "取消固定", handleTogglePin, "text-orange-600 hover:text-orange-700", isGenerating) :
                          renderIconButton(<Pin className="h-4 w-4" />, "固定内容", handleTogglePin, "text-gray-500 hover:text-gray-700", isGenerating)
                        }
                      </>
                    ) : (
                      renderIconButton(<Save className="h-4 w-4" />, "保存修改", handleSave, "text-orange-600 hover:text-orange-700", isGenerating)
                    )}
                  </div>
                  <Card className={`p-6 mt-4 ${isRequirementBookPinned ? 'border-orange-300 border-2' : ''}`}>
                    {isRequirementBookPinned && <div className="text-sm font-medium text-orange-600 mb-2">已固定的需求书内容</div>}
                    {isEditing ? (
                      <Textarea
                        value={editedBook}
                        onChange={(e) => setEditedBook(e.target.value)}
                        className="min-h-[600px] w-full resize-y"
                        disabled={isGenerating}
                      />
                    ) : (
                      <div className="space-y-4">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({children}) => <h1 className="text-xl font-bold mb-2 pb-1 border-b">{children}</h1>,
                            h2: ({children}) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
                            h3: ({children}) => <h3 className="text-base font-medium mb-1 mt-2">{children}</h3>,
                            p: ({children}) => <p className="text-gray-600 my-1 leading-normal text-sm">{children}</p>,
                            ul: ({children}) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
                            li: ({children}) => <li className="text-gray-600 text-sm">{children}</li>,
                            blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1 italic text-sm">{children}</blockquote>,
                            code: ({children}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>,
                            pre: ({children}) => (
                              <div className="relative">
                                <pre className="bg-gray-50 rounded-lg p-3 my-2 overflow-auto text-sm">{children}</pre>
                                <div className="absolute top-0 right-0 p-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-gray-500 hover:text-gray-700"
                                    onClick={() => {
                                      const codeContent = children?.toString() || '';
                                      navigator.clipboard.writeText(codeContent);
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )
                          }}
                        >
                          {isRequirementBookPinned && pinnedRequirementBook ? pinnedRequirementBook : requirementBook}
                        </ReactMarkdown>
                      </div>
                    )}
                  </Card>
                  
                  {!isEditing && (
                    <Button 
                      onClick={handleConfirmWithDialog}
                      className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
                      disabled={isGenerating}
                    >
                      <ArrowRight className="mr-2 h-4 w-4" />
                      确认并继续
                    </Button>
                  )}
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </>
  )
} 