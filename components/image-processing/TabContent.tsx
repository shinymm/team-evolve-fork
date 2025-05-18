'use client'

import { ContentHeader } from './ContentHeader'
import { ContentDisplay } from './ContentDisplay'
import { ReasoningDisplay } from './ReasoningDisplay'
import { TabType } from '@/types/image-processing'

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
  className = ''
}: TabContentProps) => {
  return (
    <div className="space-y-4">
      <ContentHeader 
        title={title}
        onDownload={onDownload}
        hasContent={!!content}
        exportType={exportType}
      />
      
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