import React from 'react';
import { 
  Loader2, 
  Maximize2
} from 'lucide-react';
import { formatDisplayContent } from '@/lib/utils/content-formatter';
import { LoadingState } from './LoadingState';
import { ReasoningSection } from './ReasoningSection';
import { ResultActions } from './ResultActions';
import { InstructionInput } from './InstructionInput';

// 定义结果状态类型，从BubbleMenu中提取
export interface ResultState {
  loading: boolean;
  content: string;
  visible: boolean;
  position: { x: number, y: number, useFixed?: boolean };
  type: 'polish' | 'expand' | 'chat' | 'boundary' | 'optimize' | 'scenario' | null;
  size?: { width: number, height: number };
  instruction?: string; 
  selectedText?: string; 
  selectionRange?: { from: number, to: number };
  reasoning?: string; 
  isSlowThinking?: boolean;
}

interface ResultPanelProps {
  result: ResultState;
  reasoningVisible: boolean;
  onToggleReasoning: () => void;
  onCopy: () => void;
  onCopyReasoning: () => void;
  onReject: () => void;
  onReExecute: () => void;
  onAppend: () => void;
  onReplace: () => void;
  onToggleMaxHeight: () => void;
  onInstructionSubmit: (e: React.FormEvent) => void;
  onInstructionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  t: any; // 国际化翻译函数
}

export const ResultPanel: React.FC<ResultPanelProps> = ({
  result,
  reasoningVisible,
  onToggleReasoning,
  onCopy,
  onCopyReasoning,
  onReject,
  onReExecute,
  onAppend,
  onReplace,
  onToggleMaxHeight,
  onInstructionSubmit,
  onInstructionChange,
  t
}) => {
  // 获取当前操作类型的显示标题
  const getResultTitle = () => {
    switch (result.type) {
      case 'polish': return t('resultPanel.polishResult');
      case 'expand': return t('resultPanel.expandResult');
      case 'chat': return result.loading || result.content ? t('resultPanel.aiReply') : t('resultPanel.chatWithAI');
      case 'boundary': return t('resultPanel.boundaryAnalysisResult');
      case 'optimize': return t('resultPanel.boundaryOptimizeResult');
      case 'scenario': return t('resultPanel.scenarioRecognitionResult');
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
      case 'scenario': return t('resultPanel.analyzingScenario');
      default: return t('resultPanel.processing');
    }
  };
  
  // 显示最终内容部分的JSX
  const renderContentSection = () => {
    if (result.content) {
      // 有内容时显示内容
      return (
        <div 
          className="polish-text"
          dangerouslySetInnerHTML={{ __html: formatDisplayContent(result.content) }}
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

  // 渲染加载状态
  if (result.loading) {
    return (
      <LoadingState 
        result={result}
        reasoningVisible={reasoningVisible}
        onToggleReasoning={onToggleReasoning}
        onCopyReasoning={onCopyReasoning}
        t={t}
      />
    );
  }

  // 聊天指令输入模式
  if (result.type === 'chat' && !result.content && !result.reasoning) {
    return (
      <InstructionInput 
        instruction={result.instruction || ''}
        onChange={onInstructionChange}
        onSubmit={onInstructionSubmit}
        onCancel={onReject}
        isSlowThinking={result.isSlowThinking}
        t={t}
      />
    );
  }

  // 内容展示模式
  return (
    <>
      <h3 className="text-base font-medium text-orange-700 mb-3 flex justify-between items-center">
        <span>{getResultTitle()} 
          {result.isSlowThinking && <span className="text-sm ml-2">({t('resultPanel.slowThinkingMode')})</span>}
        </span>
        
        {/* 高度调整按钮 */}
        <div className="flex items-center gap-2">
          <button 
            onClick={onToggleMaxHeight}
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
        <ReasoningSection 
          reasoning={result.reasoning}
          visible={reasoningVisible}
          onToggle={onToggleReasoning}
          onCopy={onCopyReasoning}
          t={t}
        />
      )}
      
      {/* 显示最终内容 */}
      {renderContentSection()}
      
      {/* 操作按钮 */}
      <ResultActions 
        result={result}
        onReject={onReject}
        onCopy={onCopy}
        onReplace={onReplace}
        onAppend={onAppend}
        onReExecute={onReExecute}
        t={t}
      />
    </>
  );
}; 