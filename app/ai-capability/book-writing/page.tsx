"use client";

import React, { useState, useEffect } from "react";
import { ArticlePrompts, setupExtensions, PromptsManager, MenuBubble, AiActionExecutor, ToolbarMenu, AdviceView, OutputForm, ChangeForm, FacetType, PromptAction } from "@studio-b3/web-core";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import MarkdownIt from "markdown-it";
import { useDebounce } from "use-debounce";
import { Theme } from "@radix-ui/themes";
import { DOMSerializer } from "prosemirror-model";
import TurndownService from "turndown";
import { Markdown } from "tiptap-markdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useSearchParams } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const md = new MarkdownIt();

interface CustomEditorAction {
  name: string;
  action?: (editor: Editor) => Promise<void>;
}

// 自定义样式覆盖 - 只针对关键样式
const customStyles = `
  /* 浅橙色高亮 - 针对my-advice和其他可能的高亮元素 */
  .my-advice,
  mark.my-advice,
  mark[class*="advice"],
  mark {
    background-color: rgba(255, 166, 77, 0.2) !important;
    color: inherit !important;
  }

  /* 基于文本内容的高特异性选择器 */
  .flex button:has(text="Reject") {
    background-color: #000000 !important;
  }

  .flex button:has(text="Accept") {
    background-color: #FF8C00 !important;
  }
`;

