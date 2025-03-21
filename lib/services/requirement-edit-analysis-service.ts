import { streamingAICall } from '@/lib/ai-service'
import { getAIConfig } from '@/lib/ai-config-service'
import { requirementAnalysisPrompt } from '@/lib/prompts/requirement-analysis'
import { template } from '@/lib/prompts/requirement-edit-analysis'

export interface EditAnalysisResult {
  success: boolean
  error?: string
}

export async function analyzeRequirementEdit(
  originalContent: string,
  editedContent: string,
  onProgress: (content: string) => void
): Promise<EditAnalysisResult> {
  try {
    const aiConfig = getAIConfig()
    if (!aiConfig) {
      throw new Error('AI配置未找到')
    }

    const prompt = template
      .replace('{{originalContent}}', originalContent)
      .replace('{{editedContent}}', editedContent)
      .replace('{{requirementPrompt}}', requirementAnalysisPrompt(''))

    await streamingAICall(
      prompt,
      aiConfig,
      onProgress
    )

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '分析过程发生错误'
    }
  }
} 