import { streamingAICall } from '@/lib/ai-service'
import { getAIConfig } from '@/lib/ai-config-service'
import { sceneBoundaryPromptTemplate } from '@/lib/prompts/scene-boundary'
import { useBoundaryRulesStore } from '@/lib/stores/boundary-rules-store'

interface Scene {
  name: string
  overview: string
  userJourney: string[]
}

interface BoundaryAnalysisParams {
  reqBackground: string
  reqBrief: string
  scene: Scene
}

// 从Zustand store获取边界识别知识规则表格
const getRulesTable = () => {
  // 使用Zustand store的getState方法获取当前状态
  const { rules } = useBoundaryRulesStore.getState()
  if (!rules || rules.length === 0) return ''
  
  // 构建表格头
  let table = '| 检查项 | 适用场景 | 检查要点 | 需求示例 | 边界示例 |\n'
  table += '|---------|------------|------------|------------|------------|\n'
  
  // 添加表格内容
  table += rules.map((rule) => {
    // 处理每个字段中可能存在的换行符，替换为空格
    const checkItem = rule.checkItem?.replace(/\n/g, ' ') || ''
    const scenario = rule.scenario?.replace(/\n/g, ' ') || ''
    const checkPoints = rule.checkPoints?.replace(/\n/g, ' ') || ''
    const example = rule.example?.replace(/\n/g, ' ') || ''
    const boundaryExample = rule.boundaryExample?.replace(/\n/g, ' ') || ''
    
    // 处理可能包含 | 符号的内容，使用 \ 转义
    return `| ${checkItem.replace(/\|/g, '\\|')} | ${scenario.replace(/\|/g, '\\|')} | ${checkPoints.replace(/\|/g, '\\|')} | ${example.replace(/\|/g, '\\|')} | ${boundaryExample.replace(/\|/g, '\\|')} |`
  }).join('\n')
  
  return table
}

export class SceneBoundaryService {
  async analyzeScene(params: BoundaryAnalysisParams, onContent: (content: string) => void) {
    const aiConfig = getAIConfig()
    if (!aiConfig) {
      throw new Error('未配置AI模型')
    }

    // 构建用户旅程字符串
    const userJourneyStr = params.scene.userJourney
      .map((step, index) => `${index + 1}. ${step}`)
      .join('\n')

    // 获取边界识别知识规则表
    const rulesTable = getRulesTable()

    // 构建prompt
    const prompt = sceneBoundaryPromptTemplate
      .replace('{req_background}', params.reqBackground)
      .replace('{req_brief}', params.reqBrief)
      .replace('{scene_name}', params.scene.name)
      .replace('{scene_overview}', params.scene.overview)
      .replace('{user_journey}', userJourneyStr)
      .replace('{boundary_rules}', rulesTable)

    // 调用AI服务进行分析
    await streamingAICall(
      prompt,
      aiConfig,
      onContent,
    )
  }
} 