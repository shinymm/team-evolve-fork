import { streamingAICall } from './ai-service'
import { sceneRequirementPromptTemplate } from '../prompts/scene-requirement'

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
    const prompt = sceneRequirementPromptTemplate(params)
    await streamingAICall(
      prompt, 
      onProgress,
      (error: string) => {
        throw new Error(`场景需求优化失败: ${error}`)
      }
    )
  }
} 