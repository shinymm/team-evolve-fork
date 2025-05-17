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
  Send
} from 'lucide-react';

interface BubbleMenuProps {
  editor: Editor;
}

interface ResultState {
  loading: boolean;
  content: string;
  visible: boolean;
  position: { x: number, y: number };
  type: 'polish' | 'expand' | 'chat' | null;
  size?: { width: number, height: number };
  instruction?: string; // 用户输入的指令
  selectedText?: string; // 选中的文本
  selectionRange?: { from: number, to: number }; // 保存选择范围以便后续清除高亮
}

export const BubbleMenu: React.FC<BubbleMenuProps> = ({ editor }) => {
  const [result, setResult] = useState<ResultState>({
    loading: false,
    content: '',
    visible: false,
    position: { x: 0, y: 0 },
    type: null,
    size: undefined,
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

  // 重置结果状态
  const resetResult = () => {
    setResult({
      loading: false,
      content: '',
      visible: false,
      position: { x: 0, y: 0 },
      type: null,
      size: undefined,
      instruction: '',
      selectedText: '',
      selectionRange: undefined
    });
  };

  // 监听浮窗大小变化
  useEffect(() => {
    if (resultRef.current && result.visible) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            setResult(prev => ({
              ...prev,
              size: { width, height }
            }));
          }
        }
      });
      
      resizeObserver.observe(resultRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [result.visible]);

  // 计算结果框的初始位置
  const calculatePosition = () => {
    if (window) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // 计算左侧位置，确保居中
        const editorRect = editor.view.dom.getBoundingClientRect();
        const initialWidth = Math.min(window.innerWidth * 0.9, 1200);
        const left = Math.max(0, rect.left - (initialWidth - rect.width) / 2);
        
        return { 
          x: left,
          y: rect.bottom + window.scrollY + 10 // 10px的偏移量
        };
      }
    }
    return { x: 0, y: 0 };
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
    
    // 设置初始宽度，确保一致性
    const initialWidth = Math.min(window.innerWidth * 0.9, 1200);
    
    // 设置状态
    setResult({
      loading: true,
      content: '',
      visible: true,
      position,
      type: 'polish',
      size: { width: initialWidth, height: 300 },
      selectedText
    });

    try {
      // 调用API进行文本润色
      const response = await fetch('/api/ai-editor-action/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: selectedText,
          fullText: fullText
        })
      });

      if (!response.ok) {
        throw new Error('润色API调用失败');
      }

      if (response.body) {
        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let resultText = '';

        // 读取流
        const processStream = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            
            try {
              // 尝试解析JSON
              const lines = chunk.split('\n').filter(line => line.trim() !== '');
              
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.polishedText) {
                    resultText += data.polishedText;
                    // 实时更新UI
                    setResult(prev => ({ 
                      ...prev, 
                      loading: false,
                      content: resultText 
                    }));
                  } else if (data.error) {
                    throw new Error(data.error);
                  }
                } catch (lineError) {
                  if (lineError instanceof Error && lineError.message !== "Unexpected end of JSON input") {
                    console.error('JSON解析错误:', lineError);
                  }
                }
              }
            } catch (e) {
              console.error('处理数据块错误:', e);
              throw e;
            }
          }
        };

        processStream().catch(error => {
          console.error('处理流失败:', error);
          setResult(prev => ({ 
            ...prev, 
            loading: false, 
            content: '润色过程出现错误，请重试。' 
          }));
        });
      } else {
        throw new Error('未收到流式响应');
      }
    } catch (error) {
      console.error('润色请求失败:', error);
      setResult(prev => ({ 
        ...prev, 
        loading: false, 
        content: `润色请求失败: ${error instanceof Error ? error.message : '未知错误'}` 
      }));
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
    
    // 设置初始宽度，确保一致性
    const initialWidth = Math.min(window.innerWidth * 0.9, 1200);
    
    // 设置状态
    setResult({
      loading: true,
      content: '',
      visible: true,
      position,
      type: 'expand',
      size: { width: initialWidth, height: 300 },
      selectedText
    });

    try {
      // 调用API进行文本扩写
      const response = await fetch('/api/ai-editor-action/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: selectedText,
          fullText: fullText
        })
      });

      if (!response.ok) {
        throw new Error('扩写API调用失败');
      }

      if (response.body) {
        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let resultText = '';

        // 读取流
        const processStream = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            
            try {
              // 尝试解析JSON
              const lines = chunk.split('\n').filter(line => line.trim() !== '');
              
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.expandedText) {
                    resultText += data.expandedText;
                    // 实时更新UI
                    setResult(prev => ({ 
                      ...prev, 
                      loading: false,
                      content: resultText 
                    }));
                  } else if (data.error) {
                    throw new Error(data.error);
                  }
                } catch (lineError) {
                  if (lineError instanceof Error && lineError.message !== "Unexpected end of JSON input") {
                    console.error('JSON解析错误:', lineError);
                  }
                }
              }
            } catch (e) {
              console.error('处理数据块错误:', e);
              throw e;
            }
          }
        };

        processStream().catch(error => {
          console.error('处理流失败:', error);
          setResult(prev => ({ 
            ...prev, 
            loading: false, 
            content: '扩写过程出现错误，请重试。' 
          }));
        });
      } else {
        throw new Error('未收到流式响应');
      }
    } catch (error) {
      console.error('扩写请求失败:', error);
      setResult(prev => ({ 
        ...prev, 
        loading: false, 
        content: `扩写请求失败: ${error instanceof Error ? error.message : '未知错误'}` 
      }));
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
    
    // 设置初始宽度，确保一致性
    const initialWidth = Math.min(window.innerWidth * 0.9, 1200);
    
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
      size: { width: initialWidth, height: 300 },
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
      // 准备发送到API的数据
      const prompt = `用户指令: ${result.instruction}\n\n选中的文本内容:\n${result.selectedText}`;

      // 调用API进行聊天
      const response = await fetch('/api/ai-editor-action/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error('AI对话API调用失败');
      }

      if (response.body) {
        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let resultText = '';

        // 读取流
        const processStream = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            
            try {
              // 尝试解析JSON
              const lines = chunk.split('\n').filter(line => line.trim() !== '');
              
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.result) {
                    resultText += data.result;
                    // 实时更新UI
                    setResult(prev => ({ 
                      ...prev, 
                      loading: false,
                      content: resultText 
                    }));
                  } else if (data.error) {
                    throw new Error(data.error);
                  }
                } catch (lineError) {
                  if (lineError instanceof Error && lineError.message !== "Unexpected end of JSON input") {
                    console.error('JSON解析错误:', lineError);
                  }
                }
              }
            } catch (e) {
              console.error('处理数据块错误:', e);
              throw e;
            }
          }
        };

        processStream().catch(error => {
          console.error('处理流失败:', error);
          setResult(prev => ({ 
            ...prev, 
            loading: false, 
            content: '对话过程出现错误，请重试。' 
          }));
        });
      } else {
        throw new Error('未收到流式响应');
      }
    } catch (error) {
      console.error('AI对话请求失败:', error);
      setResult(prev => ({ 
        ...prev, 
        loading: false, 
        content: `对话请求失败: ${error instanceof Error ? error.message : '未知错误'}` 
      }));
    }
  };

  // 处理重新执行
  const handleReExecute = () => {
    if (result.type === 'chat' && result.instruction && result.selectedText) {
      handleSubmitChat();
    }
  };

  // 处理复制内容
  const handleCopy = () => {
    if (!result.content) return;
    
    navigator.clipboard.writeText(result.content)
      .then(() => {
        // 显示复制成功提示
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
      })
      .catch(err => {
        console.error('复制失败:', err);
      });
  };

  // 处理替换原文
  const handleReplace = () => {
    if (!result.content) return;
    
    const { from, to } = editor.state.selection;
    editor.chain().focus().deleteRange({ from, to }).insertContent(result.content).run();
    resetResult();
  };

  // 处理在原文后添加
  const handleAppend = () => {
    if (!result.content) return;
    
    const { to } = editor.state.selection;
    editor.chain().focus().insertContentAt(to, result.content).run();
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

  // 添加全局鼠标事件监听
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // 获取当前操作类型的显示标题
  const getResultTitle = () => {
    switch (result.type) {
      case 'polish': return '润色结果';
      case 'expand': return '扩写结果';
      case 'chat': return result.loading || result.content ? 'AI回复' : '与AI对话';
      default: return '处理结果';
    }
  };

  // 获取加载中的显示文本
  const getLoadingText = () => {
    switch (result.type) {
      case 'polish': return '正在润色中...';
      case 'expand': return '正在扩写中...';
      case 'chat': return '正在思考中...';
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
          >
            <Wand2 size={16} />
            <span>润色</span>
          </button>
          <div className="bubble-menu-divider"></div>
          <button 
            onClick={handleExpand}
            className="bubble-menu-button"
            title="扩写文本"
          >
            <FileText size={16} />
            <span>扩写</span>
          </button>
          <div className="bubble-menu-divider"></div>
          <button 
            onClick={handleChat}
            className="bubble-menu-button"
            title="与AI对话"
          >
            <MessageSquare size={16} />
            <span>ChatWithAI</span>
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
            width: result.size ? `${result.size.width}px` : undefined,
            height: '280px' // 固定初始高度
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
                  <button 
                    type="submit" 
                    className="chat-submit-button"
                    disabled={!result.instruction?.trim()}
                  >
                    <Send size={18} />
                    <span>发送</span>
                  </button>
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
                  
                  {result.type === 'chat' && (
                    <>
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
                        onClick={handleReExecute}
                        className="polish-action-button re-execute"
                        title="重新执行"
                        disabled={!result.instruction || !result.selectedText}
                      >
                        <RefreshCw size={16} />
                        <span>重新执行</span>
                      </button>
                    </>
                  )}
                  
                  {(result.type === 'polish' || result.type === 'expand') && (
                    <>
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
                        title="追加"
                        disabled={!result.content}
                      >
                        <Plus size={16} />
                        <span>追加</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          
          {/* 尺寸调整提示 */}
          <div className="resize-hint">可拖动调整大小</div>
          <Maximize2 size={12} className="resize-indicator" />
        </div>
      )}
    </>
  );
}; 