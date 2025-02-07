import { EXCEPTION_ANALYSIS_TEMPLATE } from '../prompts/exception-analysis'
import { getAIConfig } from '../ai-config-service'
import type { AIModelConfig } from '../ai-service'

export class ExceptionAnalysisService {
  private static replaceTemplateVariables(template: string, variables: Record<string, string>) {
    return Object.entries(variables).reduce(
      (result, [key, value]) => result.replace(`{{${key}}}`, value),
      template
    )
  }

  static async analyze(
    exception: {
      request: string
      error: string
      stackTrace: string[]
    }
  ): Promise<ReadableStream> {
    try {
      const config = getAIConfig()
      if (!config) {
        throw new Error('未配置AI模型')
      }

      const prompt = this.replaceTemplateVariables(EXCEPTION_ANALYSIS_TEMPLATE, {
        request: exception.request,
        error: exception.error,
        stackTrace: exception.stackTrace.join('\n')
      })

      const response = await fetch(`${config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: '你是一个专业的软件开发工程师，擅长分析程序异常并提供专业的建议。' },
            { role: 'user', content: prompt }
          ],
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error('AI 分析请求失败')
      }

      return response.body as ReadableStream
    } catch (error) {
      console.error('Exception analysis failed:', error)
      throw error
    }
  }
} 