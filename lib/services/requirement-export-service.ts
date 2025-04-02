import { RequirementContent } from '@/types/requirement'
import { SceneAnalysisState } from '@/types/scene'

// 定义结构化场景对象
export type StructuredScene = {
  sceneName: string
  sceneOverview: string
  preconditions: string
  sceneUserJourney: string  // 用户旅程（包含步骤、规则和异常处理）
  globalConstraints: string
}

// 定义完整的结构化需求书对象
export type StructuredRequirement = {
  reqBackground: string
  reqBrief: string
  sceneList: StructuredScene[]
}

function formatMarkdownTitle(title: string, level: number): string {
  return `${'#'.repeat(level)} ${title}\n\n`
}

export class RequirementExportService {
  /**
   * 从优化结果中解析结构化内容
   */
  private static parseOptimizedContent(optimizeResult: string): Partial<StructuredScene> {
    console.log('开始解析优化结果:', optimizeResult)
    
    const sections: Partial<StructuredScene> = {}
    const lines = optimizeResult.split('\n')
    let currentContent: string[] = []

    // 检查是否是优化后的格式（以"# 场景名称"开头）
    const isOptimizedFormat = lines[0]?.trim().startsWith('# 场景名称')

    // 如果是优化后的格式，直接使用整个内容
    if (isOptimizedFormat) {
      return {
        sceneName: lines[0].replace('# 场景名称', '').trim(),
        sceneOverview: optimizeResult  // 保存完整内容
      }
    }

    // 如果是原始格式，尝试提取场景名称和概述
    const sceneNameMatch = optimizeResult.match(/^#\s+(.+?)\s*(?:，|,)?\s*场景概述：(.+?)(?:\n|$)/m)
    if (sceneNameMatch) {
      return {
        sceneName: sceneNameMatch[1].trim(),
        sceneOverview: optimizeResult  // 保存完整内容
      }
    }

    // 如果都不匹配，返回原始内容
    return {
      sceneName: '',
      sceneOverview: optimizeResult
    }
  }

  /**
   * 生成优化后的需求书
   */
  static generateOptimizedBook(content: RequirementContent, sceneStates: Record<string, SceneAnalysisState>): string {
    let mdContent = ''

    // 添加标题
    mdContent += formatMarkdownTitle('需求书', 1)

    // 添加需求背景
    mdContent += formatMarkdownTitle('需求背景', 2)
    mdContent += `${content.reqBackground}\n\n`

    // 添加需求概述
    mdContent += formatMarkdownTitle('需求概述', 2)
    mdContent += `${content.reqBrief}\n\n`

    // 添加需求详情
    mdContent += formatMarkdownTitle('需求详情', 2)

    // 添加场景详情
    content.scenes.forEach((scene, index) => {
      const sceneState = sceneStates[scene.name]
      
      // 添加场景标题
      mdContent += formatMarkdownTitle(`${index + 1}. ${scene.name}`, 3)

      try {
        if (sceneState?.optimizeResult) {
          // 直接使用优化后的内容，不再添加额外的标题
          mdContent += `${sceneState.optimizeResult}\n\n`
        } else {
          // 使用原始内容
          mdContent += formatMarkdownTitle('场景概述', 4)
          mdContent += `${scene.overview || 'N/A'}\n\n`
          
          mdContent += formatMarkdownTitle('用户旅程', 4)
          mdContent += `${scene.userJourney ? scene.userJourney.join('\n') : 'N/A'}\n\n`
        }
      } catch (error) {
        console.error(`Error processing scene ${scene.name}:`, error)
        // 发生错误时使用基本内容
        mdContent += formatMarkdownTitle('场景概述', 4)
        mdContent += `${scene.overview || 'N/A'}\n\n`
        
        mdContent += formatMarkdownTitle('用户旅程', 4)
        mdContent += `${scene.userJourney ? scene.userJourney.join('\n') : 'N/A'}\n\n`
      }

      mdContent += '---\n\n' // 场景之间的分隔线
    })

    return mdContent
  }

  /**
   * 生成结构化的需求书对象
   */
  static generateStructuredRequirement(content: RequirementContent, sceneStates: Record<string, SceneAnalysisState>): StructuredRequirement {
    console.log('开始生成结构化需求书')
    
    const structuredReq: StructuredRequirement = {
      reqBackground: content.reqBackground,
      reqBrief: content.reqBrief,
      sceneList: []
    }

    content.scenes.forEach(scene => {
      console.log(`处理场景: ${scene.name}`)
      const sceneState = sceneStates[scene.name]
      
      // 创建基本的场景结构
      const structuredScene: StructuredScene = {
        sceneName: scene.name,
        sceneOverview: '',  // 将在下面设置
        preconditions: 'N/A',
        sceneUserJourney: '',
        globalConstraints: 'N/A'
      }

      if (sceneState?.optimizeResult) {
        console.log('使用优化后的内容')
        // 直接使用优化后的完整内容作为场景概述
        structuredScene.sceneOverview = sceneState.optimizeResult
      } else {
        console.log('使用原始内容')
        // 如果没有优化结果，使用原始内容
        structuredScene.sceneOverview = scene.overview || ''
        structuredScene.sceneUserJourney = scene.userJourney ? scene.userJourney.join('\n') : ''
      }

      console.log('最终场景结构:', structuredScene)
      structuredReq.sceneList.push(structuredScene)
    })

    console.log('最终结构化需求书:', structuredReq)
    return structuredReq
  }

  /**
   * 保存结构化需求书到 localStorage
   */
  static saveStructuredRequirementToStorage(content: RequirementContent, sceneStates: Record<string, SceneAnalysisState>): void {
    try {
      // 验证输入参数
      if (!content || !sceneStates) {
        console.error('保存结构化需求书失败：参数无效', { content, sceneStates })
        throw new Error('无效的需求内容或场景状态')
      }

      const structuredReq = this.generateStructuredRequirement(content, sceneStates)

      // 验证生成的结构化需求
      if (!structuredReq.reqBackground || !structuredReq.reqBrief || !Array.isArray(structuredReq.sceneList)) {
        console.error('生成的结构化需求格式无效:', structuredReq)
        throw new Error('生成的结构化需求格式无效')
      }

      // 验证数据是否可以被正确序列化
      const jsonString = JSON.stringify(structuredReq)
      // 验证序列化后的数据是否可以被正确解析
      JSON.parse(jsonString)

      // 保存到 localStorage
      localStorage.setItem('structuredRequirement', jsonString)
      
      console.log('结构化需求保存成功:', {
        reqBackgroundLength: structuredReq.reqBackground.length,
        reqBriefLength: structuredReq.reqBrief.length,
        sceneCount: structuredReq.sceneList.length
      })
    } catch (error) {
      console.error('保存结构化需求书失败:', error)
      throw error
    }
  }
} 