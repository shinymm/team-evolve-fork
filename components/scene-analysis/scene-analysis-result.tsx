'use client'

import React from 'react'
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Scene } from '@/types/requirement'
import { SceneAnalysisState } from '@/types/scene'
import { useTranslations } from 'next-intl'

interface SceneAnalysisResultProps {
  scene: Scene
  sceneState: SceneAnalysisState
  analysisResult: string
  isCurrentlySelected: boolean
  onAcceptResult: (scene: Scene) => void
  onRejectResult: (scene: Scene) => void
}

export default function SceneAnalysisResult({
  scene,
  sceneState,
  analysisResult,
  isCurrentlySelected,
  onAcceptResult,
  onRejectResult
}: SceneAnalysisResultProps) {
  const t = useTranslations('SceneAnalysisPage')
  
  // 确定显示哪个分析结果
  const displayResult = sceneState?.analysisResult || 
                        (isCurrentlySelected ? analysisResult : '') || 
                        sceneState?.tempResult || '';
                        
  // 判断是否显示确认按钮
  const shouldShowConfirmButtons = sceneState?.isConfirming && !!sceneState?.tempResult;
  
  if (!displayResult) return null;
  
  return (
    <div className="mt-4 border-t pt-4">
      <div className="text-sm text-gray-600">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            h3: ({children}: {children: React.ReactNode}) => <h3 className="text-base font-semibold text-gray-900 mb-2">{children}</h3>,
            h4: ({children}: {children: React.ReactNode}) => <h4 className="text-sm font-medium text-gray-700 mb-1.5">{children}</h4>,
            ul: ({children}: {children: React.ReactNode}) => <ul className="space-y-1 mb-3">{children}</ul>,
            li: ({children}: {children: React.ReactNode}) => <li className="text-sm mb-1 text-orange-700">{children}</li>,
            p: ({children}: {children: React.ReactNode}) => <p className="text-sm mb-2 text-orange-700">{children}</p>
          }}
        >
          {String(displayResult)}
        </ReactMarkdown>
      </div>
      
      {/* 确认按钮区域 */}
      {shouldShowConfirmButtons && (
        <div className="flex justify-end gap-3 mt-4">
          <Button
            onClick={() => onRejectResult(scene)}
            variant="outline"
            size="sm"
            className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            {t('rejectAnalysis')}
          </Button>
          <Button
            onClick={() => onAcceptResult(scene)}
            className="bg-blue-500 hover:bg-blue-600"
            size="sm"
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            {t('acceptAnalysis')}
          </Button>
        </div>
      )}
    </div>
  )
} 