'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BubbleMenu as TiptapBubbleMenu, Editor } from '@tiptap/react';
import { 
  Wand2, 
  FileText, 
  Maximize2, 
  MessageSquare,
  AlertTriangle,
  Scissors,
  LayoutPanelTop
} from 'lucide-react';
import { useSystemStore } from '@/lib/stores/system-store';
import { useTranslations } from 'next-intl';
import { ResultPanel } from './ResultComponents';
import type { ResultState } from './ResultPanel';
// 导入新创建的客户端服务
import { useEditorActions } from '@/lib/services/editor-actions-client';
import type { EditorActionType } from '@/lib/services/editor-action-api-client';

interface BubbleMenuProps {
  editor: Editor;
}

export const BubbleMenu: React.FC<BubbleMenuProps> = ({ editor }) => {
  const { selectedSystemId } = useSystemStore();
  
  const [result, setResult] = useState<ResultState>({
    loading: false,
    content: '',
    visible: false,
    position: { x: 0, y: 0 },
    type: null,
    size: { width: 800, height: 600 },
    instruction: '',
    selectedText: '',
    selectionRange: undefined,
    reasoning: '',
    isSlowThinking: false
  });
  const resultRef = useRef<HTMLDivElement>(null);
  const instructionInputRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{ isDragging: boolean, startX: number, startY: number }>({
    isDragging: false,
    startX: 0,
    startY: 0
  });
  // 添加大小调整的ref
  const resizeRef = useRef<{ isResizing: boolean, startWidth: number, startHeight: number, startX: number, startY: number }>({
    isResizing: false,
    startWidth: 0,
    startHeight: 0,
    startX: 0,
    startY: 0
  });
  const [selectedText, setSelectedText] = useState('');
  const [resultPanelOpen, setResultPanelOpen] = useState(false);
  const [resultPanelMode, setResultPanelMode] = 
    useState<'polish' | 'expand' | 'chat' | 'boundary-analysis' | 'boundary-optimize'>('polish');
  const [chatMode, setChatMode] = useState(false);
  const [reasoningVisible, setReasoningVisible] = useState(true); // 控制思考过程的显示/隐藏
  const t = useTranslations('TiptapEditor');
  const tReasoning = useTranslations('ReasoningSection');

  // 重置结果状态
  const resetResult = () => {
    // 确保清除任何残留的高亮
    if (result.selectionRange) {
      try {
        const { from, to } = result.selectionRange;
        editor.commands.setTextSelection({ from, to });
        editor.commands.unsetMark('highlight');
        
        // 确保取消选择
        editor.commands.setTextSelection({ from: from, to: from });
      } catch (e) {
        console.warn("清除高亮时出错:", e);
      }
    }
    
    // 为了安全起见，再次全局清除所有highlight标记
    try {
      // 先暂存当前光标位置
      const { from } = editor.state.selection;
      // 尝试清除整个文档中的所有highlight标记
      editor.commands.unsetMark('highlight');
      // 恢复光标位置
      editor.commands.setTextSelection({ from, to: from });
    } catch (e) {
      console.warn("全局清除高亮时出错:", e);
    }
    
    setResult({
      loading: false,
      content: '',
      visible: false,
      position: { x: 0, y: 0 },
      type: null,
      size: { width: 800, height: 600 },
      instruction: '',
      selectedText: '',
      selectionRange: undefined,
      reasoning: '',
      isSlowThinking: false
    });
    setReasoningVisible(true);
  };

  // 计算结果框的初始位置
  const calculatePosition = () => {
    if (window) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // 获取视口尺寸
        const viewportWidth = window.innerWidth;
        
        // 查找bubble menu元素，将浮窗显示在它的下方
        const bubbleMenu = document.querySelector('.bubble-menu');
        if (bubbleMenu) {
          const bubbleRect = bubbleMenu.getBoundingClientRect();
          
          // 计算左侧位置，确保居中
          const initialWidth = Math.min(viewportWidth * 0.9, 1200);
          
          // 计算左侧位置，考虑左侧sidebar
          const minLeftPosition = 260; // 假设左侧sidebar宽度为250px，留一些间距
          // 尝试居中，但不小于最小左侧位置
          let left = Math.max(minLeftPosition, bubbleRect.left + (bubbleRect.width / 2) - (initialWidth / 2));
          
          // 确保不超出右侧边界
          if (left + initialWidth > viewportWidth) {
            left = Math.max(minLeftPosition, viewportWidth - initialWidth - 20);
          }
          
          // 使用固定定位，返回相对于视口的坐标
          // 始终将浮窗放在气泡菜单下方
          return { 
            x: left,
            y: bubbleRect.bottom + 10, // 10px的偏移量
            useFixed: true
          };
        }
        
        // 如果找不到bubble menu，则回退到选择区域
        // 计算左侧位置，确保居中
        const initialWidth = Math.min(viewportWidth * 0.9, 1200);
        let left = Math.max(0, rect.left - (initialWidth - rect.width) / 2);
        
        // 限制左侧位置，考虑左侧sidebar
        left = Math.max(260, left); // 260px考虑左侧sidebar宽度
        
        return { 
          x: left,
          y: rect.top - 10, // 在选中区域上方显示
          useFixed: true
        };
      }
    }
    return { x: 0, y: 0, useFixed: false };
  };

  // 使用编辑器操作客户端
  const editorActions = useEditorActions({
    editor,
    result,
    setResult,
    systemId: selectedSystemId,
    resetResult,
    setReasoningVisible,
    reasoningVisible,
    calculatePosition,
    t
  });

  // 简化后的处理函数
  const handlePolish = () => editorActions.handleAction('polish');
  const handleExpand = () => editorActions.handleAction('expand');
  const handleBoundaryAnalysis = () => editorActions.handleAction('boundary');
  const handleBoundaryOptimize = () => editorActions.handleAction('optimize');
  const handleFastChat = () => editorActions.handleFastChat();
  const handleSlowChat = () => editorActions.handleSlowChat();
  const handleScenarioRecognition = () => editorActions.handleAction('scenario');
  
  // 指令输入变化处理
  const handleInstructionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResult(prev => ({
      ...prev,
      instruction: e.target.value
    }));
  };

  // 处理拖动结果框
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === resultRef.current?.querySelector('.result-drag-handle')) {
      dragRef.current.isDragging = true;
      dragRef.current.startX = e.clientX - result.position.x;
      dragRef.current.startY = e.clientY - result.position.y;
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (dragRef.current.isDragging) {
      setResult(prev => ({
        ...prev,
        position: {
          x: e.clientX - dragRef.current.startX,
          y: e.clientY - dragRef.current.startY
        }
      }));
    }
  };

  const handleMouseUp = () => {
    dragRef.current.isDragging = false;
  };

  // 修复调整大小功能
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 确保size一定有值，使用默认值800/300
    const currentSize = result.size || { width: 800, height: 300 };
    
    // 设置调整大小状态
    resizeRef.current.isResizing = true;
    resizeRef.current.startWidth = currentSize.width;
    resizeRef.current.startHeight = currentSize.height;
    resizeRef.current.startX = e.clientX;
    resizeRef.current.startY = e.clientY;
    
    // 添加类以显示正在调整大小
    document.body.style.cursor = 'se-resize';
    document.body.style.userSelect = 'none'; // 防止拖动时选择文本
    
    // 高亮调整大小指示器
    const resizeIndicator = resultRef.current?.querySelector('.resize-indicator') as HTMLElement;
    if (resizeIndicator) {
      resizeIndicator.style.color = '#ef6c00';
      resizeIndicator.style.backgroundColor = '#f8fafc';
      resizeIndicator.style.borderColor = '#ef6c00';
    }
    
    console.log('开始调整大小', { 
      startWidth: resizeRef.current.startWidth,
      startHeight: resizeRef.current.startHeight,
      startX: resizeRef.current.startX,
      startY: resizeRef.current.startY
    });
  };
  
  const handleResizeMove = (e: MouseEvent) => {
    if (!resizeRef.current.isResizing) return;
    
    // 计算新的宽度和高度
    const deltaWidth = e.clientX - resizeRef.current.startX;
    const deltaHeight = e.clientY - resizeRef.current.startY;
    
    const newWidth = Math.max(300, resizeRef.current.startWidth + deltaWidth); // 最小宽度300px
    const newHeight = Math.max(200, resizeRef.current.startHeight + deltaHeight); // 最小高度200px
    
    // 更新状态
    setResult(prev => ({
      ...prev,
      size: { width: newWidth, height: newHeight }
    }));
    
  };
  
  const handleResizeEnd = () => {
    if (resizeRef.current.isResizing) {
      resizeRef.current.isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // 恢复调整大小指示器的默认样式
      const resizeIndicator = resultRef.current?.querySelector('.resize-indicator') as HTMLElement;
      if (resizeIndicator) {
        resizeIndicator.style.color = '';
        resizeIndicator.style.backgroundColor = '';
        resizeIndicator.style.borderColor = '';
      }
      
      console.log('结束调整大小', { 
        finalWidth: result.size?.width,
        finalHeight: result.size?.height
      });
    }
  };

  // 在已有的useEffect中添加resize相关的事件监听
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    // 添加调整大小相关的事件监听
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      // 移除调整大小相关的事件监听
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  // 在组件内添加ESC键监听和组件卸载时清理逻辑
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && result.visible) {
        // 清除所有高亮
        if (result.selectionRange) {
          const { from, to } = result.selectionRange;
          try {
            editor.commands.setTextSelection({ from, to });
            editor.commands.unsetMark('highlight');
            // 确保取消选择
            editor.commands.setTextSelection({ from: from, to: from });
          } catch (e) {
            console.warn("ESC键清除高亮时出错:", e);
          }
        }
        resetResult();
      }
    };
    
    // 添加事件监听
    document.addEventListener('keydown', handleEscKey);
    
    // 组件卸载时清理
    return () => {
      document.removeEventListener('keydown', handleEscKey);
      
      // 清除所有可能的高亮
      try {
        // 尝试清除所有的highlight标记
        editor.commands.unsetMark('highlight');
        
        // 如果有保存的选择范围，尝试特定清除
        if (result.selectionRange) {
          const { from, to } = result.selectionRange;
          editor.commands.setTextSelection({ from, to });
          editor.commands.unsetMark('highlight');
        }
      } catch (e) {
        console.warn("组件卸载时清除高亮出错:", e);
      }
    };
  }, [result.visible, result.selectionRange]);

  // 修复handleToggleMaxHeight函数的类型错误
  const handleToggleMaxHeight = () => {
    const currentHeight = result.size?.height || 600;
    const currentWidth = result.size?.width || 800;
    // 在三种预设高度之间切换：正常(600px)、高(800px)、超高(1000px)
    let newHeight = 600; // 默认正常高度
    
    if (currentHeight < 700) {
      newHeight = 800; // 切换到高
    } else if (currentHeight < 900) {
      newHeight = 1000; // 切换到超高
    } // 否则回到默认高度
    
    setResult(prev => ({
      ...prev,
      size: { width: currentWidth, height: newHeight }
    }));
  };

  return (
    <>
      <TiptapBubbleMenu 
        editor={editor}
        tippyOptions={{ 
          duration: 200,
          placement: 'top'
        }}
        shouldShow={({ editor }) => {
          // 只要有内容被选中就显示气泡菜单，不再限制只在段落中显示
          return editor.state.selection.content().size > 0;
        }}
      >
        <div className="bubble-menu">
          <div className="bubble-menu-content">
            {/* 一级菜单：通用 */}
            <div className="bubble-menu-dropdown">
              <button className="bubble-menu-button primary-button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{t('bubbleMenu.common')}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="bubble-submenu">
                <button 
                  onClick={handlePolish} 
                  className="bubble-menu-button"
                  title={t('bubbleMenu.polishTooltip')}
                >
                  <Wand2 size={16} />
                  <span>{t('bubbleMenu.polish')}</span>
                </button>
                <button 
                  onClick={handleExpand} 
                  className="bubble-menu-button"
                  title={t('bubbleMenu.expandTooltip')}
                >
                  <FileText size={16} />
                  <span>{t('bubbleMenu.expand')}</span>
                </button>
              </div>
            </div>
            
            {/* 一级菜单：需求改写 */}
            <div className="bubble-menu-dropdown">
              <button className="bubble-menu-button primary-button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 4H4V11H11V4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20 4H13V11H20V4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M11 13H4V20H11V13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20 13H13V20H20V13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{t('bubbleMenu.requirementRewrite')}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="bubble-submenu">
                <button 
                  onClick={handleScenarioRecognition} 
                  className="bubble-menu-button"
                  title={t('bubbleMenu.scenarioRecognitionTooltip')}
                >
                  <LayoutPanelTop size={16} />
                  <span>{t('bubbleMenu.scenarioRecognition')}</span>
                </button>
                <button 
                  onClick={handleBoundaryAnalysis} 
                  className="bubble-menu-button"
                  title={t('bubbleMenu.boundaryAnalysisTooltip')}
                >
                  <AlertTriangle size={16} />
                  <span>{t('bubbleMenu.boundaryAnalysis')}</span>
                </button>
                <button 
                  onClick={handleBoundaryOptimize} 
                  className="bubble-menu-button"
                  title={t('bubbleMenu.boundaryOptimizeTooltip')}
                >
                  <Scissors size={16} />
                  <span>{t('bubbleMenu.boundaryOptimize')}</span>
                </button>
                
              </div>
            </div>
            
            {/* 修改：一级菜单变为二级菜单 - 与AI对话 */}
            <div className="bubble-menu-dropdown">
              <button 
                className="bubble-menu-button primary-button"
                title={t('bubbleMenu.chatTooltip')}
              >
                <MessageSquare size={16} />
                <span>{t('bubbleMenu.chat')}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="bubble-submenu">
                <button 
                  onClick={handleFastChat} 
                  className="bubble-menu-button"
                  title={t('bubbleMenu.fastThinkingTooltip')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{t('bubbleMenu.fastThinking')}</span>
                </button>
                <button 
                  onClick={handleSlowChat} 
                  className="bubble-menu-button"
                  title={t('bubbleMenu.slowThinkingTooltip')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 17V17.01M12 14C12 11.7909 13.7909 10 16 10C18.2091 10 20 11.7909 20 14C20 15.2101 19.4128 16.2982 18.5 17M12 14C12 11.7909 10.2091 10 8 10C5.79086 10 4 11.7909 4 14C4 15.2101 4.58716 16.2982 5.5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{t('bubbleMenu.slowThinking')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </TiptapBubbleMenu>

      {result.visible && (
        <div 
          ref={resultRef}
          className="polish-result-container"
          style={{ 
            left: `${result.position.x}px`, 
            top: `${result.position.y}px`,
            width: `${result.size?.width || 800}px`, // 确保width始终有值
            height: `${result.size?.height || 300}px`, // 确保height始终有值
            position: result.position.useFixed ? 'fixed' : 'absolute',
            overflow: 'auto'
          }}
          onMouseDown={handleMouseDown}
        >
          <div className="result-drag-handle">
            <div className="drag-handle-icon"></div>
          </div>
          <div className="polish-result-content">
            {/* 使用我们的新组件替换原来的结果面板 */}
            <ResultPanel 
              result={result}
              reasoningVisible={reasoningVisible}
              onToggleReasoning={editorActions.handleToggleReasoning}
              onCopy={editorActions.handleCopy}
              onCopyReasoning={editorActions.handleCopyReasoning}
              onReject={editorActions.handleReject}
              onReExecute={editorActions.handleReExecute}
              onAppend={editorActions.handleAppend}
              onReplace={editorActions.handleReplace}
              onToggleMaxHeight={handleToggleMaxHeight}
              onInstructionSubmit={editorActions.handleSubmitChat}
              onInstructionChange={handleInstructionChange}
              t={t}
              tReasoning={tReasoning}
            />
          </div>
          
          {/* 添加大小调整控件 */}
          <div 
            className="resize-indicator" 
            onMouseDown={handleResizeStart}
          >
            <Maximize2 size={14} />
          </div>
        </div>
      )}
    </>
  );
}; 