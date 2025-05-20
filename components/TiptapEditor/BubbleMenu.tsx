'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BubbleMenu as TiptapBubbleMenu, Editor } from '@tiptap/react';
import { 
  Wand2, 
  Loader2, 
  Check, 
  X, 
  Plus, 
  FileText, 
  Maximize2, 
  MessageSquare,
  Copy,
  RefreshCw,
  Send,
  AlertTriangle,
  Scissors,
  ClipboardCheck
} from 'lucide-react';
import { useSystemStore } from '@/lib/stores/system-store';
import { markdownToHtml } from '@/lib/utils/markdown-utils';
import { 
  polishText, 
  expandText, 
  analyzeBoundary, 
  optimizeBoundary, 
  chatWithAI 
} from '@/lib/services/editor-action-service';

interface BubbleMenuProps {
  editor: Editor;
}

interface ResultState {
  loading: boolean;
  content: string;
  visible: boolean;
  position: { x: number, y: number, useFixed?: boolean };
  type: 'polish' | 'expand' | 'chat' | 'boundary' | 'optimize' | null;
  size?: { width: number, height: number };
  instruction?: string; // 用户输入的指令
  selectedText?: string; // 选中的文本
  selectionRange?: { from: number, to: number }; // 保存选择范围以便后续清除高亮
}

