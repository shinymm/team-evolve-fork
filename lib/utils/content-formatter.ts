import { markdownToHtml, processContent } from './markdown-utils';

/**
 * 统一的内容格式化处理工具
 * 集中处理各种格式转换和显示需求
 */

/**
 * 处理要显示在编辑器结果面板中的内容
 * 处理转义字符并保留格式
 */
export function formatDisplayContent(content: string): string {
  if (!content) return '';
  
  // 首先处理转义字符
  let formatted = content
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
  
  // 替换换行符为<br>标签
  formatted = formatted.replace(/\n/g, '<br />');
  
  // 保留连续空格
  formatted = formatted.replace(/ {2,}/g, (match) => {
    return '&nbsp;'.repeat(match.length);
  });
  
  // 保留制表符
  formatted = formatted.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
  
  return formatted;
}

/**
 * 处理需要插入到编辑器中的内容
 * 处理Markdown、转义字符等，确保在编辑器中正确显示
 */
export function prepareContentForEditor(content: string): string {
  // 使用processContent，它会根据内容类型做适当处理
  return processContent(content);
}

/**
 * 处理AI返回的原始内容
 * 包括预处理转义字符、处理格式等
 */
export function processApiResponseContent(content: string): string {
  // 首先处理常见的转义字符
  const preprocessed = content
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
  
  // 使用processContent进一步处理
  return processContent(preprocessed);
} 