import { Editor } from '@tiptap/react';
import { PromptAction, FacetType, OutputForm, ChangeForm } from '@studio-b3/web-core';

// 类型定义，用于 toast 函数参数
type ToastFunction = (options: {
  title: string;
  description: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}) => void;

/**
 * 核心的润色执行逻辑
 * @param editor Tiptap 编辑器实例
 * @param toast Antd Toast 函数实例
 * @returns Promise，成功时 resolve 润色后的文本，失败时 reject 错误
 */
async function executePolishAction(
  editor: Editor,
  toast: ToastFunction
): Promise<string | null> {
  const { from, to, empty } = editor.state.selection;
  if (empty) {
    toast({ title: "提示", description: "请先选中文本再进行润色。" });
    return null; // 返回 null 表示未执行
  }

  const selectedText = editor.state.doc.textBetween(from, to);
  toast({ title: "润色中...", description: "正在请求 AI 服务处理..." });

  try {
    const response = await fetch('/api/ai/polish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: selectedText }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || `API Error: ${response.statusText}`);
    }

    const { polishedText } = await response.json();

    if (polishedText) {
      toast({ title: "润色完成", description: "文本已更新。" });
      return polishedText; // 返回润色后的文本
    } else {
      toast({ title: "润色失败", description: "AI 未返回有效内容。", variant: "destructive" });
      return null;
    }

  } catch (error) {
    console.error("Polish action failed:", error);
    let errorMsg = "润色请求失败";
    if (error instanceof Error) {
        errorMsg = error.message;
    }
    toast({ title: "错误", description: errorMsg, variant: "destructive" });
    throw error; // 抛出错误，由调用方处理
  }
}

/**
 * 定义用于 Studio B3 MenuBubble 的 PromptAction 对象
 */
export const polishBubbleAction = ( 
  // 接收页面组件的状态更新函数和 toast
  setIsAiProcessing: (isProcessing: boolean) => void, 
  setMarkdownContent: (content: string) => void,
  toast: ToastFunction
): PromptAction => ({
  name: "润色（new）",
  i18Name: false,
  template: '',
  changeForm: ChangeForm.INSERT,
  facetType: FacetType.BUBBLE_MENU,
  outputForm: OutputForm.TEXT,
  // 使用 as any 绕过 action 函数参数的类型检查
  action: async (editor: any) => { // <-- 使用 any 类型
    setIsAiProcessing(true);
    editor.setEditable(false);
    try {
      // 确保传递给 executePolishAction 的 editor 类型正确 (如果需要)
      const polishedText = await executePolishAction(editor as Editor, toast);
      if (polishedText !== null) {
        const { from, to } = editor.state.selection;
        // 替换选中内容
        editor.chain().focus().deleteRange({ from, to }).insertContent(polishedText).run();
        // 手动触发一次 onUpdate 来同步 markdownContent 状态
        const updatedMarkdown = editor.storage.markdown.getMarkdown();
        setMarkdownContent(updatedMarkdown);
      }
    } catch (error) {
      // 错误已在 executePolishAction 中 toast 过，这里可能不需要额外处理
      console.error("Error during polish execution in action wrapper:", error);
    } finally {
      setIsAiProcessing(false);
      // 延迟恢复可编辑状态，避免与状态更新冲突
      setTimeout(() => editor.setEditable(true), 100);
    }
  },
}); 