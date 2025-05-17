'use client';

import React, { useState, useRef, useEffect } from 'react';
import { TiptapEditor } from '@/app/components/TiptapEditor';
import { 
  FileUp, 
  ChevronDown, 
  Loader2,
  FileText
} from 'lucide-react';
import { useSystemStore } from '@/lib/stores/system-store';
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store';
import { 
  loadTemplate, 
  loadDraft, 
  showToast 
} from '@/app/components/TiptapEditor/EditorToolbar';

// 导入CSS样式
import '@/app/components/TiptapEditor/styles.css';

export default function BookWritingPage() {
  const [content, setContent] = useState('<p>请在此处开始编写您的需求文档...</p>');
  
  // 编辑器引用
  const editorRef = useRef<any>(null);
  
  // 下拉菜单状态
  const [showContentDropdown, setShowContentDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // 加载状态
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  
  // 获取系统和需求分析状态
  const { selectedSystemId } = useSystemStore();
  const { getActiveRequirementBook } = useRequirementAnalysisStore();
  
  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowContentDropdown(false);
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
  
  // 处理加载需求模板
  const handleLoadTemplate = async () => {
    if (!editorRef.current) {
      showToast('编辑器未准备好', 'error');
      return;
    }
    
    setIsLoadingTemplate(true);
    try {
      await loadTemplate(editorRef.current, selectedSystemId);
    } finally {
      setIsLoadingTemplate(false);
      setShowContentDropdown(false);
    }
  };
  
  // 处理加载需求初稿
  const handleLoadDraft = () => {
    if (!editorRef.current) {
      showToast('编辑器未准备好', 'error');
      return;
    }
    
    setIsLoadingDraft(true);
    try {
      loadDraft(editorRef.current, getActiveRequirementBook);
    } finally {
      setIsLoadingDraft(false);
      setShowContentDropdown(false);
    }
  };

  return (
    <div className="mx-auto py-6 w-[90%]">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">需求书撰写</h1>
            <p className="text-muted-foreground text-sm mt-2">
              使用下方编辑器创建或编辑您的需求文档。提供丰富的文本编辑工具，帮助您精确表达需求内容。
            </p>
          </div>
          
          {/* 内容加载下拉菜单 */}
          <div className="header-dropdown-container" ref={dropdownRef}>
            <button
              onClick={() => setShowContentDropdown(!showContentDropdown)}
              className="header-dropdown-button"
              title="内容加载"
              disabled={isLoadingTemplate || isLoadingDraft}
            >
              {(isLoadingTemplate || isLoadingDraft) ? (
                <Loader2 size={20} className="animate-spin mr-2" />
              ) : (
                <FileText size={20} className="mr-2" />
              )}
              <span>内容加载</span>
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
                    <><Loader2 size={14} className="animate-spin mr-2" /> 加载中...</>
                  ) : (
                    <>
                      <FileText size={14} className="mr-2" />
                      加载需求模板
                    </>
                  )}
                </button>
                <button 
                  onClick={handleLoadDraft} 
                  className="header-dropdown-item"
                  disabled={isLoadingDraft}
                >
                  {isLoadingDraft ? (
                    <><Loader2 size={14} className="animate-spin mr-2" /> 加载中...</>
                  ) : (
                    <>
                      <FileUp size={14} className="mr-2" />
                      加载需求初稿
                    </>
                  )}
                </button>
              </div>
            )}
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
