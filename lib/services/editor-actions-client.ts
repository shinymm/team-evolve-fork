/**
 * 编辑器操作事件处理客户端
 * 封装所有与编辑器操作相关的事件处理逻辑
 */

import { Editor } from '@tiptap/react';
import { type ResultState } from '@/components/TiptapEditor/ResultPanel';
import { executeEditorAction, type EditorActionType } from './editor-action-api-client';
import { prepareContentForEditor } from '@/lib/utils/content-formatter';

// 事件处理服务接口
export interface EditorActionsHandler {
  handleAction: (actionType: EditorActionType, instruction?: string) => Promise<void>;
  handleFastChat: () => Promise<void>;
  handleSlowChat: () => Promise<void>;
  handleSubmitChat: (event?: React.FormEvent) => Promise<void>;
  handleReExecute: () => void;
  handleCopy: () => void;
  handleCopyReasoning: () => void;
  handleReplace: () => void;
  handleAppend: () => void;
  handleReject: () => void;
  handleToggleReasoning: () => void;
}

interface EditorActionsClientOptions {
  editor: Editor;
  result: ResultState;
  setResult: React.Dispatch<React.SetStateAction<ResultState>>;
  systemId: string | null;
  resetResult: () => void;
  setReasoningVisible: React.Dispatch<React.SetStateAction<boolean>>;
  reasoningVisible: boolean;
  calculatePosition: () => { x: number, y: number, useFixed?: boolean };
  t: any; // 国际化翻译函数
}

/**
 * 创建编辑器操作事件处理客户端
 */
