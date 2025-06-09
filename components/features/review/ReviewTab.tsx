"use client"

import "./word-content.css"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertTriangle,
  MessageSquare,
  CheckCircle,
  XCircle,
  Undo2,
  List,
  ChevronUp,
  ChevronDown,
  Copy,
  ChevronRight,
} from "lucide-react"
import { ReviewService, DocumentSection, ReviewIssue } from "@/lib/api/review"
import mammoth from "mammoth"

interface ReviewTabProps {
  onCompleteReview: () => void
  onBackToAnalysis: () => void
  fileId?: string
  fileName?: string
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
console.log(BASE_URL);

export function ReviewTab({ onCompleteReview, onBackToAnalysis, fileId, fileName }: ReviewTabProps) {
  const [outlineExpanded, setOutlineExpanded] = useState(false)
  const [selectedSection, setSelectedSection] = useState<string>("")
  const [selectedIssue, setSelectedIssue] = useState<string>("")
  const [reviewIssues, setReviewIssues] = useState<ReviewIssue[]>([])
  const [documentSections, setDocumentSections] = useState<DocumentSection[]>([])
  const [wordOutline, setWordOutline] = useState<{ text: string; level: number; id: string }[]>([])
  const [wordContent, setWordContent] = useState<string>("")
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [activeHeadingId, setActiveHeadingId] = useState<string>("")
  const [evaluationResults, setEvaluationResults] = useState<any[]>([])

  // Initialize data
  useEffect(() => {
    if (!fileId) return;

    // Download and process Word document
    fetch(`${BASE_URL}/upload/files/${fileId}/download`)
      .then(res => res.arrayBuffer())
      .then(arrayBuffer => mammoth.convertToHtml({ arrayBuffer }))
      .then(result => {
        setWordContent(result.value);
        // Extract headings for outline
        const headings = result.value.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/g) || [];
        const outline = headings.map((heading, index) => {
          const match = heading.match(/<h([1-6])/);
          const level = match ? parseInt(match[1]) : 1;
          const text = heading.replace(/<[^>]*>/g, '');
          return { text, level, id: `heading-${index}` };
        });
        setWordOutline(outline);
      })
      .catch(error => {
        console.error("Error processing Word document:", error);
      });
  }, [fileId]);

  // 监听页面滚动，高亮当前标题
  useEffect(() => {
    const handleScroll = () => {
      if (!wordOutline.length) return;
      const headingElements = wordOutline.map(h => document.getElementById(h.id)).filter(Boolean) as HTMLElement[];
      // 只监听内容区滚动
      if (!contentRef.current) return;
      const contentRect = contentRef.current.getBoundingClientRect();
      const scrollTop = contentRef.current.scrollTop;
      let currentId = wordOutline[0]?.id || "";
      for (let i = 0; i < headingElements.length; i++) {
        const el = headingElements[i];
        const elRect = el.getBoundingClientRect();
        const offset = elRect.top - contentRect.top + scrollTop;
        if (offset - 24 <= scrollTop) {
          currentId = el.id;
        } else {
          break;
        }
      }
      setActiveHeadingId(currentId);
      // 滚动时清空 selectedSection，避免多个高亮
      setSelectedSection("");
    };
    const ref = contentRef.current;
    if (ref) ref.addEventListener("scroll", handleScroll);
    return () => { if (ref) ref.removeEventListener("scroll", handleScroll); };
  }, [wordOutline]);

  useEffect(() => {
    if (!fileId) return;
    fetch(`${BASE_URL}/files/${fileId}/latest-evaluation`)
      .then(res => res.json())
      .then(data => {
        setEvaluationResults(data.evaluations || []);
      });
  }, [fileId]);

  // Function to find a section by ID
  const findSectionById = (sections: DocumentSection[], id: string): DocumentSection | undefined => {
    for (const section of sections) {
      if (section.id === id) {
        return section
      }
      if (section.children) {
        const found = findSectionById(section.children, id)
        if (found) {
          return found
        }
      }
    }
    return undefined
  }

  // Function to update a section's content
  const updateSectionContent = (
    sections: DocumentSection[],
    sectionId: string,
    newContent: string,
    isModified: boolean,
  ): DocumentSection[] => {
    return sections.map((section) => {
      if (section.id === sectionId) {
        return { ...section, modifiedContent: newContent, isModified }
      }
      if (section.children) {
        return {
          ...section,
          children: updateSectionContent(section.children, sectionId, newContent, isModified),
        }
      }
      return section
    })
  }

