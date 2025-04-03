import { streamingAICall } from './ai-service'
import { sceneRequirementPromptTemplate } from '../prompts/scene-requirement'
import { Scene } from '@/types/requirement'

export interface SceneRequirementOptimizeParams {
  reqBackground: string;
  reqBrief: string;
  scene: Scene;
  boundaryAnalysis: string;
}

export class SceneRequirementService {
  async optimize(
    params: SceneRequirementOptimizeParams,
    onContent: (content: string) => void
  ): Promise<void> {
    const { reqBackground, reqBrief, scene, boundaryAnalysis } = params
    
    // 生成优化提示
    const prompt = sceneRequirementPromptTemplate({
      reqBackground,
      reqBrief,
      sceneName: scene.name,
      sceneContent: scene.content,
      boundaryAnalysis
    })

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