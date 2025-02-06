interface Scene {
  name: string;
  overview: string;
  userJourney: string[];
  systemResponse?: string;
  expectedResult?: string;
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
    // 首先分割出所有场景块
    const sceneBlocks = detailSection.split(/(?=### \d+\. 场景\d+[：:])/).filter(block => block.trim());
    console.log('Found scene blocks:', sceneBlocks.length);

    for (const block of sceneBlocks) {
      console.log('Processing block:', block);
      
      // 提取场景名称 - 支持中文冒号和英文冒号
      const nameMatch = block.match(/### \d+\. 场景\d+[：:]\s*(.+?)(?:\n|$)/);
      const sceneName = nameMatch ? nameMatch[1].trim() : '';
      console.log('Scene name:', sceneName);
      
      // 提取场景概述 - 适配新格式
      const overviewSection = block.match(/#### \d+\.\d+\s*场景概述\s*([\s\S]*?)(?=#### \d+\.\d+\s*用户旅程|$)/);
      let overview = '';
      
      if (overviewSection && overviewSection[1]) {
        // 提取所有标签行
        const lines = overviewSection[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line);

        // 处理每一行，将标签行转换为普通文本
        overview = lines
          .map(line => {
            const tagMatch = line.match(/\*\*([^*]+)\*\*[：:]\s*(.+)/);
            if (tagMatch) {
              return `${tagMatch[1]}：${tagMatch[2]}`;
            }
            return line;
          })
          .join('\n');
      }
      
      console.log('Scene overview section:', overviewSection);
      console.log('Scene overview:', overview);

      // 提取用户旅程 - 同时兼容新旧格式
      const journeyMatch = block.match(/(?:#### \d+\.\d+\s*用户旅程|用户旅程)\s*([\s\S]*?)(?=(?:#### \d+\.\d+|###|---|\*\*系统响应\*\*|$))/);
      const journeyText = journeyMatch ? journeyMatch[1] : '';
      console.log('Journey text:', journeyText);
      
      let steps: string[] = [];
      let systemResponse: string | undefined;
      let expectedResult: string | undefined;

      // 检查是否包含系统响应和预期结果（新格式）
      if (journeyText.includes('**系统响应**')) {
        // 新格式：包含系统响应和预期结果
        steps = journeyText
          .split('\n')
          .filter(line => /^\d+\./.test(line.trim()))
          .map(line => line.replace(/^\d+\.\s*/, '').trim());

        // 提取系统响应和预期结果
        const responseAndResult = block.match(/\*\*系统响应\*\*[：:]\s*([\s\S]*?)(?:\*\*预期结果\*\*[：:]\s*([\s\S]*?)(?=(?:#### \d+\.\d+|###|---|$)))?/);
        
        if (responseAndResult) {
          systemResponse = responseAndResult[1]?.trim();
          expectedResult = responseAndResult[2]?.trim();
        }
      } else {
        // 旧格式：只包含用户旅程步骤
        steps = journeyText
          .split('\n')
          .filter(line => line.trim() && /^\d+\./.test(line.trim()))
          .map(line => line.replace(/^\d+\.\s*/, '').trim());
      }

      console.log('User journey steps:', steps);
      console.log('System response:', systemResponse);
      console.log('Expected result:', expectedResult);

      if (sceneName) {
        scenes.push({
          name: sceneName,
          overview,
          userJourney: steps,
          systemResponse,
          expectedResult
        });
      }
    }

    console.log('Final scenes:', scenes);
    return scenes;
  }
} 