export default function BookWritingPage() {
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [templateContent, setTemplateContent] = useState("");
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  // 获取当前系统ID，从URL参数中获取
  const systemId = searchParams.get('systemId') || "";

  const actionExecutor: AiActionExecutor = new AiActionExecutor();
  actionExecutor.setEndpointUrl("/api/ai-editor-action/chat");

  const instance = PromptsManager.getInstance();
  
  // 添加一些适合需求书撰写的自定义动作
  const customSlashActions: CustomEditorAction[] = [
    {
      name: "添加需求描述",
      action: async (editor: Editor) => {
        editor.chain().focus().insertContent("## 需求描述\n\n请在此处描述需求的详细信息。\n\n").run();
      }
    },
    {
      name: "添加用户故事",
      action: async (editor: Editor) => {
        editor.chain().focus().insertContent("## 用户故事\n\n作为一个[角色]，我想要[功能]，以便[价值]。\n\n").run();
      }
    },
    {
      name: "添加验收标准",
      action: async (editor: Editor) => {
        editor.chain().focus().insertContent("## 验收标准\n\n- [ ] 标准1\n- [ ] 标准2\n- [ ] 标准3\n\n").run();
      }
    }
  ];

  // 将自定义操作转换为PromptAction格式
  const customActionsMap: PromptAction[] = customSlashActions.map((action) => {
    return {
      name: action.name,
      i18Name: false,
      template: ``,
      facetType: FacetType.SLASH_COMMAND,
      outputForm: OutputForm.TEXT,
      action: action.action
    };
  });

  instance.updateActionsMap("article", [...ArticlePrompts, ...customActionsMap]);

  // 简单的CSS注入函数
  const injectCustomStyles = () => {
    let styleEl = document.getElementById("autodev-editor-custom-styles");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "autodev-editor-custom-styles";
      styleEl.innerHTML = customStyles;
      document.head.appendChild(styleEl);
    }
  };

  const editor = useEditor({
    extensions: setupExtensions(instance, actionExecutor).concat([
      Markdown.configure({
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ]),
    content: md.render("# 需求书\n\n开始编写您的需求书..."),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose lg:prose-xl bb-editor-inner p-4",
      },
    },
    onUpdate: ({ editor }) => {
      const schema = editor.state.schema;
      try {
        const serializer = DOMSerializer.fromSchema(schema);
        const serialized = serializer.serializeFragment(editor.state.doc.content);

        const html: string = Array.from(serialized.childNodes)
          .map((node: ChildNode) => (node as HTMLElement).outerHTML)
          .join("");

        const turndownService = new TurndownService();
        const markdown = turndownService.turndown(html);
        setMarkdownContent(markdown);
      } catch (e) {
        console.error(e);
      }
    },
  });

  // 加载需求模版函数
  const loadRequirementTemplate = async () => {
    if (!systemId) {
      toast({
        title: "错误",
        description: "未找到系统ID，无法加载模版",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/requirement-templates?systemId=${systemId}`);
      
      if (!response.ok) {
        throw new Error(`获取模版失败: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.template && data.template.content) {
        // 存储模版内容并显示确认弹窗
        setTemplateContent(data.template.content);
        setShowConfirmDialog(true);
      } else {
        toast({
          title: "提示",
          description: "未找到该系统的需求模版",
        });
      }
    } catch (error) {
      console.error("加载需求模版失败:", error);
      toast({
        title: "错误",
        description: "加载需求模版失败，请重试",
        variant: "destructive",
      });
    }
  };

  // 确认加载模版到编辑器
  const confirmLoadTemplate = () => {
    if (editor && templateContent) {
      editor.commands.setContent(md.render(templateContent));
      toast({
        title: "成功",
        description: "已加载需求模版",
      });
    }
    setShowConfirmDialog(false);
  };

  const [debouncedEditor] = useDebounce(editor?.state.doc.content, 5000);

  // 在组件挂载后注入样式
  useEffect(() => {
    // 注入CSS样式
    injectCustomStyles();
    
    return () => {
      // 清理：可选
      const styleEl = document.getElementById("autodev-editor-custom-styles");
      if (styleEl) {
        styleEl.remove();
      }
    };
  }, []);

  React.useEffect(() => {
    if (debouncedEditor) {
      try {
        localStorage.setItem("requirement-editor", JSON.stringify(editor?.getJSON()));
        console.info("需求书已保存到本地存储");
      } catch (e) {
        console.error("保存到本地存储时出错:", e);
      }
    }
  }, [debouncedEditor, editor]);

  React.useEffect(() => {
    if (editor) {
      actionExecutor.setEditor(editor);
    }

    // 从本地存储恢复内容
    const content = localStorage.getItem("requirement-editor");
    if (content && editor) {
      try {
        const parsed = JSON.parse(content);
        editor.commands.setContent(parsed);
      } catch (e) {
        console.error(e);
      }
    }
  }, [editor]);

  // 自定义气泡菜单操作
  const customBubbleActions: CustomEditorAction[] = [
    {
      name: "优化表述",
      action: async (editor: Editor) => {
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to);
        if (!selectedText) return;

        try {
          const response = await fetch("/api/ai-editor-action/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: `优化以下需求表述，使其更清晰、准确、无歧义。直接返回优化后的文本，不要添加解释或JSON格式：\n\n${selectedText}`
            }),
          });
          
          if (!response.ok) throw new Error("请求失败");
          
          const data = await response.json();
          if (data.result) {
            // 直接替换选中的内容而不是插入新内容
            editor.chain().focus().deleteSelection().insertContent(data.result).run();
          }
        } catch (error) {
          console.error("优化表述失败:", error);
        }
      }
    },
    {
      name: "生成示例",
      action: async (editor: Editor) => {
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to);
        if (!selectedText) return;

        try {
          const response = await fetch("/api/ai-editor-action/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: `为以下需求生成一个具体的实例或示例。直接返回示例文本，不要添加解释或JSON格式：\n\n${selectedText}`
            }),
          });
          
          if (!response.ok) throw new Error("请求失败");
          
          const data = await response.json();
          if (data.result) {
            // 插入内容到选中文本之后
            editor.chain().focus().setTextSelection({ from: to, to }).insertContent(`\n\n**示例：**\n${data.result}`).run();
          }
        } catch (error) {
          console.error("生成示例失败:", error);
        }
      }
    }
  ];

  // 使用any类型暂时解决类型不匹配问题
  const getCustomBubbleActions = () => customBubbleActions.map((action) => {
    return {
      name: action.name,
      template: "",
      facetType: FacetType.BUBBLE_MENU,
      changeForm: ChangeForm.REPLACE, // 使用REPLACE替代DIFF来避免JSON显示
      outputForm: OutputForm.TEXT, // 使用TEXT而不是STREAMING可能有助于避免JSON格式
      action: action.action
    } as any;
  });

  return (
    <div className="container mx-auto py-6">
      {/* 注入自定义样式 */}
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>需求书撰写</CardTitle>
            <CardDescription>使用AutoDev Editor辅助撰写需求文档</CardDescription>
          </div>
          <Button 
            onClick={loadRequirementTemplate}
            disabled={!systemId}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            加载需求模版
          </Button>
        </CardHeader>
        <CardContent>
          <Theme className="w-full flex editor-block">
            <div className="w-full editor-section">
              <div className="editor-main bg-white border rounded-md">
                {editor && <ToolbarMenu className="toolbar-menu" editor={editor as any} />}
                <EditorContent editor={editor} />
                <div>{editor && <MenuBubble editor={editor as any} customActions={getCustomBubbleActions()} />}</div>
              </div>
            </div>
            <div className="h-auto">
              {editor && <AdviceView editor={editor as any} />}
            </div>
          </Theme>
        </CardContent>
      </Card>
      
      {/* 确认覆盖内容的对话框 */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认加载模版</AlertDialogTitle>
            <AlertDialogDescription>
              加载模版将覆盖当前编辑器中的所有内容，确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLoadTemplate}>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

