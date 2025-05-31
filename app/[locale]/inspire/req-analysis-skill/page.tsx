'use client'

import { useState, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getUnprocessedActions, markActionAsProcessed, RequirementActionRecord } from '@/lib/services/requirement-action-service'
import { analyzeRequirementEdit } from '@/lib/services/requirement-edit-analysis-service'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { Check, Clock, Edit2, ChevronDown, ChevronUp, Loader2, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslations, useLocale } from 'next-intl'

export default function RequirementSkillPage() {
  const t = useTranslations('ReqAnalysisSkillPage')
  const locale = useLocale()
  const dateLocale = locale === 'zh' ? zhCN : enUS

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
      console.error(t('loadError'), error)
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
      console.error(t('markProcessedError'), error)
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    
    if (locale === 'zh') {
      return `${minutes}分${remainingSeconds}秒`
    } else {
      return `${minutes}m ${remainingSeconds}s`
    }
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
      console.error(t('analysisError'), error)
    } finally {
      setAnalyzing(prev => ({ ...prev, [action.id]: false }))
    }
  }

  return (
    <div className="mx-auto p-6 w-[90%]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>
          <div className="text-muted-foreground text-sm">
            {t('subtitle')}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{t('pendingRefinement')}</h2>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('loading')}
            </div>
          ) : unprocessedActions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noPendingItems')}
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
                          <span className="font-medium">{t('rawReqEditLabel')}</span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{t('editingDuration', { duration: formatDuration(action.duration) })}</span>
                          </div>
                          <div>
                            {t('occurrenceTime', { 
                              time: formatDistanceToNow(new Date(action.timestamp), { 
                                addSuffix: true, 
                                locale: dateLocale 
                              })
                            })}
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
                          {t('markAsRefined')}
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
                              {t('analyzing')}
                            </>
                          ) : (
                            t('aiAssistAnalysis')
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-lg">
                      <div 
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleExpand(action.id)}
                      >
                        <span className="text-sm font-medium text-gray-600">{t('viewContentComparison')}</span>
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
                              <div className="text-sm font-medium">{t('originalContent')}</div>
                              <div className="text-sm bg-muted p-4 rounded-md whitespace-pre-wrap h-[300px] overflow-y-auto">
                                {action.contentBefore}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm font-medium">{t('modifiedContent')}</div>
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
                            <span>{t('aiAnalysisResult')}</span>
                          </div>
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({children}: {children: React.ReactNode}) => <h1 className="text-xl font-bold mb-2 pb-1 border-b">{children}</h1>,
                                h2: ({children}: {children: React.ReactNode}) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
                                h3: ({children}: {children: React.ReactNode}) => <h3 className="text-base font-medium mb-1 mt-2">{children}</h3>,
                                p: ({children}: {children: React.ReactNode}) => <p className="text-gray-600 my-1 leading-normal text-sm">{children}</p>,
                                ul: ({children}: {children: React.ReactNode}) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                                ol: ({children}: {children: React.ReactNode}) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
                                li: ({children}: {children: React.ReactNode}) => <li className="text-gray-600 text-sm">{children}</li>,
                                blockquote: ({children}: {children: React.ReactNode}) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1 italic text-sm">{children}</blockquote>,
                                code: ({children}: {children: React.ReactNode}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>,
                                pre: ({children}: {children: React.ReactNode}) => (
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