'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { ImageUploadButton } from './ImageUploadButton';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  RemoveFormatting,
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  FileCode,
  Quote,
  SeparatorHorizontal,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image,
  Undo,
  Redo,
  Table as TableIcon,
  TableProperties,
  RowsIcon,
  ColumnsIcon,
  Trash,
  Combine,
  Split,
  Loader2
} from 'lucide-react';
import { useSystemStore } from '@/lib/stores/system-store';
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store';
import { markdownToHtml, htmlToMarkdown, processContent } from '@/lib/utils/markdown-utils';

interface EditorToolbarProps {
  editor: Editor;
}

// 显示提示消息
export function showToast(message: string, type: 'success' | 'error' = 'success') {
  // 创建toast元素
  const toast = document.createElement('div');
  toast.className = `editor-toast ${type}`;
  toast.textContent = message;
  
  // 添加到body
  document.body.appendChild(toast);
  
  // 自动删除
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3000);
}

// 加载需求模板
export async function loadTemplate(editor: Editor, selectedSystemId: string | null) {
  if (!selectedSystemId) {
    showToast('请先选择一个系统', 'error');
    return false;
  }

  try {
    const response = await fetch(`/api/requirement-templates?systemId=${selectedSystemId}`);
    if (!response.ok) {
      throw new Error('获取模板失败');
    }
    
    const data = await response.json();
    if (data.template && data.template.content) {
      // 处理内容并设置到编辑器
      const processedContent = processContent(data.template.content);
      editor.commands.setContent(processedContent);
      showToast('需求模板加载成功');
      return true;
    } else {
      showToast('未找到该系统的需求模板', 'error');
      return false;
    }
  } catch (error) {
    console.error('加载需求模板失败:', error);
    showToast('加载需求模板失败', 'error');
    return false;
  }
}

// 加载需求初稿
export function loadDraft(editor: Editor, getActiveRequirementBook: () => string | null) {
  try {
    const requirementBook = getActiveRequirementBook();
    
    if (!requirementBook) {
      showToast('未找到需求初稿，请先在需求分析页面生成需求书', 'error');
      return false;
    }
    
    // 处理内容并设置到编辑器
    const processedContent = processContent(requirementBook);
    editor.commands.setContent(processedContent);
    showToast('需求初稿加载成功');
    return true;
  } catch (error) {
    console.error('加载需求初稿失败:', error);
    showToast('加载需求初稿失败', 'error');
    return false;
  }
}

