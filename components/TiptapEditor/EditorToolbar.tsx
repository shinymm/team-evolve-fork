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
import { useTranslations } from 'next-intl';

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
export async function loadTemplate(editor: Editor, selectedSystemId: string | null, t: any) {
  // t可以是翻译函数也可以是命名空间，先尝试获取正确的消息
  const getMessage = (key: string) => {
    // 如果t是函数，直接调用
    if (typeof t === 'function') {
      return t(key);
    }
    
    // 否则，假设t是从useTranslations获取的已命名空间的翻译函数
    // 这种情况下，直接访问notifications下的对应键
    return t(`notifications.${key}`);
  };
  
  if (!selectedSystemId) {
    showToast(getMessage('selectSystemFirst'), 'error');
    return false;
  }

  try {
    const response = await fetch(`/api/requirement-templates?systemId=${selectedSystemId}`);
    if (!response.ok) {
      throw new Error(getMessage('templateLoadFailed'));
    }
    
    const data = await response.json();
    if (data.template && data.template.content) {
      // 处理内容并设置到编辑器
      const processedContent = processContent(data.template.content);
      editor.commands.setContent(processedContent);
      showToast(getMessage('templateLoadSuccess'));
      return true;
    } else {
      showToast(getMessage('templateNotFound'), 'error');
      return false;
    }
  } catch (error) {
    console.error(getMessage('templateLoadFailed'), error);
    showToast(getMessage('templateLoadFailed'), 'error');
    return false;
  }
}

// 加载需求初稿
export function loadDraft(editor: Editor, getOrGetActiveRequirementBook: (() => string | null) | string | null, t: any) {
  // t可以是翻译函数也可以是命名空间，先尝试获取正确的消息
  const getMessage = (key: string) => {
    // 如果t是函数，直接调用
    if (typeof t === 'function') {
      return t(key);
    }
    
    // 否则，假设t是从useTranslations获取的已命名空间的翻译函数
    // 这种情况下，直接访问notifications下的对应键
    return t(`notifications.${key}`);
  };
  
  try {
    console.log('[loadDraft] 开始加载需求初稿, 传入参数类型:', typeof getOrGetActiveRequirementBook);
    
    // 确定内容来源
    let content: string | null = null;
    let contentSource = '未知';
    
    // 如果传入的是函数，则调用获取内容
    if (typeof getOrGetActiveRequirementBook === 'function') {
      content = getOrGetActiveRequirementBook();
      contentSource = '传入的函数返回值';
      console.log(`[loadDraft] 通过函数获取内容: ${content ? '成功' : '未获取到内容'}`);
    } else {
      // 如果直接传入内容或null
      content = getOrGetActiveRequirementBook;
      contentSource = '直接传入的内容';
      console.log(`[loadDraft] 直接传入的内容: ${content ? '有内容' : '为空'}`);
    }
    
    // 如果内容为空，尝试直接从store获取
    if (!content) {
      console.log('[loadDraft] 传入内容为空，尝试从store获取');
      // 从store中获取当前状态
      const store = useRequirementAnalysisStore.getState();
      const systemId = store.currentSystemId;
      
      console.log(`[loadDraft] store当前状态:`, {
        systemId,
        hasRequirementBook: !!store.requirementBook,
        hasPinnedRequirementBook: !!store.pinnedRequirementBook,
        isRequirementBookPinned: store.isRequirementBookPinned
      });
      
      if (systemId) {
        // 优先使用固定的需求书
        if (store.isRequirementBookPinned && store.pinnedRequirementBook) {
          content = store.pinnedRequirementBook;
          contentSource = 'store中的固定需求书';
          console.log('[loadDraft] 从store获取到固定需求书');
        } 
        // 其次使用普通需求书
        else if (store.requirementBook) {
          content = store.requirementBook;
          contentSource = 'store中的普通需求书';
          console.log('[loadDraft] 从store获取到普通需求书');
        }
        
        // 如果store中仍然获取不到，直接尝试从localStorage获取
        if (!content) {
          try {
            console.log('[loadDraft] store中未找到内容，尝试直接从localStorage获取');
            const storageKey = `req_analysis_system_${systemId}`;
            const data = localStorage.getItem(storageKey);
            if (data) {
              const parsedData = JSON.parse(data);
              console.log('[loadDraft] localStorage数据:', {
                hasPinnedBook: !!parsedData.pinnedRequirementBook,
                hasBook: !!parsedData.requirementBook,
                isPinned: parsedData.isRequirementBookPinned
              });
              
              // 优先使用固定的需求书
              if (parsedData.isRequirementBookPinned && parsedData.pinnedRequirementBook) {
                content = parsedData.pinnedRequirementBook;
                contentSource = 'localStorage中的固定需求书';
                console.log('[loadDraft] 从localStorage直接获取到固定需求书');
              } 
              // 其次使用普通需求书
              else if (parsedData.requirementBook) {
                content = parsedData.requirementBook;
                contentSource = 'localStorage中的普通需求书';
                console.log('[loadDraft] 从localStorage直接获取到普通需求书');
              }
            } else {
              console.log('[loadDraft] localStorage中未找到数据:', storageKey);
            }
          } catch (error) {
            console.error('[loadDraft] 从localStorage获取数据失败:', error);
          }
        }
      }
    }
    
    // 如果仍未找到内容，显示错误
    if (!content) {
      console.log('[loadDraft] 最终未找到有效的需求初稿内容');
      showToast(getMessage('draftNotFound'), 'error');
      return false;
    }
    
    console.log(`[loadDraft] 成功获取内容，来源: ${contentSource}, 内容长度: ${content.length}`);
    
    // 处理内容并设置到编辑器
    const processedContent = processContent(content);
    editor.commands.setContent(processedContent);
    showToast(getMessage('draftLoadSuccess'));
    return true;
  } catch (error) {
    console.error('[loadDraft] 加载需求初稿失败:', error);
    showToast(getMessage('draftLoadFailed'), 'error');
    return false;
  }
}

