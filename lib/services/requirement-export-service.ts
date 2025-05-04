import { RequirementContent } from '@/types/requirement'
import { SceneAnalysisState } from '@/types/scene'

// 定义结构化场景对象
export type StructuredScene = {
  sceneName: string
  content: string  // 场景的完整内容，包括概述、用户旅程等
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

// 清理分隔线的函数
function cleanSeparators(content: string): string {
  // 移除文本中的Markdown分隔线
  return content.replace(/^\s*---\s*$/gm, '');
}

export class RequirementExportService {
  /**
   * 从优化结果中解析结构化内容
   */
  private static parseOptimizedContent(optimizeResult: string): Partial<StructuredScene> {
    console.log('开始解析优化结果:', optimizeResult)
    
    const sections: Partial<StructuredScene> = {}
    const lines = optimizeResult.split('\n')

    // 检查是否是优化后的格式（以"# 场景名称"开头）
    const isOptimizedFormat = lines[0]?.trim().startsWith('# 场景名称')

    // 如果是优化后的格式，直接使用整个内容
    if (isOptimizedFormat) {
      return {
        sceneName: lines[0].replace('# 场景名称', '').trim(),
        content: optimizeResult  // 保存完整内容
      }
    }

    // 如果是原始格式，尝试提取场景名称和内容
    const sceneNameMatch = optimizeResult.match(/^#\s+(.+?)\s*(?:，|,)?\s*场景概述：(.+?)(?:\n|$)/m)
    if (sceneNameMatch) {
      return {
        sceneName: sceneNameMatch[1].trim(),
        content: optimizeResult  // 保存完整内容
      }
    }

    // 如果都不匹配，返回原始内容
    return {
      sceneName: '',
      content: optimizeResult
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
    mdContent += `${cleanSeparators(content.reqBackground)}\n\n`

    // 添加需求概述
    mdContent += formatMarkdownTitle('需求概述', 2)
    mdContent += `${cleanSeparators(content.reqBrief)}\n\n`

    // 添加需求详情
    mdContent += formatMarkdownTitle('需求详情', 2)

    // 添加场景详情
    content.scenes.forEach((scene, index) => {
      const sceneState = sceneStates[scene.name]
      
      // 添加场景标题
      mdContent += formatMarkdownTitle(`${index + 1}. ${scene.name}`, 3)

      try {
        if (sceneState?.optimizeResult) {
          // 直接使用优化后的内容，并清理分隔线
          mdContent += `${cleanSeparators(sceneState.optimizeResult)}\n\n`
        } else {
          // 使用原始内容，并清理分隔线
          mdContent += cleanSeparators(scene.content) + '\n\n'
        }
      } catch (error) {
        console.error(`Error processing scene ${scene.name}:`, error)
        // 发生错误时使用原始内容，并清理分隔线
        mdContent += cleanSeparators(scene.content) + '\n\n'
      }
    })

    return mdContent
  }

  /**
   * 生成结构化的需求书对象
   */
  static generateStructuredRequirement(content: RequirementContent, sceneStates: Record<string, SceneAnalysisState>): StructuredRequirement {
    console.log('开始生成结构化需求书')
    
    const structuredReq: StructuredRequirement = {
      reqBackground: cleanSeparators(content.reqBackground),
      reqBrief: cleanSeparators(content.reqBrief),
      sceneList: []
    }

    content.scenes.forEach(scene => {
      console.log(`处理场景: ${scene.name}`)
      
      // 创建场景结构 - 直接使用场景的content，因为优化后的内容已经被保存到那里了
      // 清理场景内容中的分隔线
      const structuredScene: StructuredScene = {
        sceneName: scene.name,
        content: cleanSeparators(scene.content)
      }

      console.log('最终场景结构:', structuredScene)
      structuredReq.sceneList.push(structuredScene)
    })

    console.log('最终结构化需求书:', structuredReq)
    return structuredReq
  }

  /**
   * 保存结构化需求书到 localStorage
   * @param content 需求内容
   * @param sceneStates 场景状态
   * @param systemId 系统ID
   */
  static saveStructuredRequirementToStorage(
    content: RequirementContent, 
    sceneStates: Record<string, SceneAnalysisState>,
    systemId?: string
  ): void {
    try {
      // 验证输入参数
      if (!content || !sceneStates) {
        console.error('保存结构化需求书失败：参数无效', { content, sceneStates })
        throw new Error('无效的需求内容或场景状态')
      }

      // 验证场景数据完整性
      if (!Array.isArray(content.scenes)) {
        throw new Error('场景列表格式无效')
      }

      content.scenes.forEach((scene, index) => {
        if (!scene.name || !scene.content) {
          console.error(`场景 ${index + 1} 数据不完整:`, scene)
          throw new Error(`场景 ${index + 1} 数据不完整: 缺少必要字段`)
        }
      })

      const structuredReq = this.generateStructuredRequirement(content, sceneStates)

      // 验证生成的结构化需求
      if (!structuredReq.reqBackground || !structuredReq.reqBrief || !Array.isArray(structuredReq.sceneList)) {
        console.error('生成的结构化需求格式无效:', structuredReq)
        throw new Error('生成的结构化需求格式无效')
      }

      // 验证场景列表数据完整性
      structuredReq.sceneList.forEach((scene, index) => {
        if (!scene.sceneName || !scene.content) {
          console.error(`结构化场景 ${index + 1} 数据不完整:`, scene)
          throw new Error(`结构化场景 ${index + 1} 数据不完整: 缺少必要字段`)
        }
      })

      // 验证数据是否可以被正确序列化
      const jsonString = JSON.stringify(structuredReq)
      // 验证序列化后的数据是否可以被正确解析
      const parsedReq = JSON.parse(jsonString)

      // 再次验证解析后的数据
      if (!parsedReq.reqBackground || !parsedReq.reqBrief || !Array.isArray(parsedReq.sceneList)) {
        throw new Error('序列化后的数据格式无效')
      }

      // 确定存储键名
      const storageKey = systemId 
        ? `structuredRequirement_${systemId}` 
        : 'structuredRequirement';

      // 保存到 localStorage
      localStorage.setItem(storageKey, jsonString)
      
      // 向后兼容，对于旧版本，始终保存一个无系统ID的副本
      if (systemId) {
        localStorage.setItem('structuredRequirement', jsonString)
      }
      
      console.log(`结构化需求保存成功${systemId ? ` (系统ID: ${systemId})` : ''}:`, {
        reqBackgroundLength: structuredReq.reqBackground.length,
        reqBriefLength: structuredReq.reqBrief.length,
        sceneCount: structuredReq.sceneList.length,
        scenes: structuredReq.sceneList.map(scene => ({
          name: scene.sceneName,
          contentLength: scene.content.length
        }))
      })
    } catch (error) {
      console.error('保存结构化需求书失败:', error)
      throw error
    }
  }
} 