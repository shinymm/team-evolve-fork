'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { streamingAICall } from '@/lib/services/ai-service'
import { getDefaultAIConfig } from '@/lib/services/ai-config-service'
import { Card } from "@/components/ui/card"
import { Loader2, Copy, Download, Edit2, Save, ArrowRight } from "lucide-react"
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

export default function RequirementBook() {
  const [originalRequirement, setOriginalRequirement] = useState('')
  const [requirementBook, setRequirementBook] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedBook, setEditedBook] = useState('')
  const { toast } = useToast()
  const router = useRouter()
  
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
        if (requirementAnalysisTask?.status === 'completed') {
          // 从store中获取pinnedAnalysis
          const { pinnedAnalysis } = useRequirementAnalysisStore.getState()
          if (pinnedAnalysis) {
            setOriginalRequirement(pinnedAnalysis)
          }
        } 
      } catch (error) {
        console.error('Error checking task status:', error)
      }
    }

    checkPreviousTaskAndLoadData()
  }, [])

  // 修改 handleSubmit 函数
  const handleSubmit = async () => {
    // 立即设置 loading 状态
    setIsGenerating(true)
    
    try {
      if (!originalRequirement.trim()) {
        throw new Error('需求内容不能为空')
      }

      // 获取AI配置
      const aiConfig = await getDefaultAIConfig()
      if (!aiConfig) {
        throw new Error('未找到可用的AI模型配置，请先在设置中配置AI模型')
      }
      setCachedAIConfig(aiConfig)

      setRequirementBook('')
      console.log('开始生成需求书...')

      const prompt = requirementBookPrompt(originalRequirement)
      let accumulatedContent = ''
      
      await streamingAICall(
        prompt,
        aiConfig,
        (content) => {
          console.log('收到流式内容片段:', content)
          accumulatedContent += content
          setRequirementBook(accumulatedContent)
        },
        (error: string) => {
          throw new Error(`需求书衍化失败: ${error}`)
        }
      )
      
      console.log('需求书生成完成，最终内容:', accumulatedContent)
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

  // 修改 handleAutoGenerate 函数
  const handleAutoGenerate = async (content: string) => {
    // 立即设置 loading 状态
    setIsGenerating(true)
    
    try {
      // 使用缓存的配置或重新获取
      let aiConfig = cachedAIConfig
      if (!aiConfig) {
        console.log('使用缓存的 AI 配置失败，正在重新获取...')
        aiConfig = await getDefaultAIConfig()
        if (!aiConfig) {
          throw new Error('AI 模型参数配置失败')
        }
        setCachedAIConfig(aiConfig)
      }

      setRequirementBook('')
      console.log('开始生成需求书...')

      const prompt = requirementBookPrompt(content)
      let accumulatedContent = ''
      
      await streamingAICall(
        prompt,
        aiConfig,
        (content) => {
          console.log('收到流式内容片段:', content)
          const normalizedContent = normalizeMarkdownContent(content)
          accumulatedContent += normalizedContent
          setRequirementBook(accumulatedContent)
        },
        (error: string) => {
          throw new Error(`需求书衍化失败: ${error}`)
        }
      )
      
      console.log('需求书生成完成，最终内容:', accumulatedContent)
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(requirementBook)
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

  const handleDownload = () => {
    try {
      const blob = new Blob([requirementBook], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `需求书-${timestamp}.md`
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

  const handleEdit = () => {
    setIsEditing(true)
    setEditedBook(requirementBook)
  }

  const handleSave = () => {
    setRequirementBook(editedBook)
    setIsEditing(false)
    toast({
      title: "保存成功",
      description: "需求书内容已更新",
      duration: 3000
    })
  }

  const handleConfirm = async () => {
    try {
      console.log('开始更新任务状态...');
      
      // 保存需求书MD内容到store
      useRequirementAnalysisStore.getState().setRequirementBook(requirementBook);
      
      // 1. 更新需求书任务状态为完成
      console.log('更新需求书任务状态...');
      await updateTask('requirement-book', {
        status: 'completed'
      })
      
      // 2. 创建需求书结构化任务
      console.log('创建需求书结构化任务...');
      const structureTask = await createRequirementStructureTask(requirementBook)
      
      // 3. 解析需求书内容
      console.log('解析需求书内容...');
      const parser = new RequirementParserService()
      const parsedRequirement = parser.parseRequirement(requirementBook)
      
      // 4. 标记结构化任务完成
      console.log('更新结构化任务状态...');
      await updateTask(structureTask.id, {
        status: 'completed'
      })
      
      // 5. 创建场景边界分析任务
      console.log('创建场景边界分析任务...');
      await createSceneAnalysisTask(parsedRequirement)
      
      console.log('所有任务状态更新完成');
      
      toast({
        title: "需求初稿衍化与结构化已完成",
        description: "已创建后续场景边界分析任务",
        duration: 3000
      })
      
      // 直接使用 window.location.replace 进行导航
      window.location.replace('/collaboration/tactical-board')
    } catch (error) {
      console.error('任务状态更新失败:', error);
      toast({
        title: "处理失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  return (
    <>
      <div className=" mx-auto py-6 w-[90%]">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">需求初稿衍化</h1>
            <div className="flex items-center justify-between mt-2">
              <p className="text-muted-foreground text-sm">
                请输入原始需求分析结果，我们将帮助您生成一份结构化的需求书初稿。
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
                    // 从store中获取pinnedAnalysis
                    const { pinnedAnalysis } = useRequirementAnalysisStore.getState()
                    if (pinnedAnalysis) {
                      setOriginalRequirement(pinnedAnalysis)
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
            <div className="relative">
              <Button 
                onClick={handleSubmit} 
                className="w-full bg-orange-500 hover:bg-orange-600"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在生成...
                  </>
                ) : (
                  '需求书衍化'
                )}
              </Button>
            </div>

            {requirementBook && (
              <div className="space-y-4">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopy}
                    className="text-gray-500 hover:text-gray-700 h-9 w-9"
                    disabled={isGenerating}
                    title="复制内容"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDownload}
                    className="text-gray-500 hover:text-gray-700 h-9 w-9"
                    disabled={isGenerating}
                    title="下载需求书"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {!isEditing ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleEdit}
                      className="text-gray-500 hover:text-gray-700 h-9 w-9"
                      disabled={isGenerating}
                      title="编辑内容"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSave}
                      className="text-orange-600 hover:text-orange-700 h-9 w-9"
                      disabled={isGenerating}
                      title="保存修改"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Card className="p-6 mt-4">
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
                        {requirementBook}
                      </ReactMarkdown>
                    </div>
                  )}
                </Card>
                {!isEditing && (
                  <Button 
                    onClick={handleConfirm}
                    className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
                    disabled={isGenerating}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    确认并继续
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </>
  )
} 