'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import dynamic from 'next/dynamic'
import { userStoryBreakdownService } from '@/lib/services/user-story-breakdown-service'
import { StructuredRequirement, StructuredScene } from '@/lib/services/requirement-export-service'
// 动态导入复杂组件
const UserStoryCard = dynamic(() => import('@/components/user-story-card').then(mod => ({ default: mod.UserStoryCard })), {
  ssr: false,
  loading: () => <div className="p-4 border rounded">Loading user story card...</div>
})
import { UserStory } from '@/components/user-story-card'
import { parseUserStoryYaml, Feature } from '@/lib/utils/yaml-parser'
import { Copy, Trash2, ExternalLink } from 'lucide-react'
import { toast } from "@/components/ui/use-toast"
import { useSystemStore } from '@/lib/stores/system-store'
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store'
import { useTranslations, useLocale } from 'next-intl'

export default function UserStoryPage() {
  const t = useTranslations('UserStoryPage')
  const locale = useLocale()
  
  const [isClient, setIsClient] = useState(false)
  const [requirementText, setRequirementText] = useState('')
  const [scenes, setScenes] = useState<StructuredScene[]>([])
  const [selectedScene, setSelectedScene] = useState<string>('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [analysisResult, setAnalysisResult] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [parsedFeatures, setParsedFeatures] = useState<Feature[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [parseAttempted, setParseAttempted] = useState(false)
  
  // 编辑相关状态
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingStory, setEditingStory] = useState<UserStory | null>(null)
  const [editingFeatureIndex, setEditingFeatureIndex] = useState<number>(-1)
  const [editingStoryIndex, setEditingStoryIndex] = useState<number>(-1)
  
  // 从store获取系统信息
  const { selectedSystemId } = useSystemStore()
  const { 
    currentSystemId,
    setCurrentSystem
  } = useRequirementAnalysisStore()
  
  // 在组件挂载后将 isClient 设为 true
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  // 确保已设置当前系统
  useEffect(() => {
    if (selectedSystemId && selectedSystemId !== currentSystemId) {
      console.log('设置当前系统:', selectedSystemId)
      setCurrentSystem(selectedSystemId)
    }
  }, [selectedSystemId, currentSystemId, setCurrentSystem])

  useEffect(() => {
    // 确保只在客户端执行
    if (!isClient || !selectedSystemId) {
      setScenes([]);
      return;
    }

    const storageKey = `requirement-structured-content-${selectedSystemId}`;
    const storedRequirement = localStorage.getItem(storageKey);

    if (storedRequirement) {
      try {
        const requirement = JSON.parse(storedRequirement);
        
        // 尝试多种可能的场景数据位置
        let scenesArray = null;
        if (requirement && Array.isArray(requirement.scenes)) {
          scenesArray = requirement.scenes;
        } else if (requirement && Array.isArray(requirement)) {
          scenesArray = requirement;
          console.log('[UserStoryPage] 直接使用requirement数组作为场景列表');
        }
        
        if (scenesArray && scenesArray.length > 0) {
          setScenes(scenesArray);
        } else {
          console.warn(`[UserStoryPage] 无法找到有效的场景列表。存储键: ${storageKey}. 找到的数据: ${JSON.stringify(requirement).substring(0, 200)}... 清空场景列表。`);
          setScenes([]);
        }
      } catch (error) {
        console.error(`[UserStoryPage] Failed to parse stored requirement for ${selectedSystemId}. Key: ${storageKey}. Error:`, error);
        setScenes([]); // 清空场景
        toast({
          title: t('loadFailed'),
          description: t('copyFailedDesc'), // 您可能需要一个更具体的翻译键，如 'parseErrorDesc'
          variant: "destructive",
          duration: 3000
        });
      }
    } else {
      console.log(`[UserStoryPage] No stored requirement data found for system ${selectedSystemId}. Key: ${storageKey}. Clearing scenes.`);
      setScenes([]); // 清空场景
    }
  }, [selectedSystemId, t, toast, isClient]);

  // 当分析结果更新时，尝试解析YAML
  useEffect(() => {
    if (analysisResult) {
      try {
        const features = parseUserStoryYaml(analysisResult);
        setParsedFeatures(features);
        setParseAttempted(true);
      } catch (error) {
        console.error('解析用户故事YAML时出错:', error);
        setParsedFeatures([]);
        setParseAttempted(true);
      }
    } else {
      setParsedFeatures([]);
      setParseAttempted(false);
    }
  }, [analysisResult]);

  const handleSceneSelect = (sceneIndex: string) => {
    const scene = scenes[parseInt(sceneIndex)]
    if (scene) {
      console.log('选择的场景数据:', scene);
      
      // 处理场景名称可能为undefined的情况
      const sceneAny = scene as any;
      const sceneName = (sceneAny.name ? sceneAny.name : '未命名场景');
      
      // 将场景的所有相关信息组合成文本
      const sceneContent = [
        `场景名称：${sceneName}`,
        `\n场景内容：${scene.content}`
      ]
      
      setRequirementText(sceneContent.join('\n'))
      setSelectedScene(sceneIndex)
      setIsDialogOpen(false)
    }
  }

  const handleAnalyze = async () => {
    if (!requirementText.trim()) {
      alert(t('pleaseInputRequirement'))
      return
    }

    setIsAnalyzing(true)
    setAnalysisResult('')
    setParsedFeatures([])
    setParseAttempted(false)

    try {
      const streamCallback = await userStoryBreakdownService.breakdownUserStory(requirementText)
      streamCallback((content: string) => {
        setAnalysisResult(prev => prev + content)
      })
    } catch (error) {
      console.error('分析过程中出错:', error)
      alert(t('parseFailed'))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleManualParse = () => {
    try {
      console.log('手动解析YAML:', analysisResult);
      const features = parseUserStoryYaml(analysisResult);
      console.log('手动解析结果:', features);
      setParsedFeatures(features);
      setParseAttempted(true);
      
      toast({
        title: t('parseSuccess'),
        description: t('parseSuccessDesc', {
          featureCount: features.length,
          storyCount: features.reduce((sum, f) => sum + f.stories.length, 0)
        }),
        duration: 3000,
      });
    } catch (error) {
      console.error('手动解析YAML时出错:', error);
      alert(t('parseFailed') + ': ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleCopyResult = () => {
    navigator.clipboard.writeText(analysisResult)
      .then(() => {
        toast({
          title: t('copySuccess'),
          description: t('copyDesc'),
          duration: 3000,
        });
      })
      .catch(err => {
        console.error('复制失败:', err);
        toast({
          title: t('copyFailed'),
          description: t('copyFailedDesc'),
          variant: "destructive",
          duration: 3000,
        });
      });
  };

  // 处理编辑用户故事
  const handleEditStory = (story: UserStory, featureIndex: number, storyIndex: number) => {
    setEditingStory({...story});
    setEditingFeatureIndex(featureIndex);
    setEditingStoryIndex(storyIndex);
    setIsEditDialogOpen(true);
  };

  // 处理删除用户故事
  const handleDeleteStory = (featureIndex: number, storyIndex: number) => {
    if (window.confirm(t('confirmDelete'))) {
      const newFeatures = [...parsedFeatures];
      newFeatures[featureIndex].stories.splice(storyIndex, 1);
      
      // 如果删除后该功能没有故事了，也删除该功能
      if (newFeatures[featureIndex].stories.length === 0) {
        newFeatures.splice(featureIndex, 1);
      }
      
      setParsedFeatures(newFeatures);
    }
  };

  // 复制整个功能的所有用户故事
  const handleCopyFeature = (feature: Feature, featureIndex: number) => {
    // 格式化功能内容
    const featureContent = [
      `${t('feature')}: ${feature.feature}`,
      ``,
      `用户故事列表:`,
    ];
    
    // 添加每个用户故事
    feature.stories.forEach((story, index) => {
      featureContent.push(`\n${t('userStory')} #${index + 1}: ${story.story}`);
      featureContent.push(`${t('description')}: ${story.description}`);
      
      featureContent.push(`${t('acceptanceCriteria')}:`);
      story.acceptance_criteria.forEach(criteria => {
        featureContent.push(`- ${criteria}`);
      });
      
      if (story.non_functional_requirements && story.non_functional_requirements.length > 0) {
        featureContent.push(`${t('nonFunctionalRequirements')}:`);
        story.non_functional_requirements.forEach(req => {
          featureContent.push(`- ${req}`);
        });
      }
      
      featureContent.push(``); // 添加空行分隔
    });
    
    // 复制到剪贴板
    navigator.clipboard.writeText(featureContent.join('\n'))
      .then(() => {
        toast({
          title: t('copyFeatureSuccess'),
          description: t('copyFeatureDesc', {
            feature: feature.feature,
            count: feature.stories.length
          }),
          duration: 3000,
        });
      })
      .catch(err => {
        console.error('复制失败:', err);
        toast({
          title: t('copyFailed'),
          description: t('copyFailedDesc'),
          variant: "destructive",
          duration: 3000,
        });
      });
  };

  // 保存编辑后的用户故事
  const handleSaveEdit = () => {
    if (!editingStory) return;
    
    const newFeatures = [...parsedFeatures];
    newFeatures[editingFeatureIndex].stories[editingStoryIndex] = editingStory;
    
    setParsedFeatures(newFeatures);
    setIsEditDialogOpen(false);
  };

  // 更新编辑中的验收标准
  const handleUpdateAcceptanceCriteria = (index: number, value: string) => {
    if (!editingStory) return;
    
    const newCriteria = [...editingStory.acceptance_criteria];
    newCriteria[index] = value;
    
    setEditingStory({
      ...editingStory,
      acceptance_criteria: newCriteria
    });
  };

  // 添加新的验收标准
  const handleAddAcceptanceCriteria = () => {
    if (!editingStory) return;
    
    setEditingStory({
      ...editingStory,
      acceptance_criteria: [...editingStory.acceptance_criteria, '']
    });
  };

  // 删除验收标准
  const handleRemoveAcceptanceCriteria = (index: number) => {
    if (!editingStory) return;
    
    const newCriteria = [...editingStory.acceptance_criteria];
    newCriteria.splice(index, 1);
    
    setEditingStory({
      ...editingStory,
      acceptance_criteria: newCriteria
    });
  };

  // 更新编辑中的非功能需求
  const handleUpdateNonFunctionalRequirement = (index: number, value: string) => {
    if (!editingStory || !editingStory.non_functional_requirements) return;
    
    const newRequirements = [...editingStory.non_functional_requirements];
    newRequirements[index] = value;
    
    setEditingStory({
      ...editingStory,
      non_functional_requirements: newRequirements
    });
  };

  // 添加新的非功能需求
  const handleAddNonFunctionalRequirement = () => {
    if (!editingStory) return;
    
    setEditingStory({
      ...editingStory,
      non_functional_requirements: [...(editingStory.non_functional_requirements || []), '']
    });
  };

  // 删除非功能需求
  const handleRemoveNonFunctionalRequirement = (index: number) => {
    if (!editingStory || !editingStory.non_functional_requirements) return;
    
    const newRequirements = [...editingStory.non_functional_requirements];
    newRequirements.splice(index, 1);
    
    setEditingStory({
      ...editingStory,
      non_functional_requirements: newRequirements
    });
  };

  // 添加打开Jira的函数
  const handleOpenJira = () => {
    const jiraDomain = process.env.NEXT_PUBLIC_JIRA_DOMAIN || 'thoughtworks-team-evolve.atlassian.net'
    window.open(`https://${jiraDomain}/jira/your-work`, '_blank')
  }

  // 添加处理Toast的函数
  const handleToast = (title: string, description: string, variant: "default" | "destructive" = "default") => {
    toast({
      title,
      description,
      variant,
      duration: 3000
    });
  };

  return (
    <div className="w-[90%] mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
        <div className="flex items-center justify-between mt-2">
          <p className="text-gray-600 text-xs">
            {t('subtitle')}
          </p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
              >
                {t('loadSceneFromCache')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] w-[90%]">
              <DialogHeader>
                <DialogTitle>{t('selectSceneTitle')}</DialogTitle>
              </DialogHeader>
              <Select value={selectedScene} onValueChange={handleSceneSelect} name="scene-select">
                <SelectTrigger>
                  <SelectValue placeholder={t('selectScenePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {scenes.map((scene: any, index: number) => (
                    <SelectItem key={index} value={String(index)}>
                      {`场景${index + 1}: ${scene.sceneName || scene.name || '未命名场景'}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <Textarea
            placeholder={t('inputPlaceholder')}
            value={requirementText}
            onChange={(e) => setRequirementText(e.target.value)}
            className="min-h-[200px] text-xs"
          />

          <Button 
            onClick={handleAnalyze} 
            className="w-full bg-orange-500 hover:bg-orange-600"
            disabled={isAnalyzing}
          >
            {isAnalyzing ? t('analyzing') : t('startAnalysis')}
          </Button>

          {analysisResult && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-base font-semibold">{t('breakdownResult')}</h2>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleCopyResult}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    {t('copyRawYaml')}
                  </Button>
                  {parsedFeatures.length > 0 && parsedFeatures.map((feature, featureIndex) => (
                    <Button 
                      key={featureIndex}
                      variant="outline" 
                      size="sm" 
                      className="flex items-center gap-1"
                      onClick={() => handleCopyFeature(feature, featureIndex)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      {t('copyFeatureDetails')}
                    </Button>
                  ))[0]}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleOpenJira}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    {t('openJira')}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowDebug(!showDebug)}
                  >
                    {showDebug ? t('hideDebug') : t('showDebug')}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleManualParse}
                  >
                    {t('manualParse')}
                  </Button>
                </div>
              </div>
              
              {showDebug && (
                <div className="bg-gray-100 p-3 rounded-md mb-4 text-xs font-mono">
                  <p>{t('parseStatus')}: {parsedFeatures.length > 0 ? t('parseSuccess') : t('parseFailed')}</p>
                  <p>{t('parseAttempted')}: {parseAttempted ? t('yes') : t('no')}</p>
                  <p>{t('featureCount')}: {parsedFeatures.length}</p>
                  <p>{t('storyCount')}: {parsedFeatures.reduce((sum, f) => sum + f.stories.length, 0)}</p>
                </div>
              )}
              
              {parsedFeatures.length > 0 ? (
                <div className="space-y-6">
                  {parsedFeatures.map((feature, featureIndex) => (
                    <div key={featureIndex} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-medium text-gray-800">
                          {t('feature')}：{feature.feature}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {feature.stories.map((story, storyIndex) => (
                          <UserStoryCard 
                            key={storyIndex}
                            story={story}
                            featureName={feature.feature}
                            index={storyIndex}
                            featureIndex={featureIndex}
                            onEdit={handleEditStory}
                            onDelete={handleDeleteStory}
                            onToast={handleToast}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  {parseAttempted && (
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md mb-4">
                      <p className="text-yellow-700 text-sm">
                        {t('parseErrorMessage')}
                      </p>
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                    {analysisResult}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 编辑用户故事对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[800px] w-[90vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('editUserStory')}</DialogTitle>
          </DialogHeader>
          
          {editingStory && (
            <div className="space-y-6 py-4 px-2">
              <div className="space-y-3">
                <Label htmlFor="story" className="text-sm">{t('userStory')}</Label>
                <Input 
                  id="story" 
                  value={editingStory.story} 
                  onChange={(e) => setEditingStory({...editingStory, story: e.target.value})}
                  className="text-xs"
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="description" className="text-sm">{t('description')}</Label>
                <Textarea 
                  id="description" 
                  value={editingStory.description} 
                  onChange={(e) => setEditingStory({...editingStory, description: e.target.value})}
                  className="min-h-[100px] text-xs"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">{t('acceptanceCriteria')}</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddAcceptanceCriteria}
                    className="px-3"
                  >
                    {t('addCriteria')}
                  </Button>
                </div>
                
                <div className="space-y-3 mt-2">
                  {editingStory.acceptance_criteria.map((criteria, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Input 
                        value={criteria} 
                        onChange={(e) => handleUpdateAcceptanceCriteria(index, e.target.value)}
                        className="flex-1 text-xs"
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="h-9 w-9 p-0" 
                        onClick={() => handleRemoveAcceptanceCriteria(index)}
                      >
                        <Trash2 className="h-5 w-5 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">{t('nonFunctionalRequirements')}</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddNonFunctionalRequirement}
                    className="px-3"
                  >
                    {t('addRequirement')}
                  </Button>
                </div>
                
                <div className="space-y-3 mt-2">
                  {editingStory.non_functional_requirements && editingStory.non_functional_requirements.map((req, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Input 
                        value={req} 
                        onChange={(e) => handleUpdateNonFunctionalRequirement(index, e.target.value)}
                        className="flex-1 text-xs"
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="h-9 w-9 p-0" 
                        onClick={() => handleRemoveNonFunctionalRequirement(index)}
                      >
                        <Trash2 className="h-5 w-5 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="mt-6 gap-3">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="min-w-[80px]">{t('cancel')}</Button>
            <Button onClick={handleSaveEdit} className="min-w-[80px] bg-orange-500 hover:bg-orange-600">{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 