import { userStoryBreakdownPrompt } from '../prompts';
import { streamingAICall } from '../ai-service';
import type { AIModelConfig } from '../ai-service';

export class UserStoryBreakdownService {
  async breakdownUserStory(sceneDescription: string): Promise<(onContent: (content: string) => void) => void> {
    try {
      // 从localStorage获取需求背景
      const structuredRequirement = localStorage.getItem('structuredRequirement');
      const reqBackground = structuredRequirement 
        ? JSON.parse(structuredRequirement).background 
        : '';

      // 替换prompt模板中的变量
      const prompt = userStoryBreakdownPrompt
        .replace('{{reqBackground}}', reqBackground)
        .replace('{{sceneDescription}}', sceneDescription);

      // 从localStorage获取AI配置
      const aiConfig = localStorage.getItem('aiModelConfigs');
      if (!aiConfig) {
        throw new Error('未找到AI配置信息');
      }

      const configs = JSON.parse(aiConfig);
      const defaultConf = configs.find((c: any) => c.isDefault);
      if (!defaultConf) {
        throw new Error('未找到默认AI配置');
      }

      const config: AIModelConfig = {
        model: defaultConf.model,
        apiKey: defaultConf.apiKey,
        baseURL: defaultConf.baseURL,
        temperature: defaultConf.temperature
      };

      // 返回一个函数，该函数接受回调函数作为参数
      return (onContent: (content: string) => void) => {
        streamingAICall(prompt, config, onContent);
      };
    } catch (error) {
      console.error('Error in breaking down user story:', error);
      throw error;
    }
  }
}

export const userStoryBreakdownService = new UserStoryBreakdownService(); 