import React from 'react';
import { Loader2 } from 'lucide-react';
import { ResultState } from './ResultPanel';
import { ReasoningSection } from './ReasoningSection';

interface LoadingStateProps {
  result: ResultState;
  reasoningVisible: boolean;
  onToggleReasoning: () => void;
  onCopyReasoning: () => void;
  t: any;
  tReasoning: any;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  result,
  reasoningVisible,
  onToggleReasoning,
  onCopyReasoning,
  t,
  tReasoning
}) => {
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
  
  // 慢思考模式下，即使正在加载也显示思考过程
  if (result.isSlowThinking && result.reasoning) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Loader2 size={24} className="animate-spin text-orange-500" />
          <p className="text-orange-700 font-medium">{t('resultPanel.thinkingInProgress')}</p>
        </div>
        <ReasoningSection 
          reasoning={result.reasoning}
          visible={reasoningVisible}
          onToggle={onToggleReasoning}
          onCopy={onCopyReasoning}
          t={tReasoning}
        />
      </div>
    );
  }
  
  // 常规加载显示
  return (
    <div className="polish-loading">
      <Loader2 size={24} className="animate-spin" />
      <p>{getLoadingText()}</p>
    </div>
  );
}; 