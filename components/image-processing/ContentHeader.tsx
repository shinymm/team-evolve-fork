'use client'

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface ContentHeaderProps {
  title: string
  onDownload: () => void
  hasContent: boolean
  exportType?: string
}

export const ContentHeader = ({
  title,
  onDownload,
  hasContent,
  exportType = 'MD'
}: ContentHeaderProps) => {
  return (
    <div className="flex justify-between items-center">
      <h2 className="text-lg font-medium">{title}</h2>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
              onClick={onDownload}
              disabled={!hasContent}
            >
              <Download className="h-3 w-3 mr-1" />
              导出{exportType}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>导出为{exportType === 'JSON' ? 'JSON文件' : 'Markdown文件'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
} 