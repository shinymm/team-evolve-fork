import { StructuredRequirement } from './requirement-export-service'
import { ArchitectureItem } from '@/types/product-info'
import { ARCHITECTURE_SUGGESTION_PROMPT } from '../prompts/architecture-suggestion'
import { streamingAICall } from '@/lib/services/ai-service'
import yaml from 'js-yaml'

export interface ArchitectureSuggestion {
  id?: string  // 改为可选，因为新格式不需要
  type: 'add' | 'modify' | 'delete'  // 改为必需
  nodeId?: string  // 修改和删除时必需
  parentId?: string  // 新增时必需
  title: string  // 改为必需
  description: string  // 改为必需
}

// 验证建议的数据格式
const validateSuggestions = (suggestions: any[]): void => {
  if (!Array.isArray(suggestions)) {
    throw new Error('建议必须是数组格式')
  }

  for (const suggestion of suggestions) {
    // 检查必需字段
    if (!suggestion.type || !suggestion.title || !suggestion.description) {
      throw new Error('每个建议必须包含 type、title 和 description 字段')
    }

    // 检查 type 字段值
    if (!['add', 'modify', 'delete'].includes(suggestion.type)) {
      throw new Error('type 字段只能是 add、modify 或 delete')
    }

    // 根据类型检查必需字段
    if (suggestion.type === 'add' && !suggestion.parentId) {
      throw new Error('新增类型的建议必须包含 parentId')
    }

    if ((suggestion.type === 'modify' || suggestion.type === 'delete') && !suggestion.nodeId) {
      throw new Error('修改或删除类型的建议必须包含 nodeId')
    }

    // 检查 title 格式
    if (!suggestion.title.endsWith('页面')) {
      throw new Error('title 必须以"页面"结尾')
    }
  }
}

export async function generateArchitectureSuggestions(
  requirement: StructuredRequirement,
  currentArchitecture: ArchitectureItem[]
): Promise<ArchitectureSuggestion[]> {
  try {
    // 将场景列表转换为易读的字符串格式
    const scenesStr = requirement.sceneList.map((scene, index) => `
场景${index + 1}：${scene.sceneName}
场景内容：
${scene.content}
`).join('\n\n')

    // 将当前架构转换为易读的字符串格式
    const archString = currentArchitecture.map(item => 
      `${item.id}. ${item.title} - ${item.description}${item.parentId ? ` (父节点: ${item.parentId})` : ''}`
    ).join('\n')

    // 替换提示词模板中的参数
    const prompt = ARCHITECTURE_SUGGESTION_PROMPT
      .replace('{{userJourneys}}', scenesStr)
      .replace('{{architecture}}', archString)

    let fullResponse = ''
    await streamingAICall(
      prompt,
      (content) => {
        fullResponse += content
      },
      (error) => {
        throw new Error(`生成架构建议失败: ${error}`)
      }
    )

    console.log('原始模型响应:', fullResponse)

    if (!fullResponse) {
      throw new Error('AI服务返回为空')
    }

    // 尝试直接解析返回内容为YAML
    let yamlContent = ''
    
    // 首先尝试提取被包裹的YAML
    const yamlMatch = fullResponse.match(/```yaml\n([\s\S]*?)```/)
    if (yamlMatch) {
      yamlContent = yamlMatch[1].trim()
    } else {
      // 如果没有包裹，检查是否以 "- type:" 开头的YAML格式
      if (fullResponse.trim().startsWith('- type:')) {
        yamlContent = fullResponse.trim()
      } else {
        console.log('未找到YAML格式内容，完整响应:', fullResponse)
        throw new Error('未找到有效的YAML格式建议')
      }
    }

    console.log('提取的YAML内容:', yamlContent)

    try {
      // 解析YAML为建议数组
      const suggestions = yaml.load(yamlContent) as ArchitectureSuggestion[]
      
      // 验证建议格式
      validateSuggestions(suggestions)
      
      // 保存解析后的建议到localStorage
      localStorage.setItem('architecture-suggestions', JSON.stringify(suggestions))
      
      return suggestions
    } catch (error) {
      console.error('YAML解析错误:', error)
      throw new Error('YAML格式解析失败')
    }

  } catch (error) {
    console.error('Error generating architecture suggestions:', error)
    throw error
  }
}