// 导出HTML为Word文档
export function exportToWord(editor: Editor, filename: string = '需求文档') {
  try {
    // 获取HTML内容
    const html = editor.getHTML();
    
    // 构建完整的Word文档HTML
    const wordContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${filename}</title>
        <style>
          body { font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.6; }
          h1 { font-size: 24pt; color: #333; }
          h2 { font-size: 18pt; color: #444; }
          h3 { font-size: 14pt; color: #555; }
          p { font-size: 12pt; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;
    
    // 创建Blob对象
    const blob = new Blob([wordContent], { type: 'application/msword' });
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.doc`;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Word文档导出成功');
    return true;
  } catch (error) {
    console.error('导出Word文档失败:', error);
    showToast('导出Word文档失败', 'error');
    return false;
  }
}

// 导出为Markdown文件
export function exportToMarkdown(editor: Editor, filename: string = '需求文档') {
  try {
    // 获取HTML内容并转换为Markdown
    const html = editor.getHTML();
    const markdown = htmlToMarkdown(html);
    
    // 创建Blob对象
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.md`;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Markdown文件导出成功');
    return true;
  } catch (error) {
    console.error('导出Markdown文件失败:', error);
    showToast('导出Markdown文件失败', 'error');
    return false;
  }
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  const iconSize = 18;

  // 修改插入表格的方法
  const insertTable = () => {
    try {
      // 创建表格HTML并插入
      const tableHtml = '<table><tr><th>标题 1</th><th>标题 2</th><th>标题 3</th></tr><tr><td>内容 1</td><td>内容 2</td><td>内容 3</td></tr><tr><td>内容 4</td><td>内容 5</td><td>内容 6</td></tr></table>';
      editor.commands.insertContent(tableHtml);
    } catch (error) {
      console.error('插入表格失败:', error);
    }
  };

  // 表格相关操作
  const addColumnBefore = () => {
    try {
      editor.chain().focus().addColumnBefore().run();
    } catch (error) {
      console.error('添加前列失败:', error);
    }
  };
  
  const addColumnAfter = () => {
    try {
      editor.chain().focus().addColumnAfter().run();
    } catch (error) {
      console.error('添加后列失败:', error);
    }
  };
  
  const deleteColumn = () => {
    try {
      editor.chain().focus().deleteColumn().run();
    } catch (error) {
      console.error('删除列失败:', error);
    }
  };
  
  const addRowBefore = () => {
    try {
      editor.chain().focus().addRowBefore().run();
    } catch (error) {
      console.error('添加上行失败:', error);
    }
  };
  
  const addRowAfter = () => {
    try {
      editor.chain().focus().addRowAfter().run();
    } catch (error) {
      console.error('添加下行失败:', error);
    }
  };
  
  const deleteRow = () => {
    try {
      editor.chain().focus().deleteRow().run();
    } catch (error) {
      console.error('删除行失败:', error);
    }
  };
  
  const deleteTable = () => {
    try {
      editor.chain().focus().deleteTable().run();
    } catch (error) {
      console.error('删除表格失败:', error);
    }
  };
  
  const mergeCells = () => {
    try {
      editor.chain().focus().mergeCells().run();
    } catch (error) {
      console.error('合并单元格失败:', error);
    }
  };
  
  const splitCell = () => {
    try {
      editor.chain().focus().splitCell().run();
    } catch (error) {
      console.error('拆分单元格失败:', error);
    }
  };
  
  const toggleHeaderCell = () => {
    try {
      editor.chain().focus().toggleHeaderCell().run();
    } catch (error) {
      console.error('切换表头单元格失败:', error);
    }
  };

  const toggleHeaderRow = () => {
    try {
      editor.chain().focus().toggleHeaderRow().run();
    } catch (error) {
      console.error('切换表头行失败:', error);
    }
  };
  
  const toggleHeaderColumn = () => {
    try {
      editor.chain().focus().toggleHeaderColumn().run();
    } catch (error) {
      console.error('切换表头列失败:', error);
    }
  };

  return (
    <div className="editor-toolbar">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'is-active' : ''}
        title="加粗"
      >
        <Bold size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'is-active' : ''}
        title="斜体"
      >
        <Italic size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={editor.isActive('strike') ? 'is-active' : ''}
        title="删除线"
      >
        <Strikethrough size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={editor.isActive('code') ? 'is-active' : ''}
        title="代码"
      >
        <Code size={iconSize} />
      </button>
      <button 
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
        title="清除标记"
      >
        <RemoveFormatting size={iconSize} />
      </button>
      
      <div className="editor-toolbar-divider"></div>
      
      <button
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={editor.isActive('paragraph') ? 'is-active' : ''}
        title="段落"
      >
        <Pilcrow size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
        title="标题1"
      >
        <Heading1 size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
        title="标题2"
      >
        <Heading2 size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
        title="标题3"
      >
        <Heading3 size={iconSize} />
      </button>
      
      <div className="editor-toolbar-divider"></div>
      
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? 'is-active' : ''}
        title="无序列表"
      >
        <List size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? 'is-active' : ''}
        title="有序列表"
      >
        <ListOrdered size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={editor.isActive('taskList') ? 'is-active' : ''}
        title="任务列表"
      >
        <CheckSquare size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={editor.isActive('codeBlock') ? 'is-active' : ''}
        title="代码块"
      >
        <FileCode size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={editor.isActive('blockquote') ? 'is-active' : ''}
        title="引用"
      >
        <Quote size={iconSize} />
      </button>
      <button 
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="分割线"
      >
        <SeparatorHorizontal size={iconSize} />
      </button>
      
      <div className="editor-toolbar-divider"></div>
      
      <button
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}
        title="左对齐"
      >
        <AlignLeft size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}
        title="居中"
      >
        <AlignCenter size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}
        title="右对齐"
      >
        <AlignRight size={iconSize} />
      </button>
      
      <div className="editor-toolbar-divider"></div>
      
      {/* 表格相关操作按钮 */}
      <button
        onClick={insertTable}
        title="插入表格"
        className={editor.isActive('table') ? 'is-active' : ''}
      >
        <TableIcon size={iconSize} />
      </button>
      
      {/* 表格操作按钮组，只在表格内部显示 */}
      {editor.isActive('table') && (
        <>
          <button
            onClick={addColumnBefore}
            title="在前面插入列"
          >
            <ColumnsIcon size={iconSize} />
          </button>
          <button
            onClick={addColumnAfter}
            title="在后面插入列"
          >
            <ColumnsIcon size={iconSize} />
          </button>
          <button
            onClick={deleteColumn}
            title="删除列"
          >
            <ColumnsIcon size={iconSize} />
          </button>
          <button
            onClick={addRowBefore}
            title="在上方插入行"
          >
            <RowsIcon size={iconSize} />
          </button>
          <button
            onClick={addRowAfter}
            title="在下方插入行"
          >
            <RowsIcon size={iconSize} />
          </button>
          <button
            onClick={deleteRow}
            title="删除行"
          >
            <RowsIcon size={iconSize} />
          </button>
          <button
            onClick={mergeCells}
            title="合并单元格"
          >
            <Combine size={iconSize} />
          </button>
          <button
            onClick={splitCell}
            title="拆分单元格"
          >
            <Split size={iconSize} />
          </button>
          <button
            onClick={toggleHeaderCell}
            title="切换表头单元格"
          >
            <TableProperties size={iconSize} />
          </button>
          <button
            onClick={deleteTable}
            title="删除表格"
          >
            <Trash size={iconSize} />
          </button>
        </>
      )}
      
      <div className="editor-toolbar-divider"></div>
      
      <ImageUploadButton editor={editor} />
      
      <div className="editor-toolbar-divider"></div>
      
      <button 
        onClick={() => editor.chain().focus().undo().run()}
        title="撤销"
      >
        <Undo size={iconSize} />
      </button>
      <button 
        onClick={() => editor.chain().focus().redo().run()}
        title="重做"
      >
        <Redo size={iconSize} />
      </button>
    </div>
  );
}; 