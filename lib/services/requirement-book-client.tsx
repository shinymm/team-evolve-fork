"use client";

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";
import { Loader2, Copy, Download, Edit2, Save, ArrowRight, Pin, PinOff } from "lucide-react";
import { useRouter } from 'next/navigation';
import { Toaster } from "@/components/ui/toaster";
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
    setCurrentSystem,
    setRequirement,
    pinAnalysis,
    pinRequirementBook,
    unpinRequirementBook,
    getActiveRequirementBook,
  } = useRequirementAnalysisStore();

  useEffect(() => {
    if (selectedSystem?.id && selectedSystem.id !== currentSystemId) {
      setCurrentSystem(selectedSystem.id);
    }
  }, [selectedSystem, currentSystemId, setCurrentSystem]);

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
    }
  }, [selectedSystem, pinnedAnalysis, requirement]); // 依赖项更新

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
      <Toaster />
    </>
  );
} 