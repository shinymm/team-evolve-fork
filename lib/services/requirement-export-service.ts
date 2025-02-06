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
    let currentSection = ''
    let currentContent: string[] = []
    let isInUserJourney = false

    // 标题到字段的映射
    const titleToField: Record<string, keyof StructuredScene> = {
      '场景名称': 'sceneName',
      '场景概述': 'sceneOverview',
      '前置条件': 'preconditions',
      '用户旅程': 'sceneUserJourney',
      '全局约束条件': 'globalConstraints'
    }

    lines.forEach((line, index) => {
      const titleMatch = line.match(/^#{1,6}\s+(.+)$/)
      if (titleMatch) {
        console.log(`发现标题[${index}]: ${titleMatch[1]}`)
        
        // 保存上一个部分的内容
        if (currentSection && titleToField[currentSection]) {
          const content = currentContent.join('\n').trim()
          console.log(`保存上一节内容 - ${currentSection}:`, content)
          sections[titleToField[currentSection]] = content
        }

        currentSection = titleMatch[1]
        isInUserJourney = currentSection === '用户旅程'
        currentContent = []
      } else if (currentSection) {
        currentContent.push(line)
      }
    })

    // 保存最后一个部分的内容
    if (currentSection && titleToField[currentSection]) {
      const content = currentContent.join('\n').trim()
      console.log(`保存最后一节内容 - ${currentSection}:`, content)
      sections[titleToField[currentSection]] = content
    }

    console.log('解析结果:', sections)
    return sections
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
          const optimizedSections = this.parseOptimizedContent(sceneState.optimizeResult)
          
          // 添加场景概述
          if (optimizedSections.sceneOverview) {
            mdContent += formatMarkdownTitle('场景概述', 4)
            mdContent += `${optimizedSections.sceneOverview}\n\n`
          }

          // 添加前置条件
          if (optimizedSections.preconditions) {
            mdContent += formatMarkdownTitle('前置条件', 4)
            mdContent += `${optimizedSections.preconditions}\n\n`
          }

          // 添加用户旅程
          if (optimizedSections.sceneUserJourney) {
            mdContent += formatMarkdownTitle('用户旅程', 4)
            mdContent += optimizedSections.sceneUserJourney + '\n\n'
          }

          // 添加全局约束条件（如果有）
          if (optimizedSections.globalConstraints) {
            mdContent += formatMarkdownTitle('全局约束条件', 4)
            mdContent += `${optimizedSections.globalConstraints}\n\n`
          }
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
      const structuredScene: StructuredScene = {
        sceneName: scene.name,
        sceneOverview: scene.overview,
        preconditions: 'N/A',
        sceneUserJourney: '',  // 初始化为空字符串
        globalConstraints: 'N/A'
      }

      if (sceneState?.optimizeResult) {
        console.log('使用优化后的内容:', sceneState.optimizeResult)
        const optimizedSections = this.parseOptimizedContent(sceneState.optimizeResult)
        console.log('优化内容解析结果:', optimizedSections)
        Object.assign(structuredScene, optimizedSections)
      } else {
        console.log('使用原始内容')
        // 如果没有优化结果，则使用原始的用户旅程
        if (scene.userJourney) {
          structuredScene.sceneUserJourney = scene.userJourney.join('\n')
        }
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
    const structuredReq = this.generateStructuredRequirement(content, sceneStates)
    localStorage.setItem('structuredRequirement', JSON.stringify(structuredReq))
  }
} 