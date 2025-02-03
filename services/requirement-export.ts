import { SceneAnalysisState } from "@/types/scene"
import { RequirementContent } from "@/types/requirement"

type SectionKey = '场景概述' | '前置条件' | '用户旅程' | '约束条件' | '异常处理' | '补充说明'
type AnalysisKey = '前置条件' | '约束条件' | '异常处理' | '补充说明'

type SectionContent = Record<SectionKey, string>
type AnalysisContent = Record<AnalysisKey, string>

type RegexMatches<T extends string> = Record<T, RegExpMatchArray | null>

export class RequirementExportService {
  static generateOptimizedBook(
    originalContent: RequirementContent,
    sceneStates: Record<string, SceneAnalysisState>
  ): string {
    let mdContent = ''
    
    // 添加需求背景
    mdContent += '# 需求书\n\n'
    mdContent += '## 需求背景\n\n'
    mdContent += `${originalContent.reqBackground || 'N/A'}\n\n`

    // 添加需求概述
    mdContent += '## 需求概述\n\n'
    mdContent += `${originalContent.reqBrief || 'N/A'}\n\n`

    // 添加场景详情
    mdContent += '## 场景详情\n\n'
    
    originalContent.scenes.forEach((scene, index) => {
      const sceneState = sceneStates[scene.name]
    //   console.log(`\n[Debug] Scene ${index + 1}: ${scene.name}`)
    //   console.log('Scene State:', sceneState)
      
      mdContent += `### ${index + 1}. ${scene.name}\n\n`

      if (sceneState?.optimizeResult) {
        // console.log('[Debug] Using optimized content:', sceneState.optimizeResult)
        // 使用优化后的内容
        const sections = this.parseOptimizedContent(sceneState.optimizeResult)
        // console.log('[Debug] Parsed sections:', sections)
        Object.entries(sections).forEach(([title, content]) => {
          mdContent += `#### ${title}\n${content || 'N/A'}\n\n`
        })
      } else if (sceneState?.analysisResult) {
        // console.log('[Debug] Using analysis result:', sceneState.analysisResult)
        // 使用边界分析结果
        mdContent += `#### 场景概述\n${scene.overview || 'N/A'}\n\n`
        mdContent += `#### 用户旅程\n${this.formatUserJourney(scene.userJourney)}\n\n`
        
        const analysisResults = this.parseAnalysisResult(sceneState.analysisResult)
        console.log('[Debug] Parsed analysis results:', analysisResults)
        Object.entries(analysisResults).forEach(([title, content]) => {
          mdContent += `#### ${title}\n${content || 'N/A'}\n\n`
        })
      } else {
        console.log('[Debug] Using original content')
        // 使用原始内容
        mdContent += `#### 场景概述\n${scene.overview || 'N/A'}\n\n`
        mdContent += `#### 用户旅程\n${this.formatUserJourney(scene.userJourney)}\n\n`
        mdContent += `#### 前置条件\nN/A\n\n`
        mdContent += `#### 约束条件\nN/A\n\n`
        mdContent += `#### 异常处理\nN/A\n\n`
        mdContent += `#### 补充说明\nN/A\n\n`
      }

      mdContent += '---\n\n' // 场景之间的分隔线
    })

    return mdContent
  }

  private static formatUserJourney(journey: string[]): string {
    if (!journey.length) return 'N/A'
    return journey.map((step, index) => `${index + 1}. ${step}`).join('\n')
  }

  private static parseOptimizedContent(content: string): SectionContent {
    console.log('[Debug] Parsing optimized content:', content)
    const sections: SectionContent = {
      '场景概述': '',
      '前置条件': '',
      '用户旅程': '',
      '约束条件': '',
      '异常处理': '',
      '补充说明': ''
    }

    // 将内容按章节标题分割
    const parts = content.split(/###\s+/)
    
    // 遍历每个部分
    parts.forEach(part => {
      const trimmedPart = part.trim()
      if (!trimmedPart || trimmedPart.startsWith('场景名称')) return

      // 提取章节标题和内容
      const lines = trimmedPart.split('\n')
      const title = lines[0].trim() as SectionKey
      const content = lines.slice(1).join('\n').trim()

      if (title in sections) {
        sections[title] = content
      }
    })

    // 确保所有空内容都设置为 N/A
    Object.keys(sections).forEach((key) => {
      const sectionKey = key as SectionKey
      if (!sections[sectionKey]) {
        sections[sectionKey] = 'N/A'
      }
    })

    console.log('[Debug] Final sections:', sections)
    return sections
  }

  private static parseAnalysisResult(content: string): AnalysisContent {
    console.log('[Debug] Parsing analysis result:', content)
    const sections: AnalysisContent = {
      '前置条件': '',
      '约束条件': '',
      '异常处理': '',
      '补充说明': ''
    }

    // 将内容按章节标题分割
    const parts = content.split(/###\s+/)
    
    // 遍历每个部分
    parts.forEach(part => {
      const trimmedPart = part.trim()
      if (!trimmedPart || trimmedPart.startsWith('场景名称')) return

      // 提取章节标题和内容
      const lines = trimmedPart.split('\n')
      const title = lines[0].trim() as AnalysisKey
      const content = lines.slice(1).join('\n').trim()

      if (title in sections) {
        sections[title] = content
      }
    })

    // 确保所有空内容都设置为 N/A
    Object.keys(sections).forEach((key) => {
      const sectionKey = key as AnalysisKey
      if (!sections[sectionKey]) {
        sections[sectionKey] = 'N/A'
      }
    })

    console.log('[Debug] Final analysis sections:', sections)
    return sections
  }
} 