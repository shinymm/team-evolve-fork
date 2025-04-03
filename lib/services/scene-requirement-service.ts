import { streamingAICall } from './ai-service'
import { sceneRequirementPrompt } from '../prompts/scene-requirement'
import { Scene } from '@/types/requirement'

export interface SceneRequirementOptimizeParams {
  reqBackground: string;
  reqBrief: string;
  scene: Scene;
  boundaryAnalysis: string;
}

// 替换模板中的变量
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((result, [key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g')
    return result.replace(regex, value)
  }, template)
}

export class SceneRequirementService {
  async optimize(
    params: SceneRequirementOptimizeParams,
    onContent: (content: string) => void
  ): Promise<void> {
    const { reqBackground, reqBrief, scene, boundaryAnalysis } = params
    
    // 准备变量映射
    const variables = {
      reqBackground,
      reqBrief,
      sceneName: scene.name,
      sceneContent: scene.content,
      boundaryAnalysis
    }
    
    // 替换模板中的变量
    const prompt = replaceTemplateVariables(sceneRequirementPrompt, variables)

    // 调用AI服务
    await streamingAICall(
      prompt,
      onContent,
      (error: string) => {
        throw new Error(`场景需求优化失败: ${error}`)
      }
    )
  }
} 