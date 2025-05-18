/**
 * 文件导出工具
 * 提供各种格式的内容导出为文件功能
 */

interface DownloadResult {
  success: boolean;
  message: string;
}

/**
 * 将内容导出为Markdown文件
 * @param content 要导出的内容
 * @param filename 文件名（不含扩展名）
 * @returns 导出结果
 */
export const exportAsMarkdown = (content: string, filename: string): DownloadResult => {
  try {
    if (!content) {
      return {
        success: false,
        message: '没有可导出的内容'
      };
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${timestamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      message: '导出成功'
    };
  } catch (error) {
    console.error('导出Markdown文件失败:', error);
    return {
      success: false,
      message: '导出失败，请手动复制内容并保存'
    };
  }
};

/**
 * 将内容导出为JSON文件
 * @param content 要导出的内容（字符串或对象）
 * @param filename 文件名（不含扩展名）
 * @returns 导出结果
 */
export const exportAsJson = (content: string | object, filename: string): DownloadResult => {
  try {
    if (!content) {
      return {
        success: false,
        message: '没有可导出的内容'
      };
    }

    // 如果内容是字符串格式的JSON，尝试格式化
    let formattedContent: string;
    
    if (typeof content === 'string') {
      try {
        // 尝试解析和格式化JSON
        const jsonData = JSON.parse(content);
        formattedContent = JSON.stringify(jsonData, null, 2);
      } catch (e) {
        // 如果不是有效的JSON，保持原内容
        console.warn('内容不是有效的JSON格式:', e);
        formattedContent = content;
      }
    } else {
      // 如果是对象，直接格式化
      formattedContent = JSON.stringify(content, null, 2);
    }

    const blob = new Blob([formattedContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      message: '导出成功'
    };
  } catch (error) {
    console.error('导出JSON文件失败:', error);
    return {
      success: false,
      message: '导出失败，请手动复制内容并保存'
    };
  }
}; 