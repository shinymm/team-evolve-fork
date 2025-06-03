'use client'

// 导入基本库
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store'
import { useSystemStore } from '@/lib/stores/system-store'
import { Scene } from '@/types/requirement'
import { SceneAnalysisState } from '@/types/scene'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronRight, ArrowRight, Loader2, Check, X, FileEdit } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { SceneBoundaryService } from '@/lib/services/scene-boundary-service'
import { SceneRequirementService } from '@/lib/services/scene-requirement-service'

// 只导入实际使用的组件
const SceneOptimizeResult = dynamic(() => import('@/components/scene-analysis/scene-optimize-result'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-100 p-4 rounded-md min-h-[200px]">加载优化结果...</div>
})

interface EditingScene {
  name: string;
  content: string;
  analysisResult?: string;
}

// 简化的RequirementParseResult
interface SimpleRequirementParseResult {
  contentBeforeScenes?: string;
  scenes?: Scene[];
  contentAfterScenes?: string;
}

// 清理分隔符的函数
const cleanSeparators = (content: string): string => {
  if (!content) return '';
  return content.replace(/^\s*---\s*$/gm, '');
};

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

// 分析场景边界
async function analyzeSceneBoundary(scene: Scene, onChunk: (content: string) => void): Promise<string> {
  try {
    console.log('分析场景内容:', scene.name)
    
    // 创建一个Promise来处理流式响应
    return new Promise((resolve, reject) => {
      let result = '';
      
      // 创建边界分析服务实例
      const boundaryService = new SceneBoundaryService();
      
      // 调用边界分析服务
      boundaryService.analyzeScene(
        {
          reqBackground: '', // 这里应该从某处获取背景信息
          reqBrief: '',      // 这里应该从某处获取概述信息
          scene: scene
        },
        (content) => {
          // 每次收到内容片段都追加到结果中
          result += content;
          // 同时将新内容传递给回调函数，实现流式展示
          onChunk(content);
        }
      ).then(() => {
        // 分析完成后返回完整结果
        resolve(result);
      }).catch((error) => {
        console.error('分析场景边界出错:', error);
        reject(new Error('分析场景边界失败'));
      });
    });
  } catch (error) {
    console.error('分析场景边界出错:', error)
    throw new Error('分析场景边界失败')
  }
}

// 优化场景需求
async function optimizeSceneRequirement(scene: Scene, analysisResult: string, onChunk: (content: string) => void): Promise<string> {
  try {
    console.log('优化场景内容:', scene.name)
    
    // 创建一个Promise来处理流式响应
    return new Promise((resolve, reject) => {
      let result = '';
      
      // 创建需求优化服务实例
      const requirementService = new SceneRequirementService();
      
      // 调用需求优化服务
      requirementService.optimize(
        {
          reqBackground: '', // 这里应该从某处获取背景信息
          reqBrief: '',      // 这里应该从某处获取概述信息
          scene: scene,
          boundaryAnalysis: analysisResult
        },
        (content) => {
          // 每次收到内容片段都追加到结果中
          result += content;
          // 同时将新内容传递给回调函数，实现流式展示
          onChunk(content);
        }
      ).then(() => {
        // 优化完成后返回完整结果
        resolve(result);
      }).catch((error) => {
        console.error('优化场景需求出错:', error);
        reject(new Error('优化场景需求失败'));
      });
    });
  } catch (error) {
    console.error('优化场景需求出错:', error)
    throw new Error('优化场景需求失败')
  }
}

