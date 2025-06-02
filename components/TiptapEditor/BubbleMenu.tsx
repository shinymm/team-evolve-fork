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
  ClipboardCheck,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useSystemStore } from '@/lib/stores/system-store';
import { markdownToHtml } from '@/lib/utils/markdown-utils';
import { 
  polishText, 
  expandText, 
  analyzeBoundary, 
  optimizeBoundary, 
  chatWithAI,
  chatWithAIReasoning
} from '@/lib/services/editor-action-service';
import { useTranslations } from 'next-intl';

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
  reasoning?: string; // 思考过程内容
  isSlowThinking?: boolean; // 是否为慢思考模式
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

  // 处理润色功能
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
      size: { width: 800, height: 600 },
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
          // 无论内容多少，收到第一个响应就把loading状态设为false
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
            content: `${t('resultPanel.polishing')}${error}`
          }));
        }
      );
    } catch (error) {
      console.error('润色请求失败:', error);
    }
  };

  // 处理扩写功能
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
      size: { width: 1000, height: 600 },
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
          // 无论内容多少，收到第一个响应就把loading状态设为false
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
            content: `${t('resultPanel.expanding')}${error}`
          }));
        }
      );
    } catch (error) {
      console.error('扩写请求失败:', error);
    }
  };

  // 处理边界分析功能
  const handleBoundaryAnalysis = async () => {
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
      size: { width: 800, height: 600 },
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
          // 无论内容多少，收到第一个响应就把loading状态设为false
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
            content: `${t('resultPanel.analyzingBoundary')}${error}`
          }));
        }
      );
    } catch (error) {
      console.error('边界分析请求失败:', error);
    }
  };

  // 处理边界优化功能
  const handleBoundaryOptimize = async () => {
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
      size: { width: 800, height: 600 },
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
          // 无论内容多少，收到第一个响应就把loading状态设为false
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
            content: `${t('resultPanel.optimizingScenario')}${error}`
          }));
        }
      );
    } catch (error) {
      console.error('边界优化请求失败:', error);
    }
  };

  // 修复handleFastChat为快速思考处理
  const handleFastChat = async () => {
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
      size: { width: 800, height: 600 }, // 已经是600px高度，保持不变
      instruction: '',
      selectedText,
      selectionRange: { from, to }, // 明确保存选择范围以便后续清除高亮
      reasoning: '',
      isSlowThinking: false
    });

    // 聚焦指令输入框
    setTimeout(() => {
      instructionInputRef.current?.focus();
    }, 100);
  };

  // 修改：慢思考处理
  const handleSlowChat = async () => {
    // 获取选中的文本
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    
    if (!selectedText) return;

    // 检查是否选择了系统
    if (!selectedSystemId) {
      // 使用提示框显示错误
      const errorTip = document.createElement('div');
      errorTip.className = 'error-tip';
      errorTip.textContent = t('notifications.selectSystemFirst');
      errorTip.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
      document.body.appendChild(errorTip);
      
      setTimeout(() => {
        errorTip.classList.add('fade-out');
        setTimeout(() => {
          document.body.removeChild(errorTip);
        }, 300);
      }, 2000);
      return;
    }

    // 计算结果框的初始位置
    const position = calculatePosition();
    
    // 高亮选中文本
    editor.commands.setTextSelection({ from, to });
    editor.commands.setMark('highlight', { color: '#FFF3E0' });
    
    // 设置状态为指令输入模式，标记为慢思考模式
    setResult({
      loading: false,
      content: '',
      visible: true,
      position,
      type: 'chat',
      size: { width: 800, height: 600 }, // 已经是600px高度，保持不变
      instruction: '',
      selectedText,
      selectionRange: { from, to }, // 明确保存选择范围以便后续清除高亮
      reasoning: '',
      isSlowThinking: true
    });

    // 重置思考过程显示状态
    setReasoningVisible(true);

    // 聚焦指令输入框
    setTimeout(() => {
      instructionInputRef.current?.focus();
    }, 100);
  };

  // 处理切换思考过程显示/隐藏
  const handleToggleReasoning = () => {
    setReasoningVisible(prev => !prev);
  };

  // 修改handleSubmitChat函数，确保思考过程一旦开始返回就停止loading状态
  const handleSubmitChat = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    // 验证输入
    if (!result.instruction?.trim()) {
      // 显示必须输入指令的提示
      const errorTip = document.createElement('div');
      errorTip.className = 'error-tip';
      errorTip.textContent = t('notifications.inputInstruction');
      errorTip.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
      document.body.appendChild(errorTip);
      
      setTimeout(() => {
        errorTip.classList.add('fade-out');
        setTimeout(() => {
          document.body.removeChild(errorTip);
        }, 300);
      }, 2000);
      return;
    }

    if (!result.selectedText) return;

    // 保存当前选择范围信息，以防处理过程中丢失
    const selectionRange = result.selectionRange;
    console.log("保存的选择范围:", selectionRange);

    // 准备指令和选中文本
    const instruction = result.instruction.trim();
    const selectedText = result.selectedText.trim();
    
    console.log(`提交${result.isSlowThinking ? '慢' : '快'}思考请求:`, {
      指令: instruction,
      选中文本长度: selectedText.length,
      选择范围: selectionRange
    });

    // 重置结果，并默认设置思考过程显示为true
    setResult(prev => ({
      ...prev,
      loading: true,
      content: '', // 确保在开始新请求时清空之前的内容
      reasoning: '', // 同时清空思考过程
      selectionRange // 保持选择范围不变
    }));
    
    // 默认显示思考过程区域
    setReasoningVisible(true);

    try {
      // 根据isSlowThinking决定使用哪个API
      if (result.isSlowThinking) {
        // 慢思考模式 - 使用推理API
        await chatWithAIReasoning(
          instruction,
          selectedText,
          null, // 不传递systemId，使用API内部的默认推理模型
          // 内容回调
          (content) => {
            setResult(prev => ({ 
              ...prev, 
              loading: false,  // 确保设置loading为false
              content,
              selectionRange // 保持选择范围
            }));
          },
          // 思考过程回调
          (reasoning) => {
            // 收到思考过程的第一个字符后，立即设置loading为false，显示结果页
            setResult(prev => ({ 
              ...prev, 
              loading: false,  // 关键：确保收到思考过程时立即停止loading
              reasoning,
              selectionRange // 保持选择范围
            }));
            // 确保思考过程可见
            setReasoningVisible(true);
          },
          // 错误回调
          (error) => {
            console.error('AI推理对话API错误:', error);
            setResult(prev => ({ 
              ...prev, 
              loading: false, 
              content: `${t('resultPanel.thinking')}${error}`,
              selectionRange // 保持选择范围
            }));
          }
        );
      } else {
        // 快思考模式 - 使用现有API
        await chatWithAI(
          instruction,
          selectedText,
          selectedSystemId,
          // 进度回调
          (content) => {
            setResult(prev => ({ 
              ...prev, 
              loading: false,
              content,
              selectionRange // 保持选择范围
            }));
          },
          // 错误回调
          (error) => {
            console.error('快思考API错误:', error);
            setResult(prev => ({ 
              ...prev, 
              loading: false, 
              content: `${t('resultPanel.thinking')}${error}`,
              selectionRange // 保持选择范围
            }));
          }
        );
      }
    } catch (error) {
      console.error(`${result.isSlowThinking ? '慢' : '快'}思考请求失败:`, error);
      setResult(prev => ({
        ...prev,
        loading: false,
        content: `请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
        selectionRange // 保持选择范围
      }));
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
        handleBoundaryAnalysis();
        break;
      case 'optimize':
        handleBoundaryOptimize();
        break;
    }
  };

  // 处理复制内容
  const handleCopy = () => {
    // 确保有内容可复制
    if (!result.content && !result.isSlowThinking) return;
    
    // 选择要复制的内容
    const contentToCopy = result.content || ''; // 只复制最终内容，不复制思考过程
    
    navigator.clipboard.writeText(contentToCopy)
      .then(() => {
        // 1. 显示屏幕中间的复制成功提示
        const copyTip = document.createElement('div');
        copyTip.className = 'copy-success-tip';
        copyTip.textContent = t('notifications.copySuccess');
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
          copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>' + t('notifications.copySuccess') + '</span>';
          copyButton.title = t('notifications.copySuccess');
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
        copyErrorTip.textContent = t('notifications.copyFailed');
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

  // 处理拒绝
  const handleReject = () => {
    // 如果是聊天模式且有选择范围，移除高亮
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

  // 获取当前操作类型的显示标题
  const getResultTitle = () => {
    switch (result.type) {
      case 'polish': return t('resultPanel.polishResult');
      case 'expand': return t('resultPanel.expandResult');
      case 'chat': return result.loading || result.content ? t('resultPanel.aiReply') : t('resultPanel.chatWithAI');
      case 'boundary': return t('resultPanel.boundaryAnalysisResult');
      case 'optimize': return t('resultPanel.boundaryOptimizeResult');
      default: return t('resultPanel.processingResult');
    }
  };

  // 获取加载中的显示文本
  const getLoadingText = () => {
    switch (result.type) {
      case 'polish': return t('resultPanel.polishing');
      case 'expand': return t('resultPanel.expanding');
      case 'chat': return t('resultPanel.thinking');
      case 'boundary': return t('resultPanel.analyzingBoundary');
      case 'optimize': return t('resultPanel.optimizingScenario');
      default: return t('resultPanel.processing');
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

  // 新增：复制思考过程的功能
  const handleCopyReasoning = () => {
    // 确保有思考过程可复制
    if (!result.reasoning) return;
    
    // 选择要复制的内容
    const reasoningToCopy = result.reasoning;
    
    navigator.clipboard.writeText(reasoningToCopy)
      .then(() => {
        // 1. 显示屏幕中间的复制成功提示
        const copyTip = document.createElement('div');
        copyTip.className = 'copy-success-tip';
        copyTip.textContent = t('notifications.copySuccess');
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
          copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>' + t('notifications.copySuccess') + '</span>';
          copyButton.title = t('notifications.copySuccess');
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
        copyErrorTip.textContent = t('notifications.copyFailed');
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

  // 处理在原文后添加
  const handleAppend = () => {
    // 确保只在有最终内容时才执行追加
    if (!result.content && !result.isSlowThinking) return;
    
    // 选择要使用的内容
    const contentToUse = result.content || ''; // 只使用最终内容，不使用思考过程
    
    // 将markdown转换为HTML
    const htmlContent = markdownToHtml(contentToUse);
    
    if (result.selectionRange) {
      try {
        const { from, to } = result.selectionRange;
        
        // 先清除高亮
        editor.commands.setTextSelection({ from, to });
        editor.commands.unsetMark('highlight');
        
        // 然后在后面追加内容
        editor.chain().focus().insertContentAt(to, htmlContent).run();
        
        // 追加完成后，立即移动光标到内容末尾，彻底取消选区
        const newCursorPos = to + htmlContent.length;
        editor.commands.setTextSelection({ from: newCursorPos, to: newCursorPos });
        
        // 再次确保没有高亮
        editor.commands.unsetMark('highlight');
      } catch (e) {
        console.warn("追加内容时出错:", e);
        // 如果出错，尝试直接在当前位置插入
        editor.chain().focus().insertContent(htmlContent).run();
        // 确保没有高亮
        editor.commands.unsetMark('highlight');
      }
    } else {
      // 如果没有选择范围，直接在当前位置插入
      editor.chain().focus().insertContent(htmlContent).run();
    }
    
    // 清理选中区域信息，防止残留引用
    setResult(prev => ({
      ...prev,
      selectionRange: undefined
    }));
    
    // 重置结果状态
    resetResult();
    
    // 确保编辑器保持焦点
    setTimeout(() => {
      editor.commands.focus();
    }, 100);
  };

  // 处理替换原文
  const handleReplace = () => {
    // 确保只在有最终内容时才执行替换
    if (!result.content && !result.isSlowThinking) return;
    
    // 选择要使用的内容
    const contentToUse = result.content || ''; // 只使用最终内容，不使用思考过程
    
    // 将markdown转换为HTML
    const htmlContent = markdownToHtml(contentToUse);
    
    if (result.selectionRange) {
      try {
        const { from, to } = result.selectionRange;
        
        // 先清除高亮
        editor.commands.setTextSelection({ from, to });
        editor.commands.unsetMark('highlight');
        
        // 然后替换内容
        editor.chain().focus().deleteRange({ from, to }).insertContent(htmlContent).run();
        
        // 替换完成后，立即移动光标到内容末尾，彻底取消选区
        const newCursorPos = from + htmlContent.length;
        editor.commands.setTextSelection({ from: newCursorPos, to: newCursorPos });
        
        // 再次确保没有高亮
        editor.commands.unsetMark('highlight');
      } catch (e) {
        console.warn("替换内容时出错:", e);
        // 如果出错，尝试直接在当前位置插入
        editor.chain().focus().insertContent(htmlContent).run();
        // 确保没有高亮
        editor.commands.unsetMark('highlight');
      }
    } else {
      // 如果没有选择范围，直接在当前位置插入
      editor.chain().focus().insertContent(htmlContent).run();
    }
    
    // 清理选中区域信息，防止残留引用
    setResult(prev => ({
      ...prev,
      selectionRange: undefined
    }));
    
    resetResult();
    
    // 确保编辑器保持焦点
    setTimeout(() => {
      editor.commands.focus();
    }, 100);
  };

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

  // 显示最终内容部分的JSX
  const renderContentSection = () => {
    if (result.content) {
      // 有内容时显示内容
      return (
        <div 
          className="polish-text"
          dangerouslySetInnerHTML={{ __html: formatContent(result.content) }}
        />
      );
    } else if (result.isSlowThinking && result.reasoning) {
      // 慢思考模式下，如果还没有最终内容但有思考过程，显示思考中提示
      return (
        <div className="polish-text-placeholder">
          <div className="flex items-center text-orange-700">
            <Loader2 size={16} className="animate-spin mr-2" />
            <span>{t('resultPanel.finalizingAnswer')}</span>
          </div>
        </div>
      );
    } else if (!result.loading) {
      // 常规模式下，如果已经不是loading状态但还没有内容，显示正在生成提示
      return (
        <div className="polish-text-placeholder">
          <div className="flex items-center text-orange-600">
            <Loader2 size={16} className="animate-spin mr-2" />
            <span>{t('resultPanel.generatingContent')}</span>
          </div>
        </div>
      );
    }
    
    return null;
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
            {result.loading ? (
              <div className="polish-loading">
                {result.isSlowThinking && result.reasoning ? (
                  // 慢思考模式下，即使正在加载也显示思考过程
                  <div className="w-full">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Loader2 size={24} className="animate-spin text-orange-500" />
                      <p className="text-orange-700 font-medium">{t('resultPanel.thinkingInProgress')}</p>
                    </div>
                    <div className="reasoning-container w-full">
                      <div 
                        className="reasoning-header flex items-center justify-between py-1 px-2 bg-orange-50 hover:bg-orange-100 rounded-md"
                      >
                        <div 
                          className="flex items-center cursor-pointer" 
                          onClick={handleToggleReasoning}
                        >
                          <div className="mr-2 text-orange-600">
                            {reasoningVisible ? (
                              <ChevronDown size={18} />
                            ) : (
                              <ChevronRight size={18} />
                            )}
                          </div>
                          <span className="text-orange-800 font-medium">{t('resultPanel.reasoningProcess')}</span>
                        </div>
                        
                        {/* 添加复制思考过程的按钮 */}
                        {result.reasoning && (
                          <button 
                            onClick={handleCopyReasoning}
                            className="copy-reasoning-button"
                            title={t('resultPanel.copyReasoning')}
                          >
                            <Copy size={14} className="text-orange-600" />
                          </button>
                        )}
                      </div>
                      
                      {reasoningVisible && (
                        <div className="reasoning-content mt-2 p-3 bg-orange-50 rounded-md border border-orange-100 text-sm text-gray-700 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                          {result.reasoning}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // 常规加载显示
                  <>
                    <Loader2 size={24} className="animate-spin" />
                    <p>{getLoadingText()}</p>
                  </>
                )}
              </div>
            ) : result.type === 'chat' && !result.content && !result.reasoning ? (
              <div className="chat-instruction-container">
                <h3 className="text-base font-medium text-orange-700 mb-3">{t('resultPanel.chatWithAI')} {result.isSlowThinking ? `(${t('resultPanel.slowThinkingMode')})` : ''}</h3>
                <form onSubmit={handleSubmitChat} className="chat-form">
                  <textarea
                    ref={instructionInputRef}
                    value={result.instruction || ''}
                    onChange={handleInstructionChange}
                    placeholder={t('resultPanel.chatPlaceholder')}
                    className="chat-instruction-input full-width"
                  />
                  <div className="chat-actions">
                    <button 
                      type="button" 
                      onClick={handleReject}
                      className="chat-cancel-button"
                    >
                      <X size={18} />
                      <span>{t('resultPanel.cancel')}</span>
                    </button>
                    <button 
                      type="submit" 
                      className="chat-submit-button"
                      disabled={!result.instruction?.trim()}
                    >
                      <Send size={18} />
                      <span>{t('resultPanel.send')}</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                <h3 className="text-base font-medium text-orange-700 mb-3 flex justify-between items-center">
                  <span>{getResultTitle()} 
                    {result.isSlowThinking && <span className="text-sm ml-2">({t('resultPanel.slowThinkingMode')})</span>}
                  </span>
                  
                  {/* 高度调整按钮 */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleToggleMaxHeight}
                      className="height-toggle-button"
                      title={t('resultPanel.toggleHeight')}
                    >
                      <Maximize2 size={14} className="text-orange-600" />
                    </button>
                  </div>
                </h3>
                {result.type === 'chat' && result.instruction && (
                  <div className="chat-instruction-display">
                    <span className="font-medium">{t('resultPanel.instruction')}</span> {result.instruction}
                  </div>
                )}
                
                {/* 慢思考模式下总是显示思考过程区域 */}
                {result.isSlowThinking && result.reasoning && (
                  <div className="reasoning-container mb-4">
                    <div 
                      className="reasoning-header flex items-center justify-between py-1 px-2 bg-orange-50 hover:bg-orange-100 rounded-md"
                    >
                      <div 
                        className="flex items-center cursor-pointer" 
                        onClick={handleToggleReasoning}
                      >
                        <div className="mr-2 text-orange-600">
                          {reasoningVisible ? (
                            <ChevronDown size={18} />
                          ) : (
                            <ChevronRight size={18} />
                          )}
                        </div>
                        <span className="text-orange-800 font-medium">{t('resultPanel.reasoningProcess')}</span>
                      </div>
                      
                      {/* 添加复制思考过程的按钮 */}
                      {result.reasoning && (
                        <button 
                          onClick={handleCopyReasoning}
                          className="copy-reasoning-button"
                          title={t('resultPanel.copyReasoning')}
                        >
                          <Copy size={14} className="text-orange-600" />
                        </button>
                      )}
                    </div>
                    
                    {reasoningVisible && (
                      <div className="reasoning-content mt-2 p-3 bg-orange-50 rounded-md border border-orange-100 text-sm text-gray-700 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                        {result.reasoning}
                      </div>
                    )}
                  </div>
                )}
                
                {/* 显示最终内容 */}
                {renderContentSection()}
                
                <div className="polish-actions">
                  <button 
                    onClick={handleReject}
                    className="polish-action-button reject"
                    title={t('resultPanel.close')}
                  >
                    <X size={16} />
                    <span>{t('resultPanel.close')}</span>
                  </button>
                  
                  <button 
                    onClick={handleCopy}
                    className="polish-action-button copy"
                    title={t('resultPanel.copy')}
                    disabled={!result.content}
                  >
                    <Copy size={16} />
                    <span>{t('resultPanel.copy')}</span>
                  </button>
                  
                  <button 
                    onClick={handleReplace}
                    className="polish-action-button replace"
                    title={t('resultPanel.replace')}
                    disabled={!result.content}
                  >
                    <Check size={16} />
                    <span>{t('resultPanel.replace')}</span>
                  </button>
                  
                  <button 
                    onClick={handleAppend}
                    className="polish-action-button append"
                    title={t('resultPanel.append')}
                    disabled={!result.content}
                  >
                    <Plus size={16} />
                    <span>{t('resultPanel.append')}</span>
                  </button>
                  
                  <button 
                    onClick={handleReExecute}
                    className="polish-action-button re-execute"
                    title={t('resultPanel.rerun')}
                    disabled={(!result.instruction && result.type === 'chat') || !result.selectedText}
                  >
                    <RefreshCw size={16} />
                    <span>{t('resultPanel.rerun')}</span>
                  </button>
                </div>
              </>
            )}
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