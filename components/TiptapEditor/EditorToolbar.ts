import { marked } from 'marked';

// 将markdown转换为HTML
export const markdownToHtml = (markdown: string): string => {
  try {
    // 配置marked选项
    marked.setOptions({
      gfm: true, // 启用GitHub风格的markdown
      breaks: true, // 启用换行符转换为<br>
      tables: true, // 启用表格支持
    });
    
    // 转换markdown为HTML
    return marked(markdown);
  } catch (error) {
    console.error('Markdown转HTML失败:', error);
    return markdown; // 转换失败时返回原始内容
  }
}; 