'use client'

import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X, Loader2 } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Scene } from '@/types/requirement'
import { SceneAnalysisState } from '@/types/scene'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface SceneOptimizeResultProps {
  scene: Scene
  index: number
  sceneState: SceneAnalysisState
  optimizeResult: string
  isCurrentlySelected: boolean
  isOptimizing: boolean
  isHideOriginal: boolean
  onAcceptOptimize: (scene: Scene, index: number) => void
  onRejectOptimize: (scene: Scene) => void
}

export default function SceneOptimizeResult({
  scene,
  index,
  sceneState,
  optimizeResult,
  isCurrentlySelected,
  isOptimizing,
  isHideOriginal,
  onAcceptOptimize,
  onRejectOptimize
}: SceneOptimizeResultProps) {
  const t = useTranslations('SceneAnalysisPage')
  
  // 如果没有优化状态或结果，不显示组件
  if (!sceneState?.isOptimizing && !sceneState?.optimizeResult) {
    return null;
  }
  
  // 确定显示哪个优化结果
  // 优先显示正在流式生成的结果，其次是已保存的结果
  const resultContent = isCurrentlySelected && isOptimizing ? optimizeResult : (sceneState?.optimizeResult || '');
  
  return (
    <Card className={cn(
      "hover:shadow-lg transition-all duration-300",
      isHideOriginal ? "w-full" : "w-1/2"
    )}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-blue-600">{t('optimizedScene')}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{t('optimizationSuggestions')}</CardDescription>
          </div>
          {sceneState?.isOptimizeConfirming && (
            <div className="flex gap-2">
              <Button
                onClick={() => onAcceptOptimize(scene, index)}
                className="bg-blue-500 hover:bg-blue-600"
                size="sm"
              >
                <Check className="mr-2 h-3.5 w-3.5" />
                {t('acceptOptimization')}
              </Button>
              <Button
                onClick={() => onRejectOptimize(scene)}
                variant="outline"
                size="sm"
                className="border-red-200 text-red-700 hover:bg-red-50"
              >
                <X className="mr-2 h-3.5 w-3.5" />
                {t('rejectOptimization')}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-0 pb-3">
        <div className="text-sm text-gray-600">
          {isOptimizing && isCurrentlySelected && !resultContent ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-3 text-blue-600">{t('optimizingScene')}</span>
            </div>
          ) : (
            <div className="markdown-container min-h-[200px]">
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
                  pre: ({children}: {children: React.ReactNode}) => <pre className="bg-gray-50 rounded-lg p-3 my-2 overflow-auto text-sm">{children}</pre>
                }}
              >
                {String(resultContent)}
              </ReactMarkdown>
              
              {/* 优化中的加载指示器 */}
              {isOptimizing && isCurrentlySelected && resultContent && (
                <div className="flex items-center justify-center py-2 mt-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 