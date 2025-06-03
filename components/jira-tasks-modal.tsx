"use client"

import { useState, useEffect } from 'react'
import { useSystemStore } from '@/lib/stores/system-store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { formatDistanceToNow } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import { useLocale, useTranslations } from 'next-intl'

interface JiraTask {
  key: string
  fields: {
    summary: string
    description: string
    assignee: {
      displayName: string
    } | null
    created: string
    updated: string
  }
}

interface JiraTasksModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTask: (summary: string, description?: string) => void
}

export function JiraTasksModal({ open, onOpenChange, onSelectTask }: JiraTasksModalProps) {
  const t = useTranslations('TestCaseAssistant.JiraModal')
  const [tasks, setTasks] = useState<JiraTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const { systems, selectedSystemId } = useSystemStore()
  const locale = useLocale()
  const dateLocale = locale === 'zh' ? zhCN : enUS

  useEffect(() => {
    if (open) {
      fetchJiraTasks()
    }
  }, [open])

  const fetchJiraTasks = async () => {
    setIsLoading(true)
    setError(null)
    setDebugInfo(t('fetchingTasks'))

    try {
      // 获取当前选中系统的名称
      const selectedSystem = systems.find(sys => sys.id === selectedSystemId)
      const systemName = selectedSystem?.name || 'QARE' // 如果没有选中系统，默认使用QARE
      
      const url = `/api/jira/tasks?systemName=${systemName}`
      console.log('请求URL:', url)
      setDebugInfo(prev => `${prev}\n${t('requestUrl')}: ${url}`)
      
      const response = await fetch(url)
      
      console.log('API响应状态:', response.status)
      setDebugInfo(prev => `${prev}\n${t('apiResponseStatus')}: ${response.status}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch (e) {
          errorData = { error: errorText }
        }
        
        console.error('API错误详情:', errorData)
        setDebugInfo(prev => `${prev}\n${t('apiErrorDetails')}: ${JSON.stringify(errorData)}`)
        
        // 提取主要错误信息，优先使用errorMessages中的第一条
        let errorMessage = t('fetchTasksFailed')
        if (errorData.details?.errorMessages?.length > 0) {
          errorMessage = errorData.details.errorMessages[0]
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('获取到的任务数量:', data.issues?.length || 0)
      setDebugInfo(prev => `${prev}\n${t('tasksCount')}: ${data.issues?.length || 0}`)
      setTasks(data.issues || [])
    } catch (error) {
      console.error('获取Jira任务失败:', error)
      setError(error instanceof Error ? error.message : t('unknownError'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectTask = (task: JiraTask) => {
    onSelectTask(task.fields.summary, task.fields.description)
    onOpenChange(false)
  }

  // 处理长文本截断，添加省略号
  const truncateSummary = (summary: string, maxLength = 35) => {
    if (summary.length <= maxLength) return summary
    return summary.substring(0, maxLength) + '...'
  }

  // 处理描述文本的截断
  const truncateDescription = (description: string | null, maxLength = 50) => {
    if (!description) return '';
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength) + '...';
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[60vw] max-w-[900px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
            <span className="ml-2">{t('loading')}</span>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4 text-center">
            <p>{error}</p>
            <Button variant="outline" className="mt-2" onClick={fetchJiraTasks}>
              {t('retry')}
            </Button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>{t('noTasksFound')}</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.key}
                  className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleSelectTask(task)}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-medium">
                      {task.key}: {truncateSummary(task.fields.summary)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {task.fields.assignee 
                        ? task.fields.assignee.displayName 
                        : t('unassigned')}
                    </div>
                  </div>
                  {task.fields.description && (
                    <div className="mt-1 text-xs text-gray-600 bg-gray-50 p-1 rounded">
                      {truncateDescription(task.fields.description)}
                    </div>
                  )}
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <div>{t('created')}: {formatDistanceToNow(new Date(task.fields.created), { addSuffix: true, locale: dateLocale })}</div>
                    <div>{t('updated')}: {formatDistanceToNow(new Date(task.fields.updated), { addSuffix: true, locale: dateLocale })}</div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 