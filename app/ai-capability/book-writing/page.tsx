'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea"; // 将被 Tiptap 替代
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

// 1. 导入 Tiptap 和 Studio B3 相关依赖
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { Markdown } from 'tiptap-markdown';
import MarkdownIt from 'markdown-it';
import {
  AiActionExecutor,
  PromptsManager,
  setupExtensions,
  ToolbarMenu,
  MenuBubble,
  AdviceView,
  // 导入可能需要的类型，根据实际使用情况调整
  PromptAction,
  FacetType,
  OutputForm,
} from '@studio-b3/web-core';

// 假设 Studio B3 的 CSS 需要导入 (如果它提供了单独的 CSS 文件)
// import '@studio-b3/web-core/styles.css';

const md = new MarkdownIt({ html: true });

// 不再需要自定义接口，使用 PromptAction
// interface CustomBubbleAction { ... }

// Zustand stores
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store';
import { useSystemStore } from '@/lib/stores/system-store';

// 1. 导入新的 Action 文件
import { polishBubbleAction } from '@/lib/ai-actions/polishAction';

export default function BookWritingPage() {
  const { toast } = useToast();
  const [markdownContent, setMarkdownContent] = useState<string>("## 需求书\n\n请选中一段文字试试 **润色** 功能。");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false); // AI 处理状态
  const [isTemplateLoading, setIsTemplateLoading] = useState(false); // 新增：模板加载状态

  // Get data from Zustand stores
  const { selectedSystemId } = useSystemStore();
  const systems = useSystemStore(state => state.systems);
  const currentSystem = systems.find(sys => sys.id === selectedSystemId);
  const { 
    systemRequirements,
    currentSystemId, // Needed for comparison in scene-analysis, maybe useful here?
    setCurrentSystem // Maybe useful if system changes
  } = useRequirementAnalysisStore();

  // 2. 实例化 Studio B3 核心组件
  const actionExecutor = useMemo(() => new AiActionExecutor(), []);
  const promptsManager = useMemo(() => PromptsManager.getInstance(), []);

  // 设置 AI 后端接口
  useEffect(() => {
    actionExecutor.setEndpointUrl("/api/chat"); // TODO: 确认实际的 API 端点
  }, [actionExecutor]);

  // 可以根据需要配置 PromptsManager，例如添加自定义动作
  // useEffect(() => {
  //   promptsManager.updateActionsMap('custom', [...]);
  // }, [promptsManager]);

  // 3. 初始化 Tiptap 编辑器实例，集成 Studio B3
  const editor = useEditor({
    extensions: [
      // 使用 setupExtensions 替代 StarterKit
      ...setupExtensions(promptsManager, actionExecutor),
      // 添加 Markdown 支持
      Markdown.configure({
        html: true, // Tiptap Markdown 扩展是否处理 HTML 标签
        tightLists: true,
        tightListClass: 'tight',
        bulletListMarker: '-',
        linkify: true,
        breaks: true, // 解析换行符
        // transformPastedText: true, // 示例中有，可以按需启用
        // transformCopiedText: true, // 示例中有，可以按需启用
      }),
    ],
    // 使用 markdown-it 渲染初始内容
    content: '', // 初始设为空，在 useEffect 中设置
    editorProps: {
      attributes: {
        // 应用 Tailwind typography 或自定义样式
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      if (isAiProcessing) return; // AI 处理时不更新状态，防止覆盖
      // 4. 当编辑器内容更新时，尝试获取 Markdown 并更新状态
      try {
        const markdown = editor.storage.markdown.getMarkdown();
        setMarkdownContent(markdown);
        console.log("Editor Updated (Markdown):", markdown);
      } catch (error) {
        console.error("Error getting markdown from editor:", error);
        // 备选：如果 getMarkdown 失败，可以尝试获取 HTML
        // const html = editor.getHTML();
        // console.log("Editor Updated (HTML fallback):", html);
        // TODO: 如果需要，这里需要 HTML -> Markdown 的转换逻辑
      }
    },
    onCreate: ({ editor }) => {
       // 使用 as any 绕过类型检查
       actionExecutor.setEditor(editor as any);
       setIsEditorReady(true);
    }
  });

  // 处理初始内容加载和外部 markdownContent 变化
  useEffect(() => {
    if (editor && isEditorReady && !editor.isDestroyed && markdownContent !== editor.storage.markdown.getMarkdown()) {
        if (!editor.isFocused && !isAiProcessing) { // 仅在编辑器未聚焦且 AI 未处理时更新
            console.log("Setting editor content from state...")
            // 使用 markdown-it 渲染 Markdown 为 HTML 设置给编辑器
            // 注意：这可能会覆盖 Studio B3 的内部状态，需要测试
            const htmlContent = md.render(markdownContent);
            editor.commands.setContent(htmlContent, false); // false 表示不触发 onUpdate
        }
    }
  }, [markdownContent, editor, isEditorReady, isAiProcessing]);

  // 组件卸载时销毁编辑器实例
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  // 3. 更新 customBubbleActions 的 useMemo
  const customBubbleActions: PromptAction[] = useMemo(() => [
    // 调用导入的函数并传入状态设置器和 toast
    polishBubbleAction(setIsAiProcessing, setMarkdownContent, toast),
    // 未来可以添加更多从其他文件导入的 Action 对象
    // import { summarizeBubbleAction } from '@/lib/ai-actions/summarizeAction';
    // summarizeBubbleAction(setIsAiProcessing, toast),
  ], [toast]); // 依赖项现在是 toast (因为它在组件外定义，setIsAiProcessing/setMarkdownContent 由 React 保证引用稳定)

  const handleImport = () => {
    // TODO: 实现导入逻辑，更新 markdownContent 状态
    const importedMd = `# 示例文本\n\n这是**一段**需要润色的示例文本，你可以选中它，然后在弹出的菜单中选择"润色"来测试这个功能。

人工智能（AI）正在改变世界。它的应用范围从自动驾驶汽车到个性化医疗，无所不包。我们必须理解它的潜力与风险。`;
    // 直接命令编辑器更新内容，而不是通过状态，避免冲突
    if(editor && !editor.isDestroyed) {
      const htmlContent = md.render(importedMd);
      editor.commands.setContent(htmlContent, true); // true 触发 onUpdate 同步状态
      setMarkdownContent(importedMd); // 也更新状态
    }
    toast({
      title: "内容已导入 (示例)",
      description: "编辑器内容已更新为导入的示例 Markdown。",
      duration: 3000
    });
  };

  const handleSave = () => {
    setIsLoading(true);
    // 直接使用当前的 markdownContent 状态保存
    console.log("准备保存的内容 (Markdown):", markdownContent);
    toast({
      title: "保存中...",
      description: "正在保存需求书内容（功能待实现）。",
      duration: 2000
    });
    setTimeout(() => {
      console.log("保存的内容:", markdownContent);
      setIsLoading(false);
      toast({
        title: "保存成功",
        description: "需求书内容已模拟保存（Markdown格式）。",
        duration: 3000
      });
    }, 1500);
  };

  // --- New Handlers --- 
  const handleLoadInitialDraft = useCallback(() => {
    if (!selectedSystemId) {
      toast({ title: "无法加载", description: "请先选择一个系统。", variant: "destructive" });
      return;
    }
    const systemData = systemRequirements[selectedSystemId];
    if (!systemData) {
      toast({ title: "无法加载", description: "未找到所选系统的需求数据。", variant: "destructive" });
      return;
    }
    
    const draftContent = systemData.isRequirementBookPinned 
                         ? systemData.pinnedRequirementBook 
                         : systemData.requirementBook;

    if (!draftContent) {
      toast({ title: "提示", description: "未找到该系统的需求初稿内容。", variant: "default" });
      setMarkdownContent(""); // Clear content if no draft found
    } else {
      setMarkdownContent(draftContent);
      toast({ title: "加载成功", description: "已加载需求初稿内容。" });
    }
  }, [selectedSystemId, systemRequirements, toast]);

  const handleClearContent = useCallback(() => {
    setMarkdownContent("");
    if (editor) {
        // Also clear the editor directly in case state update is slow
        editor.commands.clearContent(true); 
    }
    toast({ title: "已清空", description: "编辑器内容已清空。" });
  }, [toast, editor]);

  const handleDownload = useCallback(() => {
    if (!markdownContent.trim()) {
      toast({ title: "无法下载", description: "编辑器内容为空。", variant: "destructive" });
      return;
    }

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const systemName = currentSystem?.name || selectedSystemId || '未知系统';
    a.download = `需求书编辑稿_${systemName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: "下载开始", description: `正在下载 ${a.download}` });

  }, [markdownContent, selectedSystemId, currentSystem, toast]);

  // 新增：加载模板的处理函数
  const handleLoadTemplate = useCallback(async () => {
    if (!selectedSystemId) {
      toast({ title: "无法加载", description: "请先选择一个系统。", variant: "destructive" });
      return;
    }
    setIsTemplateLoading(true);
    try {
      const response = await fetch(`/api/requirement-templates?systemId=${selectedSystemId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
      const { template } = await response.json();

      if (template && template.content) {
        setMarkdownContent(template.content);
        if (editor && !editor.isDestroyed) {
          const htmlContent = md.render(template.content);
          // 使用setContent并触发更新，以便同步状态
          editor.commands.setContent(htmlContent, true); 
        }
        toast({ title: "加载成功", description: "已加载需求书模板。" });
      } else {
        toast({ title: "提示", description: "未找到该系统的需求书模板。", variant: "default" });
        // 可选：如果未找到模板，是否清空内容？目前不清空
        // setMarkdownContent("");
        // editor?.commands.clearContent(true);
      }
    } catch (error: any) {
      console.error("Failed to load requirement template:", error);
      toast({ title: "加载失败", description: error.message || "获取需求书模板时发生错误。", variant: "destructive" });
    } finally {
      setIsTemplateLoading(false);
    }
  }, [selectedSystemId, toast, editor]); // 添加 editor 依赖

  return (
    <div className="mx-auto py-6 w-[90%] space-y-6 flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">需求书撰写 (PRO) - Studio B3</h1>
          <p className="text-xs text-muted-foreground mt-1">
            使用 Studio B3 AI 增强编辑器自由撰写和修改需求书。
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
             onClick={handleLoadTemplate} 
             variant="outline" 
             disabled={isAiProcessing || isTemplateLoading || !selectedSystemId}
           >
            {isTemplateLoading ? "加载中..." : "加载需求模板"}
          </Button>
          <Button 
             onClick={handleLoadInitialDraft} 
             variant="outline" 
             disabled={isAiProcessing || isTemplateLoading || !selectedSystemId} // 也禁用此按钮在模板加载时
          >
            加载需求初稿
          </Button>
          <Button 
            onClick={handleClearContent} 
            className="bg-orange-500 hover:bg-orange-600"
            disabled={isAiProcessing || !markdownContent}
          >
            清空内容
          </Button>
          <Button onClick={handleDownload} disabled={isLoading || !editor || !isEditorReady || isAiProcessing || !markdownContent}>
            下载内容
          </Button>
        </div>
      </div>

      {/* 5. 渲染 Studio B3 编辑器及相关 UI 组件 */}
      <Card className="flex-1 flex flex-col overflow-hidden border border-gray-300 rounded-lg shadow-sm">
        {/* 工具栏 */} 
        {editor && <ToolbarMenu editor={editor as any} className="p-2 border-b bg-gray-50" />}

        {/* 编辑器内容区域 */} 
        <CardContent className="flex-1 overflow-y-auto p-0 relative">
            {/* 应用 isAiProcessing 状态 */} 
            <EditorContent editor={editor} className={`h-full p-4 ${isAiProcessing ? 'opacity-50 cursor-wait' : ''}`}/>
            {/* 传递 customActions */} 
            {editor && <MenuBubble editor={editor as any} customActions={customBubbleActions} />} 
        </CardContent>

        {/* AI 建议视图 (如果需要) */} 
        {/* {editor && <AdviceView editor={editor} />} */} 
      </Card>

      <Toaster />
    </div>
  );
} 