export default function SceneAnalysisPage({params}: {params: {locale: string}}) {
  const router = useRouter() 
  const currentLocale = useLocale();
  const t = useTranslations('SceneAnalysisPage')
  
  const [content, setContent] = useState<SimpleRequirementParseResult | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null)
  const [analysisResult, setAnalysisResult] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [sceneStates, setSceneStates] = useState<Record<string, SceneAnalysisState>>({})
  const [editingScene, setEditingScene] = useState<EditingScene | null>(null)
  const [optimizeResult, setOptimizeResult] = useState<string>('')
  const [isOptimizing, setIsOptimizing] = useState(false)
  const { toast } = useToast()
  
  // 添加一个ref来跟踪状态重置是否已经执行过
  const didResetStates = useRef(false);
  
  // 获取当前系统
  const { selectedSystemId } = useSystemStore()
  const { 
    currentSystemId,
    setCurrentSystem,
    getActiveRequirementBook,
    pinnedRequirementBook,
    requirementBook,
    isRequirementBookPinned
  } = useRequirementAnalysisStore()
  
  // 确保已设置当前系统
  useEffect(() => {
    if (selectedSystemId && selectedSystemId !== currentSystemId) {
      setCurrentSystem(selectedSystemId);
      didResetStates.current = false;
    }
  }, [selectedSystemId, currentSystemId, setCurrentSystem]);
  
  // 使用 useEffect 在客户端加载数据
  useEffect(() => {
    // 防止重复加载数据
    let isComponentMounted = true;
    
    // 处理解析内容的函数
    const processContent = (parsedContent: any) => {
      // 验证场景数据完整性
      if (!Array.isArray(parsedContent.scenes)) {
        throw new Error('场景列表格式无效')
      }
      
      // 清理内容
      if (parsedContent.contentBeforeScenes) {
        parsedContent.contentBeforeScenes = cleanSeparators(parsedContent.contentBeforeScenes);
      }
      
      if (parsedContent.contentAfterScenes) {
        parsedContent.contentAfterScenes = cleanSeparators(parsedContent.contentAfterScenes);
      }
      
      // 清理场景内容中的分隔线
      parsedContent.scenes.forEach((scene: Scene, index: number) => {
        if (!scene.name || !scene.content) {
          console.error(`场景 ${index + 1} 数据不完整:`, scene);
          throw new Error(`场景 ${index + 1} 数据不完整: 缺少必要字段`)
        }
        scene.content = cleanSeparators(scene.content);
      })
      
      if (isComponentMounted) {
        setContent(parsedContent);
      }
    }
    
    // 加载结构化内容函数
    const loadStructuredContent = () => {
      if (!selectedSystemId || !isComponentMounted) return;
      
      // 使用系统ID为key获取结构化内容
      const storageKey = `requirement-structured-content-${selectedSystemId}`;
      const storedContent = localStorage.getItem(storageKey);
      
      if (!storedContent) {
        console.log(`未找到系统${selectedSystemId}的结构化内容`);
        return;
      }

      try {
        const parsedContent = JSON.parse(storedContent);
        if (isComponentMounted) {
          processContent(parsedContent);
        }
      } catch (error) {
        console.error('解析结构化内容出错:', error);
        toast({
          title: t('loadFailed'),
          description: t('parseErrorDesc'),
          variant: "destructive",
          duration: 3000
        });
      }
    };

    // 加载场景状态函数
    const loadSceneStates = () => {
      if (!selectedSystemId || !isComponentMounted) return;
      
      // 使用系统ID为key获取场景状态
      const statesKey = `scene-analysis-states-${selectedSystemId}`;
      const storedStates = localStorage.getItem(statesKey);
      
      if (storedStates) {
        try {
          const parsedStates = JSON.parse(storedStates);
          setSceneStates(parsedStates);
        } catch (error) {
          console.error('解析场景状态出错:', error);
          // 如果状态解析失败，设置为空对象
          setSceneStates({});
        }
      } else {
        // 如果没有保存的状态，设置为空对象
        setSceneStates({});
      }
    };

    // 主加载函数
    const loadData = () => {
      if (!selectedSystemId) return;
      loadStructuredContent();
      loadSceneStates();
    };

    // 首次加载数据
    loadData();

    // 清理函数
    return () => {
      isComponentMounted = false;
    };
  }, [selectedSystemId, toast, t]);

  // 检查所有场景是否已完成分析
  const isAllScenesCompleted = () => {
    if (!content || !content.scenes || content.scenes.length === 0) return false;
    
    return content.scenes.every(scene => {
      const state = sceneStates[scene.name];
      return state && state.isCompleted;
    });
  };
  
  // 启动编辑场景
  const handleStartEdit = (scene: Scene, index: number) => {
    console.log('开始编辑场景:', scene.name);
    setEditingScene({
      name: scene.name,
      content: scene.content
    });
    
    // 更新场景状态
    setSceneStates(prev => ({
      ...prev,
      [scene.name]: {
        ...prev[scene.name],
        isEditing: true
      }
    }));
  };
  
  // 保存编辑内容
  const handleSaveEdit = (scene: Scene, index: number) => {
    if (!editingScene) return;
    
    console.log('保存场景编辑:', scene.name);
    
    try {
      // 更新场景内容
      const updatedContent = { ...content };
      if (updatedContent.scenes && updatedContent.scenes[index]) {
        updatedContent.scenes[index].content = editingScene.content;
        setContent(updatedContent);
      }
      
      // 更新场景状态
      setSceneStates(prev => ({
        ...prev,
        [scene.name]: {
          ...prev[scene.name],
          isEditing: false
        }
      }));
      
      // 保存到本地存储
      if (selectedSystemId) {
        const storageKey = `requirement-structured-content-${selectedSystemId}`;
        localStorage.setItem(storageKey, JSON.stringify(updatedContent));
      }
      
      // 清空编辑状态
      setEditingScene(null);
      
      toast({
        title: t('saveSuccess'),
        description: t('sceneSaved', { sceneName: scene.name }),
        duration: 3000
      });
    } catch (error) {
      console.error('保存失败:', error);
      toast({
        title: t('saveError'),
        description: error instanceof Error ? error.message : t('tryAgain'),
        variant: "destructive",
        duration: 3000
      });
    }
  };
  
  // 取消编辑
  const handleCancelEdit = (scene: Scene) => {
    console.log('取消编辑场景:', scene.name);
    
    // 更新场景状态
    setSceneStates(prev => ({
      ...prev,
      [scene.name]: {
        ...prev[scene.name],
        isEditing: false
      }
    }));
    
    // 清空编辑状态
    setEditingScene(null);
  };

  // 分析场景边界
  const handleAnalyzeScene = async (scene: Scene, index: number) => {
    if (isAnalyzing) return;
    
    // 设置当前选中的场景
    setSelectedScene(scene);
    setIsAnalyzing(true);
    setAnalysisResult('');
    
    try {
      // 更新场景状态
      setSceneStates(prev => ({
        ...prev,
        [scene.name]: {
          ...prev[scene.name],
          isAnalyzing: true
        }
      }));
      
      // 进行场景分析
      const result = await analyzeSceneBoundary(
        scene,
        (chunk) => {
          // 每次收到新内容时更新UI显示
          setAnalysisResult(prev => prev + chunk);
        }
      );
      
      // 如果分析成功，更新状态
      // 这里不需要再次设置analysisResult，因为在流式回调中已经设置了
      
      // 更新场景状态
      const confirmedStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          isAnalyzing: false,
          tempResult: result,
          isConfirming: true
        }
      };
      setSceneStates(confirmedStates);
      
      // 保存状态到本地存储
      if (selectedSystemId) {
        const statesKey = `scene-analysis-states-${selectedSystemId}`;
        localStorage.setItem(statesKey, JSON.stringify(confirmedStates));
      }
      
      toast({
        title: t('analysisComplete'),
        description: t('pleaseConfirmAnalysis', { sceneName: scene.name }),
        duration: 3000
      });
    } catch (error) {
      console.error('分析失败:', error);
      toast({
        title: t('analysisError'),
        description: error instanceof Error ? error.message : t('tryAgain'),
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 接受分析结果
  const handleAcceptResult = async (scene: Scene) => {
    const state = sceneStates[scene.name];
    
    try {
      // 确保分析结果不为空
      const finalResult = analysisResult || (state && state.tempResult) || '';
      if (!finalResult) {
        toast({
          title: "确认失败",
          description: "分析结果为空，请重新分析",
          variant: "destructive",
          duration: 3000
        });
        return;
      }

      // 更新场景状态
      const updatedStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          isConfirming: false,
          isCompleted: true,
          analysisResult: finalResult,
          tempResult: undefined
        }
      };
      setSceneStates(updatedStates);
      
      // 保存状态到本地存储
      if (selectedSystemId) {
        const statesKey = `scene-analysis-states-${selectedSystemId}`;
        localStorage.setItem(statesKey, JSON.stringify(updatedStates));
      }
      
      // 清空当前状态
      setAnalysisResult('');
      setSelectedScene(null);
      
      toast({
        title: t('analysisComplete'),
        description: t('analysisAccepted', { sceneName: scene.name }),
        duration: 3000
      });
    } catch (error) {
      console.error('确认失败:', error);
      toast({
        title: t('operationError'),
        description: error instanceof Error ? error.message : t('tryAgain'),
        variant: "destructive",
        duration: 3000
      });
    }
  };

  // 拒绝分析结果
  const handleRejectResult = async (scene: Scene) => {
    const state = sceneStates[scene.name];
    if (!state) return;
    
    try {
      // 重置场景状态
      const updatedStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          isConfirming: false,
          isCompleted: false,
          tempResult: undefined,
          analysisResult: undefined
        }
      };
      setSceneStates(updatedStates);
      
      // 保存状态到本地存储
      if (selectedSystemId) {
        const statesKey = `scene-analysis-states-${selectedSystemId}`;
        localStorage.setItem(statesKey, JSON.stringify(updatedStates));
      }
      
      // 清空当前状态
      setAnalysisResult('');
      setSelectedScene(null);
      
      toast({
        title: t('analysisComplete'),
        description: t('analysisRejected', { sceneName: scene.name }),
        duration: 3000
      });
    } catch (error) {
      console.error('拒绝失败:', error);
      toast({
        title: t('operationError'),
        description: error instanceof Error ? error.message : t('tryAgain'),
        variant: "destructive",
        duration: 3000
      });
    }
  };

  // 优化场景需求
  const handleOptimizeRequirement = async (scene: Scene, index: number) => {
    if (isOptimizing) return;
    
    // 设置当前选中的场景
    setSelectedScene(scene);
    setIsOptimizing(true);
    setOptimizeResult('');
    
    try {
      // 获取该场景的边界分析结果
      const analysisResult = sceneStates[scene.name]?.analysisResult || '';
      if (!analysisResult) {
        toast({
          title: "优化失败",
          description: "请先完成场景边界分析",
          variant: "destructive",
          duration: 3000
        });
        setIsOptimizing(false);
        return;
      }
      
      // 更新场景状态
      const updatedStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          isOptimizing: true
        }
      };
      setSceneStates(updatedStates);
      
      // 进行场景优化
      const result = await optimizeSceneRequirement(
        scene, 
        analysisResult,
        (chunk) => {
          // 每次收到新内容时更新UI显示
          setOptimizeResult(prev => prev + chunk);
        }
      );
      
      // 如果优化成功，更新状态
      // 这里不需要再次设置optimizeResult，因为在流式回调中已经设置了
      
      // 更新场景状态
      const confirmedStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          isOptimizing: true,
          optimizeResult: result,
          isOptimizeConfirming: true
        }
      };
      setSceneStates(confirmedStates);
      
      // 保存状态到本地存储
      if (selectedSystemId) {
        const statesKey = `scene-analysis-states-${selectedSystemId}`;
        localStorage.setItem(statesKey, JSON.stringify(confirmedStates));
      }
      
      toast({
        title: t('optimizeComplete'),
        description: t('pleaseConfirmOptimize', { sceneName: scene.name }),
        duration: 3000
      });
    } catch (error) {
      console.error('优化失败:', error);
      toast({
        title: t('optimizeError'),
        description: error instanceof Error ? error.message : t('tryAgain'),
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  // 接受优化结果
  const handleAcceptOptimize = async (scene: Scene, index: number) => {
    const state = sceneStates[scene.name];
    
    try {
      // 确保优化结果不为空
      const finalResult = optimizeResult || (state && state.optimizeResult) || '';
      if (!finalResult) {
        toast({
          title: "确认失败",
          description: "优化结果为空，请重新优化",
          variant: "destructive",
          duration: 3000
        });
        return;
      }

      // 更新场景内容
      const updatedContent = { ...content };
      if (updatedContent.scenes && updatedContent.scenes[index]) {
        updatedContent.scenes[index].content = finalResult;
        setContent(updatedContent);
      }
      
      // 更新场景状态
      const updatedStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          isOptimizeConfirming: false,
          isOptimizing: false,
          optimizeResult: undefined
        }
      };
      setSceneStates(updatedStates);
      
      // 保存内容到本地存储
      if (selectedSystemId) {
        const storageKey = `requirement-structured-content-${selectedSystemId}`;
        localStorage.setItem(storageKey, JSON.stringify(updatedContent));
        
        // 保存状态到本地存储
        const statesKey = `scene-analysis-states-${selectedSystemId}`;
        localStorage.setItem(statesKey, JSON.stringify(updatedStates));
      }
      
      // 清空当前状态
      setOptimizeResult('');
      setSelectedScene(null);
      
      toast({
        title: t('optimizeComplete'),
        description: t('optimizeAccepted', { sceneName: scene.name }),
        duration: 3000
      });
    } catch (error) {
      console.error('确认失败:', error);
      toast({
        title: t('operationError'),
        description: error instanceof Error ? error.message : t('tryAgain'),
        variant: "destructive",
        duration: 3000
      });
    }
  };

  // 拒绝优化结果
  const handleRejectOptimize = async (scene: Scene) => {
    const state = sceneStates[scene.name];
    if (!state) return;
    
    try {
      // 重置场景状态
      const updatedStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          isOptimizeConfirming: false,
          isOptimizing: false,
          optimizeResult: undefined
        }
      };
      setSceneStates(updatedStates);
      
      // 保存状态到本地存储
      if (selectedSystemId) {
        const statesKey = `scene-analysis-states-${selectedSystemId}`;
        localStorage.setItem(statesKey, JSON.stringify(updatedStates));
      }
      
      // 清空当前状态
      setOptimizeResult('');
      setSelectedScene(null);
      
      toast({
        title: t('optimizeComplete'),
        description: t('optimizeRejected', { sceneName: scene.name }),
        duration: 3000
      });
    } catch (error) {
      console.error('拒绝失败:', error);
      toast({
        title: t('operationError'),
        description: error instanceof Error ? error.message : t('tryAgain'),
        variant: "destructive",
        duration: 3000
      });
    }
  };

  // 导航到下一页
  const handleConfirmAndContinue = () => {
    router.push(`/${currentLocale}/ai-capability/test-format`);
  };

  // 渲染需求详述章节
  return (
    <div className="mx-auto py-6 w-[90%] space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>
      
      {/* 需求内容框架 */}
      <div className="space-y-4">
        {/* 需求详述章节 */}
        <Card className="bg-gray-50/50">
          <CardHeader className="py-2">
            <CardTitle className="text-base font-medium text-gray-500">{t('sceneDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="py-2 pb-3">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-2">{t('sceneList')} ({content?.scenes?.length || 0})</h2>
              
              {!content?.scenes || content.scenes.length === 0 ? (
                <div className="text-center text-gray-500">
                  {t('noScenesDetected')}
                </div>
              ) : (
                <div className="space-y-4">
                  {content.scenes.map((scene, index) => (
                    <div key={index} className="flex gap-4">
                      {/* 左侧内容区域：原始场景+边界分析 */}
                      <div className={cn(
                        "flex-1",
                        (sceneStates[scene.name]?.isOptimizing || sceneStates[scene.name]?.optimizeResult) ? "w-1/2" : "w-full"
                      )}>
                        <Card className="hover:shadow-lg transition-all duration-300 h-full">
                          <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-base">{scene.name}</CardTitle>
                                <CardDescription className="text-xs mt-0.5">场景概述</CardDescription>
                              </div>
                              <div className="flex gap-2">
                                {sceneStates[scene.name]?.isEditing ? (
                                  <>
                                    <Button
                                      onClick={() => handleSaveEdit(scene, index)}
                                      className="bg-green-500 hover:bg-green-600"
                                      size="sm"
                                    >
                                      <Check className="mr-2 h-3.5 w-3.5" />
                                      {t('saveChanges')}
                                    </Button>
                                    <Button
                                      onClick={() => handleCancelEdit(scene)}
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
                                      onClick={() => handleStartEdit(scene, index)}
                                      variant="outline"
                                      size="sm"
                                      className="border-blue-200 text-blue-900 hover:bg-blue-50"
                                    >
                                      <FileEdit className="mr-2 h-3.5 w-3.5" />
                                      {t('editScene')}
                                    </Button>
                                    <Button 
                                      onClick={() => handleAnalyzeScene(scene, index)}
                                      className={cn(
                                        "bg-orange-500 hover:bg-orange-600",
                                        sceneStates[scene.name]?.isCompleted && "bg-gray-100 hover:bg-gray-200 text-gray-600"
                                      )}
                                      size="sm"
                                      disabled={isAnalyzing && selectedScene?.name === scene.name}
                                    >
                                      {isAnalyzing && selectedScene?.name === scene.name ? (
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
                                    {sceneStates[scene.name]?.isCompleted && !sceneStates[scene.name]?.isOptimizing && (
                                      <Button
                                        onClick={() => handleOptimizeRequirement(scene, index)}
                                        variant="default"
                                        size="sm"
                                        className={cn(
                                          "bg-blue-500 hover:bg-blue-600 text-white",
                                          "transition-all duration-200 ease-in-out transform hover:scale-105"
                                        )}
                                        disabled={isOptimizing}
                                      >
                                        {isOptimizing && selectedScene?.name === scene.name ? (
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
                            {/* 场景内容 */}
                            <div>
                              {editingScene && editingScene.name === scene.name ? (
                                <textarea
                                  className="w-full p-2 text-sm border rounded-md min-h-[200px]"
                                  value={editingScene.content}
                                  onChange={(e) => {
                                    setEditingScene({
                                      ...editingScene,
                                      content: e.target.value
                                    });
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
                            
                            {/* 边界分析结果 */}
                            {(sceneStates[scene.name]?.analysisResult || 
                              (selectedScene?.name === scene.name && analysisResult) || 
                              sceneStates[scene.name]?.tempResult) && (
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
                                    {String(sceneStates[scene.name]?.analysisResult || 
                                            (selectedScene?.name === scene.name ? analysisResult : '') || 
                                            sceneStates[scene.name]?.tempResult || '')}
                                  </ReactMarkdown>
                                </div>
                                
                                {/* 确认按钮区域 */}
                                {sceneStates[scene.name]?.isConfirming && !!sceneStates[scene.name]?.tempResult && (
                                  <div className="flex justify-end gap-3 mt-4">
                                    <Button
                                      onClick={() => handleRejectResult(scene)}
                                      variant="outline"
                                      size="sm"
                                      className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                                    >
                                      <X className="mr-1.5 h-3.5 w-3.5" />
                                      {t('rejectAnalysis')}
                                    </Button>
                                    <Button
                                      onClick={() => handleAcceptResult(scene)}
                                      className="bg-blue-500 hover:bg-blue-600"
                                      size="sm"
                                    >
                                      <Check className="mr-1.5 h-3.5 w-3.5" />
                                      {t('acceptAnalysis')}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                      
                      {/* 右侧优化结果组件 */}
                      {(sceneStates[scene.name]?.isOptimizing || sceneStates[scene.name]?.optimizeResult) && (
                        <SceneOptimizeResult
                          scene={scene}
                          index={index}
                          sceneState={sceneStates[scene.name] || {}}
                          optimizeResult={optimizeResult}
                          isCurrentlySelected={selectedScene?.name === scene.name}
                          isOptimizing={isOptimizing}
                          isHideOriginal={false}
                          onAcceptOptimize={handleAcceptOptimize}
                          onRejectOptimize={handleRejectOptimize}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* 底部操作按钮 */}
      <div className="flex justify-end mt-8">
        <Button onClick={handleConfirmAndContinue} className="bg-orange-500 hover:bg-orange-600">
          <ArrowRight className="mr-2 h-4 w-4" />
          {t('confirmAndContinue')}
        </Button>
      </div>
      
      <Toaster />
    </div>
  );
} 