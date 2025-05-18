'use client'

import { Button } from "@/components/ui/button"
import { FileText, Loader2, Image as ImageIcon } from 'lucide-react'
import { ProcessingStates } from '@/types/image-processing'

interface ActionButtonsProps {
  processingStates: ProcessingStates
  processing: boolean
  hasSelectedImages: boolean
  onExtractProductInfo: () => void
  onExtractArchitecture: () => void
  onVisionAnalysis: () => void
  onGenerateRequirementDraft: () => void
}

export const ActionButtons = ({
  processingStates,
  processing,
  hasSelectedImages,
  onExtractProductInfo,
  onExtractArchitecture,
  onVisionAnalysis,
  onGenerateRequirementDraft
}: ActionButtonsProps) => {
  return (
    <div className="flex flex-wrap space-x-2 pt-4">
      <Button
        onClick={onExtractProductInfo}
        disabled={processing || !hasSelectedImages}
        className="h-10 bg-orange-500 hover:bg-orange-600 text-white"
      >
        {processingStates['product-info'] ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        提炼产品基础信息
      </Button>
      
      <Button
        onClick={onExtractArchitecture}
        disabled={processing || !hasSelectedImages}
        className="h-10 bg-orange-500 hover:bg-orange-600 text-white"
      >
        {processingStates['architecture'] ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        抽取信息架构
      </Button>
      
      <Button
        onClick={onVisionAnalysis}
        disabled={processing || !hasSelectedImages}
        className="h-10 bg-orange-500 hover:bg-orange-600 text-white"
      >
        {processingStates['vision-analysis'] ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ImageIcon className="mr-2 h-4 w-4" />
        )}
        自定义视觉分析
      </Button>
      
      <Button
        onClick={onGenerateRequirementDraft}
        disabled={processing || !hasSelectedImages}
        className="h-10 bg-orange-500 hover:bg-orange-600 text-white"
      >
        {processingStates['requirement-draft'] ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        生成需求初稿
      </Button>
    </div>
  )
} 