  // Handle accepting a modification
  const handleAcceptModification = (issueId: string) => {
    const issue = reviewIssues.find((i) => i && i.id === issueId)
    if (!issue || !issue.modifiedContent || !issue.section) return

    const reviewService = ReviewService.getInstance();
    
    // Update section content
    setDocumentSections((prevSections) =>
      updateSectionContent(prevSections, issue.section, issue.modifiedContent!, true),
    )

    // Update issue status
    setReviewIssues((prevIssues) => prevIssues.map((i) => (i && i.id === issueId ? { ...i, accepted: true } : i)))

    // Call API to update section content
    reviewService.updateSectionContent("doc1", issue.section, issue.modifiedContent, true).then(response => {
      if (response.status === 'success') {
        console.log('Section content updated successfully');
      }
    });

    // Call API to update issue status
    reviewService.updateIssueStatus("doc1", issueId, true).then(response => {
      if (response.status === 'success') {
        console.log('Issue status updated successfully');
      }
    });
  }

  // Handle undoing a modification
  const handleUndoModification = (issueId: string) => {
    const issue = reviewIssues.find((i) => i && i.id === issueId)
    if (!issue || !issue.originalContent || !issue.section) return

    const reviewService = ReviewService.getInstance();
    
    // Update section content
    setDocumentSections((prevSections) =>
      updateSectionContent(prevSections, issue.section, issue.originalContent!, false),
    )

    // Update issue status
    setReviewIssues((prevIssues) => prevIssues.map((i) => (i && i.id === issueId ? { ...i, accepted: undefined } : i)))

    // Call API to update section content
    reviewService.updateSectionContent("doc1", issue.section, issue.originalContent, false).then(response => {
      if (response.status === 'success') {
        console.log('Section content updated successfully');
      }
    });

    // Call API to update issue status
    reviewService.updateIssueStatus("doc1", issueId, false).then(response => {
      if (response.status === 'success') {
        console.log('Issue status updated successfully');
      }
    });
  }

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    if (sectionRefs.current[sectionId]) {
      sectionRefs.current[sectionId]?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  // Handle section selection
  const handleSectionSelect = (sectionId: string) => {
    setSelectedSection(sectionId);
    // 滚动内容区到对应的锚点
    const el = document.getElementById(sectionId);
    if (el && contentRef.current) {
      // 计算el相对内容区的offsetTop，使其正好贴顶
      const contentRect = contentRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const scrollTop = contentRef.current.scrollTop;
      const offset = elRect.top - contentRect.top + scrollTop;
      contentRef.current.scrollTo({ top: offset - 24, behavior: "smooth" });
    }
  }

  // Handle issue selection
  const handleIssueSelect = (issueId: string) => {
    const issue = reviewIssues.find((i) => i && i.id === issueId)
    if (issue && issue.section) {
      setSelectedIssue(issueId)
      setSelectedSection(issue.section)
      scrollToSection(issue.section)
    }
  }

  // Toggle sidebar and outline
  const handleToggleOutline = () => {
    setOutlineExpanded(!outlineExpanded)
  }

  // Render document outline
  const renderDocumentOutline = () => {
    return wordOutline.map((heading, index) => (
      <div key={index} className={`ml-${(heading.level - 1) * 4}`}>
        <button
          onClick={() => handleSectionSelect(heading.id)}
          className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
            (selectedSection
              ? selectedSection === heading.id
              : activeHeadingId === heading.id)
              ? "bg-orange-100 text-orange-700 border border-orange-200"
              : "hover:bg-gray-100 text-gray-700"
          }`}
        >
          <div className="flex items-center space-x-2">
            <ChevronRight className="w-4 h-4" />
            <span className="font-medium">{heading.text}</span>
          </div>
        </button>
      </div>
    ));
  };

  // Render Word document content
  const renderWordContent = () => {
    let html = wordContent;
    // 给所有 h1~h6 加唯一 id，确保大纲和内容一一对应
    let headingIdx = 0;
    html = html.replace(/<h([1-6])(.*?)>([\s\S]*?)<\/h\1>/g, (match, level, attrs, text) => {
      const id = wordOutline[headingIdx]?.id || `heading-${headingIdx}`;
      headingIdx++;
      // 避免重复加id
      if (attrs.includes('id=')) return match;
      return `<h${level}${attrs} id="${id}">${text}</h${level}>`;
    });
    return <div className="word-content" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // 通过章节标题查找 wordOutline id
  const findHeadingIdByTitle = (title: string) => {
    // 去除前后空格，支持"1.2 文档范围"或"文档范围"
    title = title.trim();
    // 优先精确匹配
    let found = wordOutline.find(h => h.text === title);
    if (found) return found.id;
    // 支持章节号+空格+标题的模糊匹配
    found = wordOutline.find(h => h.text.endsWith(title));
    if (found) return found.id;
    // 支持只匹配章节号
    found = wordOutline.find(h => h.text.replace(/\s/g, '').startsWith(title.replace(/\s/g, '')));
    if (found) return found.id;
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
            onClick={handleToggleOutline}
          >
            <List className="w-4 h-4" />
            <span>{outlineExpanded ? "隐藏大纲" : "显示大纲"}</span>
            {outlineExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <h2 className="text-xl font-semibold text-gray-900">{fileName ? fileName.replace(/\.[^/.]+$/, "") : "文档名称加载中..."}</h2>
        </div>
        <Badge variant="secondary">v1.2.0 汽车行业</Badge>
      </div>

      <div className="flex gap-6 h-[700px]">
        {/* Document Outline - Left Side (when expanded) */}
        {outlineExpanded && (
          <div className="w-1/4 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-medium text-gray-900">文档大纲</h3>
            </div>
            <div className="p-4 overflow-y-auto h-full">
              <div className="space-y-2">{renderDocumentOutline()}</div>
            </div>
          </div>
        )}

        {/* Document Content - Center */}
        <div
          className={`${outlineExpanded ? "w-1/2" : "w-2/3"} bg-white rounded-lg border border-gray-200 overflow-hidden`}
        >
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">文档内容</h3>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  <Copy className="w-4 h-4 mr-2" />
                  复制
                </Button>
              </div>
            </div>
          </div>
          <div className="p-6 overflow-y-auto h-full" ref={contentRef}>
            <div className="space-y-6">{renderWordContent()}</div>
          </div>
        </div>

        {/* Evaluation Results - Right Side */}
        <div
          className={`${outlineExpanded ? "w-1/4" : "w-1/3"} bg-white rounded-lg border border-gray-200 overflow-hidden`}
        >
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-medium text-gray-900">评审结果</h3>
            {(() => {
              const allProblems = evaluationResults.flatMap(eva => (eva.result || []).filter((item: any) => item.result === '不通过' || item.result === '部分通过'));
              return <p className="text-sm text-gray-500 mt-1">共发现 {allProblems.length} 个问题</p>;
            })()}
          </div>
          <div className="p-4 overflow-y-auto h-full">
            <div className="space-y-4">
              {evaluationResults.length === 0 && (
                <div className="text-sm text-gray-400">暂无评审结果</div>
              )}
              {(() => {
                // 收集所有问题项
                const allProblems: {item: any, eva: any}[] = [];
                evaluationResults.forEach(eva => {
                  (eva.result || []).forEach((item: any) => {
                    if (item.result === '不通过' || item.result === '部分通过') {
                      allProblems.push({item, eva});
                    }
                  });
                });
                return allProblems.map(({item, eva}, idx) => {
                  const isError = item.result === '不通过';
                  const isWarning = item.result === '部分通过';
                  const borderColor = isError ? 'border-[#ffb980]' : 'border-[#ffe9b0]';
                  const hoverBg = isError ? 'hover:bg-[#fff7f3]' : 'hover:bg-[#fffdf5]';
                  const icon = isError ? <AlertTriangle className="w-5 h-5 text-[#ff6f3c]" /> : <AlertTriangle className="w-5 h-5 text-[#fbbf24]" />;
                  return (
                    <div
                      key={eva.id + '-' + idx}
                      className={`relative rounded-xl p-5 mb-4 ${borderColor} border transition-colors ${hoverBg}`}
                    >
                      {/* 序号和icon */}
                      <div className="flex items-center mb-2">
                        <span className={`text-lg font-bold mr-2 ${isError ? 'text-[#ff6f3c]' : 'text-[#fbbf24]'}`}>#{idx + 1}</span>
                        {icon}
                        <div className="ml-auto flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-gray-400 cursor-pointer hover:text-green-500" />
                          <XCircle className="w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600" />
                        </div>
                      </div>
                      {/* 标题 */}
                      <div className="text-lg font-bold text-gray-900 mb-1">{item.title}</div>
                      {/* 章节 */}
                      <div className="mb-2 flex flex-wrap items-center gap-1">
                        <span className="text-sm text-gray-500">所在章节：</span>
                        {item.section_title && item.section_title.split(',').map((t: string, idx: number) => {
                          const headingId = findHeadingIdByTitle(t);
                          return (
                            <span
                              key={t + idx}
                              className={`inline-block text-xs px-2 py-0.5 rounded-md border border-blue-200 bg-gray-50 text-blue-600 cursor-pointer mr-1 align-middle transition-all
                                ${headingId ? 'hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50' : 'opacity-50 cursor-not-allowed'}
                              `}
                              style={{lineHeight: '1.6'}}
                              onClick={() => headingId && handleSectionSelect(headingId)}
                            >
                              {t.trim()}{idx < item.section_title.split(',').length - 1 ? '，' : ''}
                            </span>
                          );
                        })}
                      </div>
                      {/* 问题描述 */}
                      <div className="text-sm text-gray-700 mb-2">{item.question}</div>
                      {/* 建议 */}
                      <div className="border-t border-dashed border-gray-200 pt-3 mt-3">
                        <div className="font-semibold text-gray-900 mb-1">修改建议</div>
                        <div className="text-sm text-gray-700 mb-2">{item.suggestion}</div>
                        <button className="px-4 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium">采纳修改</button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={onBackToAnalysis}
          className="flex items-center space-x-2"
        >
          <span>上一步</span>
        </Button>
        <Button
          onClick={onCompleteReview}
          className="bg-orange-500 hover:bg-orange-600"
        >
          下一步
        </Button>
      </div>
    </div>
  )
} 