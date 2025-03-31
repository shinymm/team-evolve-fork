import { userStoryBreakdownPrompt } from '../prompts';
import { streamingAICall } from './ai-service';

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

      // 返回一个函数，该函数接受回调函数作为参数
      return (onContent: (content: string) => void) => {
        streamingAICall(
          prompt, 
          onContent,
          (error: string) => {
            throw new Error(`用户故事拆解失败: ${error}`)
          }
        );
      };
    } catch (error) {
      console.error('Error in breaking down user story:', error);
      throw error;
    }
  }
}

export const userStoryBreakdownService = new UserStoryBreakdownService(); 