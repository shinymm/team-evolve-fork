import React from 'react';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';

interface ReasoningSectionProps {
  reasoning: string;
  visible: boolean;
  onToggle: () => void;
  onCopy: () => void;
  t: (key: 'reasoningProcess' | 'copyReasoning') => string;
}

export const ReasoningSection: React.FC<ReasoningSectionProps> = ({
  reasoning,
  visible,
  onToggle,
  onCopy,
  t
}) => {
  return (
    <div className="reasoning-container mb-4">
      <div 
        className="reasoning-header flex items-center justify-between py-1 px-2 bg-orange-50 hover:bg-orange-100 rounded-md"
      >
        <div 
          className="flex items-center cursor-pointer" 
          onClick={onToggle}
        >
          <div className="mr-2 text-orange-600">
            {visible ? (
              <ChevronDown size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
          </div>
          <span className="text-orange-800 font-medium">{t('reasoningProcess')}</span>
        </div>
        
        {/* 添加复制思考过程的按钮 */}
        {reasoning && (
          <button 
            onClick={onCopy}
            className="copy-reasoning-button"
            title={t('copyReasoning')}
          >
            <Copy size={14} className="text-orange-600" />
          </button>
        )}
      </div>
      
      {visible && (
        <div className="reasoning-content mt-2 p-3 bg-orange-50 rounded-md border border-orange-100 text-sm text-gray-700 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
          {reasoning}
        </div>
      )}
    </div>
  );
}; 