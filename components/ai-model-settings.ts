export interface ModelConfig {
  model: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
}

export const getDefaultModelConfig = (): ModelConfig => {
  return {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
    topP: 0.95,
    frequencyPenalty: 0,
    presencePenalty: 0
  }
} 