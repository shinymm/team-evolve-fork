'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, ArrowRight, Loader2, Check, X, FileEdit, Copy } from "lucide-react"
import { RequirementParserService, RequirementParseResult } from '@/lib/services/requirement-parser-service'
import { SceneBoundaryService } from '@/lib/services/scene-boundary-service'
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createTask, updateTask } from '@/lib/services/task-service'
import { cn } from '@/lib/utils'
import { SceneRequirementService } from '@/lib/services/scene-requirement-service'
import { RequirementExportService } from '@/lib/services/requirement-export-service'
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store'
import { useSystemStore } from '@/lib/stores/system-store'
import { Scene, RequirementContent } from '@/types/requirement'
import { SceneAnalysisState } from '@/types/scene'

interface EditingScene {
  name: string;
  content: string;
  analysisResult?: string;
}

// 清理分隔线的函数
const cleanSeparators = (content: string): string => {
  // 移除文本中的Markdown分隔线
  if (!content) return '';
  return content.replace(/^\s*---\s*$/gm, '');
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

export default function SceneAnalysisPage() {
  const [content, setContent] = useState<RequirementParseResult | null>(null)
  const [mdContent, setMdContent] = useState<string>('')
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
      // 重置状态重置标记，以便在切换系统时能够重新执行
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
      
      // 清理需求背景和需求概述中的分隔线
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
      
      // 这是RequirementBookService保存的最新结构化数据
      const structuredReqKey = `structuredRequirement_${selectedSystemId}`;
      const structuredData = localStorage.getItem(structuredReqKey);
      
      if (structuredData) {
        try {
          const parsedStructured = JSON.parse(structuredData);
          if (parsedStructured && Array.isArray(parsedStructured.scenes) && parsedStructured.scenes.length > 0) {
            console.log(`从 ${structuredReqKey} 加载数据，场景数量: ${parsedStructured.scenes.length}`);
            processContent(parsedStructured);
            
            // 同步到新格式的存储键
            const newStructuredKey = `requirement-structured-content-${selectedSystemId}`;
            localStorage.setItem(newStructuredKey, structuredData);
            return;
          }
        } catch (e) {
          console.error(`解析 ${structuredReqKey} 数据失败:`, e);
        }
      }
      
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
      } catch (e) {
        console.error(`解析系统${selectedSystemId}的结构化内容失败:`, e);
        if (isComponentMounted) {
          toast({
            title: "加载失败",
            description: e instanceof Error ? e.message : "无法加载需求数据",
            variant: "destructive",
            duration: 3000
          });
        }
      }
    };
    
    const loadData = () => {
      if (!selectedSystemId || !isComponentMounted) return;
      
      try {
        // 加载结构化内容
        loadStructuredContent();
      } catch (error) {
        console.error('加载数据时出错:', error);
        if (isComponentMounted) {
          toast({
            title: "加载失败",
            description: error instanceof Error ? error.message : "数据加载过程中出现错误",
            variant: "destructive",
            duration: 3000
          });
        }
      }
    };
    
    // 加载需求书内容和结构化数据
    if (selectedSystemId && isComponentMounted) {
      // 加载需求书内容 - 从当前系统的数据中获取
      const systemData = pinnedRequirementBook || requirementBook;
      
      if (systemData && isComponentMounted) {
        setMdContent(systemData);
      } else {
        console.log('当前系统没有需求书内容');
      }
      
      // 执行数据加载
      loadData();
    }
    
    // 清理函数，防止内存泄漏
    return () => {
      isComponentMounted = false;
    };
  // 重要：从依赖数组中移除content，防止循环渲染
  }, [selectedSystemId, pinnedRequirementBook, requirementBook, toast]);

  // 将场景状态的加载移到单独的useEffect中
  useEffect(() => {
    if (!selectedSystemId || !content) return;
    
    let isComponentMounted = true;
    
    // 防止在未加载content的情况下尝试加载场景状态
    const loadSceneStates = () => {
      if (!isComponentMounted) return;
      
      const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`;
      const storedSceneStates = localStorage.getItem(sceneStatesKey);
      
      if (storedSceneStates) {
        try {
          const parsedStates = JSON.parse(storedSceneStates);
          // 检查场景状态是否与当前需求内容匹配
          const statesMatchContent = content.scenes.every(
            (scene: Scene) => parsedStates[scene.name] !== undefined
          );
          
          // 只有当场景状态与当前内容匹配时才更新状态
          if (statesMatchContent && isComponentMounted) {
            setSceneStates(parsedStates);
          } else if (isComponentMounted) {
            // 不匹配时清空并创建新的状态对象
            const initialStates: Record<string, SceneAnalysisState> = {};
            content.scenes.forEach(scene => {
              initialStates[scene.name] = {
                isConfirming: false,
                isCompleted: false,
                isEditing: false,
                isOptimizing: false,
                isOptimizeConfirming: false,
                isHideOriginal: false
              };
            });
            
            localStorage.removeItem(sceneStatesKey);
            setSceneStates(initialStates);
            
            // 保存初始状态
            localStorage.setItem(sceneStatesKey, JSON.stringify(initialStates));
          }
        } catch (e) {
          console.error('解析场景状态失败:', e);
          localStorage.removeItem(sceneStatesKey);
          // 创建初始状态
          const initialStates: Record<string, SceneAnalysisState> = {};
          if (content && content.scenes && isComponentMounted) {
            content.scenes.forEach(scene => {
              initialStates[scene.name] = {
                isConfirming: false,
                isCompleted: false,
                isEditing: false,
                isOptimizing: false,
                isOptimizeConfirming: false,
                isHideOriginal: false
              };
            });
            setSceneStates(initialStates);
          }
        }
      } else if (content && content.scenes && isComponentMounted) {
        // 如果没有保存的状态，创建初始状态
        const initialStates: Record<string, SceneAnalysisState> = {};
        content.scenes.forEach(scene => {
          initialStates[scene.name] = {
            isConfirming: false,
            isCompleted: false,
            isEditing: false,
            isOptimizing: false,
            isOptimizeConfirming: false,
            isHideOriginal: false
          };
        });
        setSceneStates(initialStates);
        
        // 保存初始状态
        localStorage.setItem(sceneStatesKey, JSON.stringify(initialStates));
      }
    };
    
    // 加载场景状态
    loadSceneStates();
    
    return () => {
      isComponentMounted = false;
    };
    
  // 这个useEffect依赖content，但与加载content的useEffect分开
  }, [selectedSystemId, content]);
  
  // 用memo优化场景分析状态保存函数，减少不必要的重新创建
  const saveSceneStates = useCallback((states: Record<string, SceneAnalysisState>) => {
    if (!selectedSystemId) return;
    
    try {
      const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`;
      localStorage.setItem(sceneStatesKey, JSON.stringify(states));
    } catch (error) {
      console.error('保存场景状态失败:', error);
    }
  }, [selectedSystemId]);
  
  // 添加一个重置场景状态的函数
  const resetAllSceneConfirmingState = useCallback(() => {
    if (!content || !content.scenes || !Object.keys(sceneStates).length) return;
    
    console.log('重置所有场景的确认状态');
    
    // 检查是否有处于确认状态的场景
    const hasConfirmingScenes = content.scenes.some(scene => 
      sceneStates[scene.name]?.isConfirming && sceneStates[scene.name]?.tempResult
    );
    
    // 如果有正在等待确认的场景，不执行重置
    if (hasConfirmingScenes) {
      console.log('检测到有场景处于确认状态，跳过重置');
      return;
    }
    
    // 创建新状态，保留原有数据但重置isConfirming
    const resetStates = { ...sceneStates };
    
    // 遍历所有场景，重置确认状态
    content.scenes.forEach(scene => {
      if (resetStates[scene.name]) {
        resetStates[scene.name] = {
          ...resetStates[scene.name],
          isConfirming: false
        };
      }
    });
    
    // 更新状态
    setSceneStates(resetStates);
    
    // 保存到localStorage
    if (selectedSystemId) {
      const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`;
      localStorage.setItem(sceneStatesKey, JSON.stringify(resetStates));
      console.log('已重置并保存场景状态');
    }
  }, [content, sceneStates, selectedSystemId]);
  
  // 在组件加载后自动重置确认状态
  useEffect(() => {
    // 确保有内容和状态后再执行，并且只执行一次
    if (content && content.scenes && Object.keys(sceneStates).length > 0 && !didResetStates.current) {
      // 标记已执行
      didResetStates.current = true;
      console.log('首次重置场景状态');
      
      // 添加一个短暂延迟，确保状态已经完全加载
      const timeoutId = setTimeout(() => {
        resetAllSceneConfirmingState();
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [content, resetAllSceneConfirmingState]); // 移除sceneStates依赖，防止循环
  
  // 使用防抖保存场景状态，添加错误处理，限制频率减轻负担
  useEffect(() => {
    // 如果没有场景状态或系统ID，不执行保存
    if (!Object.keys(sceneStates).length || !selectedSystemId || !content) return;
    
    // 对比同一场景数量，避免无效保存
    let shouldSave = true;
    try {
      const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`;
      const storedStates = localStorage.getItem(sceneStatesKey);
      if (storedStates) {
        const parsedStates = JSON.parse(storedStates);
        // 如果场景数量和名称完全一致，可能不需要保存
        const storedKeys = Object.keys(parsedStates);
        const currentKeys = Object.keys(sceneStates);
        
        // 只有当状态确实发生变化时才保存
        if (JSON.stringify(parsedStates) === JSON.stringify(sceneStates)) {
          shouldSave = false;
        }
      }
    } catch (error) {
      console.error('比较场景状态失败:', error);
    }
    
    if (!shouldSave) return;
    
    // 增加防抖延迟，减少更新频率
    const timeoutId = setTimeout(() => {
      try {
        saveSceneStates(sceneStates);
        console.log('场景状态已保存, 系统ID:', selectedSystemId);
      } catch (error) {
        console.error('保存场景状态时出错:', error);
      }
    }, 2000); // 2秒的防抖延迟
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [sceneStates, saveSceneStates, selectedSystemId, content]);

  const handleParse = () => {
    if (!mdContent.trim()) {
      toast({
        title: "解析失败",
        description: "请先确保有需求书内容",
        variant: "destructive",
        duration: 3000
      })
      return
    }
    
    if (!selectedSystemId) {
      toast({
        title: "解析失败", 
        description: "请先选择一个系统",
        variant: "destructive",
        duration: 3000
      })
      return
    }

    try {
      console.log('开始解析需求书，内容长度:', mdContent.length);
      // 解析markdown内容
      const parser = new RequirementParserService()
      const parsedContent = parser.parseRequirement(mdContent)

      if (!parsedContent) {
        throw new Error('解析需求书失败，请检查格式是否正确')
      }

      console.log('解析结果:', {
        场景前内容长度: parsedContent.contentBeforeScenes?.length || 0,
        场景数量: parsedContent.scenes?.length || 0,
        场景名称: parsedContent.scenes?.map(s => s.name) || [],
        场景后内容长度: parsedContent.contentAfterScenes?.length || 0
      });

      // 清理场景内容中的分隔线
      if (parsedContent.scenes && Array.isArray(parsedContent.scenes)) {
        parsedContent.scenes.forEach(scene => {
          scene.content = cleanSeparators(scene.content);
        });
      }

      // 保存解析结果
      setContent(parsedContent)
      
      // 按系统ID保存到localStorage
      const storageKey = `requirement-structured-content-${selectedSystemId}`
      localStorage.setItem(storageKey, JSON.stringify(parsedContent))

      // 初始化场景分析状态
      const initialStates: Record<string, SceneAnalysisState> = {}
      parsedContent.scenes.forEach(scene => {
        initialStates[scene.name] = {
          isConfirming: false,
          isCompleted: false,
          isEditing: false,
          isOptimizing: false,
          isOptimizeConfirming: false,
          isHideOriginal: false
        }
      })
      setSceneStates(initialStates)
      
      // 按系统ID保存场景状态
      const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`
      localStorage.setItem(sceneStatesKey, JSON.stringify(initialStates))

      // 如果没有找到场景，显示更具体的错误信息
      if (!parsedContent.scenes || parsedContent.scenes.length === 0) {
        toast({
          title: "解析提示",
          description: "未检测到场景信息，可能原因：1. 文档中缺少'需求详述'章节; 2. 三级标题(###)格式不规范; 3. 需要手动添加场景",
          variant: "destructive",
          duration: 5000
        })
      } else {
        toast({
          title: "解析成功",
          description: `已解析 ${parsedContent.scenes.length} 个场景`,
          duration: 3000
        })
      }
    } catch (error) {
      console.error('解析失败:', error)
      toast({
        title: "解析失败",
        description: error instanceof Error ? error.message : "无法解析需求书内容",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  const handleAnalyzeScene = async (scene: Scene, index: number) => {
    setSelectedScene(scene)
    setIsAnalyzing(true)
    setAnalysisResult('') // 清空旧结果

    try {
      // 创建任务
      const task = await createTask({
        title: `场景${index + 1}边界分析`,
        description: `分析场景"${scene.name}"的边界条件和异常情况`,
        type: 'scene-boundary-analysis',
        assignee: 'system',
        status: 'pending'
      })

      // 更新场景状态
      const updatedStates = {
        ...sceneStates,
        [scene.name]: {
          taskId: task.id,
          isConfirming: false,
          isCompleted: false
        }
      }
      setSceneStates(updatedStates)
      
      // 立即保存更新后的状态
      if (selectedSystemId) {
        const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`
        localStorage.setItem(sceneStatesKey, JSON.stringify(updatedStates))
      }

      const service = new SceneBoundaryService()
      if (!content) {
        throw new Error('缺少需求内容')
      }

      // 使用局部变量存储累积的分析结果
      let accumulatedResult = '';
      
      await service.analyzeScene(
        {
          reqBackground: content.contentBeforeScenes,
          reqBrief: content.contentAfterScenes,
          scene: scene
        },
        (streamedContent: string) => {
          // 更新局部变量
          accumulatedResult += streamedContent;
          // 同时更新UI显示
          setAnalysisResult(accumulatedResult);
        }
      )

      // 分析完成后，使用完整的分析结果更新状态
      console.log('分析完成，完整结果长度:', accumulatedResult.length);
      
      // 创建确认状态对象
      const confirmedStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          tempResult: accumulatedResult, // 使用累积的完整结果
          isConfirming: true
        }
      };
      
      console.log('更新场景状态为等待确认:', {
        sceneName: scene.name,
        resultLength: accumulatedResult.length,
        isConfirming: true
      });
      
      // 更新状态
      setSceneStates(confirmedStates);
      
      // 立即保存更新后的状态 - 使用三种方式确保状态被保存
      if (selectedSystemId) {
        // 1. 直接保存
        const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`;
        localStorage.setItem(sceneStatesKey, JSON.stringify(confirmedStates));
        
        // 2. 使用强制保存函数
        setTimeout(() => {
          console.log('5秒后强制保存，确保状态已更新');
          forceSaveSceneStates('分析完成5秒后');
        }, 5000);
      }
      
      // 3. 直接再次设置状态，确保React状态已更新
      setTimeout(() => {
        setSceneStates(current => {
          const updatedState = {
            ...current,
            [scene.name]: {
              ...current[scene.name],
              isConfirming: true,
              tempResult: accumulatedResult
            }
          };
          
          console.log('二次确认场景状态为等待确认');
          if (selectedSystemId) {
            const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`;
            localStorage.setItem(sceneStatesKey, JSON.stringify(updatedState));
          }
          
          return updatedState;
        });
      }, 2000);

      toast({
        title: "分析完成",
        description: `场景"${scene.name}"的边界分析已完成，请确认结果`,
        duration: 3000
      })
    } catch (error) {
      console.error('分析失败:', error)
      toast({
        title: "分析失败",
        description: error instanceof Error ? error.message : "分析过程中出现错误",
        variant: "destructive",
        duration: 3000
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAcceptResult = async (scene: Scene) => {
    console.log('接受分析结果', scene.name)
    const state = sceneStates[scene.name]
    
    console.log('场景状态详情:', {
      sceneName: scene.name,
      state: state,
      taskIdExists: !!state?.taskId,
      hasAnalysisResult: !!analysisResult,
      hasTempResult: !!state?.tempResult,
      analysisResultLength: analysisResult?.length || 0,
      tempResultLength: state?.tempResult?.length || 0
    })
    
    // 如果没有taskId，只记录错误但继续执行，不要直接返回
    if (!state?.taskId) {
      console.warn('无法找到taskId，但会继续执行保存结果操作', scene.name, sceneStates[scene.name])
    } else {
      try {
        // 更新任务状态
        await updateTask(state.taskId, {
          status: 'completed'
        })
        console.log('已更新任务状态为completed')
      } catch (error) {
        console.error('更新任务状态失败，但将继续保存分析结果:', error)
      }
    }

    try {
      // 确保analysisResult不为空
      console.log('当前分析结果状态:', {
        analysisResult: analysisResult?.length || 0,
        tempResult: state?.tempResult?.length || 0
      })
      
      if (!analysisResult && !(state && state.tempResult)) {
        console.error('分析结果为空')
        toast({
          title: "确认失败",
          description: "分析结果为空，请重新分析",
          variant: "destructive",
          duration: 3000
        })
        return
      }

      // 使用分析结果或临时结果
      const finalResult = analysisResult || (state && state.tempResult) || ''
      console.log('最终结果长度:', finalResult.length)

      // 更新场景状态，保存分析结果
      const updatedStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          // 如果存在taskId就保留，如果不存在则初始化一个临时ID
          taskId: state?.taskId || `temp-task-${Date.now()}`,
          isConfirming: false,
          isCompleted: true,
          analysisResult: finalResult,  // 保存当前的分析结果
          tempResult: undefined  // 清空临时结果
        }
      }
      setSceneStates(updatedStates)
      console.log('已更新场景状态')
      
      // 使用包含系统ID的键名保存状态
      if (selectedSystemId) {
        const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`
        localStorage.setItem(sceneStatesKey, JSON.stringify(updatedStates))
        console.log('已保存场景分析结果，场景:', scene.name, '结果长度:', finalResult.length, '系统ID:', selectedSystemId)
      } else {
        console.error('没有选中的系统ID，无法保存')
      }

      // 清空当前的实时分析结果
      setAnalysisResult('')
      setSelectedScene(null)

      // 确保所有场景的确认状态被重置
      resetAllSceneConfirmingState()

      toast({
        title: "已接受分析结果",
        description: `场景"${scene.name}"的边界分析结果已确认`,
        duration: 3000
      })
    } catch (error) {
      console.error('确认失败:', error)
      toast({
        title: "确认失败",
        description: error instanceof Error ? error.message : "操作过程中出现错误",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  const handleRejectResult = async (scene: Scene) => {
    const state = sceneStates[scene.name]
    // 移除对taskId的硬性依赖，即使没有taskId也继续执行
    if (!state) {
      console.warn('场景状态不存在:', scene.name)
      return
    }

    try {
      console.log('拒绝分析结果', scene.name, {
        hasTaskId: !!state.taskId,
        isConfirming: state.isConfirming,
        hasTempResult: !!state.tempResult
      })
      
      // 重置场景状态
      const updatedStates = {
        ...sceneStates,
        [scene.name]: {
          // 如果存在taskId就保留，如果不存在则不使用该字段
          ...(state.taskId ? { taskId: state.taskId } : {}),
          isConfirming: false,
          isCompleted: false,
          tempResult: undefined,  // 清空临时结果
          analysisResult: undefined  // 清空分析结果
        }
      }
      setSceneStates(updatedStates)
      
      // 使用包含系统ID的键名保存状态
      if (selectedSystemId) {
        const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`
        localStorage.setItem(sceneStatesKey, JSON.stringify(updatedStates))
      }

      // 清空当前的实时分析结果
      setAnalysisResult('')
      setSelectedScene(null)

      // 确保所有场景的确认状态被重置
      resetAllSceneConfirmingState()

      toast({
        title: "已拒绝分析结果",
        description: `场景"${scene.name}"的边界分析结果已拒绝，可重新分析`,
        duration: 3000
      })
    } catch (error) {
      console.error('拒绝失败:', error)
      toast({
        title: "操作失败",
        description: error instanceof Error ? error.message : "操作过程中出现错误",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  // 开始编辑场景
  const handleStartEdit = (scene: Scene, index: number) => {
    setEditingScene({
      name: scene.name,
      content: scene.content,
      analysisResult: sceneStates[scene.name]?.analysisResult
    })
    setSceneStates(prev => ({
      ...prev,
      [scene.name]: {
        ...prev[scene.name],
        isEditing: true
      }
    }))
  }

  // 保存编辑的场景
  const handleSaveEdit = (scene: Scene, index: number) => {
    if (!editingScene || !content) return

    // 更新场景内容
    const updatedScenes = [...content.scenes]
    updatedScenes[index] = {
      name: scene.name,
      content: editingScene.content
    }

    // 更新content并保存到localStorage
    const updatedContent: RequirementParseResult = {
      ...content,
      scenes: updatedScenes
    }
    setContent(updatedContent)
    
    // 使用系统ID保存更新后的内容
    if (selectedSystemId) {
      const structuredContentKey = `requirement-structured-content-${selectedSystemId}`
      localStorage.setItem(structuredContentKey, JSON.stringify(updatedContent))
    } else {
      console.warn('未提供系统ID，无法保存更新后的内容')
    }

    // 更新场景状态，保持分析结果不变
    const updatedStates = {
      ...sceneStates
    }
    updatedStates[scene.name] = {
      ...sceneStates[scene.name] || {},
      isEditing: false,
      analysisResult: editingScene.analysisResult || sceneStates[scene.name]?.analysisResult
    }
    setSceneStates(updatedStates)
    
    // 使用包含系统ID的键名保存状态
    if (selectedSystemId) {
      const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`
      localStorage.setItem(sceneStatesKey, JSON.stringify(updatedStates))
    }

    // 如果当前选中的场景是被编辑的场景，也需要更新选中的场景
    if (selectedScene?.name === scene.name) {
      setSelectedScene(updatedScenes[index])
    }

    setEditingScene(null)

    toast({
      title: "保存成功",
      description: "场景信息已更新",
      duration: 3000
    })
  }

  // 取消编辑
  const handleCancelEdit = (scene: Scene) => {
    setEditingScene(null)
    setSceneStates(prev => ({
      ...prev,
      [scene.name]: {
        ...prev[scene.name],
        isEditing: false
      }
    }))
  }

  const handleOptimizeRequirement = async (scene: Scene, index: number) => {
    if (!content) return
    
    setIsOptimizing(true)
    setSelectedScene(scene)
    setOptimizeResult('')

    try {
      // 创建优化任务
      const task = await createTask({
        title: `优化场景"${scene.name}"的需求描述`,
        description: "使用AI优化场景需求描述",
        type: "scene-requirement-optimize",
        assignee: "AI",
        status: "in_progress"
      })

      // 添加调试日志
      console.log(`开始优化场景: ${scene.name}`, { 
        taskId: task.id, 
        sceneContent: scene.content.substring(0, 50) + '...'
      });

      // 更新场景状态为正在优化
      const updatedStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          taskId: task.id,
          isOptimizing: true,
          optimizeResult: '' // 确保从空字符串开始
        }
      }
      setSceneStates(updatedStates)
      
      // 立即保存状态
      if (selectedSystemId) {
        const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`
        localStorage.setItem(sceneStatesKey, JSON.stringify(updatedStates))
      }

      const service = new SceneRequirementService()
      
      // 使用局部变量累计流式结果
      let accumulatedResult = '';
      
      await service.optimize(
        {
          reqBackground: content.contentBeforeScenes,
          reqBrief: content.contentAfterScenes,
          scene: scene,
          boundaryAnalysis: sceneStates[scene.name]?.analysisResult || ''
        },
        (streamedContent: string) => {
          // 累加到局部变量
          accumulatedResult += streamedContent;
          
          // 更新UI状态
          setOptimizeResult(accumulatedResult);
          
          // 调试输出
          console.log(`流式更新 [${scene.name}]:`, {
            newChunkLength: streamedContent.length,
            totalLength: accumulatedResult.length,
            chunkPreview: streamedContent.substring(0, Math.min(20, streamedContent.length))
          });
          
          // 直接设置完整的累积结果，而不是仅追加新内容
          setSceneStates(prevStates => {
            const newStates = { ...prevStates };
            const currentScene = { ...prevStates[scene.name] };
            
            newStates[scene.name] = {
              ...currentScene,
              optimizeResult: accumulatedResult // 使用完整的累积结果
            };
            
            // 立即保存到localStorage
            if (selectedSystemId) {
              const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`;
              localStorage.setItem(sceneStatesKey, JSON.stringify(newStates));
            }
            
            return newStates;
          });
        }
      )

      // 最终结果添加调试日志
      console.log(`优化完成 [${scene.name}]:`, {
        finalResultLength: accumulatedResult.length,
        preview: accumulatedResult.substring(0, Math.min(100, accumulatedResult.length)) + '...'
      });

      // 更新场景状态为等待确认，确保保留完整的优化结果
      const confirmingStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          isOptimizeConfirming: true,
          isOptimizing: false,
          optimizeResult: accumulatedResult // 确保使用完整结果
        }
      }
      setSceneStates(confirmingStates)
      
      // 强制立即更新一次状态
      setOptimizeResult(accumulatedResult);
      
      // 立即保存状态到localStorage
      if (selectedSystemId) {
        const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`
        localStorage.setItem(sceneStatesKey, JSON.stringify(confirmingStates))
      }

      toast({
        title: "优化完成",
        description: `场景"${scene.name}"的需求描述已优化完成，请确认结果`,
        duration: 3000
      })
    } catch (error) {
      console.error('优化失败:', error)
      toast({
        title: "优化失败",
        description: error instanceof Error ? error.message : "优化过程中出现错误",
        variant: "destructive",
        duration: 3000
      })
      // 发生错误时，重置场景状态
      const errorStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          isOptimizing: false,
          isOptimizeConfirming: false,
          optimizeResult: undefined
        }
      }
      setSceneStates(errorStates)
      
      // 立即保存状态
      if (selectedSystemId) {
        const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`
        localStorage.setItem(sceneStatesKey, JSON.stringify(errorStates))
      }
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleAcceptOptimize = async (scene: Scene, index: number) => {
    const state = sceneStates[scene.name]
    if (!state || !content || !state.optimizeResult) return

    try {
      // 清理优化后的内容中的分隔线
      const cleanedContent = cleanSeparators(state.optimizeResult);

      // 更新场景内容
      const updatedScenes = [...content.scenes]
      updatedScenes[index] = {
        name: scene.name,
        content: cleanedContent  // 使用清理后的优化内容替换原始内容
      }

      // 更新content并保存到localStorage
      const updatedContent: RequirementParseResult = {
        ...content,
        scenes: updatedScenes
      }
      setContent(updatedContent)
      
      // 使用系统ID保存更新后的内容
      if (selectedSystemId) {
        const structuredContentKey = `requirement-structured-content-${selectedSystemId}`
        localStorage.setItem(structuredContentKey, JSON.stringify(updatedContent))
      } else {
        console.warn('未提供系统ID，无法保存更新后的内容')
      }

      // Restore state reset logic as per user clarification
      const updatedStates = {
        ...sceneStates,
        [scene.name]: {
          taskId: state.taskId, // Preserve the taskId from the optimization initiation
          isOptimizing: false,
          isOptimizeConfirming: false,
          optimizeResult: undefined,  // Clear optimizeResult as it's now in scene.content
          isHideOriginal: false,      // Reset hide original flag
          analysisResult: undefined,  // Clear boundary analysis result
          isCompleted: false          // Reset boundary analysis completion state
        }
      }
      setSceneStates(updatedStates)
      
      // 使用包含系统ID的键名保存状态
      if (selectedSystemId) {
        const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`
        localStorage.setItem(sceneStatesKey, JSON.stringify(updatedStates))
      } else {
        console.warn('未提供系统ID，无法保存场景状态')
      }

      // 清空选中的场景和优化结果
      setSelectedScene(null)
      setOptimizeResult('')

      toast({
        title: "已接受优化结果",
        description: `场景"${scene.name}"的需求描述已更新`,
        duration: 3000
      })
    } catch (error) {
      console.error('确认失败:', error)
      toast({
        title: "确认失败",
        description: error instanceof Error ? error.message : "操作过程中出现错误",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  const handleRejectOptimize = async (scene: Scene) => {
    const state = sceneStates[scene.name]
    if (!state?.taskId) return

    try {
      // 重置场景状态
      const updatedStates = {
        ...sceneStates,
        [scene.name]: {
          ...sceneStates[scene.name],
          isOptimizing: false,
          isOptimizeConfirming: false,
          optimizeResult: undefined
        }
      }
      setSceneStates(updatedStates)
      
      // 使用包含系统ID的键名保存状态
      if (selectedSystemId) {
        const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`
        localStorage.setItem(sceneStatesKey, JSON.stringify(updatedStates))
      } else {
        console.warn('未提供系统ID，无法保存场景状态')
      }

      toast({
        title: "已拒绝优化结果",
        description: `场景"${scene.name}"的需求描述优化已取消，可重新优化`,
        duration: 3000
      })
    } catch (error) {
      console.error('拒绝失败:', error)
      toast({
        title: "操作失败",
        description: error instanceof Error ? error.message : "操作过程中出现错误",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  const handleExport = () => {
    if (!selectedSystemId) {
      toast({
        title: "导出失败",
        description: "请先选择一个系统",
        variant: "destructive",
        duration: 3000
      })
      return
    }
    
    if (!content) {
      toast({
        title: "导出失败",
        description: "没有内容可导出",
        variant: "destructive",
        duration: 3000
      })
      return
    }
    
    // Convert RequirementParseResult back to expected RequirementContent for the service
    const contentToExport: RequirementContent = {
      contentBeforeScenes: content.contentBeforeScenes || '',
      contentAfterScenes: content.contentAfterScenes || '',
      scenes: content.scenes // Reverted to scenes
    }
    RequirementExportService.saveStructuredRequirementToStorage(contentToExport, sceneStates, selectedSystemId)
    toast({
      title: "导出成功",
      description: `需求书内容已导出，系统ID: ${selectedSystemId}`,
      duration: 3000
    })
  }

  const handleConfirmAndContinue = async () => {
    if (!selectedSystemId) {
      toast({
        title: "确认失败",
        description: "请先选择一个系统",
        variant: "destructive",
        duration: 3000
      })
      return
    }
    
    if (!content) {
      toast({
        title: "确认失败",
        description: "请先确保有需求内容",
        variant: "destructive",
        duration: 3000
      })
      return
    }

    try {
      // Convert RequirementParseResult back to expected RequirementContent for the service
      const contentToExport: RequirementContent = {
        contentBeforeScenes: content.contentBeforeScenes || '',
        scenes: content.scenes, // Reverted to scenes
        contentAfterScenes: content.contentAfterScenes || ''
      }
      
      // 保存结构化数据到localStorage - 传递系统ID (For Export Service)
      RequirementExportService.saveStructuredRequirementToStorage(contentToExport, sceneStates, selectedSystemId)
      
      // 同时更新本页面使用的、基于 RequirementParseResult 结构的 localStorage 数据
      const storageKey = `requirement-structured-content-${selectedSystemId}`;
      localStorage.setItem(storageKey, JSON.stringify(content)); // Save the original RequirementParseResult
      
      // 保存场景状态
      const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`;
      localStorage.setItem(sceneStatesKey, JSON.stringify(sceneStates));

      // 创建需求书确认任务
      await createTask({
        title: "需求书确认",
        description: "确认生成的需求书内容",
        type: "requirement-book-confirm",
        assignee: "SQ",
        status: "pending"
      });

      toast({
        title: "确认成功",
        description: "已创建需求书确认任务",
        duration: 3000
      });

      // 跳转到需求书确认页面
      window.location.href = "/ai-capability/book-confirm";
    } catch (error) {
      console.error('确认失败:', error);
      toast({
        title: "确认失败",
        description: error instanceof Error ? error.message : "操作过程中出现错误",
        variant: "destructive",
        duration: 3000
      });
    }
  }

  // 导出场景状态，仅用于调试
  const debugSceneStates = () => {
    console.log('[调试] 所有场景状态:', sceneStates);
    console.log('[调试] 当前选中场景:', selectedScene?.name);
    console.log('[调试] 当前分析结果长度:', analysisResult.length);
    
    // 打印确认状态的场景
    Object.entries(sceneStates).forEach(([name, state]) => {
      if (state.isConfirming) {
        console.log(`[调试] 确认状态的场景: ${name}`, {
          tempResult: state.tempResult?.substring(0, 20) + '...',
          tempResultLength: state.tempResult?.length || 0,
          isConfirming: state.isConfirming
        });
      }
    });
  };
  
  // 强制保存场景状态函数
  const forceSaveSceneStates = useCallback((message: string = '手动触发') => {
    if (!selectedSystemId) return;
    
    try {
      console.log(`[强制保存] ${message}`);
      const sceneStatesKey = `scene-analysis-states-${selectedSystemId}`;
      localStorage.setItem(sceneStatesKey, JSON.stringify(sceneStates));
      console.log('[强制保存] 完成');
      
      // 调试当前状态
      debugSceneStates();
      
      return true;
    } catch (error) {
      console.error('[强制保存] 失败:', error);
      return false;
    }
  }, [selectedSystemId, sceneStates]);

  // 使用 useEffect 触发分析任务的状态更新
  useEffect(() => {
    const updateSceneTaskStatus = async () => {
      try {
        // 如果全部场景都完成了，更新任务状态
        if (content?.scenes && content.scenes.length > 0) {
          const sceneNames = content.scenes.map(scene => scene.name);
          const allCompleted = sceneNames.every(sceneName => {
            return sceneStates[sceneName]?.isCompleted === true;
          });
          
          // 已经全部完成的情况
          if (allCompleted) {
            console.log('所有场景分析已完成');
            await updateTask('scene-analysis', {
              status: 'completed'
            });
          }
        }
      } catch (error) {
        console.error('更新任务状态失败:', error);
      }
    };
    
    updateSceneTaskStatus();
  }, [content, sceneStates]);

  // 加载requirementBook内容和分析
  useEffect(() => {
    const initializeFromRequirementBook = async () => {
      if (!selectedSystemId) return;
      
      try {
        // 获取活跃的需求书内容 - 直接从store的getter中获取
        const activeBook = getActiveRequirementBook();
        
        // 如果有需求书内容，但还没有结构化内容或场景，触发初始解析
        if (activeBook && (!content || !content.scenes || content.scenes.length === 0)) {
          console.log('需要从需求书初始化场景分析');
          setMdContent(activeBook);
          
          // 创建解析服务实例并使用正确的方法
          const parserService = new RequirementParserService();
          const freshContent = parserService.parseRequirement(activeBook);
          
          if (freshContent && freshContent.scenes) {
            // 存储结构化内容
            const storageKey = `requirement-structured-content-${selectedSystemId}`;
            localStorage.setItem(storageKey, JSON.stringify(freshContent));
            setContent(freshContent);
          }
        }
      } catch (error) {
        console.error('初始化需求书分析失败:', error);
        toast({
          title: "初始化失败",
          description: error instanceof Error ? error.message : "无法从需求书初始化分析",
          variant: "destructive",
          duration: 3000
        });
      }
    };
    
    // 检查是否有内容并决定是否初始化
    if (selectedSystemId && (!content || !content.scenes || content.scenes.length === 0)) {
      initializeFromRequirementBook();
    }
  }, [content, getActiveRequirementBook, selectedSystemId, toast]);

  if (!content) {
    return (
      <div className="mx-auto py-6 w-[90%] space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">场景边界分析</h1>
          <p className="text-sm text-muted-foreground mt-1">
            基于需求书中的场景描述，分析每个场景的边界条件和异常情况
          </p>
        </div>

        {/* MD内容输入区域 */}
        <div>
          <Card className="bg-gray-50/50">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium text-gray-500">需求书初稿</CardTitle>
                  <span className="text-xs text-gray-400">(请输入或粘贴需求书内容)</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-0 pb-3">
              <div className="space-y-3">
                <textarea
                  className="w-full min-h-[200px] p-3 text-sm text-gray-600 bg-white rounded-md border resize-y"
                  value={mdContent}
                  onChange={(e) => {
                    setMdContent(e.target.value)
                    // 更新当前系统的需求书数据，不传额外参数
                    if (selectedSystemId) {
                      // 确保当前系统已设置
                      if (selectedSystemId !== currentSystemId) {
                        useRequirementAnalysisStore.getState().setCurrentSystem(selectedSystemId)
                      }
                      useRequirementAnalysisStore.getState().setRequirementBook(e.target.value)
                    }
                  }}
                  placeholder="请在此输入需求书内容..."
                />
                <Button 
                  onClick={handleParse}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  size="sm"
                  disabled={!mdContent.trim()}
                >
                  解析需求书
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-gray-500 mt-6">
          请先输入需求书内容并解析，生成结构化内容
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto py-6 w-[90%] space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">场景边界分析</h1>
        <p className="text-sm text-muted-foreground mt-1">
          基于需求书中的场景描述，分析每个场景的边界条件和异常情况
        </p>
      </div>

      {/* MD内容展示区域 */}
      <div>
        <Card className="bg-gray-50/50">
          <CardHeader className="cursor-pointer py-3" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium text-gray-500">需求书初稿</CardTitle>
                <span className="text-xs text-gray-400">(点击展开进行编辑)</span>
              </div>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
            </div>
          </CardHeader>
          {isExpanded && (
            <CardContent className="py-0 pb-3">
              <div className="space-y-3">
                <textarea
                  className="w-full min-h-[200px] p-3 text-sm text-gray-600 bg-white rounded-md border resize-y"
                  value={mdContent}
                  onChange={(e) => {
                    setMdContent(e.target.value)
                    // 更新当前系统的需求书数据，不传额外参数
                    if (selectedSystemId) {
                      // 确保当前系统已设置
                      if (selectedSystemId !== currentSystemId) {
                        useRequirementAnalysisStore.getState().setCurrentSystem(selectedSystemId)
                      }
                      useRequirementAnalysisStore.getState().setRequirementBook(e.target.value)
                    }
                  }}
                  placeholder="请在此输入需求书内容..."
                />
                <Button 
                  onClick={handleParse}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  size="sm"
                >
                  重新解析需求书
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* 分割线和标题 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-sm font-medium text-gray-500">需求场景抽取细化</span>
        </div>
      </div>

      {/* 需求内容框架 */}
      <div className="space-y-4">
        
        {/* 需求详述章节 */}
        <Card className="bg-gray-50/50">
          <CardHeader className="py-2">
            <CardTitle className="text-base font-medium text-gray-500">需求详述</CardTitle>
          </CardHeader>
          <CardContent className="py-2 pb-3">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-2">场景列表 ({content.scenes.length})</h2>
              
              {content.scenes.length === 0 ? (
                <div className="text-center text-gray-500">
                  未检测到场景信息，请检查需求书格式是否正确
                </div>
              ) : (
                <div className="space-y-4">
                  {content.scenes.map((scene, index) => (
                    <div key={index} className="flex flex-col gap-3">
                      <div className="flex gap-4">
                        {/* 原始场景卡片 */}
                        {!sceneStates[scene.name]?.isHideOriginal && (
                          <Card 
                            className={cn(
                              "hover:shadow-lg transition-all duration-300",
                              (sceneStates[scene.name]?.isOptimizing || sceneStates[scene.name]?.optimizeResult) ? "w-1/2" : "w-full"
                            )}
                          >
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
                                        保存修改
                                      </Button>
                                      <Button
                                        onClick={() => handleCancelEdit(scene)}
                                        variant="outline"
                                        size="sm"
                                        className="border-gray-200"
                                      >
                                        <X className="mr-2 h-3.5 w-3.5" />
                                        取消
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
                                        编辑场景
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
                                            分析中...
                                          </>
                                        ) : (
                                          <>
                                            <ArrowRight className="mr-2 h-3.5 w-3.5" />
                                            场景边界分析
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
                                              优化中...
                                            </>
                                          ) : (
                                            <>
                                              <FileEdit className="mr-2 h-3.5 w-3.5" />
                                              完善场景需求描述
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
                                {sceneStates[scene.name]?.isEditing ? (
                                  <textarea
                                    className="w-full p-2 text-sm border rounded-md min-h-[200px]"
                                    value={editingScene?.content}
                                    onChange={(e) => setEditingScene(prev => prev ? {...prev, content: e.target.value} : null)}
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
                                    {cleanSceneContentForDisplay(scene.name, scene.content)}
                                  </ReactMarkdown>
                                )}
                              </div>
                              {/* 显示分析结果：如果有分析结果就显示 */}
                              {(() => {
                                // 添加调试日志，显示当前场景状态
                                const sceneName = scene.name;
                                const sceneState = sceneStates[sceneName];
                                const hasAnalysisResult = !!sceneState?.analysisResult;
                                const isCurrentlySelected = selectedScene?.name === sceneName;
                                const hasCurrentAnalysis = !!analysisResult && isCurrentlySelected;
                                const isConfirming = !!sceneState?.isConfirming;
                                const hasTempResult = !!sceneState?.tempResult;
                                const shouldShowConfirmButtons = isConfirming && hasTempResult;
                                
                                // 判断是否显示分析结果
                                const shouldShowResults = hasAnalysisResult || hasCurrentAnalysis || (isConfirming && hasTempResult);
                                if (!shouldShowResults) return null;
                                
                                return (
                                  <div className="mt-4 border-t pt-4">
                                    <div className="text-sm text-gray-600">
                                      {sceneStates[scene.name]?.isEditing ? (
                                        <textarea
                                          className="w-full p-2 text-sm border rounded-md"
                                          value={editingScene?.analysisResult || ''}
                                          onChange={(e) => setEditingScene(prev => prev ? {...prev, analysisResult: e.target.value} : null)}
                                          rows={10}
                                        />
                                      ) : (
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
                                          {sceneState?.analysisResult || (isCurrentlySelected ? analysisResult : '') || sceneState?.tempResult || ''}
                                        </ReactMarkdown>
                                      )}
                                    </div>
                                    {/* 在分析结果右下角添加确认按钮 */}
                                    {shouldShowConfirmButtons && (
                                      <div className="flex justify-end gap-3 mt-4">
                                        <Button
                                          onClick={() => handleRejectResult(scene)}
                                          variant="outline"
                                          size="sm"
                                          className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                                        >
                                          <X className="mr-1.5 h-3.5 w-3.5" />
                                          拒绝
                                        </Button>
                                        <Button
                                          onClick={() => handleAcceptResult(scene)}
                                          className="bg-blue-500 hover:bg-blue-600"
                                          size="sm"
                                        >
                                          <Check className="mr-1.5 h-3.5 w-3.5" />
                                          接受
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })() as React.ReactNode}
                            </CardContent>
                          </Card>
                        )}

                        {/* 优化后的场景卡片 */}
                        {(sceneStates[scene.name]?.isOptimizing || sceneStates[scene.name]?.optimizeResult) && (
                          <Card className={cn(
                            "hover:shadow-lg transition-all duration-300",
                            sceneStates[scene.name]?.isHideOriginal ? "w-full" : "w-1/2"
                          )}>
                            <CardHeader className="py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="text-base text-blue-600">优化后的场景描述</CardTitle>
                                  <CardDescription className="text-xs mt-0.5">基于边界分析结果的完善建议</CardDescription>
                                </div>
                                {sceneStates[scene.name]?.isOptimizeConfirming && (
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => handleAcceptOptimize(scene, index)}
                                      className="bg-blue-500 hover:bg-blue-600"
                                      size="sm"
                                    >
                                      <Check className="mr-2 h-3.5 w-3.5" />
                                      接受优化结果
                                    </Button>
                                    <Button
                                      onClick={() => handleRejectOptimize(scene)}
                                      variant="outline"
                                      size="sm"
                                      className="border-red-200 text-red-700 hover:bg-red-50"
                                    >
                                      <X className="mr-2 h-3.5 w-3.5" />
                                      拒绝并重新优化
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="py-0 pb-3">
                              <div className="text-sm text-gray-600">
                                {sceneStates[scene.name]?.isOptimizing ? (
                                  <div className="markdown-container min-h-[200px]">
                                    {sceneStates[scene.name]?.optimizeResult ? (
                                      <>
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
                                          {sceneStates[scene.name]?.optimizeResult}
                                        </ReactMarkdown>
                                        <div className="flex items-center justify-center py-4 mt-2 bg-gray-50 rounded-md">
                                          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                                          <span className="ml-2 text-blue-600 text-sm">正在继续优化...</span>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                        <span className="ml-3 text-blue-600">正在优化场景描述...</span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="markdown-container min-h-[200px]">
                                    {(() => {
                                      // 添加调试信息
                                      const resultContent = sceneStates[scene.name]?.optimizeResult || optimizeResult || '';
                                      console.log(`渲染优化结果 [${scene.name}]:`, {
                                        fromSceneState: !!sceneStates[scene.name]?.optimizeResult,
                                        fromOptimizeResult: !!optimizeResult,
                                        contentLength: resultContent.length,
                                        previewStart: resultContent.substring(0, Math.min(50, resultContent.length))
                                      });
                                      return (
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
                                          {resultContent}
                                        </ReactMarkdown>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex justify-end mt-8">
        <Button onClick={handleConfirmAndContinue} className="w-full bg-orange-500 hover:bg-orange-600">
          <ArrowRight className="mr-2 h-4 w-4" />
          确认并继续
        </Button>
      </div>
      <Toaster />
    </div>
  )
} 