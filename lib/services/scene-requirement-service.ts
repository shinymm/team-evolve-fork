import { streamingAICall, AIModelConfig } from '../ai-service'
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
  constructor(private config: AIModelConfig) {}

  async optimize(
    params: SceneRequirementOptimizeParams,
    onProgress: (content: string) => void
  ): Promise<void> {
    const prompt = sceneRequirementPromptTemplate(params)
    await streamingAICall(prompt, this.config, onProgress)
  }
} 