export function createEditorActionsClient(options: EditorActionsClientOptions): EditorActionsHandler {
  const { 
    editor, 
    result, 
    setResult, 
    systemId, 
    resetResult, 
    setReasoningVisible,
    reasoningVisible, 
    calculatePosition, 
    t 
  } = options;

  // 统一的动作处理函数
  const handleAction = async (actionType: EditorActionType, instruction?: string) => {
    // 获取选中的文本
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    const fullText = editor.getText();
    
    if (!selectedText) return;

    // 计算结果框的初始位置
    const position = calculatePosition();
    
    // 设置通用状态
    const baseResult: ResultState = {
      loading: true,
      content: '',
      visible: true,
      position,
      type: getResultType(actionType),
      size: { width: getWidthForActionType(actionType), height: 600 },
      selectedText,
      selectionRange: { from, to } // 保存选择范围
    };
    
    // 对于聊天类型，可能需要设置额外参数
    if (actionType === 'reasoningChat') {
      baseResult.isSlowThinking = true;
      baseResult.reasoning = '';
    }
    
    // 如果提供了指令，设置到结果中
    if (instruction) {
      baseResult.instruction = instruction;
    }
    
    // 更新状态
    setResult(baseResult);

    try {
      // 使用API客户端执行操作
      await executeEditorAction(
        actionType,
        selectedText, 
        fullText,
        systemId,
        {
          onProgress: (content) => {
            // 无论内容多少，收到第一个响应就把loading状态设为false
            setResult(prev => ({ 
              ...prev, 
              loading: false,
              content
            }));
          },
          onReasoning: actionType === 'reasoningChat' ? (reasoning) => {
            // 收到思考过程的第一个字符后，立即设置loading为false，显示结果页
            setResult(prev => ({ 
              ...prev, 
              loading: false,
              reasoning,
            }));
            // 确保思考过程可见
            setReasoningVisible(true);
          } : undefined,
          onError: (error) => {
            const errorPrefix = getErrorPrefix(actionType);
            setResult(prev => ({ 
              ...prev, 
              loading: false, 
              content: `${errorPrefix}${error}`
            }));
          }
        },
        instruction // 传递指令参数给API客户端
      );
    } catch (error) {
      console.error(`${actionType}请求失败:`, error);
    }
  };

  // 处理快速聊天
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
      size: { width: 800, height: 600 },
      instruction: '',
      selectedText,
      selectionRange: { from, to }, // 明确保存选择范围以便后续清除高亮
      reasoning: '',
      isSlowThinking: false
    });
    
    // 聚焦指令输入框
    setTimeout(() => {
      // 尝试聚焦输入框
      const instructionInput = document.querySelector('.chat-instruction-input') as HTMLTextAreaElement;
      if (instructionInput) {
        instructionInput.focus();
      }
    }, 100);
  };

  // 处理慢思考聊天
  const handleSlowChat = async () => {
    // 获取选中的文本
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    
    if (!selectedText) return;

    // 检查是否选择了系统
    if (!systemId) {
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
      size: { width: 800, height: 600 },
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
      // 尝试聚焦输入框
      const instructionInput = document.querySelector('.chat-instruction-input') as HTMLTextAreaElement;
      if (instructionInput) {
        instructionInput.focus();
      }
    }, 100);
  };

  // 处理聊天提交
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

    // 准备指令和选中文本
    const instruction = result.instruction.trim();
    const selectedText = result.selectedText.trim();
    
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

    // 根据isSlowThinking决定使用哪个API
    const actionType = result.isSlowThinking ? 'reasoningChat' : 'chat';
    
    // 调用处理操作的方法，明确传递instruction参数
    await handleAction(actionType, instruction);
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
          // 确保传递instruction参数
          handleSubmitChat();
        }
        break;
      case 'polish':
        handleAction('polish');
        break;
      case 'expand':
        handleAction('expand');
        break;
      case 'boundary':
        handleAction('boundary');
        break;
      case 'optimize':
        handleAction('optimize');
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

  // 复制思考过程
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
        const copyButton = document.querySelector('.copy-reasoning-button') as HTMLButtonElement;
        if (copyButton) {
          // 保存原始内容
          const originalColor = copyButton.style.color;
          
          // 修改为成功状态
          copyButton.style.color = '#10b981';
          
          // 恢复原始状态
          setTimeout(() => {
            copyButton.style.color = originalColor;
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
    
    // 使用统一的内容处理服务
    const htmlContent = prepareContentForEditor(contentToUse);
    
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
    
    // 使用统一的内容处理服务
    const htmlContent = prepareContentForEditor(contentToUse);
    
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

  // 处理切换思考过程显示/隐藏
  const handleToggleReasoning = () => {
    setReasoningVisible(prev => !prev);
  };

  // 辅助函数：根据操作类型获取结果类型
  function getResultType(actionType: EditorActionType): ResultState['type'] {
    switch (actionType) {
      case 'polish': return 'polish';
      case 'expand': return 'expand';
      case 'boundary': return 'boundary';
      case 'optimize': return 'optimize';
      case 'scenario': return 'scenario';
      case 'chat':
      case 'reasoningChat':
        return 'chat';
      default:
        return null;
    }
  }

  // 辅助函数：根据操作类型获取浮窗宽度
  function getWidthForActionType(actionType: EditorActionType): number {
    switch (actionType) {
      case 'expand': return 1000; // 扩写窗口宽一些
      default: return 800;
    }
  }

  // 辅助函数：根据操作类型获取错误前缀
  function getErrorPrefix(actionType: EditorActionType): string {
    switch (actionType) {
      case 'polish': return t('resultPanel.polishing');
      case 'expand': return t('resultPanel.expanding');
      case 'boundary': return t('resultPanel.analyzingBoundary');
      case 'optimize': return t('resultPanel.optimizingScenario');
      case 'chat':
      case 'reasoningChat':
        return t('resultPanel.thinking');
      default: return '';
    }
  }

  return {
    handleAction,
    handleFastChat,
    handleSlowChat,
    handleSubmitChat,
    handleReExecute,
    handleCopy,
    handleCopyReasoning,
    handleReplace,
    handleAppend,
    handleReject,
    handleToggleReasoning
  };
}

// React Hook包装器
export function useEditorActions(options: EditorActionsClientOptions): EditorActionsHandler {
  return createEditorActionsClient(options);
} 