import { streamingAICall } from '@/lib/ai-service'
import { getAIConfig } from '@/lib/ai-config-service'
import { requirementAnalysisPrompt } from '@/lib/prompts/requirement-analysis'
import { productElevatorPitch } from '@/lib/product-info'

const EDIT_ANALYSIS_PROMPT = `你是一个专业的需求分析师，请分析用户对AI生成的需求分析内容的修改，并给出深入的见解。

原始AI生成的需求分析内容：
{originalContent}

用户修改后的内容：
{editedContent}

现有的需求分析提示词：
{requirementPrompt}

请按照以下步骤进行分析：

1. 仔细对比原始内容和修改后的内容，总结用户的主要改动点：
   - 列出具体修改的段落或句子，总结这些修改反映出的用户意图

2. 深入分析用户修改背后的本质原因：
   A. 针对具体修改的直接原因：
      - 分析每处修改中原始内容的具体问题（理解偏差/表述不准确/信息缺失等）
      - 说明这些问题如何影响需求分析的质量

   B. 提炼高阶的系统性问题：
      - 这些修改是否反映出AI在需求理解方面的某些共性问题
      - 是否暴露出提示词或产品电梯演讲在某些维度上的系统性缺陷
      - 是否反映出用户在需求表达和AI理解之间的某些固有差异
      - 这些问题是否可能在其他类似的需求分析场景中重复出现

3. 基于根因分析提供全面的改进方案：

   - 提示词战略层面的通用优化：
      \`\`\`
      // 请提供一个更具普适性的提示词模板，以应对同类问题
      \`\`\`


请以markdown格式输出分析结果，使用清晰的标题层级和列表结构。对于改进建议部分，请确保提供的是可以直接使用的完整内容。`

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

    const prompt = EDIT_ANALYSIS_PROMPT
      .replace('{originalContent}', originalContent)
      .replace('{editedContent}', editedContent)
      .replace('{requirementPrompt}', requirementAnalysisPrompt(''))
      .replace('{productPitch}', productElevatorPitch)

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