export const BubbleMenu: React.FC<BubbleMenuProps> = ({ editor }) => {
  const { selectedSystemId } = useSystemStore();
  
  const [result, setResult] = useState<ResultState>({
    loading: false,
    content: '',
    visible: false,
    position: { x: 0, y: 0 },
    type: null,
    size: { width: 800, height: 300 },
    instruction: '',
    selectedText: '',
    selectionRange: undefined
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

  // 重置结果状态
  const resetResult = () => {
    setResult({
      loading: false,
      content: '',
      visible: false,
      position: { x: 0, y: 0 },
      type: null,
      size: { width: 800, height: 300 },
      instruction: '',
      selectedText: '',
      selectionRange: undefined
    });
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

  // 处理润色文本
  const handlePolish = async () => {
    // 获取选中的文本
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    const fullText = editor.getText();
    
    if (!selectedText) return;

    // 计算结果框的初始位置
    const position = calculatePosition();
    
    // 设置状态
    setResult({
      loading: true,
      content: '',
      visible: true,
      position,
      type: 'polish',
      size: { width: 800, height: 300 },
      selectedText,
      selectionRange: { from, to } // 保存选择范围
    });

    try {
      // 使用service调用API
      await polishText(
        selectedText, 
        fullText, 
        selectedSystemId,
        // 进度回调
        (content) => {
          setResult(prev => ({ 
            ...prev, 
            loading: false,
            content
          }));
        },
        // 错误回调
        (error) => {
          setResult(prev => ({ 
            ...prev, 
            loading: false, 
            content: `润色过程出现错误，请重试：${error}`
          }));
        }
      );
    } catch (error) {
      console.error('润色请求失败:', error);
    }
  };

  // 处理扩写文本
  const handleExpand = async () => {
    // 获取选中的文本
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    const fullText = editor.getText();
    
    if (!selectedText) return;

    // 计算结果框的初始位置
    const position = calculatePosition();
    
    // 设置状态
    setResult({
      loading: true,
      content: '',
      visible: true,
      position,
      type: 'expand',
      size: { width: 1000, height: 300 },
      selectedText,
      selectionRange: { from, to } // 保存选择范围
    });

    try {
      // 使用service调用API
      await expandText(
        selectedText, 
        fullText, 
        selectedSystemId,
        // 进度回调
        (content) => {
          setResult(prev => ({ 
            ...prev, 
            loading: false,
            content
          }));
        },
        // 错误回调
        (error) => {
          setResult(prev => ({ 
            ...prev, 
            loading: false, 
            content: `扩写过程出现错误，请重试：${error}`
          }));
        }
      );
    } catch (error) {
      console.error('扩写请求失败:', error);
    }
  };

  // 处理与AI对话
  const handleChat = async () => {
    // 获取选中的文本
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    
    if (!selectedText) return;

    // 计算结果框的初始位置
    const position = calculatePosition();
    
    // 高亮选中文本
    editor.commands.setTextSelection({ from, to });
    editor.commands.setMark('highlight', { color: '#FFF3E0' });
    
    // 设置状态为指令输入模式
    setResult({
      loading: false,
      content: '',
      visible: true,
      position,
      type: 'chat',
      size: { width: 800, height: 300 },
      instruction: '',
      selectedText,
      selectionRange: { from, to } // 保存选择范围以便后续清除高亮
    });

    // 聚焦指令输入框
    setTimeout(() => {
      instructionInputRef.current?.focus();
    }, 100);
  };

  // 处理ChatWithAI请求，修复流式显示问题
  const handleSubmitChat = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    if (!result.instruction?.trim() || !result.selectedText) return;

    setResult(prev => ({
      ...prev,
      loading: true,
      content: '', // 确保在开始新请求时清空之前的内容
    }));

    try {
      // 使用service调用API
      await chatWithAI(
        result.instruction,
        result.selectedText,
        selectedSystemId,
        // 进度回调
        (content) => {
          setResult(prev => ({ 
            ...prev, 
            loading: false,
            content
          }));
        },
        // 错误回调
        (error) => {
          setResult(prev => ({ 
            ...prev, 
            loading: false, 
            content: `对话过程出现错误，请重试：${error}`
          }));
        }
      );
    } catch (error) {
      console.error('AI对话请求失败:', error);
    }
  };

  // 处理边界分析
  const handleBoundary = async () => {
    // 获取选中的文本
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    const fullText = editor.getText();
    
    if (!selectedText) return;

    // 计算结果框的初始位置
    const position = calculatePosition();
    
    // 设置状态
    setResult({
      loading: true,
      content: '',
      visible: true,
      position,
      type: 'boundary',
      size: { width: 800, height: 300 },
      selectedText,
      selectionRange: { from, to } // 保存选择范围
    });

    try {
      // 使用service调用API
      await analyzeBoundary(
        selectedText, 
        fullText, 
        selectedSystemId,
        // 进度回调
        (content) => {
          setResult(prev => ({ 
            ...prev, 
            loading: false,
            content
          }));
        },
        // 错误回调
        (error) => {
          setResult(prev => ({ 
            ...prev, 
            loading: false, 
            content: `边界分析过程出现错误，请重试：${error}`
          }));
        }
      );
    } catch (error) {
      console.error('边界分析请求失败:', error);
    }
  };

  // 处理边界优化
  const handleOptimize = async () => {
    // 获取选中的文本
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    const fullText = editor.getText();
    
    if (!selectedText) return;

    // 计算结果框的初始位置
    const position = calculatePosition();
    
    // 设置状态
    setResult({
      loading: true,
      content: '',
      visible: true,
      position,
      type: 'optimize',
      size: { width: 800, height: 300 },
      selectedText,
      selectionRange: { from, to } // 保存选择范围
    });

    try {
      // 使用service调用API
      await optimizeBoundary(
        selectedText, 
        fullText, 
        selectedSystemId,
        // 进度回调
        (content) => {
          setResult(prev => ({ 
            ...prev, 
            loading: false,
            content
          }));
        },
        // 错误回调
        (error) => {
          setResult(prev => ({ 
            ...prev, 
            loading: false, 
            content: `边界优化过程出现错误，请重试：${error}`
          }));
        }
      );
    } catch (error) {
      console.error('边界优化请求失败:', error);
    }
  };

  // 处理重新执行
  const handleReExecute = () => {
    if (!result.selectedText) return;
    
    // 如果有保存的选择范围，恢复选择
    if (result.selectionRange) {
      const { from, to } = result.selectionRange;
      editor.commands.setTextSelection({ from, to });
    }
    
    switch (result.type) {
      case 'chat':
        if (result.instruction) {
          handleSubmitChat();
        }
        break;
      case 'polish':
        handlePolish();
        break;
      case 'expand':
        handleExpand();
        break;
      case 'boundary':
        handleBoundary();
        break;
      case 'optimize':
        handleOptimize();
        break;
    }
  };

  // 处理复制内容
  const handleCopy = () => {
    if (!result.content) return;
    
    navigator.clipboard.writeText(result.content)
      .then(() => {
        // 1. 显示屏幕中间的复制成功提示
        const copyTip = document.createElement('div');
        copyTip.className = 'copy-success-tip';
        copyTip.textContent = '复制成功';
        document.body.appendChild(copyTip);
        
        setTimeout(() => {
          copyTip.classList.add('fade-out');
          setTimeout(() => {
            document.body.removeChild(copyTip);
          }, 300);
        }, 1500);
        
        // 2. 在按钮上显示临时状态变化
        const copyButton = document.querySelector('.polish-actions .copy') as HTMLButtonElement;
        if (copyButton) {
          // 保存原始内容
          const originalHTML = copyButton.innerHTML;
          const originalTitle = copyButton.title;
          
          // 修改为成功状态
          copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>已复制</span>';
          copyButton.title = '已复制到剪贴板';
          copyButton.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
          copyButton.style.color = '#10b981';
          copyButton.style.borderColor = '#10b981';
          
          // 恢复原始状态
          setTimeout(() => {
            copyButton.innerHTML = originalHTML;
            copyButton.title = originalTitle;
            copyButton.style.backgroundColor = '';
            copyButton.style.color = '';
            copyButton.style.borderColor = '';
          }, 2000);
        }
      })
      .catch(err => {
        console.error('复制失败:', err);
        
        // 显示失败提示
        const copyErrorTip = document.createElement('div');
        copyErrorTip.className = 'copy-success-tip';
        copyErrorTip.textContent = '复制失败';
        copyErrorTip.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
        document.body.appendChild(copyErrorTip);
        
        setTimeout(() => {
          copyErrorTip.classList.add('fade-out');
          setTimeout(() => {
            document.body.removeChild(copyErrorTip);
          }, 300);
        }, 1500);
      });
  };

  // 处理替换原文
  const handleReplace = () => {
    if (!result.content) return;
    
    // 将markdown转换为HTML
    const htmlContent = markdownToHtml(result.content);
    
    const { from, to } = editor.state.selection;
    editor.chain().focus().deleteRange({ from, to }).insertContent(htmlContent).run();
    resetResult();
  };

  // 处理在原文后添加
  const handleAppend = () => {
    if (!result.content) return;
    
    // 将markdown转换为HTML
    const htmlContent = markdownToHtml(result.content);
    
    const { to } = editor.state.selection;
    editor.chain().focus().insertContentAt(to, htmlContent).run();
    resetResult();
  };

  // 处理拒绝
  const handleReject = () => {
    // 如果是聊天模式且有选择范围，移除高亮
    if (result.type === 'chat' && result.selectionRange) {
      const { from, to } = result.selectionRange;
      editor.commands.setTextSelection({ from, to });
      editor.commands.unsetMark('highlight');
    }
    resetResult();
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

  // 修改handleResizeStart函数
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
  };
  
  // 修改handleResizeMove函数
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

  // 获取当前操作类型的显示标题
  const getResultTitle = () => {
    switch (result.type) {
      case 'polish': return '润色结果';
      case 'expand': return '扩写结果';
      case 'chat': return result.loading || result.content ? 'AI回复' : '与AI对话';
      case 'boundary': return '边界分析结果';
      case 'optimize': return '边界优化结果';
      default: return '处理结果';
    }
  };

  // 获取加载中的显示文本
  const getLoadingText = () => {
    switch (result.type) {
      case 'polish': return '正在润色中...';
      case 'expand': return '正在扩写中...';
      case 'chat': return '正在思考中...';
      case 'boundary': return '正在分析边界条件...';
      case 'optimize': return '正在优化场景需求...';
      default: return '处理中...';
    }
  };
  
  // 格式化文本内容，保留换行和空格
  const formatContent = (content: string) => {
    if (!content) return '';
    
    // 替换换行符为<br>标签
    let formatted = content.replace(/\n/g, '<br />');
    
    // 保留连续空格
    formatted = formatted.replace(/ {2,}/g, (match) => {
      return '&nbsp;'.repeat(match.length);
    });
    
    // 保留制表符
    formatted = formatted.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
    
    return formatted;
  };

  // 处理指令输入变化
  const handleInstructionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResult(prev => ({
      ...prev,
      instruction: e.target.value
    }));
  };

  // 在组件内添加ESC键监听
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && result.visible) {
        // 如果是聊天模式且有选择范围，移除高亮
        if (result.type === 'chat' && result.selectionRange) {
          const { from, to } = result.selectionRange;
          editor.commands.setTextSelection({ from, to });
          editor.commands.unsetMark('highlight');
        }
        resetResult();
      }
    };
    
    // 添加事件监听
    document.addEventListener('keydown', handleEscKey);
    
    // 组件卸载时移除事件监听
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [result.visible, result.type, result.selectionRange]);

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
          <button 
            onClick={handlePolish}
            className="bubble-menu-button"
            title="润色文本"
            data-tooltip="使用AI智能润色和优化选中的文本"
          >
            <Wand2 size={16} />
            <span>润色</span>
          </button>
          <div className="bubble-menu-divider"></div>
          <button 
            onClick={handleExpand}
            className="bubble-menu-button"
            title="扩写文本"
            data-tooltip="基于选中内容进行扩展和丰富写作"
          >
            <FileText size={16} />
            <span>扩写</span>
          </button>
          <div className="bubble-menu-divider"></div>
          <button 
            onClick={handleBoundary}
            className="bubble-menu-button"
            title="边界分析"
            data-tooltip="分析选中内容的边界条件和异常情况"
          >
            <AlertTriangle size={16} />
            <span>边界分析</span>
          </button>
          <div className="bubble-menu-divider"></div>
          <button 
            onClick={handleOptimize}
            className="bubble-menu-button"
            title="边界优化"
            data-tooltip="优化选中场景的边界条件和需求描述"
          >
            <Scissors size={16} />
            <span>边界优化</span>
          </button>
          <div className="bubble-menu-divider"></div>
          <button 
            onClick={handleChat}
            className="bubble-menu-button"
            title="与AI对话"
            data-tooltip="基于选中内容与AI进行对话和提问"
          >
            <MessageSquare size={16} />
            <span>Chat With LLM</span>
          </button>
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
            {result.loading ? (
              <div className="polish-loading">
                <Loader2 size={24} className="animate-spin" />
                <p>{getLoadingText()}</p>
              </div>
            ) : result.type === 'chat' && !result.content ? (
              <div className="chat-instruction-container">
                <h3 className="text-base font-medium text-orange-700 mb-3">与AI对话</h3>
                <form onSubmit={handleSubmitChat} className="chat-form">
                  <textarea
                    ref={instructionInputRef}
                    value={result.instruction || ''}
                    onChange={handleInstructionChange}
                    placeholder="输入指令，例如：根据选中文本帮我总结几个需求点"
                    className="chat-instruction-input full-width"
                  />
                  <div className="chat-actions">
                    <button 
                      type="button" 
                      onClick={handleReject}
                      className="chat-cancel-button"
                    >
                      <X size={18} />
                      <span>取消</span>
                    </button>
                    <button 
                      type="submit" 
                      className="chat-submit-button"
                      disabled={!result.instruction?.trim()}
                    >
                      <Send size={18} />
                      <span>发送</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                <h3 className="text-base font-medium text-orange-700 mb-3">{getResultTitle()}</h3>
                {result.type === 'chat' && result.instruction && (
                  <div className="chat-instruction-display">
                    <span className="font-medium">指令：</span> {result.instruction}
                  </div>
                )}
                <div 
                  className="polish-text"
                  dangerouslySetInnerHTML={{ __html: formatContent(result.content) }}
                />
                <div className="polish-actions">
                  <button 
                    onClick={handleReject}
                    className="polish-action-button reject"
                    title="关闭"
                  >
                    <X size={16} />
                    <span>关闭</span>
                  </button>
                  
                  <button 
                    onClick={handleCopy}
                    className="polish-action-button copy"
                    title="复制内容"
                    disabled={!result.content}
                  >
                    <Copy size={16} />
                    <span>复制</span>
                  </button>
                  
                  <button 
                    onClick={handleReplace}
                    className="polish-action-button replace"
                    title="替换"
                    disabled={!result.content}
                  >
                    <Check size={16} />
                    <span>替换</span>
                  </button>
                  
                  <button 
                    onClick={handleAppend}
                    className="polish-action-button append"
                    title="插入"
                    disabled={!result.content}
                  >
                    <Plus size={16} />
                    <span>插入</span>
                  </button>
                  
                  <button 
                    onClick={handleReExecute}
                    className="polish-action-button re-execute"
                    title="重跑"
                    disabled={(!result.instruction && result.type === 'chat') || !result.selectedText}
                  >
                    <RefreshCw size={16} />
                    <span>重跑</span>
                  </button>
                </div>
              </>
            )}
          </div>
          
          {/* 增强调整大小的视觉反馈 */}
          <div 
            className="resize-indicator"
            onMouseDown={handleResizeStart}
            style={{ cursor: 'se-resize', zIndex: 100 }}
          >
            <Maximize2 size={16} />
          </div>
          <div className="resize-hint">可拖动调整大小</div>
        </div>
      )}
    </>
  );
}; 