'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { StructuredRequirement, StructuredScene } from '@/lib/services/requirement-export-service'
import { createArchitectureSuggestionTask, createArchitectureConfirmTask } from '@/lib/services/task-control'
import { generateArchitectureSuggestions } from '@/lib/services/architecture-suggestion-service'
import { updateTask } from '@/lib/services/task-service'
import { useSystemStore } from '@/lib/stores/system-store'
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store'
import type { ArchitectureItem } from '@/types/product-info'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslations, useLocale } from 'next-intl'

export default function BookConfirmPage({params}: {params: {locale: string}}) {
  const currentLocale = useLocale()
  const t = useTranslations('BookConfirmPage')
  
  const [requirement, setRequirement] = useState<StructuredRequirement | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()
  const [currentArchitecture, setCurrentArchitecture] = useState<ArchitectureItem[]>([])
  
  // 从 store 获取系统信息
  const { selectedSystemId } = useSystemStore()
  const systems = useSystemStore(state => state.systems)
  const currentSystem = systems.find(sys => sys.id === selectedSystemId)
  
  // 从 store 获取需求分析信息
  const { 
    currentSystemId,
    setCurrentSystem,
    getActiveRequirementBook,
  } = useRequirementAnalysisStore()
  
  // 确保已设置当前系统
  useEffect(() => {
    if (selectedSystemId && selectedSystemId !== currentSystemId) {
      console.log('设置当前系统:', selectedSystemId)
      setCurrentSystem(selectedSystemId)
    }
  }, [selectedSystemId, currentSystemId, setCurrentSystem])

  // 清理分隔线的函数
  const cleanSeparators = (content: string): string => {
    // 移除文本中的Markdown分隔线
    if (!content) return '';
    return content.replace(/^\s*---\s*$/gm, '');
  }

  useEffect(() => {
    // 根据当前系统ID从localStorage加载结构化需求数据
    try {
      if (!selectedSystemId) {
        return
      }
      
      const storageKey = `requirement-structured-content-${selectedSystemId}`
      const storedReq = localStorage.getItem(storageKey)
      
      if (!storedReq) {
        console.log(`未找到系统 ${selectedSystemId} 的存储需求数据`)
        setRequirement(null); // Explicitly set to null if no data
        return
      }

      const parsedDataFromStorage = JSON.parse(storedReq);
      
      // Validate the actual structure from localStorage (RequirementParseResult-like)
      if (!parsedDataFromStorage || 
          typeof parsedDataFromStorage.contentBeforeScenes === 'undefined' ||
          typeof parsedDataFromStorage.contentAfterScenes === 'undefined' || 
          !Array.isArray(parsedDataFromStorage.scenes)) { // Expect 'scenes' array
        console.error('加载的需求数据结构不完整或字段名不匹配. Expected: { contentBeforeScenes: string, contentAfterScenes: string, scenes: [] }', parsedDataFromStorage);
        throw new Error(t('structureError'));
      }

      // Validate and clean scene content from raw data
      parsedDataFromStorage.scenes.forEach((scene: any, index: number) => {
        if (typeof scene.name === 'undefined' || typeof scene.content === 'undefined') { // Expect 'name' and 'content'
          console.error(`场景 ${index + 1} 数据不完整 (raw):`, scene);
          throw new Error(t('sceneDataError', { index: index + 1 }));
        }
        // Clean separators on raw content before mapping
        scene.content = cleanSeparators(scene.content);
      });

      // Transform parsedDataFromStorage (RequirementParseResult-like with 'scenes' and 'scene.name')
      // to StructuredRequirement (with 'sceneList' and 'scene.sceneName')
      const transformedReq: StructuredRequirement = {
        contentBeforeScenes: parsedDataFromStorage.contentBeforeScenes || '',
        contentAfterScenes: parsedDataFromStorage.contentAfterScenes || '',
        sceneList: parsedDataFromStorage.scenes.map((s: { name: string; content: string; [key: string]: any }) => ({
          sceneName: s.name, // Map 'name' to 'sceneName'
          content: s.content,
          // Other fields in StructuredScene like analysisResult, isOptimize, optimizedContent
          // are not typically in RequirementParseResult.scenes. They will be undefined if not present in 's'.
          analysisResult: s.analysisResult, 
          isOptimize: s.isOptimize,
          optimizedContent: s.optimizedContent,
        })),
      };

      setRequirement(transformedReq);
      
      console.log(`系统 ${selectedSystemId} 需求数据加载成功 (transformed):`, {
        contentBeforeScenesLength: transformedReq.contentBeforeScenes?.length ?? 0,
        contentAfterScenesLength: transformedReq.contentAfterScenes?.length ?? 0,
        sceneCount: transformedReq.sceneList.length // Use transformedReq for logging
      });
    } catch (e) {
      console.error('加载需求数据失败:', e);
      setRequirement(null); // Ensure requirement is null on error
      toast({
        title: t('loadError'),
        description: e instanceof Error ? e.message : t('loadErrorDesc'),
        variant: "destructive",
        duration: 3000
      });
    }
  }, [selectedSystemId, toast, t]); // 添加t到依赖数组

  // 加载当前系统的信息架构
  useEffect(() => {
    const loadArchitecture = async () => {
      if (!selectedSystemId) {
        toast({
          title: t('apiError'),
          description: t('noSystemSelected'),
          variant: "destructive",
          duration: 3000
        })
        return
      }

      try {
        const response = await fetch(`/api/systems/${selectedSystemId}/product-info`)
        if (!response.ok) {
          throw new Error(t('architectureLoadError'))
        }
        const data = await response.json()
        setCurrentArchitecture(data.architecture || [])
      } catch (error) {
        console.error('加载系统信息架构失败:', error)
        toast({
          title: t('apiError'),
          description: t('architectureLoadError'),
          variant: "destructive",
          duration: 3000
        })
      }
    }

    if (selectedSystemId) {
      loadArchitecture()
    }
  }, [selectedSystemId, t])

  const handleExport = () => {
    if (!requirement || !selectedSystemId) return

    // 生成Markdown格式的需求书
    const mdContent = generateMarkdown(requirement)
    
    // 创建Blob对象
    const blob = new Blob([mdContent], { type: 'text/markdown' })
    
    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // 添加系统名称到文件名
    const systemName = currentSystem?.name || selectedSystemId
    // 根据当前语言生成不同的文件名
    const fileName = currentLocale === 'zh' 
      ? `需求书_${systemName}.md`
      : `Requirements_${systemName}.md`
    a.download = fileName
    
    // 触发下载
    document.body.appendChild(a)
    a.click()
    
    // 清理
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: t('exportSuccess'),
      description: t('exportDesc', { systemName: systemName }),
      duration: 3000
    })
  }

  const handleUpdateKnowledge = async () => {
    if (!requirement) {
      toast({
        title: t('updateError'),
        description: t('noRequirementData'),
        variant: "destructive",
        duration: 3000
      })
      return
    }

    if (!selectedSystemId) {
      toast({
        title: t('updateError'),
        description: t('noSystemSelected'),
        variant: "destructive",
        duration: 3000
      })
      return
    }

    setIsUpdating(true)
    toast({
      title: t('updateTaskStarted'),
      description: t('updateTaskDesc'),
      duration: 8000
    })

    try {
      // 1. 创建产品知识更新建议任务
      const suggestionTask = await createArchitectureSuggestionTask(requirement)

      // 2. 调用架构建议服务获取建议
      const suggestions = await generateArchitectureSuggestions(requirement, currentArchitecture)

      // 3. 更新建议任务状态为已完成
      await updateTask(suggestionTask.id, {
        status: 'completed'
      })

      // 4. 创建产品知识更新确认任务
      await createArchitectureConfirmTask(suggestions)

      // 5. 跳转到信息架构页面
      window.location.href = '/knowledge/information-architecture'

    } catch (error) {
      console.error('更新产品知识失败:', error)
      let errorMessage = t('tryAgain')
      
      if (error instanceof Error) {
        if (error.message === '未配置AI模型') {
          errorMessage = t('configureAiModel')
        } else if (error.message === 'AI服务返回为空') {
          errorMessage = t('emptyAiResponse')
        } else if (error.message.includes('Invalid')) {
          errorMessage = t('invalidFormat')
        } else {
          errorMessage = error.message
        }
      }
      
      toast({
        title: t('updateFailed'),
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      })
    } finally {
      setIsUpdating(false)
    }
  }

  // 清理场景内容开头的冗余标题和分隔线
  const cleanSceneContentForDisplay = (sceneName: string, content: string): string => {
    let cleanedContent = cleanSeparators(content);
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

  // 生成Markdown格式的需求书
  const generateMarkdown = (req: StructuredRequirement): string => {
    const contentBeforeScenes = req.contentBeforeScenes || '';
    const contentAfterScenes = req.contentAfterScenes || '';
    
    const headingMatch = contentBeforeScenes.match(/^(#+)\s+(?:[一二三四五六七八九十]+\.?|[0-9]+\.?|[IVXivx]+\.?)?[\s\S]*?$/m);
    const baseHeadingLevel = headingMatch ? headingMatch[1].length : 2;
    
    const chapterTitles = contentBeforeScenes.match(/^#{2,3}\s+(?:([一二三四五六七八九十]+)\.?|([0-9]+)\.?|([IVXivx]+)\.?)\s+.+$/gm) || [];
    
    let chapterNumber = '';
    if (chapterTitles.length > 0) {
      const lastChapterTitle = chapterTitles[chapterTitles.length - 1];
      const chineseNumberMatch = lastChapterTitle.match(/^#{2,3}\s+([一二三四五六七八九十]+)\.?\s+/);
      const arabicNumberMatch = lastChapterTitle.match(/^#{2,3}\s+([0-9]+)\.?\s+/);
      const romanNumberMatch = lastChapterTitle.match(/^#{2,3}\s+([IVXivx]+)\.?\s+/);
      
      if (chineseNumberMatch) {
        const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
        const lastNumber = chineseNumbers.indexOf(chineseNumberMatch[1]);
        chapterNumber = (lastNumber !== -1 && lastNumber < chineseNumbers.length - 1) ? chineseNumbers[lastNumber + 1] : '三';
      } else if (arabicNumberMatch) {
        chapterNumber = (parseInt(arabicNumberMatch[1], 10) + 1).toString();
      } else if (romanNumberMatch) {
        const romanNumbers = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
        const upperRomanNumbers = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        const isUpperCase = /[IVX]/.test(romanNumberMatch[1]);
        const romanList = isUpperCase ? upperRomanNumbers : romanNumbers;
        const lastNumber = romanList.indexOf(romanNumberMatch[1]);
        chapterNumber = (lastNumber !== -1 && lastNumber < romanList.length - 1) ? romanList[lastNumber + 1] : (isUpperCase ? 'III' : 'iii');
      } else {
        chapterNumber = '三';
      }
    } else {
      chapterNumber = '三';
    }
    
    const sceneHeadingLevel = baseHeadingLevel + 1;
    const scenePattern = new RegExp(`^${'^#'.repeat(sceneHeadingLevel)}\\s+(?:\\d+\\.?\\s+)?.*$`, 'gm');
    const sceneTitles = contentBeforeScenes.match(scenePattern) || [];
    let sceneTitleTemplate = '';
    
    if (sceneTitles.length > 0) {
      const firstSceneTitle: string = sceneTitles[0] || '';
      if (firstSceneTitle && /\d+/.test(firstSceneTitle)) {
        sceneTitleTemplate = firstSceneTitle.replace(/\d+(?:\.?\s+|\.\s*|：|:)/, '{index}. ')
          .replace(/(?:：|:).*$|(?<=\s)(?!$).+$/, '{name}');
      } else {
        sceneTitleTemplate = '#'.repeat(sceneHeadingLevel) + ' {index}. {name}';
      }
    } else {
      sceneTitleTemplate = '#'.repeat(sceneHeadingLevel) + ' {index}. {name}';
    }
    
    let scenesContent = '';
    req.sceneList.forEach((scene, index) => {
      const cleanSceneName = scene.sceneName.replace(/^\d+\.?\s+/, '');
      const formattedTitle = sceneTitleTemplate
        .replace('{index}', String(index + 1))
        .replace('{name}', cleanSceneName);
      const cleanedSceneContent = cleanSceneContentForDisplay(scene.sceneName, scene.content);
      scenesContent += `${formattedTitle}\n\n${cleanedSceneContent}\n\n`;
    });
    
    const needDetailChapter = `${'#'.repeat(baseHeadingLevel)} ${chapterNumber}. 需求详述\n\n`;
    const resultMd = contentBeforeScenes + '\n\n' + needDetailChapter + scenesContent + contentAfterScenes;
    
    return resultMd;
  }

  if (!requirement) {
    return (
      <div className="mx-auto py-6 w-[90%] space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('loading')}</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto py-6 w-[90%] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} className="bg-orange-500 hover:bg-orange-600">
            {t('exportButton')}
          </Button>
          <Button 
            onClick={handleUpdateKnowledge} 
            className="bg-blue-500 hover:bg-blue-600"
            disabled={true}
          >
            {t('updateKnowledgeButton')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="prose max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({children}: {children: React.ReactNode}) => <h1 className="text-xl font-bold mb-3 pb-1 border-b">{children}</h1>,
                h2: ({children}: {children: React.ReactNode}) => <h2 className="text-lg font-semibold mb-2 mt-4">{children}</h2>,
                h3: ({children}: {children: React.ReactNode}) => <h3 className="text-base font-medium mb-1 mt-3">{children}</h3>,
                p: ({children}: {children: React.ReactNode}) => <p className="text-gray-700 my-2 leading-relaxed text-sm">{children}</p>,
                ul: ({children}: {children: React.ReactNode}) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
                ol: ({children}: {children: React.ReactNode}) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
                li: ({children}: {children: React.ReactNode}) => <li className="text-gray-700 text-sm">{children}</li>,
                blockquote: ({children}: {children: React.ReactNode}) => <blockquote className="border-l-4 border-gray-300 pl-4 my-2 italic text-sm text-gray-600">{children}</blockquote>,
                code: ({inline, className, children}: {inline?: boolean, className?: string, children: React.ReactNode}) => {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline ? (
                    <pre className={`${className} bg-gray-100 rounded p-2 text-sm overflow-x-auto`}>
                      <code>{children}</code>
                    </pre>
                  ) : (
                    <code className={`${className} bg-gray-100 rounded px-1 py-0.5 text-xs font-mono`}>
                      {children}
                    </code>
                  )
                },
              }}
            >
              {requirement && generateMarkdown(requirement)} 
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>
      
      <Toaster />
    </div>
  )
} 