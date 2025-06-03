'use client'

import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronRight, ArrowRight, Loader2, Check, X, FileEdit } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Scene } from '@/types/requirement'
import { SceneAnalysisState } from '@/types/scene'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

// 清理场景内容开头的冗余标题和分隔线
const cleanSceneContentForDisplay = (sceneName: string, content: string): string => {
  if (!content) return '';
  
  // 清理分隔线
  let cleanedContent = content.replace(/^\s*---\s*$/gm, '');
  const lines = cleanedContent.split('\n');
  let linesToRemove = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { // Skip empty lines
        linesToRemove++;
        continue;
    }

    // Check 1: Line starting with # and very similar to sceneName
    if (line.startsWith('#')) {
        const headingText = line.replace(/^#+\s*/, '').trim();
         // Also check for number prefix like "1. sceneName"
        const headingTextWithoutNumber = headingText.replace(/^\d+\.?\s*/, '').trim();

        // Escape sceneName for regex safety, just in case (though includes check is safer)
        const escapedSceneName = sceneName.replace(/[.*+?^${}()|[\\]]/g, '\\$&');

        if (headingText.includes(sceneName) || sceneName.includes(headingText) || 
            headingTextWithoutNumber.includes(sceneName) || sceneName.includes(headingTextWithoutNumber)) {
            linesToRemove++;
            continue; // Move to next line
        }
    }

    // Check 2: Line starting with # or number, looks like a sub-heading/module description
    // e.g., "3.1 功能模块：...", "## 场景概述"
    if (line.match(/^#*\s*(\d+(\.\d+)*\.?|场景概述|功能模块[:：])/i)) {
       linesToRemove++;
       continue; // Move to next line
    }

    // Check 3: First *non-empty* content line is very similar to sceneName (and not too long)
     if (i === linesToRemove && line.length < 80 && !line.startsWith('#')) { // Only check the first actual content line, ensure it's not a heading already checked
        const titleWords = sceneName.split(/[\s（）()]+/); // Split by space or brackets
        // Check if most words from the title are present in the line
        let matchCount = 0;
        if (titleWords.length > 1) {
           titleWords.forEach(word => {
              if (word && line.includes(word)) {
                 matchCount++;
              }
           });
           // Consider it a match if > 50% of title words are present
           if (matchCount / titleWords.length > 0.5) {
             linesToRemove++;
             continue; // Move to next line
           }
        }
    }

    // If none of the above conditions met for the current line (which is the first non-empty, non-header line), stop checking
    // We only want to remove initial redundant headers/lines.
     if(i >= linesToRemove) {
         break;
     }
  }

  // Join the remaining lines
  cleanedContent = lines.slice(linesToRemove).join('\n').trim();

  return cleanedContent;
};

interface EditingScene {
  name: string;
  content: string;
  analysisResult?: string;
}

interface SceneContentViewProps {
  scene: Scene
  index: number
  sceneState: SceneAnalysisState
  isAnalyzing: boolean
  isOptimizing: boolean
  selectedScene: Scene | null
  editingScene: EditingScene | null
  onStartEdit: (scene: Scene, index: number) => void
  onSaveEdit: (scene: Scene, index: number) => void
  onCancelEdit: (scene: Scene) => void
  onAnalyzeScene: (scene: Scene, index: number) => void
  onOptimizeRequirement: (scene: Scene, index: number) => void
  setEditingScene: (scene: EditingScene | null) => void
}

export default function SceneContentView({
  scene,
  index,
  sceneState,
  isAnalyzing,
  isOptimizing,
  selectedScene,
  editingScene,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onAnalyzeScene,
  onOptimizeRequirement,
  setEditingScene
}: SceneContentViewProps) {
  const t = useTranslations('SceneAnalysisPage')
  
  const isCurrentlySelected = selectedScene?.name === scene.name
  
  return (
    <Card 
      className={cn(
        "hover:shadow-lg transition-all duration-300",
        (sceneState?.isOptimizing || sceneState?.optimizeResult) ? "w-1/2" : "w-full"
      )}
    >
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{scene.name}</CardTitle>
            <CardDescription className="text-xs mt-0.5">场景概述</CardDescription>
          </div>
          <div className="flex gap-2">
            {sceneState?.isEditing ? (
              <>
                <Button
                  onClick={() => onSaveEdit(scene, index)}
                  className="bg-green-500 hover:bg-green-600"
                  size="sm"
                >
                  <Check className="mr-2 h-3.5 w-3.5" />
                  {t('saveChanges')}
                </Button>
                <Button
                  onClick={() => onCancelEdit(scene)}
                  variant="outline"
                  size="sm"
                  className="border-gray-200"
                >
                  <X className="mr-2 h-3.5 w-3.5" />
                  {t('cancel')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => onStartEdit(scene, index)}
                  variant="outline"
                  size="sm"
                  className="border-blue-200 text-blue-900 hover:bg-blue-50"
                >
                  <FileEdit className="mr-2 h-3.5 w-3.5" />
                  {t('editScene')}
                </Button>
                <Button 
                  onClick={() => onAnalyzeScene(scene, index)}
                  className={cn(
                    "bg-orange-500 hover:bg-orange-600",
                    sceneState?.isCompleted && "bg-gray-100 hover:bg-gray-200 text-gray-600"
                  )}
                  size="sm"
                  disabled={isAnalyzing && isCurrentlySelected}
                >
                  {isAnalyzing && isCurrentlySelected ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      {t('analyzingScene')}
                    </>
                  ) : (
                    <>
                      <ArrowRight className="mr-2 h-3.5 w-3.5" />
                      {t('analyzeBoundary')}
                    </>
                  )}
                </Button>
                {sceneState?.isCompleted && !sceneState?.isOptimizing && (
                  <Button
                    onClick={() => onOptimizeRequirement(scene, index)}
                    variant="default"
                    size="sm"
                    className={cn(
                      "bg-blue-500 hover:bg-blue-600 text-white",
                      "transition-all duration-200 ease-in-out transform hover:scale-105"
                    )}
                    disabled={isOptimizing}
                  >
                    {isOptimizing && isCurrentlySelected ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        {t('optimizingScene')}
                      </>
                    ) : (
                      <>
                        <FileEdit className="mr-2 h-3.5 w-3.5" />
                        {t('refineSceneDesc')}
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-0 pb-3 space-y-3">
        <div>
          {sceneState?.isEditing ? (
            <textarea
              className="w-full p-2 text-sm border rounded-md min-h-[200px]"
              value={editingScene?.content}
              onChange={(e) => {
                if (editingScene) {
                  setEditingScene({
                    ...editingScene,
                    content: e.target.value
                  });
                }
              }}
            />
          ) : (
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h3: ({children}: {children: React.ReactNode}) => <h3 className="text-base font-semibold text-gray-900 mb-2">{children}</h3>,
                h4: ({children}: {children: React.ReactNode}) => <h4 className="text-sm font-medium text-gray-700 mb-1.5">{children}</h4>,
                p: ({children}: {children: React.ReactNode}) => <p className="text-sm text-gray-600 mb-2">{children}</p>,
                ul: ({children}: {children: React.ReactNode}) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                ol: ({children}: {children: React.ReactNode}) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
                li: ({children}: {children: React.ReactNode}) => <li className="text-sm text-gray-600">{children}</li>
              }}
            >
              {String(cleanSceneContentForDisplay(scene.name, scene.content))}
            </ReactMarkdown>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 