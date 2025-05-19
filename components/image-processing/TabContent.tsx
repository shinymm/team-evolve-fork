'use client'

import { ContentHeader } from './ContentHeader'
import { ContentDisplay } from './ContentDisplay'
import { ReasoningDisplay } from './ReasoningDisplay'
import { TabType } from '@/types/image-processing'
import { Button } from '@/components/ui/button'
import { Download, Save } from 'lucide-react'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface TabContentProps {
  tabType: TabType
  title: string
  content: string
  reasoning?: string
  isQVQModel: boolean
  reasoningVisible: boolean
  onToggleReasoning: () => void
  onDownload: () => void
  onDownloadReasoning: () => void
  exportType?: string
  className?: string
  onCacheDraft?: () => void
  hasCacheDraftBtn?: boolean
}

export const TabContent = ({
  tabType,
  title,
  content,
  reasoning = '',
  isQVQModel,
  reasoningVisible,
  onToggleReasoning,
  onDownload,
  onDownloadReasoning,
  exportType = 'MD',
  className = '',
  onCacheDraft,
  hasCacheDraftBtn = false
}: TabContentProps) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <ContentHeader title={title} />
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                  onClick={onDownload}
                  disabled={!content}
                >
                  <Download className="h-3 w-3 mr-1" />
                  导出{exportType}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>导出为{exportType === 'JSON' ? 'JSON文件' : 'Markdown文件'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {hasCacheDraftBtn && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-700"
                    onClick={onCacheDraft}
                    disabled={!content}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    缓存图片初稿
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>将当前初稿按系统隔离缓存到本地</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      {/* 推理过程显示（如果是QVQ模型且有推理内容） */}
      {isQVQModel && reasoning && (
        <ReasoningDisplay 
          content={reasoning} 
          isVisible={reasoningVisible} 
          onToggle={onToggleReasoning}
          onDownload={onDownloadReasoning}
        />
      )}
      
      <div className={className}>
        <ContentDisplay content={content} />
      </div>
    </div>
  )
} 