'use client'

import { useState, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getUnprocessedActions, markActionAsProcessed, RequirementActionRecord } from '@/lib/services/requirement-action-service'
import { analyzeRequirementEdit } from '@/lib/services/requirement-edit-analysis-service'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Check, Clock, Edit2, ChevronDown, ChevronUp, Loader2, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function RequirementSkillPage() {
  const [unprocessedActions, setUnprocessedActions] = useState<RequirementActionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({})
  const [analysisResults, setAnalysisResults] = useState<Record<string, string>>({})

  useEffect(() => {
    loadUnprocessedActions()
  }, [])

  const loadUnprocessedActions = async () => {
    try {
      const actions = await getUnprocessedActions()
      setUnprocessedActions(actions)
    } catch (error) {
      console.error('加载待提炼项失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsProcessed = async (actionId: string) => {
    try {
      await markActionAsProcessed(actionId)
      setUnprocessedActions(prev => prev.filter(action => action.id !== actionId))
      setAnalysisResults(prev => {
        const newResults = { ...prev }
        delete newResults[actionId]
        return newResults
      })
      setExpandedCards(prev => {
        const newStates = { ...prev }
        delete newStates[actionId]
        return newStates
      })
      setAnalyzing(prev => {
        const newStates = { ...prev }
        delete newStates[actionId]
        return newStates
      })
    } catch (error) {
      console.error('标记为已处理失败:', error)
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}分${remainingSeconds}秒`
  }

  const toggleExpand = (actionId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [actionId]: !prev[actionId]
    }))
  }

  const handleAnalyze = async (action: RequirementActionRecord) => {
    if (!action.contentBefore || !action.contentAfter) return

    setAnalyzing(prev => ({ ...prev, [action.id]: true }))
    setAnalysisResults(prev => ({ ...prev, [action.id]: '' }))

    try {
      await analyzeRequirementEdit(
        action.contentBefore,
        action.contentAfter,
        (content) => {
          setAnalysisResults(prev => ({
            ...prev,
            [action.id]: (prev[action.id] || '') + content
          }))
        }
      )
    } catch (error) {
      console.error('分析失败:', error)
    } finally {
      setAnalyzing(prev => ({ ...prev, [action.id]: false }))
    }
  }

  return (
    <div className="mx-auto p-6 w-[90%]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-4">需求分析技能</h1>
          <div className="text-muted-foreground text-sm">
            在这里，您可以查看用户在需求分析过程中的关键行为，这些行为可能包含有价值的反馈信息。
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">待提炼项</h2>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              正在加载...
            </div>
          ) : unprocessedActions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无待提炼项
            </div>
          ) : (
            <div className="space-y-4">
              {unprocessedActions.map((action) => (
                <Card key={action.id} className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Edit2 className="h-4 w-4 text-orange-500" />
                          <span className="font-medium">需求编辑动作</span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>编辑时长: {formatDuration(action.duration)}</span>
                          </div>
                          <div>
                            发生时间: {formatDistanceToNow(new Date(action.timestamp), { addSuffix: true, locale: zhCN })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsProcessed(action.id)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          标记已提炼
                        </Button>
                        <Button
                          onClick={() => handleAnalyze(action)}
                          disabled={analyzing[action.id]}
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          {analyzing[action.id] ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              正在分析...
                            </>
                          ) : (
                            'AI辅助分析提炼'
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-lg">
                      <div 
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleExpand(action.id)}
                      >
                        <span className="text-sm font-medium text-gray-600">查看内容对比</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {expandedCards[action.id] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {expandedCards[action.id] && (
                        <div className="border-t p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="text-sm font-medium">原始内容:</div>
                              <div className="text-sm bg-muted p-4 rounded-md whitespace-pre-wrap h-[300px] overflow-y-auto">
                                {action.contentBefore}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm font-medium">修改后内容:</div>
                              <div className="text-sm bg-muted p-4 rounded-md whitespace-pre-wrap h-[300px] overflow-y-auto">
                                {action.contentAfter}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {analysisResults[action.id] && (
                      <div className="mt-6 border-t pt-6">
                        <div className="space-y-2">
                          <div className="text-sm font-medium flex items-center space-x-2">
                            <div className="h-1 w-1 rounded-full bg-orange-500"></div>
                            <span>AI分析结果</span>
                          </div>
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({children}) => <h1 className="text-2xl font-bold mb-4 pb-2 border-b">{children}</h1>,
                                h2: ({children}) => <h2 className="text-xl font-semibold mb-3 mt-6">{children}</h2>,
                                h3: ({children}) => <h3 className="text-lg font-medium mb-2 mt-4">{children}</h3>,
                                p: ({children}) => <p className="text-gray-600 my-2 leading-relaxed">{children}</p>,
                                ul: ({children}) => <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>,
                                ol: ({children}) => <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>,
                                li: ({children}) => <li className="text-gray-600">{children}</li>,
                                blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 pl-4 my-2 italic">{children}</blockquote>,
                                code: ({children}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-sm">{children}</code>,
                                pre: ({children}) => (
                                  <div className="relative">
                                    <pre className="bg-gray-50 rounded-lg p-4 my-4 overflow-auto">{children}</pre>
                                    <div className="absolute top-0 right-0 p-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-gray-500 hover:text-gray-700"
                                        onClick={() => {
                                          const codeContent = children?.toString() || '';
                                          navigator.clipboard.writeText(codeContent);
                                        }}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                )
                              }}
                            >
                              {analysisResults[action.id]}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 