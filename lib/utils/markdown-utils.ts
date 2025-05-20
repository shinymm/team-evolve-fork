/**
 * 将Markdown格式转换为HTML格式
 * @param markdown Markdown格式的文本
 * @returns HTML格式的文本
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  // 先处理多余的空行，确保列表项之间没有空行
  markdown = markdown.replace(/\n\s*\n/g, '\n\n');

  // 替换标题
  let html = markdown
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 替换粗体和斜体
  html = html
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/~~(.*?)~~/gim, '<del>$1</del>');
    
  // 替换引用
  html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');
  
  // 替换代码块
  html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
  
  // 替换行内代码
  html = html.replace(/`(.*?)`/gim, '<code>$1</code>');

  // 处理列表 - 改进版
  // 首先找到所有连续的列表项区块
  const findUlBlocksRegex = /(^[\-\+\*] .*$\n?)+/gm;
  html = html.replace(findUlBlocksRegex, function(match) {
    // 移除列表项开头的标记，并用<li>包裹每一行
    const listItems = match.split('\n')
      .filter(line => line.trim())
      .map(line => `<li>${line.replace(/^[\-\+\*] /, '')}</li>`)
      .join('');
    return `<ul>${listItems}</ul>`;
  });

  // 处理有序列表
  const findOlBlocksRegex = /(^\d+\. .*$\n?)+/gm;
  html = html.replace(findOlBlocksRegex, function(match) {
    // 移除列表项开头的数字和点，并用<li>包裹每一行
    const listItems = match.split('\n')
      .filter(line => line.trim())
      .map(line => `<li>${line.replace(/^\d+\. /, '')}</li>`)
      .join('');
    return `<ol>${listItems}</ol>`;
  });
  
  // 替换链接
  html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>');
  
  // 替换图片
  html = html.replace(/!\[(.*?)\]\((.*?)\)/gim, '<img alt="$1" src="$2" />');
  
  // 将剩余的换行符替换为段落 - 但跳过已转换为HTML标签的内容
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs
    .map(p => {
      const trimmed = p.trim();
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<blockquote') || 
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<pre') ||
        trimmed === ''
      ) {
        return trimmed;
      }
      // 处理段落内的单个换行，这些通常不应该创建新段落
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    })
    .filter(p => p) // 移除空项
    .join('\n');
  
  return html;
}

/**
 * 将HTML格式转换为Markdown格式
 * @param html HTML格式的文本
 * @returns Markdown格式的文本
 */
export function htmlToMarkdown(html: string): string {
  let markdown = html;
  
  // 移除HTML注释
  markdown = markdown.replace(/<!--[\s\S]*?-->/g, '');
  
  // 替换标题
  markdown = markdown
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  
  // 替换段落
  markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  
  // 替换列表
  markdown = markdown
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, function(match, content) {
      // 替换列表项
      return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n';
    })
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, function(match, content) {
      // 替换有序列表项，使用计数器
      let counter = 1;
      return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, function() {
        return counter++ + '. ' + arguments[1] + '\n';
      }) + '\n';
    });
  
  // 替换粗体和斜体
  markdown = markdown
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  
  // 替换删除线
  markdown = markdown.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~');
  
  // 替换代码块
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
  
  // 替换行内代码
  markdown = markdown.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  
  // 替换引用
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, function(match, content) {
    // 将引用内容的每一行都加上 >
    return content.split('\n').map((line: string) => '> ' + line).join('\n') + '\n\n';
  });
  
  // 替换链接
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  
  // 替换图片
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)');
  
  // 替换分隔线
  markdown = markdown.replace(/<hr[^>]*>/gi, '---\n\n');
  
  // 替换表格
  markdown = markdown.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, function(match, tableContent) {
    let result = '';
    
    // 处理表头
    const headerMatch = tableContent.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
    if (headerMatch) {
      const headerContent = headerMatch[1];
      const headerCells = headerContent.match(/<th[^>]*>([\s\S]*?)<\/th>/gi) || [];
      
      if (headerCells.length) {
        // 表格头部
        result += '| ' + headerCells.map((cell: string) => {
          return cell.replace(/<th[^>]*>([\s\S]*?)<\/th>/i, '$1').trim();
        }).join(' | ') + ' |\n';
        
        // 分隔线
        result += '| ' + headerCells.map(() => '---').join(' | ') + ' |\n';
      }
    }
    
    // 处理表格内容
    const bodyMatch = tableContent.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (bodyMatch) {
      const bodyContent = bodyMatch[1];
      const rows = bodyContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      
      rows.forEach((row: string) => {
        const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
        if (cells.length) {
          result += '| ' + cells.map((cell: string) => {
            return cell.replace(/<td[^>]*>([\s\S]*?)<\/td>/i, '$1').trim();
          }).join(' | ') + ' |\n';
        }
      });
    }
    
    return result + '\n';
  });
  
  // 清理HTML标签
  markdown = markdown.replace(/<[^>]*>/g, '');
  
  // 修复空白行
  markdown = markdown.replace(/(\n\s*){3,}/g, '\n\n');
  
  return markdown;
}

/**
 * 判断内容类型并适当处理，用于转换为编辑器可用的格式
 * @param content 可能是Markdown、HTML或纯文本的内容
 * @returns 处理后的HTML内容
 */
export function processContent(content: string): string {
  // 检查内容是否为Markdown格式
  const isMarkdown = 
    content.includes('# ') || 
    content.includes('## ') ||
    content.includes('### ') ||
    content.includes('- ') ||
    content.includes('* ') ||
    content.includes('```') ||
    content.includes('> ');
  
  if (isMarkdown) {
    // 如果是Markdown，转换为HTML
    return markdownToHtml(content);
  } else if (!content.includes('<')) {
    // 如果是纯文本，将换行符转换为<p>标签
    return content.split('\n').map(line => line.trim() ? `<p>${line}</p>` : '').join('');
  }
  
  // 如果已经是HTML，直接返回
  return content;
} 