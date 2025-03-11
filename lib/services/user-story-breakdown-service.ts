import { userStoryBreakdownPrompt } from '../prompts';
import { streamingAICall } from '../ai-service';
import type { AIModelConfig } from '../ai-service';
import { getAIConfig } from '../ai-config-service';

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

      // 使用getAIConfig获取AI配置，与其他页面保持一致
      const config = getAIConfig();
      
      if (!config) {
        throw new Error('未找到AI配置信息');
      }

      // 添加调试日志
      console.log('用户故事拆解使用的模型配置:', {
        model: config.model,
        baseURL: config.baseURL,
        temperature: config.temperature,
        isGemini: config.model.toLowerCase().startsWith('gemini')
      });

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