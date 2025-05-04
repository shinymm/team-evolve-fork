'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { userStoryBreakdownService } from '@/lib/services/user-story-breakdown-service'
import { StructuredRequirement, StructuredScene } from '@/lib/services/requirement-export-service'
import { UserStoryCard, UserStory } from '@/components/user-story-card'
import { parseUserStoryYaml, Feature } from '@/lib/utils/yaml-parser'
import { Copy, Trash2 } from 'lucide-react'
import { toast } from "@/components/ui/use-toast"
import { useSystemStore } from '@/lib/stores/system-store'
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store'

export default function UserStoryPage() {
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
  
  // 确保已设置当前系统
  useEffect(() => {
    if (selectedSystemId && selectedSystemId !== currentSystemId) {
      console.log('设置当前系统:', selectedSystemId)
      setCurrentSystem(selectedSystemId)
    }
  }, [selectedSystemId, currentSystemId, setCurrentSystem])

  useEffect(() => {
    // 根据当前系统ID从localStorage获取结构化需求
    if (!selectedSystemId) {
      console.log('未选择系统，无法加载数据')
      return
    }
    
    const storageKey = `structuredRequirement_${selectedSystemId}`
    const storedRequirement = localStorage.getItem(storageKey)
    
    if (storedRequirement) {
      try {
        const requirement = JSON.parse(storedRequirement)
        setScenes(requirement.sceneList || [])
        console.log(`已加载系统 ${selectedSystemId} 的场景数据，共 ${requirement.sceneList?.length || 0} 个场景`)
      } catch (error) {
        console.error('解析需求数据失败:', error)
        toast({
          title: "加载失败",
          description: "无法解析需求数据",
          variant: "destructive",
          duration: 3000
        })
      }
    } else {
      console.log(`未找到系统 ${selectedSystemId} 的需求数据`)
      
      // 向后兼容：尝试加载无系统ID的数据
      const legacyStoredRequirement = localStorage.getItem('structuredRequirement')
      if (legacyStoredRequirement) {
        try {
          const requirement = JSON.parse(legacyStoredRequirement)
          setScenes(requirement.sceneList || [])
          console.log(`已加载旧版格式的场景数据，共 ${requirement.sceneList?.length || 0} 个场景`)
        } catch (error) {
          console.error('解析旧版需求数据失败:', error)
        }
      }
    }
  }, [selectedSystemId])

  // 当分析结果更新时，尝试解析YAML
  useEffect(() => {
    if (analysisResult) {
      try {
        console.log('开始解析YAML:', analysisResult.substring(0, 100) + '...');
        const features = parseUserStoryYaml(analysisResult);
        console.log('解析结果:', features);
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
      // 将场景的所有相关信息组合成文本
      const sceneContent = [
        `场景名称：${scene.sceneName}`,
        `\n场景内容：${scene.content}`
      ]
      
      setRequirementText(sceneContent.join('\n'))
      setSelectedScene(sceneIndex)
      setIsDialogOpen(false)
    }
  }

  const handleAnalyze = async () => {
    if (!requirementText.trim()) {
      alert('请先输入场景描述')
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
      alert('分析过程中出错，请重试')
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
      alert(`解析成功，找到 ${features.length} 个功能，共 ${features.reduce((sum, f) => sum + f.stories.length, 0)} 个用户故事`);
    } catch (error) {
      console.error('手动解析YAML时出错:', error);
      alert('解析失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleCopyResult = () => {
    navigator.clipboard.writeText(analysisResult)
      .then(() => {
        toast({
          title: "已复制到剪贴板",
          description: "原始YAML分析结果已复制",
          duration: 3000,
        });
      })
      .catch(err => {
        console.error('复制失败:', err);
        toast({
          title: "复制失败",
          description: "无法复制到剪贴板，请手动复制",
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
    if (window.confirm('确定要删除这个用户故事吗？')) {
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
      `功能: ${feature.feature}`,
      ``,
      `用户故事列表:`,
    ];
    
    // 添加每个用户故事
    feature.stories.forEach((story, index) => {
      featureContent.push(`\n用户故事 #${index + 1}: ${story.story}`);
      featureContent.push(`描述: ${story.description}`);
      
      featureContent.push(`验收标准:`);
      story.acceptance_criteria.forEach(criteria => {
        featureContent.push(`- ${criteria}`);
      });
      
      if (story.non_functional_requirements && story.non_functional_requirements.length > 0) {
        featureContent.push(`非功能需求:`);
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
          title: "已复制到剪贴板",
          description: `功能"${feature.feature}"的所有用户故事已复制，共 ${feature.stories.length} 个故事`,
          duration: 3000,
        });
      })
      .catch(err => {
        console.error('复制失败:', err);
        toast({
          title: "复制失败",
          description: "无法复制到剪贴板，请手动复制",
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

  return (
    <div className="w-[90%] mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">用户故事拆解</h1>
        <div className="flex items-center justify-between mt-2">
          <p className="text-gray-600 text-xs">
            通过AI分析需求内容，将场景拆解为更细粒度的用户故事，帮助团队更好地理解和实现需求。
          </p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
              >
                从缓存中加载场景
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] w-[90%]">
              <DialogHeader>
                <DialogTitle>选择要加载的场景</DialogTitle>
              </DialogHeader>
              <Select value={selectedScene} onValueChange={handleSceneSelect} name="scene-select">
                <SelectTrigger>
                  <SelectValue placeholder="选择要拆解的场景" />
                </SelectTrigger>
                <SelectContent>
                  {scenes.map((scene: StructuredScene, index: number) => (
                    <SelectItem key={index} value={String(index)}>
                      {`场景${index + 1}: ${scene.sceneName}` || `场景 ${index + 1}`}
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
            placeholder="请输入需求内容..."
            value={requirementText}
            onChange={(e) => setRequirementText(e.target.value)}
            className="min-h-[200px] text-xs"
          />

          <Button 
            onClick={handleAnalyze} 
            className="w-full bg-orange-500 hover:bg-orange-600"
            disabled={isAnalyzing}
          >
            {isAnalyzing ? '正在拆解中...' : '开始拆解用户故事'}
          </Button>

          {analysisResult && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-base font-semibold">拆解结果：</h2>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleCopyResult}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    复制结果
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowDebug(!showDebug)}
                  >
                    {showDebug ? '隐藏调试' : '显示调试'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleManualParse}
                  >
                    手动解析
                  </Button>
                </div>
              </div>
              
              {showDebug && (
                <div className="bg-gray-100 p-3 rounded-md mb-4 text-xs font-mono">
                  <p>解析状态: {parsedFeatures.length > 0 ? '成功' : '失败'}</p>
                  <p>解析尝试: {parseAttempted ? '是' : '否'}</p>
                  <p>功能数量: {parsedFeatures.length}</p>
                  <p>用户故事总数: {parsedFeatures.reduce((sum, f) => sum + f.stories.length, 0)}</p>
                </div>
              )}
              
              {parsedFeatures.length > 0 ? (
                <div className="space-y-6">
                  {parsedFeatures.map((feature, featureIndex) => (
                    <div key={featureIndex} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-medium text-gray-800">
                          功能：{feature.feature}
                        </h3>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 flex items-center gap-1 text-gray-600 hover:text-gray-900"
                          onClick={() => handleCopyFeature(feature, featureIndex)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="text-xs">复制功能</span>
                        </Button>
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
                        未能解析为卡片格式，显示原始YAML。请检查YAML格式是否正确，或点击"手动解析"按钮尝试再次解析。
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
            <DialogTitle>编辑用户故事</DialogTitle>
          </DialogHeader>
          
          {editingStory && (
            <div className="space-y-6 py-4 px-2">
              <div className="space-y-3">
                <Label htmlFor="story" className="text-sm">用户故事</Label>
                <Input 
                  id="story" 
                  value={editingStory.story} 
                  onChange={(e) => setEditingStory({...editingStory, story: e.target.value})}
                  className="text-xs"
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="description" className="text-sm">描述</Label>
                <Textarea 
                  id="description" 
                  value={editingStory.description} 
                  onChange={(e) => setEditingStory({...editingStory, description: e.target.value})}
                  className="min-h-[100px] text-xs"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">验收标准</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddAcceptanceCriteria}
                    className="px-3"
                  >
                    添加标准
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
                  <Label className="text-sm">非功能需求</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddNonFunctionalRequirement}
                    className="px-3"
                  >
                    添加需求
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
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="min-w-[80px]">取消</Button>
            <Button onClick={handleSaveEdit} className="min-w-[80px] bg-orange-500 hover:bg-orange-600">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 