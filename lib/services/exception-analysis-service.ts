import { EXCEPTION_ANALYSIS_TEMPLATE } from '../prompts/exception-analysis'
import type { AIModelConfig } from './ai-service'
import { getDefaultAIConfig } from '@/lib/services/ai-config-service'
import { streamingAICall } from '@/lib/services/ai-service'

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
      // 获取默认配置
      const config = await getDefaultAIConfig()
      if (!config) {
        throw new Error('未找到AI配置信息，请先在设置中配置AI模型')
      }

      // 构建提示词
      const prompt = this.replaceTemplateVariables(EXCEPTION_ANALYSIS_TEMPLATE, {
        request: exception.request,
        error: exception.error,
        stackTrace: exception.stackTrace.join('\n')
      })

      console.log(`[${new Date().toISOString()}] 开始异常分析，模型: ${config.model}`)

      // 创建一个新的 TransformStream 来处理数据
      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()
      const encoder = new TextEncoder()

      // 在后台处理流
      streamingAICall(
        prompt,
        config,
        (content: string) => {
          // 直接传递内容，因为 streamingAICall 已经处理了格式化
          writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
        },
        async (error: string) => {
          console.error(`[${new Date().toISOString()}] 异常分析错误:`, error)
          await writer.write(encoder.encode(`data: ${JSON.stringify({ error })}\n\n`))
          await writer.close()
        }
      )

      return readable
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 异常分析失败:`, error)
      // 创建一个新的 TransformStream 来返回错误
      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()
      const encoder = new TextEncoder()
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      writer.write(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`))
      writer.close()
      return readable
    }
  }
} 