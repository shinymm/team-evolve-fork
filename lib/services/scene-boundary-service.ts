import { streamingAICall } from '@/lib/services/ai-service'
import { sceneBoundaryPromptTemplate } from '@/lib/prompts/scene-boundary'
import { useBoundaryRulesStore } from '@/lib/stores/boundary-rules-store'
import { Scene } from '@/types/requirement'

interface BoundaryAnalysisParams {
  reqBackground: string;
  reqBrief: string;
  scene: Scene;
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
  async analyzeScene(
    params: BoundaryAnalysisParams,
    onContent: (content: string) => void
  ): Promise<void> {
    const { reqBackground, reqBrief, scene } = params
    
    // 获取边界规则
    const boundaryRules = useBoundaryRulesStore.getState().rules
    
    // 生成分析提示
    const prompt = sceneBoundaryPromptTemplate({
      reqBackground,
      reqBrief,
      sceneName: scene.name,
      sceneContent: scene.content,
      boundaryRules
    })

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