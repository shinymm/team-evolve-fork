import { streamingAICall } from '@/lib/services/ai-service'
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
    const prompt = template
      .replace('{{originalContent}}', originalContent)
      .replace('{{editedContent}}', editedContent)
      .replace('{{requirementPrompt}}', requirementAnalysisPrompt(''))

    await streamingAICall(
      prompt,
      onProgress,
      (error: string) => {
        throw new Error(`req-edit-analysis AI调用错误: ${error}`)
      }
    )

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '分析过程发生错误'
    }
  }
} 