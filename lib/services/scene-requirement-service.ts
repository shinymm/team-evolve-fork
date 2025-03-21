import { streamingAICall, AIModelConfig } from './ai-service'
import { sceneRequirementPromptTemplate } from '../prompts/scene-requirement'
import { getDefaultAIConfig } from './ai-config-service'

export interface Scene {
  name: string
  overview: string
  userJourney: string[]
}

export interface SceneRequirementOptimizeParams {
  reqBackground: string
  reqBrief: string
  scene: Scene
  boundaryAnalysis: string
}

export class SceneRequirementService {
  async optimize(
    params: SceneRequirementOptimizeParams,
    onProgress: (content: string) => void
  ): Promise<void> {
    const config = await getDefaultAIConfig()
    if (!config) {
      throw new Error('未找到AI配置信息')
    }

    const prompt = sceneRequirementPromptTemplate(params)
    await streamingAICall(
      prompt, 
      config,
      onProgress,
      (error: string) => {
        throw new Error(`场景需求优化失败: ${error}`)
      }
    )
  }
} 