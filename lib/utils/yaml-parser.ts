import yaml from 'js-yaml';

export interface UserStory {
  story: string;
  description: string;
  acceptance_criteria: string[];
  non_functional_requirements?: string[];
}

export interface Feature {
  feature: string;
  stories: UserStory[];
}

export function parseUserStoryYaml(yamlContent: string): Feature[] {
  try {
    // 检查是否被包裹在markdown代码块中
    const yamlMatch = yamlContent.match(/```(?:yaml)?\s*([\s\S]*?)```/);
    const contentToProcess = yamlMatch ? yamlMatch[1].trim() : yamlContent;
    
    // 清理YAML内容，移除多余的空行
    const cleanedYaml = contentToProcess
      .replace(/\n\s*\n/g, '\n') // 替换连续的空行为单个换行
      .trim();
    
    console.log('清理后的YAML内容:', cleanedYaml);
    
    // 解析YAML
    const parsed = yaml.load(cleanedYaml) as any[];
    
    console.log('解析后的YAML对象:', parsed);
    
    if (!Array.isArray(parsed)) {
      console.error('解析的YAML不是数组格式', parsed);
      return [];
    }
    
    // 转换为Feature数组
    const features: Feature[] = parsed.map(item => {
      if (!item || typeof item !== 'object') {
        console.error('YAML项不是对象:', item);
        return { feature: '未知功能', stories: [] };
      }
      
      return {
        feature: item.feature || '未命名功能',
        stories: Array.isArray(item.stories) 
          ? item.stories.map((story: any) => {
              if (!story || typeof story !== 'object') {
                console.error('故事项不是对象:', story);
                return {
                  story: '未知故事',
                  description: '',
                  acceptance_criteria: [],
                  non_functional_requirements: []
                };
              }
              
              return {
                story: story.story || '',
                description: story.description || '',
                acceptance_criteria: Array.isArray(story.acceptance_criteria) 
                  ? story.acceptance_criteria 
                  : [],
                non_functional_requirements: Array.isArray(story.non_functional_requirements)
                  ? story.non_functional_requirements
                  : []
              };
            })
          : []
      };
    });
    
    console.log('转换后的Feature数组:', features);
    
    return features;
  } catch (error) {
    console.error('解析YAML时出错:', error);
    // 尝试手动解析
    try {
      console.log('尝试手动解析YAML...');
      return manualParseYaml(yamlContent);
    } catch (manualError) {
      console.error('手动解析YAML也失败:', manualError);
      return [];
    }
  }
}

// 手动解析YAML的简单实现
function manualParseYaml(yamlContent: string): Feature[] {
  // 检查是否被包裹在markdown代码块中
  const yamlMatch = yamlContent.match(/```(?:yaml)?\s*([\s\S]*?)```/);
  const contentToProcess = yamlMatch ? yamlMatch[1].trim() : yamlContent;
  
  const features: Feature[] = [];
  let currentFeature: Feature | null = null;
  let currentStory: UserStory | null = null;
  let inAcceptanceCriteria = false;
  let inNonFunctionalRequirements = false;
  
  // 分割行并处理
  const lines = contentToProcess.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // 跳过空行
    if (!trimmedLine) continue;
    
    // 检测功能行
    if (trimmedLine.startsWith('- feature:')) {
      const featureName = trimmedLine.substring('- feature:'.length).trim();
      currentFeature = { feature: featureName, stories: [] };
      features.push(currentFeature);
      currentStory = null;
      inAcceptanceCriteria = false;
      inNonFunctionalRequirements = false;
    } 
    // 检测故事行
    else if (trimmedLine.startsWith('- story:') && currentFeature) {
      const storyTitle = trimmedLine.substring('- story:'.length).trim();
      currentStory = { 
        story: storyTitle, 
        description: '', 
        acceptance_criteria: [],
        non_functional_requirements: []
      };
      currentFeature.stories.push(currentStory);
      inAcceptanceCriteria = false;
      inNonFunctionalRequirements = false;
    }
    // 检测描述行
    else if (trimmedLine.startsWith('description:') && currentStory) {
      currentStory.description = trimmedLine.substring('description:'.length).trim();
      inAcceptanceCriteria = false;
      inNonFunctionalRequirements = false;
    }
    // 检测验收标准标题行
    else if (trimmedLine === 'acceptance_criteria:' && currentStory) {
      inAcceptanceCriteria = true;
      inNonFunctionalRequirements = false;
    }
    // 检测非功能需求标题行
    else if (trimmedLine === 'non_functional_requirements:' && currentStory) {
      inAcceptanceCriteria = false;
      inNonFunctionalRequirements = true;
    }
    // 检测列表项
    else if (trimmedLine.startsWith('- ') && currentStory) {
      const item = trimmedLine.substring('- '.length).trim();
      
      if (inNonFunctionalRequirements) {
        if (!currentStory.non_functional_requirements) {
          currentStory.non_functional_requirements = [];
        }
        currentStory.non_functional_requirements.push(item);
      } else if (inAcceptanceCriteria) {
        currentStory.acceptance_criteria.push(item);
      }
    }
  }
  
  console.log('手动解析的结果:', features);
  return features;
} 