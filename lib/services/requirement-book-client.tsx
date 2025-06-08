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
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSystemStore } from '@/lib/stores/system-store';
import { RequirementBookService } from '@/lib/services/requirement-book-service';
import { SceneAnalysisState } from '@/types/scene';
import { UploadDialog } from '@/components/image-processing/UploadDialog';
import { ImageList, UploadedFile } from '@/components/image-processing/ImageList';
import { RequirementFromPrototypeService } from '@/lib/services/requirement-from-prototype-service';
import { ReasoningSection } from '@/components/TiptapEditor/ReasoningSection';

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
  const tCommon = useTranslations('ReasoningSection');
  const locale = useLocale();
  const [originalRequirement, setOriginalRequirement] = useState('');
  const [requirementBook, setRequirementBook] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBook, setEditedBook] = useState('');
  const [editTarget, setEditTarget] = useState<'main' | 'pinned'>('main');
  const { toast } = useToast();
  const router = useRouter();

  // 推理过程相关状态
  const [reasoningContent, setReasoningContent] = useState('');
  const [isReasoningVisible, setIsReasoningVisible] = useState(true);

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
    uploadedFiles,
    setUploadedFiles,
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
      // 确保有选择系统ID
      if (!selectedSystemId) {
        console.warn('未选择系统，无法加载模板列表');
        setTemplates([]);
        toast({
          title: '无法加载模板',
          description: '请先选择一个系统',
          variant: "warning",
        });
        setIsLoadingTemplates(false);
        return;
      }

      // 加入systemId参数
      const response = await fetch(`/api/templates?systemId=${selectedSystemId}`);
      if (!response.ok) {
        throw new Error('获取模板列表失败');
      }
      const data = await response.json();
      console.log(`获取系统[${selectedSystemId}]的模板列表，数量:`, data.length);
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
        variant: "warning",
      });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // 获取模板详情
  const fetchTemplateDetails = async (id: string) => {
    try {
      if (!selectedSystemId) {
        console.warn('未选择系统，无法获取模板详情');
        return;
      }

      const response = await fetch(`/api/templates/${id}`);
      if (!response.ok) {
        throw new Error('获取模板详情失败');
      }
      
      const data = await response.json();
      console.log(`获取模板详情成功, ID: ${id}, 名称: ${data.name}`);
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

  // 图片上传相关状态
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isImagesExpanded, setIsImagesExpanded] = useState(false);

  // 上传图片到OSS（通过表单上传）
  const handleUploadFile = async (file: File) => {
    if (!selectedSystem?.id) {
      setUploadError('请先选择系统');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      // 1. 从后端获取表单上传参数
      const getUrlResponse = await fetch('/api/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          systemName: selectedSystem.name || '',
        }),
      });

      const result = await getUrlResponse.json();
      if (!getUrlResponse.ok) {
        throw new Error(result.error || '获取上传参数失败');
      }
      
      const { uploadUrl, accessUrl, key, formData } = result;

      // 2. 使用表单方式上传到OSS
      const formDataObj = new FormData();
      // 添加所有表单字段
      Object.entries(formData).forEach(([k, v]) => {
        formDataObj.append(k, v as string);
      });
      // 添加文件作为最后一项
      formDataObj.append('file', file);
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formDataObj,
        // 不要设置Content-Type，让浏览器自动设置multipart/form-data
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('OSS上传失败:', errorText);
        throw new Error('文件上传到OSS失败');
      }

      // 3. 保存元数据到数据库
      const metadataResponse = await fetch('/api/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          name: file.name,
          url: accessUrl,
          fileSize: file.size,
          fileType: file.type,
          systemId: selectedSystem.id
        }),
      });

      if (!metadataResponse.ok) {
        const metadataError = await metadataResponse.json();
        console.error('保存元数据失败:', metadataError);
        throw new Error('文件上传成功，但保存元数据失败');
      }

      // 4. 更新前端状态
      const newFile: UploadedFile = {
        id: key,
        name: file.name,
        uploadTime: new Date(),
        provider: 'OSS',
        url: accessUrl,
        selected: true,
      };
      setUploadedFiles([...(uploadedFiles || []), newFile]);
      setIsUploadDialogOpen(false);
      setIsImagesExpanded(true);
      toast({ title: '上传成功', description: `文件 ${file.name} 已上传` });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '上传失败');
      toast({ title: '上传失败', description: error instanceof Error ? error.message : '未知错误', variant: 'warning' });
    } finally {
      setUploading(false);
    }
  };

  // 删除图片（仅本地删除）
  const handleDeleteFile = (fileId: string) => {
    setUploadedFiles((uploadedFiles || []).filter(file => file.id !== fileId));
  };

  // 选择图片（单选/多选）
  const handleSelectFile = (fileId: string, checked: boolean) => {
    setUploadedFiles((uploadedFiles || []).map(file => file.id === fileId ? { ...file, selected: checked } : file));
  };

  // 全选/全不选
  const handleSelectAllFiles = (allSelected: boolean) => {
    setUploadedFiles((uploadedFiles || []).map(file => ({ ...file, selected: allSelected })));
  };

  const handleSubmit = async () => {
    if (!selectedSystem?.id) {
      toast({
        title: t('selectSystemFirst'),
        description: t('needSelectSystem'),
        variant: "warning",
        duration: 3000
      });
      return;
    }
    if (!templateId && !currentTemplateDetails) {
      toast({
        title: '请先设置模板',
        description: '请点击"设置模板"按钮选择一个模板',
        variant: "warning",
        duration: 3000
      });
      return;
    }
    setIsGenerating(true);
    setRequirementBook('');
    setReasoningContent(''); // 开始生成时清空上一次的思考过程
    try {
      // 判断是否有图片
      const selectedImages = (uploadedFiles || []).filter(f => f.selected);
      if (selectedImages.length > 0) {
        // 多模态推理
        const imageUrls = selectedImages.map(f => f.url!);
        // 获取模板内容（优先localStorage中的ID）
        let templateIdToUse = templateId;
        if (!templateIdToUse && selectedSystem?.id) {
          // 兼容localStorage
          const localKey = `req_analysis_system_${selectedSystem.id}`;
          try {
            const cache = localStorage.getItem(localKey);
            if (cache) {
              const parsed = JSON.parse(cache);
              if (parsed.templateId) templateIdToUse = parsed.templateId;
            }
          } catch {}
        }
        if (!templateIdToUse) {
          toast({ title: '未找到模板ID', description: '请先设置模板', variant: 'warning' });
          setIsGenerating(false);
          return;
        }
        // 调用多模态service，传入templateId
        const protoService = new RequirementFromPrototypeService();
        await protoService.generateRequirementFromPrototype(
          selectedSystem.id,
          imageUrls,
          originalRequirement,
          templateIdToUse,
          (reasoning) => {
            // 更新思考过程状态，用于UI展示
            setReasoningContent(reasoning);
          },
          (content) => setRequirementBook(content)
        );
      } else {
        // 纯文字逻辑
        await RequirementBookService.generateRequirementBook(
          originalRequirement,
          selectedSystem.id,
          (content) => setRequirementBook(content)
        );
      }
    } catch (error) {
      toast({
        title: t('generateFailed'),
        description: error instanceof Error ? error.message : t('tryAgain'),
        variant: "warning",
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
        variant: "warning",
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
        variant: "warning",
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
        variant: "warning",
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
                {/* 上传原型图片按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsUploadDialogOpen(true)}
                  className="h-7 px-2 text-xs text-orange-500 hover:text-orange-700 border border-orange-200"
                >
                  上传原型图片
                </Button>
                {/* 设置模板按钮 */}
                <Button
                  variant={templateId ? "outline" : "default"}
                  size="sm"
                  onClick={() => setIsTemplateDialogOpen(true)}
                  className={`h-7 flex items-center gap-1 text-xs ml-2 ${!templateId ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}
                  disabled={isGenerating}
                >
                  <Settings className="h-3.5 w-3.5" />
                  设置模板
                  {!templateId && <span className="relative flex h-2 w-2 ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>}
                </Button>
              </div>
            </div>
          </div>
          {/* 图片列表展示（放在文本输入框上方，仅有图片时显示） */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <ImageList
                uploadedFiles={uploadedFiles}
                isImagesExpanded={isImagesExpanded}
                setIsImagesExpanded={setIsImagesExpanded}
                onSelectFile={handleSelectFile}
                onDeleteFile={handleDeleteFile}
                onUploadClick={() => setIsUploadDialogOpen(true)}
                processing={isGenerating}
                imagesLoading={false}
                onSelectAllFiles={handleSelectAllFiles}
              />
            </div>
          )}
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
            
            {/* 推理过程展示区域 */}
            {isGenerating && reasoningContent && (
              <ReasoningSection
                reasoning={reasoningContent}
                visible={isReasoningVisible}
                onToggle={() => setIsReasoningVisible(!isReasoningVisible)}
                onCopy={() => handleCopy(reasoningContent)}
                t={tCommon}
              />
            )}

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
                          className="min-h-[calc(100vh-22rem)] w-full resize-y"
                        />
                      ) : (
                        <ScrollArea className="h-[calc(100vh-22rem)]">
                          <DynamicReactMarkdown>
                            {pinnedRequirementBook}
                          </DynamicReactMarkdown>
                        </ScrollArea>
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
                          className="min-h-[calc(100vh-22rem)] w-full resize-y"
                        />
                      ) : (
                        <ScrollArea className="h-[calc(100vh-22rem)]">
                          <DynamicReactMarkdown>
                            {requirementBook}
                          </DynamicReactMarkdown>
                        </ScrollArea>
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
                  {renderIconButton(<Copy className="h-4 w-4" />, t('copy'), () => handleCopy(getActiveRequirementBook() || ''), "text-gray-500 hover:text-gray-700", isGenerating)}
                  {renderIconButton(<Download className="h-4 w-4" />, t('download'), () => handleDownload(getActiveRequirementBook() || ''), "text-gray-500 hover:text-gray-700", isGenerating)}
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
                      className="min-h-[calc(100vh-22rem)] w-full resize-y"
                    />
                  ) : (
                    <ScrollArea className="h-[calc(100vh-22rem)]">
                      <DynamicReactMarkdown>
                        {getActiveRequirementBook() || ''}
                      </DynamicReactMarkdown>
                    </ScrollArea>
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
        <DialogContent className="flex h-[80vh] w-[90%] max-w-[1000px] flex-col">
          <DialogHeader>
            <DialogTitle>{t('templateMarket')}</DialogTitle>
            <DialogDescription>
              {t('templateMarketDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-1 gap-4 overflow-hidden">
            <ScrollArea className="h-full w-2/5">
              <div className="space-y-2 pr-4">
                {isLoadingTemplates ? (
                  <div>{t('loadingTemplates')}</div>
                ) : (
                  templates.map((template) => (
                    <Card
                      key={template.id}
                      className={`cursor-pointer ${selectedTemplate?.id === template.id ? 'border-orange-500' : ''}`}
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{template.name}</h3>
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                          </div>
                          {templateId === template.id && (
                            <Badge variant="default" className="bg-green-500">{t('current')}</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
            <ScrollArea className="h-full w-3/5">
              {selectedTemplate ? (
                <div className="prose prose-sm w-full max-w-none">
                  <DynamicReactMarkdown>
                    {selectedTemplate.content}
                  </DynamicReactMarkdown>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-10">
                  请从左侧选择一个模板
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter className="flex justify-end space-x-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsTemplateDialogOpen(false)}
              className="w-24"
            >
              取消
            </Button>
            <Button 
              onClick={handleConfirmTemplate} 
              disabled={!selectedTemplate}
              className="bg-orange-500 hover:bg-orange-600 text-white w-24"
            >
              确认选择
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <UploadDialog
        open={isUploadDialogOpen}
        onClose={() => { setIsUploadDialogOpen(false); setUploadError(''); }}
        onUpload={handleUploadFile}
        uploading={uploading}
        error={uploadError}
      />
      <Toaster />
    </>
  );
} 