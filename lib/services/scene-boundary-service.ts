import { streamingAICall } from './ai-service'
import { sceneBoundaryPrompt } from '../prompts/scene-boundary'
import { Scene } from '@/types/requirement'

export interface SceneBoundaryAnalysisParams {
  reqBackground: string;
  reqBrief: string;
  scene: Scene;
}

// 替换模板中的变量
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((result, [key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g')
    return result.replace(regex, value)
  }, template)
}

export class SceneBoundaryService {
  private boundaryRules: string[] = [
    "检查功能和业务规则的边界场景",
    "明确需求中的模糊术语",
    "完善规则条件及其组合",
    "检查数值与范围的边界情况",
    "验证时间与顺序依赖的边界场景"
  ]

  async analyzeScene(
    params: SceneBoundaryAnalysisParams,
    onContent: (content: string) => void
  ): Promise<void> {
    const { reqBackground, reqBrief, scene } = params

    // 准备变量映射
    const variables = {
      reqBackground,
      reqBrief,
      sceneName: scene.name,
      sceneContent: scene.content,
      boundaryRules: this.boundaryRules.join('\n')
    }
    
    // 替换模板中的变量
    const prompt = replaceTemplateVariables(sceneBoundaryPrompt, variables)

    // 调用AI服务
    await streamingAICall(
      prompt,
      onContent,
      (error: string) => {
        throw new Error(`场景边界分析失败: ${error}`)
      }
    )
  }
} 