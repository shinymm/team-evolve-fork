import { Scene } from '@/types/requirement'

export interface RequirementParseResult {
  reqBackground: string;
  reqBrief: string;
  scenes: Scene[];
}

export class RequirementParserService {
  /**
   * 解析需求书 Markdown 内容
   * @param mdContent Markdown 格式的需求书内容
   * @returns 解析后的需求书对象
   */
  public parseRequirement(mdContent: string): RequirementParseResult {
    const sections = mdContent.split('\n## ');
    
    // 解析需求背景
    const reqBackground = this.extractSection(sections, '一. 需求背景');
    
    // 解析需求概述
    const reqBrief = this.extractSection(sections, '二. 需求概述');
    
    // 解析需求详述中的场景
    const detailSection = this.extractSection(sections, '三. 需求详述');
    const scenes = this.parseScenes(detailSection);

    const result: RequirementParseResult = {
      reqBackground,
      reqBrief,
      scenes
    };

    // 保存结构化结果到 localStorage
    try {
      localStorage.setItem('requirement-structured-content', JSON.stringify(result));
    } catch (error) {
      console.error('Failed to save structured requirement to localStorage:', error);
    }

    return result;
  }

  private extractSection(sections: string[], sectionTitle: string): string {
    console.log('Extracting section:', sectionTitle);
    console.log('Available sections:', sections.map(s => s.trim().split('\n')[0]));
    
    const section = sections.find(s => s.trim().startsWith(sectionTitle));
    if (!section) {
      console.log('Section not found:', sectionTitle);
      return '';
    }
    
    console.log('Found section:', section);
    
    // 移除标题并清理内容
    const content = section.replace(sectionTitle, '').trim();
    console.log('Content after removing title:', content);

    // 如果内容包含下一个章节的标题，只取到该标题之前的内容
    const nextSectionIndex = content.indexOf('\n## ');
    const finalContent = nextSectionIndex > -1 ? content.slice(0, nextSectionIndex).trim() : content.trim();
    
    console.log('Final content:', finalContent);
    return finalContent;
  }

  private parseScenes(detailSection: string): Scene[] {
    if (!detailSection) {
      console.log('No detail section found');
      return [];
    }

    console.log('Detail section:', detailSection);

    const scenes: Scene[] = [];
    // 分割出所有场景块
    const sceneBlocks = detailSection.split(/(?=### \d+\. 场景\d+[：:])/).filter(block => block.trim());
    console.log('Found scene blocks:', sceneBlocks.length);

    for (const block of sceneBlocks) {
      console.log('Processing block:', block);
      
      // 提取场景名称 - 支持中文冒号和英文冒号
      const nameMatch = block.match(/### \d+\. 场景\d+[：:]\s*(.+?)(?:\n|$)/);
      const sceneName = nameMatch ? nameMatch[1].trim() : '';
      console.log('Scene name:', sceneName);

      if (sceneName) {
        scenes.push({
          name: sceneName,
          content: block.trim()  // 保存完整的场景内容
        });
      }
    }

    console.log('Final scenes:', scenes);
    return scenes;
  }
} 