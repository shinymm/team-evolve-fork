interface Scene {
  name: string;
  overview: string;
  userJourney: string[];
}

interface RequirementParseResult {
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

    return {
      reqBackground,
      reqBrief,
      scenes
    };
  }

  private extractSection(sections: string[], sectionTitle: string): string {
    const section = sections.find(s => s.trim().startsWith(sectionTitle));
    if (!section) return '';
    
    // 移除标题并清理内容
    const content = section.replace(sectionTitle, '').trim();
    // 如果内容包含下一个章节的标题，只取到该标题之前的内容
    const nextSectionIndex = content.indexOf('\n### ');
    return nextSectionIndex > -1 ? content.slice(0, nextSectionIndex).trim() : content.trim();
  }

  private parseScenes(detailSection: string): Scene[] {
    if (!detailSection) return [];

    const scenes: Scene[] = [];
    const sceneBlocks = detailSection.split('\n### ').filter(block => block.trim());

    for (const block of sceneBlocks) {
      if (!block.includes('场景')) continue;

      const lines = block.split('\n');
      const sceneName = lines[0].replace(/^\d+\.\s*/, '').trim();
      
      // 提取场景概述
      const overviewStartIndex = block.indexOf('场景概述');
      const overviewEndIndex = block.indexOf('用户旅程');
      const overview = overviewStartIndex > -1 && overviewEndIndex > -1
        ? block.slice(overviewStartIndex, overviewEndIndex)
            .replace('场景概述', '')
            .trim()
        : '';

      // 提取用户旅程
      const userJourneyStartIndex = block.indexOf('用户旅程');
      const userJourney = userJourneyStartIndex > -1
        ? block.slice(userJourneyStartIndex)
            .replace('用户旅程', '')
            .split('\n')
            .filter(line => /^\d+\./.test(line.trim()))
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
        : [];

      scenes.push({
        name: sceneName,
        overview,
        userJourney
      });
    }

    return scenes;
  }
} 