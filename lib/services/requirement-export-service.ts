import { RequirementContent } from '@/types/requirement'
import { SceneAnalysisState } from '@/types/scene'

// 定义模板部分的类型
type TemplateSection = {
  title: string
  level: number
  key?: string
  formatter?: (content: any) => string
}

// 定义分析结果的部分
type AnalysisSection = '前置条件' | '约束条件' | '异常处理' | '补充说明'

// 定义结构化场景对象
export type StructuredScene = {
  sceneName: string
  sceneOverview: string
  sceneUserJourney: string[]
  preconditions: string    // 前置条件
  constraints: string      // 约束条件
  exceptions: string       // 异常处理
  notes: string           // 补充说明
}

// 定义完整的结构化需求书对象
export type StructuredRequirement = {
  reqBackground: string
  reqBrief: string
  sceneList: StructuredScene[]
}

// 需求书模板定义
const REQUIREMENT_TEMPLATE: TemplateSection[] = [
  { title: '需求书', level: 1 },
  { title: '需求背景', level: 2, key: 'reqBackground' },
  { title: '需求概述', level: 2, key: 'reqBrief' },
  { title: '需求详情', level: 2 }
]

// 场景模板定义
const SCENE_TEMPLATE: TemplateSection[] = [
  { title: '场景概述', level: 4 },
  { title: '用户旅程', level: 4, formatter: (steps: string[]) => formatUserJourney(steps) },
  { title: '前置条件', level: 4 },
  { title: '约束条件', level: 4 },
  { title: '异常处理', level: 4 },
  { title: '补充说明', level: 4 }
]

// 格式化工具函数
function formatUserJourney(steps: string[] | string): string {
  if (!steps) return 'N/A'
  if (typeof steps === 'string') return steps
  if (!Array.isArray(steps)) return 'N/A'
  return steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
}

function formatMarkdownTitle(title: string, level: number): string {
  return `${'#'.repeat(level)} ${title}\n\n`
}

function formatSection(section: TemplateSection, content: any): string {
  if (!content) return ''
  const titleMd = formatMarkdownTitle(section.title, section.level)
  const formattedContent = section.formatter ? section.formatter(content) : content
  return `${titleMd}${formattedContent}\n\n`
}

export class RequirementExportService {
  /**
   * 从分析结果中提取结构化内容
   */
  private static parseAnalysisResult(analysisResult: string): Record<AnalysisSection, string> {
    const sections: Record<AnalysisSection, string> = {
      '前置条件': '',
      '约束条件': '',
      '异常处理': '',
      '补充说明': ''
    }

    // 使用正则表达式从分析结果中提取各个部分
    Object.keys(sections).forEach(sectionTitle => {
      const regex = new RegExp(`${sectionTitle}[：:](.*?)(?=(?:${Object.keys(sections).join('|')})[：:]|$)`, 's')
      const match = analysisResult.match(regex)
      if (match) {
        sections[sectionTitle as AnalysisSection] = match[1].trim()
      }
    })

    return sections
  }

  /**
   * 从优化结果中解析结构化内容
   */
  private static parseOptimizedContent(optimizeResult: string): Record<string, string> {
    const sections: Record<string, string> = {}
    const lines = optimizeResult.split('\n')
    let currentSection = ''
    let currentContent: string[] = []

    lines.forEach(line => {
      const titleMatch = line.match(/^#{1,6}\s+(.+)$/)
      if (titleMatch) {
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n').trim()
        }
        currentSection = titleMatch[1]
        currentContent = []
      } else if (currentSection) {
        currentContent.push(line)
      }
    })

    if (currentSection) {
      sections[currentSection] = currentContent.join('\n').trim()
    }

    return sections
  }

