'use client';

import React, { useState, useRef, useEffect } from 'react';
import { TiptapEditor } from '@/components/TiptapEditor';
import { 
  FileUp, 
  ChevronDown, 
  Loader2,
  FileText,
  Download,
  Image
} from 'lucide-react';
import { useSystemStore } from '@/lib/stores/system-store';
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store';
import { 
  loadTemplate, 
  loadDraft, 
  showToast,
  exportToWord,
  exportToMarkdown
} from '@/components/TiptapEditor/EditorToolbar';
import { processContent } from '@/lib/utils/markdown-utils';
import { useTranslations, useLocale } from 'next-intl';

// 导入CSS样式
import '@/components/TiptapEditor/styles.css';

export default function BookWritingPage() {
  const locale = useLocale();
  const t = useTranslations('BookWritingPage');
  
  const [content, setContent] = useState<string>('');
  
  // 初始化时根据当前语言设置编辑器内容
  useEffect(() => {
    setContent(`<p>${t('editorPlaceholder')}</p>`);
  }, [t]);
  
  // 编辑器引用
  const editorRef = useRef<any>(null);
  
  // 下拉菜单状态
  const [showContentDropdown, setShowContentDropdown] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const contentDropdownRef = useRef<HTMLDivElement>(null);
  const downloadDropdownRef = useRef<HTMLDivElement>(null);
  
  // 加载状态
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // 获取系统和需求分析状态
  const { selectedSystemId } = useSystemStore();
  const { 
    getActiveRequirementBook, 
    imageDraft, 
    setCurrentSystem,
    requirementBook,
    pinnedRequirementBook,
    isRequirementBookPinned
  } = useRequirementAnalysisStore();
  
  // 新增：加载图片初稿状态
  const [isLoadingImageDraft, setIsLoadingImageDraft] = useState(false);
  
  // 新增：提取实际可用的需求初稿
  const getAvailableRequirementBook = () => {
    // 优先使用固定的需求书
    if (isRequirementBookPinned && pinnedRequirementBook) {
      return pinnedRequirementBook;
    }
    // 其次使用普通需求书
    else if (requirementBook) {
      return requirementBook;
    }
    // 最后使用老方法获取内容
    else {
      return getActiveRequirementBook();
    }
  };
  
  // 设置当前系统ID和加载数据
  useEffect(() => {
    if (selectedSystemId) {
      console.log('设置当前系统ID:', selectedSystemId);
      
      // 先查看一下localStorage中是否有数据
      try {
        const storageKey = `req_analysis_system_${selectedSystemId}`;
        const data = localStorage.getItem(storageKey);
        console.log('localStorage中系统数据:', data ? '存在' : '不存在', storageKey);
        
        // 如果localStorage中有数据，先手动加载作为备份
        if (data) {
          try {
            const parsedData = JSON.parse(data);
            console.log('localStorage数据解析结果:', {
              hasRequirementBook: !!parsedData.requirementBook,
              hasPinnedRequirementBook: !!parsedData.pinnedRequirementBook
            });
          } catch (e) {
            console.error('解析localStorage数据失败:', e);
          }
        }
      } catch (error) {
        console.error('检查localStorage数据失败:', error);
      }
      
      // 设置当前系统，这会触发从Redis/localStorage加载数据
      setCurrentSystem(selectedSystemId);
      
      // 设置后检查store中的状态
      setTimeout(() => {
        const store = useRequirementAnalysisStore.getState();
        console.log('设置系统后store中数据状态:', {
          currentSystemId: store.currentSystemId,
          hasRequirementBook: !!store.requirementBook,
          hasPinnedRequirementBook: !!store.pinnedRequirementBook,
          isPinned: store.isRequirementBookPinned
        });
      }, 1000); // 1秒后检查，确保异步加载完成
    }
    
    // 组件卸载时保存数据
    return () => {
      console.log('页面组件卸载，保存系统数据');
      // 获取当前store数据并保存
      const store = useRequirementAnalysisStore.getState();
      if (store.currentSystemId) {
        try {
          // 先检查localStorage中是否已有数据
          const existingData = localStorage.getItem(`req_analysis_system_${store.currentSystemId}`);
          let shouldSave = true;
          
          // 检查当前store中的数据是否有价值
          const hasRequirementBook = !!store.requirementBook;
          const hasPinnedRequirementBook = !!store.pinnedRequirementBook;
          const hasRequirement = !!store.requirement && store.requirement.trim() !== '';
          const hasPinnedAnalysis = !!store.pinnedAnalysis;
          const hasImageDraft = !!store.imageDraft;
          
          // 如果当前store正在加载中，或者数据为空，可能不应覆盖已有数据
          if (store.isLoading) {
            console.log('组件卸载时store正在加载中，不保存可能不完整的数据');
            shouldSave = false;
          } else if (!(hasRequirementBook || hasPinnedRequirementBook || hasRequirement || hasPinnedAnalysis || hasImageDraft)) {
            console.log('组件卸载时store数据为空，检查是否应覆盖已有数据');
            
            // 如果localStorage中有数据但当前内存中没有，不应覆盖
            if (existingData) {
              try {
                const parsedData = JSON.parse(existingData);
                const hasExistingData = !!(
                  parsedData.requirementBook || 
                  parsedData.pinnedRequirementBook || 
                  (parsedData.requirement && parsedData.requirement.trim() !== '') ||
                  parsedData.pinnedAnalysis ||
                  parsedData.imageDraft
                );
                
                if (hasExistingData) {
                  console.log('localStorage中存在有价值的数据，不覆盖');
                  shouldSave = false;
                }
              } catch (e) {
                console.error('解析localStorage数据失败:', e);
              }
            }
          }
          
          if (shouldSave) {
            console.log('[BookWritingPage Unmount] Relying on store setters and beforeunload for final save.');
          }
        } catch (error) {
          console.error('页面卸载时保存数据处理失败:', error);
        }
      }
    };
  }, [selectedSystemId, setCurrentSystem]);
  
  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contentDropdownRef.current && !contentDropdownRef.current.contains(event.target as Node)) {
        setShowContentDropdown(false);
      }
      
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target as Node)) {
        setShowDownloadDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // 保存编辑器实例的引用
  const handleEditorReady = (editor: any) => {
    editorRef.current = editor;
  };

  const handleChange = (html: string) => {
    setContent(html);
    // 您可以在这里添加自动保存逻辑，例如保存到localStorage或发送到后端
  };
  
  // 创建本地化的showToast函数，替换原始函数以支持国际化
  const localizedShowToast = (key: string, type: 'success' | 'error' = 'success') => {
    // 使用t函数翻译消息
    const message = t(key);
    showToast(message, type);
  };
  
  // 处理加载需求模板
  const handleLoadTemplate = async () => {
    if (!editorRef.current) {
      localizedShowToast('editorNotReady', 'error');
      return;
    }
    
    setIsLoadingTemplate(true);
    try {
      // 重写loadTemplate函数以传递本地化消息
      const success = await (async () => {
        if (!selectedSystemId) {
          localizedShowToast('selectSystemFirst', 'error');
          return false;
        }
    
        try {
          const response = await fetch(`/api/requirement-templates?systemId=${selectedSystemId}`);
          if (!response.ok) {
            throw new Error('获取模板失败');
          }
          
          const data = await response.json();
          if (data.template && data.template.content) {
            // 处理内容并设置到编辑器
            const processedContent = processContent(data.template.content);
            editorRef.current.commands.setContent(processedContent);
            localizedShowToast('loadTemplateSuccess');
            return true;
          } else {
            localizedShowToast('loadTemplateError', 'error');
            return false;
          }
        } catch (error) {
          console.error('加载需求模板失败:', error);
          localizedShowToast('loadTemplateError', 'error');
          return false;
        }
      })();
      
      console.log('加载模板结果:', success);
    } finally {
      setIsLoadingTemplate(false);
      setShowContentDropdown(false);
    }
  };
  
  // 处理加载需求初稿
  const handleLoadDraft = () => {
    if (!editorRef.current) {
      localizedShowToast('editorNotReady', 'error');
      return;
    }
    
    // 输出调试信息
    console.log('开始加载需求初稿，当前系统状态:', {
      systemId: selectedSystemId,
      requirementBook: !!requirementBook, 
      pinnedRequirementBook: !!pinnedRequirementBook,
      isRequirementBookPinned
    });
    
    setIsLoadingDraft(true);
    try {
      // 首先获取可用的需求书内容
      let activeBook = getAvailableRequirementBook();
      
      // 如果store中获取不到，直接尝试从localStorage获取
      if (!activeBook && selectedSystemId) {
        try {
          const storageKey = `req_analysis_system_${selectedSystemId}`;
          console.log('尝试直接从localStorage获取数据:', storageKey);
          const data = localStorage.getItem(storageKey);
          if (data) {
            const parsedData = JSON.parse(data);
            console.log('成功解析localStorage数据:', {
              hasPinnedBook: !!parsedData.pinnedRequirementBook,
              hasBook: !!parsedData.requirementBook,
              isPinned: parsedData.isRequirementBookPinned
            });
            
            // 优先使用固定的需求书
            if (parsedData.isRequirementBookPinned && parsedData.pinnedRequirementBook) {
              activeBook = parsedData.pinnedRequirementBook;
              console.log('从localStorage直接获取到固定需求书');
            } 
            // 其次使用普通需求书
            else if (parsedData.requirementBook) {
              activeBook = parsedData.requirementBook;
              console.log('从localStorage直接获取到普通需求书');
            }
          } else {
            console.log('localStorage中没有找到数据:', storageKey);
          }
        } catch (error) {
          console.error('直接从localStorage获取失败:', error);
        }
      }
      
      console.log('最终获取到的需求书内容:', activeBook ? '有内容' : '无内容');
      
      // 如果没有找到内容，显示错误
      if (!activeBook) {
        localizedShowToast('loadDraftError', 'error');
        return;
      }
      
      // 处理内容并设置到编辑器
      try {
        const processedContent = processContent(activeBook);
        editorRef.current.commands.setContent(processedContent);
        localizedShowToast('loadDraftSuccess');
      } catch (error) {
        console.error('处理内容失败:', error);
        localizedShowToast('loadDraftError', 'error');
      }
    } finally {
      setIsLoadingDraft(false);
      setShowContentDropdown(false);
    }
  };
  
  // 处理导出Word文档
  const handleExportWord = () => {
    if (!editorRef.current) {
      localizedShowToast('editorNotReady', 'error');
      return;
    }
    
    setIsExporting(true);
    try {
      // 使用当前语言环境决定文件名
      const fileName = locale === 'zh' ? '需求文档' : 'Requirements';
      exportToWord(editorRef.current, fileName, t);
    } finally {
      setIsExporting(false);
      setShowDownloadDropdown(false);
    }
  };
  
  // 处理导出Markdown
  const handleExportMarkdown = () => {
    if (!editorRef.current) {
      localizedShowToast('editorNotReady', 'error');
      return;
    }
    
    setIsExporting(true);
    try {
      // 使用当前语言环境决定文件名
      const fileName = locale === 'zh' ? '需求文档' : 'Requirements';
      exportToMarkdown(editorRef.current, fileName, t);
    } finally {
      setIsExporting(false);
      setShowDownloadDropdown(false);
    }
  };

  // 新增：处理加载图片初稿
  const handleLoadImageDraft = () => {
    if (!editorRef.current) {
      localizedShowToast('editorNotReady', 'error');
      return;
    }
    
    if (!selectedSystemId) {
      localizedShowToast('selectSystemFirst', 'error');
      return;
    }
    
    if (!imageDraft) {
      localizedShowToast('noImageDraft', 'error');
      return;
    }
    
    setIsLoadingImageDraft(true);
    try {
      // 使用processContent函数处理markdown内容
      const processedContent = processContent(imageDraft);
      
      // 设置编辑器内容
      editorRef.current.commands.setContent(processedContent);
      localizedShowToast('loadImageDraftSuccess', 'success');
    } catch (error) {
      console.error('加载图片初稿失败:', error);
      localizedShowToast('loadImageDraftError', 'error');
    } finally {
      setIsLoadingImageDraft(false);
      setShowContentDropdown(false);
    }
  };

  return (
    <div className="mx-auto py-6 w-[90%]">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground text-sm mt-2">
              {t('subtitle')}
            </p>
          </div>
          
          <div className="flex space-x-3">
            {/* 内容加载下拉菜单 */}
            <div className="header-dropdown-container" ref={contentDropdownRef}>
              <button
                onClick={() => setShowContentDropdown(!showContentDropdown)}
                className="header-dropdown-button"
                title={t('contentLoad')}
                disabled={isLoadingTemplate || isLoadingDraft || isLoadingImageDraft}
              >
                {(isLoadingTemplate || isLoadingDraft || isLoadingImageDraft) ? (
                  <Loader2 size={20} className="animate-spin mr-2" />
                ) : (
                  <FileText size={20} className="mr-2" />
                )}
                <span>{t('contentLoad')}</span>
                <ChevronDown size={14} className="ml-1" />
              </button>
              
              {showContentDropdown && (
                <div className="header-dropdown-menu">
                  <button 
                    onClick={handleLoadTemplate} 
                    className="header-dropdown-item"
                    disabled={isLoadingTemplate}
                  >
                    {isLoadingTemplate ? (
                      <><Loader2 size={14} className="animate-spin mr-2" /> {t('loading')}</>
                    ) : (
                      <>
                        <FileText size={14} className="mr-2" />
                        {t('loadTemplate')}
                      </>
                    )}
                  </button>
                  <button 
                    onClick={handleLoadDraft} 
                    className="header-dropdown-item"
                    disabled={isLoadingDraft}
                  >
                    {isLoadingDraft ? (
                      <><Loader2 size={14} className="animate-spin mr-2" /> {t('loading')}</>
                    ) : (
                      <>
                        <FileUp size={14} className="mr-2" />
                        {t('loadDraft')}
                      </>
                    )}
                  </button>
                  <button 
                    onClick={handleLoadImageDraft} 
                    className="header-dropdown-item"
                    disabled={isLoadingImageDraft}
                  >
                    {isLoadingImageDraft ? (
                      <><Loader2 size={14} className="animate-spin mr-2" /> {t('loading')}</>
                    ) : (
                      <>
                        <Image size={14} className="mr-2" />
                        {t('loadImageDraft')}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            
            {/* 下载文档下拉菜单 */}
            <div className="header-dropdown-container" ref={downloadDropdownRef}>
              <button
                onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                className="header-dropdown-button"
                title={t('downloadDoc')}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 size={20} className="animate-spin mr-2" />
                ) : (
                  <Download size={20} className="mr-2" />
                )}
                <span>{t('downloadDoc')}</span>
                <ChevronDown size={14} className="ml-1" />
              </button>
              
              {showDownloadDropdown && (
                <div className="header-dropdown-menu">
                  <button 
                    onClick={handleExportWord} 
                    className="header-dropdown-item"
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <><Loader2 size={14} className="animate-spin mr-2" /> {t('loading')}</>
                    ) : (
                      <>
                        <FileText size={14} className="mr-2" />
                        {t('exportWord')}
                      </>
                    )}
                  </button>
                  <button 
                    onClick={handleExportMarkdown} 
                    className="header-dropdown-item"
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <><Loader2 size={14} className="animate-spin mr-2" /> {t('loading')}</>
                    ) : (
                      <>
                        <FileText size={14} className="mr-2" />
                        {t('exportMarkdown')}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="min-h-[calc(100vh-200px)]">
            <TiptapEditor 
              content={content} 
              onChange={handleChange}
              className="h-full"
              onReady={handleEditorReady}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
