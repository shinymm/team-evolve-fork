"use client";

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Copy, Download, Edit2, Save, ArrowRight, Pin, PinOff, Settings, Check } from "lucide-react";
import { useRouter } from 'next/navigation';
import { Toaster } from "@/components/ui/toaster";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import dynamic from 'next/dynamic';
// 动态导入ReactMarkdown组件
const DynamicReactMarkdown = dynamic(() => import('@/components/dynamic-markdown'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-100 p-4 rounded-md min-h-[200px]">加载内容中...</div>
})
import remarkGfm from 'remark-gfm';
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSystemStore } from '@/lib/stores/system-store';
import { RequirementBookService } from '@/lib/services/requirement-book-service';
import { SceneAnalysisState } from '@/types/scene';

// 定义模板接口
interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export function RequirementBookClient() {
  const t = useTranslations('RequirementBookPage');
  const locale = useLocale();
  console.log('client 调试 locale:', locale, 't(title):', t('title'));
  const [originalRequirement, setOriginalRequirement] = useState('');
  const [requirementBook, setRequirementBook] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBook, setEditedBook] = useState('');
  const [editTarget, setEditTarget] = useState<'main' | 'pinned'>('main');
  const { toast } = useToast();
  const router = useRouter();

  // 模板相关状态
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [currentTemplateDetails, setCurrentTemplateDetails] = useState<Template | null>(null);

  // 获取当前系统信息
  const { systems, selectedSystemId } = useSystemStore();
  const selectedSystem = systems.find(s => s.id === selectedSystemId) || null;

  // 从store中获取状态和方法，直接解构当前活跃系统的字段
  const {
    currentSystemId,
    requirement,
    pinnedAnalysis,
    requirementBook: storedRequirementBook,
    pinnedRequirementBook,
    isPinned,
    isRequirementBookPinned,
    templateId,
    setCurrentSystem,
    setRequirement,
    pinAnalysis,
    pinRequirementBook,
    unpinRequirementBook,
    getActiveRequirementBook,
    setTemplateId,
  } = useRequirementAnalysisStore();

  useEffect(() => {
    if (selectedSystem?.id && selectedSystem.id !== currentSystemId) {
      setCurrentSystem(selectedSystem.id);
    }
  }, [selectedSystem, currentSystemId, setCurrentSystem]);

  // 加载模板列表
  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await fetch('/api/templates');
      if (!response.ok) {
        throw new Error('获取模板列表失败');
      }
      const data = await response.json();
      setTemplates(data);
      
      // 如果已有选中的模板ID，获取详情
      if (templateId) {
        fetchTemplateDetails(templateId);
      }
    } catch (error) {
      console.error('加载模板列表失败:', error);
      toast({
        title: '获取模板列表失败',
        description: '请稍后重试',
        variant: "destructive",
      });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // 获取模板详情
  const fetchTemplateDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/templates/${id}`);
      if (!response.ok) {
        throw new Error('获取模板详情失败');
      }
      const data = await response.json();
      setCurrentTemplateDetails(data);
    } catch (error) {
      console.error('获取模板详情失败:', error);
    }
  };

  // 打开模板选择对话框时加载模板列表
  useEffect(() => {
    if (isTemplateDialogOpen) {
      loadTemplates();
    }
  }, [isTemplateDialogOpen]);

  // 选择模板并预览
  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
  };

  // 确认选择模板
  const handleConfirmTemplate = () => {
    if (selectedTemplate && selectedSystem?.id) {
      setTemplateId(selectedTemplate.id);
      setIsTemplateDialogOpen(false);
      toast({
        title: '设置模板成功',
        description: `已选择模板: ${selectedTemplate.name}`,
        duration: 3000,
      });
      // 更新当前模板详情
      setCurrentTemplateDetails(selectedTemplate);
    }
  };

  // 添加 AI 配置缓存
  const [cachedAIConfig, setCachedAIConfig] = useState<any>(null);

  // 添加内容格式化函数
  const normalizeMarkdownContent = (content: string): string => {
    if (!content) return '';
    content = content.replace(/\n{3,}/g, '\n\n');
    content = content.replace(/^[*-]\s.*$/gm, match => `${match}\n`);
    content = content.replace(/^#{1,6}\s.*$/gm, match => `${match}\n`);
    if (content.includes('```')) {
      return content;
    }
    return content.trim();
  };

  useEffect(() => {
    // 检查 store 中是否已有 pinnedAnalysis 或 requirement 作为原始需求
    if (selectedSystem?.id) { // 确保有选中的系统
      if (pinnedAnalysis) {
        // 如果 store 中有固定的分析结果，则使用它
        setOriginalRequirement(pinnedAnalysis);
      } else if (requirement) {
        // 否则，如果 store 中有来自上一页的原始需求输入 (requirement)，使用它
        // 这通常是用户在 book-evolution 页面直接输入的内容
        setOriginalRequirement(requirement);
      }
      // 如果两者都没有，originalRequirement 将保持其初始空字符串状态
      
      // 如果有模板ID，获取模板详情
      if (templateId) {
        fetchTemplateDetails(templateId);
      }
    }
  }, [selectedSystem, pinnedAnalysis, requirement, templateId]); // 依赖项更新

  useEffect(() => {
    return () => {
      if (currentSystemId) {
        // 状态自动保存到localStorage
      }
    };
  }, [currentSystemId]);

  const handleSubmit = async () => {
    if (!selectedSystem?.id) {
      toast({
        title: t('selectSystemFirst'),
        description: t('needSelectSystem'),
        variant: "destructive",
        duration: 3000
      });
      return;
    }
    
    // 检查是否设置了模板
    if (!templateId && !currentTemplateDetails) {
      toast({
        title: '请先设置模板',
        description: '请点击"设置模板"按钮选择一个模板',
        variant: "destructive",
        duration: 3000
      });
      return;
    }
    
    setIsGenerating(true);
    setRequirementBook('');
    try {
      await RequirementBookService.generateRequirementBook(
        originalRequirement,
        selectedSystem.id,
        (content) => setRequirementBook(content)
      );
    } catch (error) {
      toast({
        title: t('generateFailed'),
        description: error instanceof Error ? error.message : t('tryAgain'),
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: t('copySuccess'),
        description: t('copyDesc'),
        duration: 3000
      });
    } catch (error) {
      toast({
        title: t('copyFailed'),
        description: t('copyFailedDesc'),
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const handleDownload = (content: string, suffix: string = '') => {
    try {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = `${t('generate')}${suffix}-${timestamp}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: t('downloadSuccess'),
        description: t('downloadDesc'),
        duration: 3000
      });
    } catch (error) {
      toast({
        title: t('downloadFailed'),
        description: t('downloadFailedDesc'),
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const handleEdit = (target: 'main' | 'pinned' = 'main') => {
    setIsEditing(true);
    setEditTarget(target);
    setEditedBook(target === 'main' ? requirementBook : (pinnedRequirementBook || ''));
  };

  const handleSave = () => {
    if (!selectedSystem?.id) return;
    if (editTarget === 'main') {
      setRequirementBook(editedBook);
    } else {
      pinRequirementBook(editedBook);
    }
    setIsEditing(false);
    toast({
      title: t('saveSuccess'),
      description: t('saveDesc'),
      duration: 3000
    });
  };

  const handleTogglePin = () => {
    if (!selectedSystem?.id) return;
    if (isRequirementBookPinned) {
      if (!requirementBook && pinnedRequirementBook) {
        setRequirementBook(pinnedRequirementBook);
      }
      unpinRequirementBook();
      toast({
        title: t('unpinSuccess'),
        description: t('unpinDesc'),
        duration: 3000
      });
    } else {
      pinRequirementBook(requirementBook);
      setRequirementBook('');
      toast({
        title: t('pinSuccess'),
        description: t('pinDesc'),
        duration: 3000
      });
    }
  };

  const handleConfirm = async () => {
    if (!selectedSystem?.id) return;
    try {
      const activeBook = getActiveRequirementBook() || requirementBook;
      if (!isRequirementBookPinned && requirementBook) {
        pinRequirementBook(requirementBook);
      }
      await RequirementBookService.processConfirmation(activeBook, selectedSystem.id);
      try {
        const structuredKey = `requirement-structured-content-${selectedSystem.id}`;
        const structuredData = localStorage.getItem(structuredKey);
        if (structuredData) {
          const parsedData = JSON.parse(structuredData);
          if (parsedData && parsedData.scenes && Array.isArray(parsedData.scenes)) {
            const initialStates: Record<string, SceneAnalysisState> = {};
            parsedData.scenes.forEach((scene: { name?: string }) => {
              if (scene.name) {
                initialStates[scene.name] = {
                  isConfirming: false,
                  isCompleted: false,
                  isEditing: false,
                  isOptimizing: false,
                  isOptimizeConfirming: false,
                  isHideOriginal: false
                };
              }
            });
            if (Object.keys(initialStates).length > 0) {
              const sceneStatesKey = `scene-analysis-states-${selectedSystem.id}`;
              localStorage.setItem(sceneStatesKey, JSON.stringify(initialStates));
            }
          }
        }
      } catch (syncError) {
        // ignore
      }
      toast({
        title: t('saveSuccess'),
        description: t('saveDesc'),
        duration: 3000
      });
      router.push('/ai-capability/scene-analysis');
    } catch (error) {
      toast({
        title: t('generateFailed'),
        description: error instanceof Error ? error.message : t('tryAgain'),
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const handleConfirmWithDialog = async () => {
    if (!selectedSystem?.id) return;
    if (isRequirementBookPinned && pinnedRequirementBook && requirementBook) {
      if (confirm(t('confirmAndContinue'))) {
        await handleConfirm();
      } else {
        pinRequirementBook(requirementBook);
        await handleConfirm();
      }
    } else {
      await handleConfirm();
    }
  };

  const renderIconButton = (icon: React.ReactNode, label: string, onClick: () => void, className: string = "", disabled: boolean = false) => {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClick}
              className={`h-8 w-8 rounded-full ${className}`}
              disabled={disabled}
            >
              {icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <>
      <div className="mx-auto py-6 w-[90%]">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <div className="flex items-center justify-between mt-2">
              <p className="text-muted-foreground text-sm">
                {t('subtitle')}
              </p>
              <div className="flex gap-1 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOriginalRequirement('')}
                  className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                  disabled={isGenerating}
                >
                  {t('clear')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (selectedSystem?.id) {
                      if (pinnedAnalysis) {
                        setOriginalRequirement(pinnedAnalysis);
                        toast({
                          title: t('copySuccess'),
                          description: t('copyDesc'),
                          duration: 3000
                        });
                      } else {
                        toast({
                          title: t('copyFailed'),
                          description: t('copyFailedDesc'),
                          variant: "destructive",
                          duration: 3000
                        });
                      }
                    } else {
                      toast({
                        title: t('selectSystemFirst'),
                        description: t('needSelectSystem'),
                        variant: "destructive",
                        duration: 3000
                      });
                    }
                  }}
                  className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                  disabled={isGenerating}
                >
                  {t('reload')}
                </Button>
                
                {/* 设置模板按钮 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTemplateDialogOpen(true)}
                  className="h-7 ml-2 flex items-center gap-1 text-xs"
                  disabled={isGenerating}
                >
                  <Settings className="h-3.5 w-3.5" />
                  设置模板
                  {!templateId && <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>}
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <Textarea
              placeholder={t('placeholder')}
              className="min-h-[200px]"
              value={originalRequirement}
              onChange={(e) => setOriginalRequirement(e.target.value)}
              disabled={isGenerating}
            />
            <Button
              onClick={handleSubmit}
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={isGenerating || !selectedSystemId}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('generating')}...
                </>
              ) : !selectedSystemId ? (
                t('selectSystemFirst')
              ) : (
                t('generate')
              )}
            </Button>
            {isRequirementBookPinned && pinnedRequirementBook && requirementBook ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="flex justify-end gap-1">
                      {renderIconButton(<Copy className="h-4 w-4" />, t('copy'), () => handleCopy(pinnedRequirementBook), "text-gray-500 hover:text-gray-700", isGenerating)}
                      {renderIconButton(<Download className="h-4 w-4" />, t('download'), () => handleDownload(pinnedRequirementBook, '-fixed'), "text-gray-500 hover:text-gray-700", isGenerating)}
                      {renderIconButton(<Edit2 className="h-4 w-4" />, t('edit'), () => handleEdit('pinned'), "text-gray-500 hover:text-gray-700", isGenerating || isEditing)}
                      {renderIconButton(<PinOff className="h-4 w-4" />, t('unpin'), handleTogglePin, "text-orange-600 hover:text-orange-700", isGenerating)}
                    </div>
                    <Card className="p-6 mt-4 border-orange-300 border-2">
                      <div className="text-sm font-medium text-orange-600 mb-2">{t('fixedContent')}</div>
                      {isEditing && editTarget === 'pinned' ? (
                        <Textarea
                          value={editedBook}
                          onChange={(e) => setEditedBook(e.target.value)}
                          className="min-h-[600px] w-full resize-y"
                          disabled={isGenerating}
                        />
                      ) : (
                        <div className="space-y-4">
                          <DynamicReactMarkdown remarkPlugins={[remarkGfm]}>{pinnedRequirementBook}</DynamicReactMarkdown>
                        </div>
                      )}
                    </Card>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-end gap-1">
                      {renderIconButton(<Copy className="h-4 w-4" />, t('copy'), () => handleCopy(requirementBook), "text-gray-500 hover:text-gray-700", isGenerating)}
                      {renderIconButton(<Download className="h-4 w-4" />, t('download'), () => handleDownload(requirementBook, '-new'), "text-gray-500 hover:text-gray-700", isGenerating)}
                      {renderIconButton(<Edit2 className="h-4 w-4" />, t('edit'), () => handleEdit('main'), "text-gray-500 hover:text-gray-700", isGenerating || isEditing)}
                      {renderIconButton(<Pin className="h-4 w-4" />, t('pin'), handleTogglePin, "text-gray-500 hover:text-gray-700", isGenerating)}
                    </div>
                    <Card className="p-6 mt-4">
                      <div className="text-sm font-medium text-gray-600 mb-2">{t('newContent')}</div>
                      {isEditing && editTarget === 'main' ? (
                        <Textarea
                          value={editedBook}
                          onChange={(e) => setEditedBook(e.target.value)}
                          className="min-h-[600px] w-full resize-y"
                          disabled={isGenerating}
                        />
                      ) : (
                        <div className="space-y-4">
                          <DynamicReactMarkdown remarkPlugins={[remarkGfm]}>{requirementBook}</DynamicReactMarkdown>
                        </div>
                      )}
                    </Card>
                  </div>
                </div>
                {!isEditing && (
                  <Button
                    onClick={handleConfirmWithDialog}
                    className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
                    disabled={isGenerating}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    {t('confirmAndContinue')}
                  </Button>
                )}
              </div>
            ) : ((isRequirementBookPinned && pinnedRequirementBook) || requirementBook ? (
              <div className="space-y-4">
                <div className="flex justify-end gap-1">
                  {renderIconButton(<Copy className="h-4 w-4" />, t('copy'), () => handleCopy(isRequirementBookPinned && pinnedRequirementBook ? pinnedRequirementBook : requirementBook), "text-gray-500 hover:text-gray-700", isGenerating)}
                  {renderIconButton(<Download className="h-4 w-4" />, t('download'), () => handleDownload(isRequirementBookPinned && pinnedRequirementBook ? pinnedRequirementBook : requirementBook), "text-gray-500 hover:text-gray-700", isGenerating)}
                  {!isEditing ? (
                    <>
                      {renderIconButton(<Edit2 className="h-4 w-4" />, t('edit'), () => handleEdit(isRequirementBookPinned ? 'pinned' : 'main'), "text-gray-500 hover:text-gray-700", isGenerating)}
                      {isRequirementBookPinned ?
                        renderIconButton(<PinOff className="h-4 w-4" />, t('unpin'), handleTogglePin, "text-orange-600 hover:text-orange-700", isGenerating) :
                        renderIconButton(<Pin className="h-4 w-4" />, t('pin'), handleTogglePin, "text-gray-500 hover:text-gray-700", isGenerating)
                      }
                    </>
                  ) : (
                    renderIconButton(<Save className="h-4 w-4" />, t('saveEdit'), handleSave, "text-orange-600 hover:text-orange-700", isGenerating)
                  )}
                </div>
                <Card className={`p-6 mt-4 ${isRequirementBookPinned ? 'border-orange-300 border-2' : ''}`}>
                  {isRequirementBookPinned && <div className="text-sm font-medium text-orange-600 mb-2">{t('fixedContent')}</div>}
                  {isEditing ? (
                    <Textarea
                      value={editedBook}
                      onChange={(e) => setEditedBook(e.target.value)}
                      className="min-h-[600px] w-full resize-y"
                      disabled={isGenerating}
                    />
                  ) : (
                    <div className="space-y-4">
                      <DynamicReactMarkdown remarkPlugins={[remarkGfm]}>{isRequirementBookPinned && pinnedRequirementBook ? pinnedRequirementBook : requirementBook}</DynamicReactMarkdown>
                    </div>
                  )}
                </Card>
                {!isEditing && (
                  <Button
                    onClick={handleConfirmWithDialog}
                    className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
                    disabled={isGenerating}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    {t('confirmAndContinue')}
                  </Button>
                )}
              </div>
            ) : null)}
          </div>
        </div>
      </div>
      
      {/* 模板选择对话框 */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent 
          className="max-w-[80%] max-h-[80vh] overflow-hidden flex flex-col" 
          style={{ width: "80%", minWidth: "80%" } as React.CSSProperties}
        >
          <DialogHeader>
            <DialogTitle>选择需求书模板</DialogTitle>
            <DialogDescription>
              从以下模板中选择一个作为需求书生成的基础模板
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-1 overflow-hidden mt-4">
            {/* 模板列表 */}
            <div className="w-1/3 border-r pr-4 overflow-hidden flex flex-col">
              <h3 className="font-medium text-sm mb-2">模板列表</h3>
              
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {templates.map(template => (
                      <div 
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className={`p-3 rounded-md cursor-pointer transition-colors ${
                          selectedTemplate?.id === template.id 
                            ? 'bg-orange-100 border border-orange-300' 
                            : 'hover:bg-gray-100 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{template.name}</div>
                          {selectedTemplate?.id === template.id && (
                            <Check className="h-4 w-4 text-orange-500" />
                          )}
                        </div>
                        {template.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.tags?.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs py-0 px-1.5">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    {templates.length === 0 && !isLoadingTemplates && (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        暂无可用模板
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
            
            {/* 模板预览 */}
            <div className="w-2/3 pl-4 overflow-hidden flex flex-col">
              <h3 className="font-medium text-sm mb-2">模板预览</h3>
              
              <Card className="flex-1 overflow-hidden">
                <CardContent className="p-4 h-full">
                  <ScrollArea className="h-[calc(60vh-120px)]">
                    {selectedTemplate ? (
                      <div className="prose prose-sm max-w-none">
                        <DynamicReactMarkdown
                          remarkPlugins={[remarkGfm]}
                        >
                          {selectedTemplate.content}
                        </DynamicReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        请从左侧选择一个模板
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleConfirmTemplate} 
              disabled={!selectedTemplate}
              className="bg-orange-500 hover:bg-orange-600"
            >
              确认选择
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Toaster />
    </>
  );
} 