import { RequirementContent } from '@/types/requirement'
import { SceneAnalysisState } from '@/types/scene'

export class RequirementExportService {
  generateOptimizedBook(content: RequirementContent, sceneStates: Record<string, SceneAnalysisState>): string {
    let mdContent = ''

    // 添加需求背景
    mdContent += '# 需求书\n\n'
    mdContent += '## 需求背景\n\n'
    mdContent += `${content.reqBackground}\n\n`

    // 添加需求概述
    mdContent += '## 需求概述\n\n'
    mdContent += `${content.reqBrief}\n\n`

    // 添加需求详情（场景）
    mdContent += '## 需求详情\n\n'
    content.scenes.forEach((scene, index) => {
      const sceneState = sceneStates[scene.name]
      mdContent += `### ${index + 1}. ${scene.name}\n\n`

      // 场景概述（使用优化后的内容如果有的话）
      mdContent += '#### 场景概述\n\n'
      if (sceneState?.optimizeResult) {
        mdContent += `${sceneState.optimizeResult}\n\n`
      } else {
        mdContent += `${scene.overview}\n\n`
      }

      // 用户旅程
      mdContent += '#### 用户旅程\n\n'
      scene.userJourney.forEach((step, stepIndex) => {
        mdContent += `${stepIndex + 1}. ${step}\n`
      })
      mdContent += '\n'

      // 如果有边界分析结果，添加相关内容
      if (sceneState?.analysisResult) {
        // 从分析结果中提取前置条件、约束条件、异常处理等
        mdContent += this.formatAnalysisResult(sceneState.analysisResult)
      }

      mdContent += '\n---\n\n' // 场景之间的分隔线
    })

    return mdContent
  }

  private formatAnalysisResult(analysisResult: string): string {
    let formattedContent = ''

    // 分析结果中可能包含的各个部分
    const sections = [
      { title: '前置条件', content: '' },
      { title: '约束条件', content: '' },
      { title: '异常处理', content: '' },
      { title: '补充说明', content: '' }
    ]

    // 使用正则表达式从分析结果中提取各个部分
    sections.forEach(section => {
      const regex = new RegExp(`${section.title}[：:](.*?)(?=(?:${sections.map(s => s.title).join('|')})[：:]|$)`, 's')
      const match = analysisResult.match(regex)
      if (match) {
        section.content = match[1].trim()
        formattedContent += `#### ${section.title}\n\n${section.content}\n\n`
      }
    })

    return formattedContent
  }
} 