'use client'

import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, Download } from 'lucide-react'

interface ReasoningDisplayProps { 
  content: string; 
  isVisible: boolean; 
  onToggle: () => void;
  onDownload: () => void;
}

export const ReasoningDisplay = ({ 
  content, 
  isVisible, 
  onToggle,
  onDownload
}: ReasoningDisplayProps) => {
  if (!content) {
    return null;
  }

  return (
    <div className="mt-4 border rounded-md">
      <div 
        className="flex justify-between items-center p-2 bg-gray-50 border-b cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center">
          {isVisible ? 
            <ChevronDown className="h-4 w-4 mr-1.5 text-gray-500" /> : 
            <ChevronRight className="h-4 w-4 mr-1.5 text-gray-500" />
          }
          <h3 className="text-sm font-medium">思考过程</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 hover:text-orange-700"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
        >
          <Download className="h-3 w-3 mr-1" />
          导出
        </Button>
      </div>
      {isVisible && (
        <div className="p-3 bg-orange-50/50 max-h-[300px] overflow-auto">
          <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap text-xs leading-relaxed">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}; 