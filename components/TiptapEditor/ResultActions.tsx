import React from 'react';
import { X, Copy, Check, Plus, RefreshCw } from 'lucide-react';
import { ResultState } from './ResultPanel';

interface ResultActionsProps {
  result: ResultState;
  onReject: () => void;
  onCopy: () => void;
  onReplace: () => void;
  onAppend: () => void;
  onReExecute: () => void;
  t: any;
}

export const ResultActions: React.FC<ResultActionsProps> = ({
  result,
  onReject,
  onCopy,
  onReplace,
  onAppend,
  onReExecute,
  t
}) => {
  return (
    <div className="polish-actions">
      <button 
        onClick={onReject}
        className="polish-action-button reject"
        title={t('resultPanel.close')}
      >
        <X size={16} />
        <span>{t('resultPanel.close')}</span>
      </button>
      
      <button 
        onClick={onCopy}
        className="polish-action-button copy"
        title={t('resultPanel.copy')}
        disabled={!result.content}
      >
        <Copy size={16} />
        <span>{t('resultPanel.copy')}</span>
      </button>
      
      <button 
        onClick={onReplace}
        className="polish-action-button replace"
        title={t('resultPanel.replace')}
        disabled={!result.content}
      >
        <Check size={16} />
        <span>{t('resultPanel.replace')}</span>
      </button>
      
      <button 
        onClick={onAppend}
        className="polish-action-button append"
        title={t('resultPanel.append')}
        disabled={!result.content}
      >
        <Plus size={16} />
        <span>{t('resultPanel.append')}</span>
      </button>
      
      <button 
        onClick={onReExecute}
        className="polish-action-button re-execute"
        title={t('resultPanel.rerun')}
        disabled={(!result.instruction && result.type === 'chat') || !result.selectedText}
      >
        <RefreshCw size={16} />
        <span>{t('resultPanel.rerun')}</span>
      </button>
    </div>
  );
}; 