  /**
   * 生成优化后的需求书
   */
  static generateOptimizedBook(content: RequirementContent, sceneStates: Record<string, SceneAnalysisState>): string {
    let mdContent = ''

    // 添加基本信息（需求背景和概述）
    REQUIREMENT_TEMPLATE.forEach(section => {
      if (section.key) {
        mdContent += formatSection(section, content[section.key as keyof RequirementContent])
      } else {
        mdContent += formatMarkdownTitle(section.title, section.level)
      }
    })

    // 添加场景详情
    content.scenes.forEach((scene, index) => {
      const sceneState = sceneStates[scene.name]
      
      // 添加场景标题
      mdContent += formatMarkdownTitle(`${index + 1}. ${scene.name}`, 3)

      try {
        if (sceneState?.optimizeResult) {
          // 使用优化后的内容
          const optimizedSections = this.parseOptimizedContent(sceneState.optimizeResult)
          SCENE_TEMPLATE.forEach(section => {
            if (optimizedSections[section.title]) {
              mdContent += formatSection(section, optimizedSections[section.title])
            }
          })
        } else {
          // 使用原始内容和分析结果
          mdContent += formatSection(SCENE_TEMPLATE[0], scene.overview || 'N/A')
          mdContent += formatSection(SCENE_TEMPLATE[1], scene.userJourney || [])
          
        }
      } catch (error) {
        console.error(`Error processing scene ${scene.name}:`, error)
        // 发生错误时使用基本内容
        mdContent += formatSection(SCENE_TEMPLATE[0], scene.overview || 'N/A')
        mdContent += formatSection(SCENE_TEMPLATE[1], scene.userJourney || [])
      }

      mdContent += '---\n\n' // 场景之间的分隔线
    })

    return mdContent
  }

  /**
   * 生成结构化的需求书对象
   */
  static generateStructuredRequirement(content: RequirementContent, sceneStates: Record<string, SceneAnalysisState>): StructuredRequirement {
    const structuredReq: StructuredRequirement = {
      reqBackground: content.reqBackground,
      reqBrief: content.reqBrief,
      sceneList: []
    }

    content.scenes.forEach(scene => {
      const sceneState = sceneStates[scene.name]
      const structuredScene: Partial<StructuredScene> = {
        sceneName: scene.name,
        sceneOverview: scene.overview,
        sceneUserJourney: scene.userJourney,
        preconditions: 'N/A',
        constraints: 'N/A',
        exceptions: 'N/A',
        notes: 'N/A'
      }

      if (sceneState?.optimizeResult) {
        // 使用优化后的内容
        const optimizedSections = this.parseOptimizedContent(sceneState.optimizeResult)
        // 映射中文属性名到英文属性名
        const titleMapping: Record<string, Exclude<keyof StructuredScene, 'sceneName' | 'sceneOverview' | 'sceneUserJourney'>> = {
          '前置条件': 'preconditions',
          '约束条件': 'constraints',
          '异常处理': 'exceptions',
          '补充说明': 'notes'
        }
        Object.entries(optimizedSections).forEach(([title, content]) => {
          const englishTitle = titleMapping[title]
          if (englishTitle && content && typeof content === 'string') {
            structuredScene[englishTitle] = content
          }
        })
      } else if (sceneState?.analysisResult) {
        // 使用原始分析结果
        const analysisResults = this.parseAnalysisResult(sceneState.analysisResult)
        const titleMapping: Record<AnalysisSection, Exclude<keyof StructuredScene, 'sceneName' | 'sceneOverview' | 'sceneUserJourney'>> = {
          '前置条件': 'preconditions',
          '约束条件': 'constraints',
          '异常处理': 'exceptions',
          '补充说明': 'notes'
        }
        Object.entries(analysisResults).forEach(([title, content]) => {
          if (content && typeof content === 'string') {
            const englishTitle = titleMapping[title as AnalysisSection]
            if (englishTitle) {
              structuredScene[englishTitle] = content
            }
          }
        })
      }

      structuredReq.sceneList.push(structuredScene as StructuredScene)
    })

    return structuredReq
  }

  /**
   * 保存结构化需求书到 localStorage
   */
  static saveStructuredRequirementToStorage(content: RequirementContent, sceneStates: Record<string, SceneAnalysisState>): void {
    const structuredReq = this.generateStructuredRequirement(content, sceneStates)
    localStorage.setItem('structuredRequirement', JSON.stringify(structuredReq))
    // console.log(structuredReq)
  }
} 