// 导出HTML为Word文档
export function exportToWord(editor: Editor, filename: string = '需求文档', t: any) {
  // t可以是翻译函数也可以是命名空间，先尝试获取正确的消息
  const getMessage = (key: string) => {
    // 如果t是函数，直接调用
    if (typeof t === 'function') {
      return t(key);
    }
    
    // 否则，假设t是从useTranslations获取的已命名空间的翻译函数
    // 这种情况下，直接访问notifications下的对应键
    return t(`notifications.${key}`);
  };
  
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
    
    showToast(getMessage('wordExportSuccess'));
    return true;
  } catch (error) {
    console.error('导出Word文档失败:', error);
    showToast(getMessage('wordExportFailed'), 'error');
    return false;
  }
}

// 导出为Markdown文档
export function exportToMarkdown(editor: Editor, filename: string = '需求文档', t: any) {
  // t可以是翻译函数也可以是命名空间，先尝试获取正确的消息
  const getMessage = (key: string) => {
    // 如果t是函数，直接调用
    if (typeof t === 'function') {
      return t(key);
    }
    
    // 否则，假设t是从useTranslations获取的已命名空间的翻译函数
    // 这种情况下，直接访问notifications下的对应键
    return t(`notifications.${key}`);
  };
  
  try {
    // 获取HTML内容
    const html = editor.getHTML();
    
    // 转换为Markdown
    const markdown = htmlToMarkdown(html);
    
    // 创建Blob对象
    const blob = new Blob([markdown], { type: 'text/markdown' });
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.md`;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(getMessage('markdownExportSuccess'));
    return true;
  } catch (error) {
    console.error('导出Markdown文档失败:', error);
    showToast(getMessage('markdownExportFailed'), 'error');
    return false;
  }
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  const iconSize = 18;
  // 添加国际化翻译支持
  const t = useTranslations('TiptapEditor');

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
        title={t('toolbar.bold')}
      >
        <Bold size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'is-active' : ''}
        title={t('toolbar.italic')}
      >
        <Italic size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={editor.isActive('strike') ? 'is-active' : ''}
        title={t('toolbar.strikethrough')}
      >
        <Strikethrough size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={editor.isActive('code') ? 'is-active' : ''}
        title={t('toolbar.code')}
      >
        <Code size={iconSize} />
      </button>
      <button 
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
        title={t('toolbar.clearMarks')}
      >
        <RemoveFormatting size={iconSize} />
      </button>
      
      <div className="editor-toolbar-divider"></div>
      
      <button
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={editor.isActive('paragraph') ? 'is-active' : ''}
        title={t('toolbar.paragraph')}
      >
        <Pilcrow size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
        title={t('toolbar.heading1')}
      >
        <Heading1 size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
        title={t('toolbar.heading2')}
      >
        <Heading2 size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
        title={t('toolbar.heading3')}
      >
        <Heading3 size={iconSize} />
      </button>
      
      <div className="editor-toolbar-divider"></div>
      
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? 'is-active' : ''}
        title={t('toolbar.bulletList')}
      >
        <List size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? 'is-active' : ''}
        title={t('toolbar.orderedList')}
      >
        <ListOrdered size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={editor.isActive('taskList') ? 'is-active' : ''}
        title={t('toolbar.taskList')}
      >
        <CheckSquare size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={editor.isActive('codeBlock') ? 'is-active' : ''}
        title={t('toolbar.codeBlock')}
      >
        <FileCode size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={editor.isActive('blockquote') ? 'is-active' : ''}
        title={t('toolbar.blockquote')}
      >
        <Quote size={iconSize} />
      </button>
      <button 
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title={t('toolbar.horizontalRule')}
      >
        <SeparatorHorizontal size={iconSize} />
      </button>
      
      <div className="editor-toolbar-divider"></div>
      
      <button
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}
        title={t('toolbar.alignLeft')}
      >
        <AlignLeft size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}
        title={t('toolbar.alignCenter')}
      >
        <AlignCenter size={iconSize} />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}
        title={t('toolbar.alignRight')}
      >
        <AlignRight size={iconSize} />
      </button>
      
      <div className="editor-toolbar-divider"></div>
      
      {/* 表格相关操作按钮 */}
      {!editor.isActive('table') && (
        <button 
          onClick={insertTable}
          title={t('toolbar.insertTable')}
        >
          <TableIcon size={iconSize} />
        </button>
      )}
      
      {editor.isActive('table') && (
        <>
          <button 
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            title={t('toolbar.addColumnBefore')}
          >
            <TableProperties size={iconSize} className="rotate-90" />
          </button>
          <button 
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title={t('toolbar.addColumnAfter')}
          >
            <TableProperties size={iconSize} className="rotate-90" />
          </button>
          <button 
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title={t('toolbar.deleteColumn')}
          >
            <ColumnsIcon size={iconSize} />
          </button>
          <button 
            onClick={() => editor.chain().focus().addRowBefore().run()}
            title={t('toolbar.addRowBefore')}
          >
            <TableProperties size={iconSize} />
          </button>
          <button 
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title={t('toolbar.addRowAfter')}
          >
            <TableProperties size={iconSize} />
          </button>
          <button 
            onClick={() => editor.chain().focus().deleteRow().run()}
            title={t('toolbar.deleteRow')}
          >
            <RowsIcon size={iconSize} />
          </button>
          <button 
            onClick={() => editor.chain().focus().mergeCells().run()}
            title={t('toolbar.mergeCells')}
          >
            <Combine size={iconSize} />
          </button>
          <button 
            onClick={() => editor.chain().focus().splitCell().run()}
            title={t('toolbar.splitCell')}
          >
            <Split size={iconSize} />
          </button>
          <button 
            onClick={() => editor.chain().focus().toggleHeaderCell().run()}
            title={t('toolbar.toggleHeaderCell')}
          >
            <TableProperties size={iconSize} />
          </button>
          <button 
            onClick={() => editor.chain().focus().deleteTable().run()}
            title={t('toolbar.deleteTable')}
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
        disabled={!editor.can().undo()}
        title={t('toolbar.undo')}
      >
        <Undo size={iconSize} />
      </button>
      <button 
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title={t('toolbar.redo')}
      >
        <Redo size={iconSize} />
      </button>
    </div>
  );
}; 