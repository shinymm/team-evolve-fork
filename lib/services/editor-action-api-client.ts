/**
 * 编辑器操作API客户端
 * 封装所有与编辑器操作相关的API调用
 */

import { 
  polishText, 
  expandText, 
  analyzeBoundary, 
  optimizeBoundary, 
  chatWithAI,
  chatWithAIReasoning,
  scenarioRecognition
} from './editor-action-service';

// 定义API操作类型
export type EditorActionType = 'polish' | 'expand' | 'boundary' | 'optimize' | 'chat' | 'reasoningChat' | 'scenario';

// 定义API调用的回调类型
export interface EditorActionCallbacks {
  onProgress: (content: string) => void;
  onReasoning?: (reasoning: string) => void;
  onError: (error: string) => void;
}

// 统一的API调用方法
export async function executeEditorAction(
  actionType: EditorActionType,
  selectedText: string,
  fullText: string,
  systemId: string | null,
  callbacks: EditorActionCallbacks,
  instruction?: string // 添加instruction参数，主要用于聊天操作
): Promise<{ content: string; reasoning?: string }> {
  const { onProgress, onReasoning, onError } = callbacks;

  try {
    switch (actionType) {
      case 'polish':
        const polishedContent = await polishText(
          selectedText,
          fullText,
          systemId,
          onProgress,
          onError
        );
        return { content: polishedContent };

      case 'expand':
        const expandedContent = await expandText(
          selectedText,
          fullText,
          systemId,
          onProgress,
          onError
        );
        return { content: expandedContent };

      case 'boundary':
        const boundaryAnalysis = await analyzeBoundary(
          selectedText,
          fullText,
          systemId,
          onProgress,
          onError
        );
        return { content: boundaryAnalysis };

      case 'optimize':
        const optimizedContent = await optimizeBoundary(
          selectedText,
          fullText,
          systemId,
          onProgress,
          onError
        );
        return { content: optimizedContent };
        
      case 'scenario':
        const scenarioAnalysis = await scenarioRecognition(
          selectedText,
          fullText,
          systemId,
          onProgress,
          onError
        );
        return { content: scenarioAnalysis };

      case 'chat':
        // 确保对于聊天操作，使用指令作为第一个参数
        if (!instruction) {
          throw new Error('聊天操作必须提供指令');
        }
        
        const chatResult = await chatWithAI(
          instruction, // 正确使用指令
          selectedText, // 选中的文本作为第二个参数
          systemId,
          onProgress,
          onError
        );
        return { content: chatResult };

      case 'reasoningChat':
        // 确保对于推理聊天操作，使用指令作为第一个参数
        if (!instruction) {
          throw new Error('推理聊天操作必须提供指令');
        }
        
        if (!onReasoning) {
          throw new Error('使用推理聊天时必须提供onReasoning回调');
        }
        
        const reasoningResult = await chatWithAIReasoning(
          instruction, // 正确使用指令
          selectedText, // 选中的文本作为第二个参数
          systemId,
          onProgress,
          onReasoning,
          onError
        );
        
        return { 
          content: reasoningResult.content,
          reasoning: reasoningResult.reasoning
        };
        
      default:
        throw new Error(`未知的操作类型: ${actionType}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    onError(errorMessage);
    throw error;
  }
}

// React Hook包装器
export function useEditorActionApi() {
  return {
    executeAction: executeEditorAction
  };
} 