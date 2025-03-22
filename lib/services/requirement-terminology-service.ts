import { streamingFileAICall } from './ai-service'

/**
 * 需求术语抽取服务
 */
export class RequirementTerminologyService {
  /**
   * 抽取文档中的术语知识
   * @param fileIds 文件ID列表
   * @param onContent 内容回调
   */
  async extractTerminology(
    fileIds: string[],
    onContent: (content: string) => void
  ): Promise<void> {
    console.log(`💡 [术语服务] 开始抽取术语知识，文件ID: ${fileIds.join(',')}`);

    if (!fileIds || fileIds.length === 0) {
      throw new Error('未指定要处理的文件ID');
    }

    // 使用系统提示
    const systemPrompt =
      `你是一个专业的需求分析师，擅长从文档中抽取术语知识。
     我会上传需求文档，请帮我提取出所有业务术语并进行解释，包括概念、定义、业务规则等。
     要求：
     1. 按照markdown格式输出，用表格呈现，列为"术语"、"定义"、"备注"
     2. 尽可能完整提取所有术语，解释要准确、简洁
     3. 对复杂术语可以提供更详细的解释，包括上下文和使用场景
     4. 如果文档内容不足以确定定义，请注明"文档未明确定义"`;

    // 用户提示
    const userPrompt = '请从上传的需求文档中提取业务术语及其定义，以表格形式呈现。';

    try {
      // 首先向前端发送等待提示，确保用户知道系统正在处理
      onContent("正在连接模型API...\n请耐心等待，大模型处理文件可能需要一些时间才开始返回结果...");
      
      // 记录请求时间，用于性能分析
      const startTime = Date.now();
      
      console.log(`💡 [术语服务] 调用AI服务，文件数: ${fileIds.length}，时间: ${new Date().toISOString()}`);
      
      // 发送请求给AI服务，并通过回调接收流式响应
      await streamingFileAICall({
        fileIds,
        systemPrompt,
        userPrompt,
        onContent: (content: string) => {
          const now = Date.now();
          const elapsedSeconds = ((now - startTime) / 1000).toFixed(1);
          
          // 记录首个内容的到达时间
          if (content.trim().startsWith('|') || content.trim().startsWith('#')) {
            console.log(`💡 [术语服务] 收到首个实际内容，长度: ${content.length}字符，耗时: ${elapsedSeconds}秒`);
          } else {
            // 接收内容的定期日志，避免太多日志
            const contentLength = content.length;
            if (contentLength > 100) {
              console.log(`💡 [术语服务] 收到较大内容块，长度: ${contentLength}字符，耗时: ${elapsedSeconds}秒`);
            } else if (contentLength > 0) {
              console.log(`💡 [术语服务] 收到内容，长度: ${contentLength}字符`);
            }
          }
          
          // 直接传递内容给回调函数，不做任何缓存或处理
          // 这确保了内容能立即显示在前端
          onContent(content);
        }
      });
      
      // 记录总耗时
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`💡 [术语服务] 术语抽取完成，总耗时: ${totalTime}秒`);
      
      // 发送处理完成标记给前端
      onContent(`\n\n--- 术语抽取完成，总耗时: ${totalTime}秒 ---`);
    } catch (error) {
      console.error(`💡 [术语服务] 术语抽取出错:`, error);
      
      // 发送错误信息给前端，确保用户知道出了问题
      onContent(`\n\n[错误] ${error instanceof Error ? error.message : '未知错误'}`);
      
      // 重新抛出错误，让上层处理
      throw error;
    }
  }
} 