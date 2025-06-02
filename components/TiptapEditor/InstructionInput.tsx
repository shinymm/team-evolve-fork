import React, { useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';

interface InstructionInputProps {
  instruction: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSlowThinking?: boolean;
  t: any;
}

export const InstructionInput: React.FC<InstructionInputProps> = ({
  instruction,
  onChange,
  onSubmit,
  onCancel,
  isSlowThinking = false,
  t
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    // 聚焦指令输入框
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);
  
  return (
    <div className="chat-instruction-container">
      <h3 className="text-base font-medium text-orange-700 mb-3">
        {t('resultPanel.chatWithAI')} 
        {isSlowThinking && <span className="text-sm ml-2">({t('resultPanel.slowThinkingMode')})</span>}
      </h3>
      <form onSubmit={onSubmit} className="chat-form">
        <textarea
          ref={inputRef}
          value={instruction || ''}
          onChange={onChange}
          placeholder={t('resultPanel.chatPlaceholder')}
          className="chat-instruction-input full-width"
        />
        <div className="chat-actions">
          <button 
            type="button" 
            onClick={onCancel}
            className="chat-cancel-button"
          >
            <X size={18} />
            <span>{t('resultPanel.cancel')}</span>
          </button>
          <button 
            type="submit" 
            className="chat-submit-button"
            disabled={!instruction?.trim()}
          >
            <Send size={18} />
            <span>{t('resultPanel.send')}</span>
          </button>
        </div>
      </form>
    </div>
  );
}; 