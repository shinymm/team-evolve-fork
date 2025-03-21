'use client'

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { Upload, File as FileIcon, X, Trash2, Download, Book, Loader2, AlertCircle, FileText, HelpCircle } from 'lucide-react'
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/components/ui/use-toast"
import { getAIConfig } from '@/lib/ai-config-service'
import type { AIModelConfig } from '@/lib/ai-service'
import { Button } from "@/components/ui/button"
import { RequirementToMdService } from '@/lib/services/requirement-to-md-service'
import { RequirementToTestService } from '@/lib/services/requirement-to-test-service'
import { RequirementBoundaryComparisonService } from '@/lib/services/requirement-boundary-comparison-service'
import { RequirementTerminologyService } from '@/lib/services/requirement-terminology-service'
import { RequirementArchitectureService } from '@/lib/services/requirement-architecture-service'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// 添加全局样式
import './requirement-styles.css'

// 已上传文件类型定义
type UploadedFile = {
  id: string;
  name: string;
  uploadTime: Date;
  selected?: boolean;  // 新增：是否被选中
  provider: string; // 新增：文件提供者
};

// 添加内容显示组件，使用ReactMarkdown展示Markdown内容
const ContentDisplay = ({ content }: { content: string }) => {
  console.log('ContentDisplay rendering, content length:', content.length);
  
  return (
    <div className="w-full">
      <div className="markdown-content overflow-x-auto w-full">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({children}) => <h1 className="text-xl font-bold mb-2 pb-1 border-b">{children}</h1>,
            h2: ({children}) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
            h3: ({children}) => <h3 className="text-base font-medium mb-1 mt-2">{children}</h3>,
            p: ({children}) => <p className="text-gray-600 my-1 leading-normal text-sm">{children}</p>,
            ul: ({children}) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
            ol: ({children}) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
            li: ({children}) => <li className="text-gray-600 text-sm">{children}</li>,
            blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1 italic text-sm">{children}</blockquote>,
            code: ({children}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>,
            pre: ({children}) => (
              <div className="relative">
                <pre className="bg-gray-50 rounded-lg p-3 my-2 overflow-auto text-sm">{children}</pre>
              </div>
            ),
            table: ({children}) => (
              <div className="overflow-x-auto my-2 md:max-w-full">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 text-sm table-fixed">{children}</table>
              </div>
            ),
            thead: ({children}) => <thead className="bg-gray-50">{children}</thead>,
            tbody: ({children}) => <tbody className="divide-y divide-gray-200">{children}</tbody>,
            tr: ({children}) => <tr className="border-b border-gray-200">{children}</tr>,
            th: ({children}) => <th className="px-3 py-2 text-left font-medium text-gray-700 border-r border-gray-200 last:border-r-0 break-words">{children}</th>,
            td: ({children}) => <td className="px-3 py-2 whitespace-normal border-r border-gray-200 last:border-r-0 break-words align-top">{children}</td>
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      <div className="mt-4 p-2 bg-gray-100 rounded">
        <p className="text-xs text-gray-500">内容长度: {content.length}</p>
      </div>
    </div>
  );
};

export default function RequirementUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string>('')
  const [uploading, setUploading] = useState<boolean>(false)
  const [fileId, setFileId] = useState<string>('')
  const [aiConfig, setAiConfig] = useState<AIModelConfig | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [mdContent, setMdContent] = useState<string>('')
  const [testContent, setTestContent] = useState<string>('')
  const [boundaryContent, setBoundaryContent] = useState<string>('')
  const [terminologyContent, setTerminologyContent] = useState<string>('')
  const [architectureContent, setArchitectureContent] = useState<string>('')
  const [isConverting, setIsConverting] = useState(false)
  const [isGeneratingTest, setIsGeneratingTest] = useState(false)
  const [isComparing, setIsComparing] = useState(false)
  const [isExtractingTerminology, setIsExtractingTerminology] = useState(false)
  const [isExtractingArchitecture, setIsExtractingArchitecture] = useState(false)
  const [fileSelectionAlert, setFileSelectionAlert] = useState<string>('')
  const [showChapterDialog, setShowChapterDialog] = useState(false)
  const [requirementChapter, setRequirementChapter] = useState('')
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const mdContentRef = useRef<HTMLDivElement>(null)
  const testContentRef = useRef<HTMLDivElement>(null)
  const boundaryContentRef = useRef<HTMLDivElement>(null)
  const terminologyContentRef = useRef<HTMLDivElement>(null)
  const architectureContentRef = useRef<HTMLDivElement>(null)
  
  // 添加一个强制重新渲染的机制
  const [, forceUpdate] = useState({});
  
  // 添加标签页状态
  const [activeTab, setActiveTab] = useState<'md' | 'test' | 'boundary' | 'terminology' | 'architecture'>('md');
  
  // 监听内容变化，自动滚动到底部
  useEffect(() => {
    if (mdContentRef.current) {
      mdContentRef.current.scrollTop = mdContentRef.current.scrollHeight;
    }
    console.log('mdContent变化了，新长度:', mdContent.length);
  }, [mdContent]);

  useEffect(() => {
    if (testContentRef.current) {
      testContentRef.current.scrollTop = testContentRef.current.scrollHeight;
    }
    console.log('testContent变化了，新长度:', testContent.length);
  }, [testContent]);

  useEffect(() => {
    if (boundaryContentRef.current) {
      boundaryContentRef.current.scrollTop = boundaryContentRef.current.scrollHeight;
    }
    console.log('boundaryContent变化了，新长度:', boundaryContent.length);
  }, [boundaryContent]);

  useEffect(() => {
    if (terminologyContentRef.current) {
      terminologyContentRef.current.scrollTop = terminologyContentRef.current.scrollHeight;
    }
    console.log('terminologyContent变化了，新长度:', terminologyContent.length);
  }, [terminologyContent]);

  useEffect(() => {
    if (architectureContentRef.current) {
      architectureContentRef.current.scrollTop = architectureContentRef.current.scrollHeight;
    }
    console.log('architectureContent变化了，新长度:', architectureContent.length);
  }, [architectureContent]);

  // 当内容变化时，强制重新渲染
  useEffect(() => {
    const timer = setInterval(() => {
      if (isConverting || isGeneratingTest || isComparing || isExtractingTerminology || isExtractingArchitecture) {
        console.log('强制重新渲染，当前时间:', new Date().toISOString());
        forceUpdate({});
      }
    }, 500); // 每500ms强制重新渲染一次
    
    return () => clearInterval(timer);
  }, [isConverting, isGeneratingTest, isComparing, isExtractingTerminology, isExtractingArchitecture]);

  // 获取AI配置
  useEffect(() => {
    // 直接获取配置放入状态
    const config = getAIConfig()
    setAiConfig(config)
    
    if (!config) {
      setError('未设置AI模型配置，请先在设置中配置模型')
    } else {
      console.log('获取到AI模型配置:', {
        model: config.model,
        baseURL: config.baseURL
      })
    }

    // 从localStorage恢复已上传文件列表
    const storedFiles = localStorage.getItem('uploaded-requirement-files')
    if (storedFiles) {
      try {
        const parsedFiles = JSON.parse(storedFiles)
        // 将字符串日期转换回Date对象
        const filesWithDates = parsedFiles.map((file: any) => ({
          ...file,
          uploadTime: new Date(file.uploadTime),
          selected: parsedFiles.length === 1 ? true : false, // 只有一个文件时默认选中
          provider: file.provider || 'openai' // 记录文件提供者
        }))
        setUploadedFiles(filesWithDates)
      } catch (e) {
        console.error('Failed to parse stored files:', e)
      }
    }
  }, [])

  // 当上传文件列表变化时，保存到localStorage
  useEffect(() => {
    if (uploadedFiles.length > 0) {
      localStorage.setItem('uploaded-requirement-files', JSON.stringify(uploadedFiles))
    }
  }, [uploadedFiles])

  const validateAndSetFile = (selectedFile: File) => {
    // 支持的文件类型列表
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'text/plain', // txt
      'application/pdf', // pdf
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'text/markdown', // md
      'text/x-markdown' // md (别名)
    ];
    
    // 检查文件扩展名作为备选验证方式
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['docx', 'txt', 'pdf', 'xlsx', 'md'];
    
    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension || '')) {
      setError('不支持的文件格式，请上传 Word、TXT、PDF、Excel 或 Markdown 文件');
      return false;
    }

    setFile(selectedFile);
    return true;
  }
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    setError('')

    if (!selectedFile) {
      return
    }

    validateAndSetFile(selectedFile)
    
    // 选择文件后自动上传
    if (selectedFile) {
      setTimeout(() => {
        handleUploadFile(selectedFile);
      }, 100);
    }
  }

  // 处理拖拽事件
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.add('border-orange-500')
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.remove('border-orange-500')
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.remove('border-orange-500')
    }
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      const isValid = validateAndSetFile(droppedFile)
      // 如果文件有效，自动上传
      if (isValid) {
        setTimeout(() => {
          handleUploadFile(droppedFile);
        }, 100);
      }
    }
  }

  const handleUploadFile = async (fileToUpload: File) => {
    if (!fileToUpload) {
      setError('请先选择文件')
      return
    }

    if (!aiConfig) {
      setError('请先配置AI模型')
      return
    }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', fileToUpload)
      formData.append('apiKey', aiConfig.apiKey)
      formData.append('baseURL', aiConfig.baseURL)
      formData.append('model', aiConfig.model)

      const response = await fetch('/api/upload-requirement', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '上传失败')
      }

      console.log('上传成功:', result)

      // 添加到文件列表
      setUploadedFiles(prev => [
        ...prev,
        {
          id: result.file.id,
          name: result.file.name,
          uploadTime: new Date(),
          selected: true,
          provider: result.file.provider
        }
      ])

      // 重置文件选择
      setFile(null)
      setError('')
      setFileId(result.file.id)
      toast({
        title: "上传成功",
        description: `文件 ${result.file.name} 已成功上传，文件ID: ${result.file.id}`,
      })
    } catch (error) {
      console.error('上传文件出错:', error)
      setError(error instanceof Error ? error.message : '未知错误')
      toast({
        variant: "destructive",
        title: "上传失败",
        description: error instanceof Error ? error.message : "未知错误",
      })
    } finally {
      setUploading(false)
    }
  }
  
  // 保留原有的handleUpload函数，但修改为使用handleUploadFile
  const handleUpload = async () => {
    if (!file) {
      setError('请先选择文件')
      return
    }
    
    await handleUploadFile(file);
  }

  const handleDeleteFile = (fileId: string) => {
    // 从已上传文件列表中移除文件
    const updatedFiles = uploadedFiles.filter(file => file.id !== fileId)
    
    // 如果删除后只剩一个文件，则自动选中
    if (updatedFiles.length === 1) {
      updatedFiles[0].selected = true
    }
    
    setUploadedFiles(updatedFiles)
    
    // 更新localStorage
    localStorage.setItem('uploaded-requirement-files', JSON.stringify(updatedFiles))
    
    // 显示删除成功的提示
    toast({
      title: "删除成功",
      description: "文件已从列表中移除",
    });
  };
  
  // 处理文件选择状态变更
  const handleSelectFile = (fileId: string, checked: boolean) => {
    // 更新为支持多选功能
    const updatedFiles = uploadedFiles.map(file => ({
      ...file,
      selected: file.id === fileId ? checked : file.selected
    }))
    
    setUploadedFiles(updatedFiles)
    localStorage.setItem('uploaded-requirement-files', JSON.stringify(updatedFiles))
  }

  // 处理需求书转MD
  const handleConvertToMd = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "转换失败",
        description: "请先上传至少一个文件",
        variant: "destructive",
      });
      return;
    }

    const selectedFiles = uploadedFiles.filter(file => file.selected);
    if (selectedFiles.length !== 1) {
      setFileSelectionAlert("需求书转MD功能一次只能处理一个文件，请只选择一个文件");
      return;
    }

    setFileSelectionAlert("");

    if (!aiConfig) {
      toast({
        title: "转换失败",
        description: "请先配置AI模型",
        variant: "destructive",
      });
      return;
    }

    // 清空之前的内容
    setMdContent('');
    setIsConverting(true);
    // 激活MD标签页
    setActiveTab('md');

    try {
      const service = new RequirementToMdService();

      await service.convertToMd(
        [selectedFiles[0].id],
        aiConfig,
        (content: string) => {
          console.log('收到新内容，长度:', content.length);
          // 使用函数式更新，确保基于最新状态
          setMdContent(prev => prev + content);
        }
      );
    } catch (error) {
      console.error('转换失败:', error);
      toast({
        title: "转换失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      console.log('转换完成');
      setIsConverting(false);
    }
  };

  // 处理下载MD文件
  const handleDownloadMd = () => {
    try {
      const blob = new Blob([mdContent], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `需求书-${timestamp}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: "下载成功",
        description: "需求书内容已保存为 Markdown 文件",
        duration: 3000
      })
    } catch (error) {
      toast({
        title: "下载失败",
        description: "请手动复制内容并保存",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  // 处理打开需求章节输入弹窗
  const handleOpenTestDialog = () => {
    // 检查是否有文件上传
    if (uploadedFiles.length === 0) {
      toast({
        title: "转换失败",
        description: "请先上传至少一个文件",
        variant: "destructive",
      })
      return
    }
    
    // 检查是否有选中的文件
    const selectedFiles = uploadedFiles.filter(file => file.selected)
    if (selectedFiles.length === 0) {
      setFileSelectionAlert("请至少选择一个需求文件进行转换")
      return
    }
    
    setFileSelectionAlert("")

    if (!aiConfig) {
      toast({
        title: "转换失败",
        description: "请先配置AI模型",
        variant: "destructive",
      })
      return
    }

    // 打开弹窗
    setRequirementChapter('')
    setShowChapterDialog(true)
  }

  const handleConvertToTest = async () => {
    // 关闭弹窗
    setShowChapterDialog(false);
    
    // 清空之前的内容
    setTestContent('');
    setIsGeneratingTest(true);
    // 激活测试用例标签页
    setActiveTab('test');
    
    // 添加一个更明显的调试标记，确认函数被调用
    console.log('开始生成测试用例 - ' + new Date().toISOString());

    try {
      const service = new RequirementToTestService()
      const selectedFiles = uploadedFiles.filter(file => file.selected)
      const fileIds = selectedFiles.map(file => file.id)

      await service.convertToTest(
        fileIds,
        aiConfig!,
        (content: string) => {
          console.log('收到新内容，长度:', content.length);
          // 使用函数式更新，确保基于最新状态
          setTestContent(prev => prev + content);
        },
        requirementChapter || undefined
      )

      console.log('生成测试用例完成 - ' + new Date().toISOString());
    } catch (error) {
      console.error('转换失败:', error)
      toast({
        title: "转换失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingTest(false);
      console.log('测试用例生成完成');
    }
  }

  // 处理下载测试用例
  const handleDownloadTest = () => {
    try {
      if (!testContent) {
        toast({
          title: "下载失败",
          description: "没有可下载的测试用例内容",
          variant: "destructive",
          duration: 3000
        })
        return
      }

      const blob = new Blob([testContent], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      
      const a = document.createElement('a')
      a.href = url
      a.download = `测试用例-${timestamp}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: "下载成功",
        description: "测试用例内容已保存为 Markdown 文件",
        duration: 3000
      })
    } catch (error) {
      toast({
        title: "下载失败",
        description: "请手动复制内容并保存",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  // 处理需求对比抽取边界知识
  const handleCompareRequirements = async () => {
    if (uploadedFiles.length < 2) {
      toast({
        title: "对比失败",
        description: "请先上传至少两个文件",
        variant: "destructive",
      });
      return;
    }

    const selectedFiles = uploadedFiles.filter(file => file.selected);
    if (selectedFiles.length !== 2) {
      setFileSelectionAlert("需求对比功能需要选择两个文件（初稿和终稿），请确保选择且仅选择两个文件");
      return;
    }

    setFileSelectionAlert("");

    if (!aiConfig) {
      toast({
        title: "对比失败",
        description: "请先配置AI模型",
        variant: "destructive",
      });
      return;
    }

    // 清空之前的内容
    setBoundaryContent('');
    setIsComparing(true);
    // 激活边界知识标签页
    setActiveTab('boundary');

    try {
      const service = new RequirementBoundaryComparisonService();

      await service.compareRequirements(
        [selectedFiles[0].id, selectedFiles[1].id],
        aiConfig,
        (content: string) => {
          console.log('收到新内容，长度:', content.length);
          // 使用函数式更新，确保基于最新状态
          setBoundaryContent(prev => prev + content);
        }
      );
    } catch (error) {
      console.error('对比失败:', error);
      toast({
        title: "对比失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      console.log('对比完成');
      setIsComparing(false);
    }
  };

  // 处理下载边界知识
  const handleDownloadBoundary = () => {
    try {
      if (!boundaryContent) {
        toast({
          title: "下载失败",
          description: "没有可下载的边界知识内容",
          variant: "destructive",
          duration: 3000
        });
        return;
      }

      const blob = new Blob([boundaryContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `需求边界知识-${timestamp}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "下载成功",
        description: "边界知识内容已保存为 Markdown 文件",
        duration: 3000
      });
    } catch (error) {
      toast({
        title: "下载失败",
        description: "请手动复制内容并保存",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  // 处理术语知识抽取
  const handleExtractTerminology = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "抽取失败",
        description: "请先上传至少一个文件",
        variant: "destructive",
      });
      return;
    }

    const selectedFiles = uploadedFiles.filter(file => file.selected);
    if (selectedFiles.length === 0) {
      setFileSelectionAlert("请至少选择一个文件进行术语抽取");
      return;
    }

    setFileSelectionAlert("");

    if (!aiConfig) {
      toast({
        title: "抽取失败",
        description: "请先配置AI模型",
        variant: "destructive",
      });
      return;
    }

    // 清空之前的内容
    setTerminologyContent('');
    setIsExtractingTerminology(true);
    // 激活术语知识标签页
    setActiveTab('terminology');

    try {
      const service = new RequirementTerminologyService();
      const fileIds = selectedFiles.map(file => file.id);

      await service.extractTerminology(
        fileIds,
        aiConfig,
        (content: string) => {
          console.log('收到新内容，长度:', content.length);
          // 使用函数式更新，确保基于最新状态
          setTerminologyContent(prev => prev + content);
        }
      );
    } catch (error) {
      console.error('术语抽取失败:', error);
      toast({
        title: "抽取失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      console.log('术语抽取完成');
      setIsExtractingTerminology(false);
    }
  };

  // 处理下载术语知识
  const handleDownloadTerminology = () => {
    try {
      if (!terminologyContent) {
        toast({
          title: "下载失败",
          description: "没有可下载的术语知识内容",
          variant: "destructive",
          duration: 3000
        });
        return;
      }

      const blob = new Blob([terminologyContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `业务术语知识-${timestamp}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "下载成功",
        description: "术语知识内容已保存为 Markdown 文件",
        duration: 3000
      });
    } catch (error) {
      toast({
        title: "下载失败",
        description: "请手动复制内容并保存",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  // 处理信息架构树抽取
  const handleExtractArchitecture = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "抽取失败",
        description: "请先上传至少一个文件",
        variant: "destructive",
      });
      return;
    }

    const selectedFiles = uploadedFiles.filter(file => file.selected);
    if (selectedFiles.length === 0) {
      setFileSelectionAlert("请至少选择一个文件进行信息架构抽取");
      return;
    }

    setFileSelectionAlert("");

    if (!aiConfig) {
      toast({
        title: "抽取失败",
        description: "请先配置AI模型",
        variant: "destructive",
      });
      return;
    }

    // 清空之前的内容
    setArchitectureContent('');
    setIsExtractingArchitecture(true);
    // 激活信息架构标签页
    setActiveTab('architecture');

    try {
      const service = new RequirementArchitectureService();
      const fileIds = selectedFiles.map(file => file.id);

      await service.extractArchitecture(
        fileIds,
        aiConfig,
        (content: string) => {
          console.log('收到新内容，长度:', content.length);
          // 使用函数式更新，确保基于最新状态
          setArchitectureContent(prev => prev + content);
        }
      );
    } catch (error) {
      console.error('信息架构抽取失败:', error);
      toast({
        title: "抽取失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      console.log('信息架构抽取完成');
      setIsExtractingArchitecture(false);
    }
  };

  // 处理下载信息架构
  const handleDownloadArchitecture = () => {
    try {
      if (!architectureContent) {
        toast({
          title: "下载失败",
          description: "没有可下载的信息架构内容",
          variant: "destructive",
          duration: 3000
        });
        return;
      }

      const blob = new Blob([architectureContent], { type: 'text/typescript' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `信息架构树-${timestamp}.ts`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "下载成功",
        description: "信息架构内容已保存为 TypeScript 文件",
        duration: 3000
      });
    } catch (error) {
      toast({
        title: "下载失败",
        description: "请手动复制内容并保存",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  return (
    <>
      <div className="w-full max-w-full overflow-x-hidden">
        <div className="space-y-4 px-4 py-4 mx-auto w-[90%]">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center">
                <h1 className="text-2xl font-bold tracking-tight">需求书综合处理</h1>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="ml-2 cursor-help">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md p-4 bg-white shadow-lg rounded-lg border border-gray-200">
                      <div className="text-sm">
                        <p className="font-bold text-gray-900 mb-1">重要提示</p>
                        <p className="text-gray-700">请确保选择<span className="font-bold text-orange-600">长上下文且支持docx附件</span>的大模型（如 qwen-long），以获得最佳处理效果。</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-muted-foreground text-xs mt-1">
                请上传需求书文档（建议Qwen-long使用docx格式， Gemini使用PDF格式），我们将帮助您进行智能拆解。
              </p>
              {!aiConfig && (
                <p className="text-red-500 text-xs mt-1">
                  未检测到AI模型配置，请先在设置中配置模型
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3 overflow-x-auto">
            <div className="border rounded-lg p-3">
              <div 
                ref={dropAreaRef}
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center transition-colors duration-200"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Upload className="h-8 w-8 text-gray-400" />
                  <div className="text-xs text-gray-600">
                    {file ? (
                      <p className="text-green-600">已选择文件: {file.name}</p>
                    ) : (
                      <>
                        <p>拖拽文件到此处或</p>
                        <label className="cursor-pointer text-orange-600 hover:text-orange-700">
                          点击上传
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".docx,.txt,.pdf,.xlsx,.md"
                            onChange={handleFileChange}
                          />
                        </label>
                      </>
                    )}
                  </div>
                  {error && <p className="text-red-500 text-xs">{error}</p>}
                </div>
              </div>

              <div className="mt-3 flex justify-center gap-2">
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading || !aiConfig}
                  className={`px-3 py-1.5 rounded-md text-white text-xs
                    ${file && !uploading && aiConfig
                      ? 'bg-orange-500 hover:bg-orange-600' 
                      : 'bg-gray-400 cursor-not-allowed'
                    }`}
                >
                  {uploading ? '上传中...' : '上传文件'}
                </button>
                
                {/* 需求书转MD按钮 */}
                <Button
                  onClick={handleConvertToMd}
                  disabled={uploadedFiles.length === 0 || isConverting}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !isConverting
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {isConverting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Book className="h-3 w-3" />
                  )}
                  {isConverting ? '转换中...' : '需求书转MD'}
                </Button>
                
                {/* 需求书转测试用例按钮 */}
                <Button
                  onClick={handleOpenTestDialog}
                  disabled={uploadedFiles.length === 0 || isGeneratingTest}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !isGeneratingTest
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {isGeneratingTest ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {isGeneratingTest ? '生成中...' : '需求书转测试用例'}
                </Button>
                
                {/* 需求对比抽取边界知识按钮 */}
                <Button
                  onClick={handleCompareRequirements}
                  disabled={uploadedFiles.length < 2 || isComparing}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length >= 2 && !isComparing
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {isComparing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <HelpCircle className="h-3 w-3" />
                  )}
                  {isComparing ? '对比中...' : '抽取边界知识'}
                </Button>
                
                {/* 术语知识抽取按钮 */}
                <Button
                  onClick={handleExtractTerminology}
                  disabled={uploadedFiles.length === 0 || isExtractingTerminology}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !isExtractingTerminology
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {isExtractingTerminology ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Book className="h-3 w-3" />
                  )}
                  {isExtractingTerminology ? '抽取中...' : '抽取术语知识'}
                </Button>
                
                {/* 信息架构树抽取按钮 */}
                <Button
                  onClick={handleExtractArchitecture}
                  disabled={uploadedFiles.length === 0 || isExtractingArchitecture}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !isExtractingArchitecture
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {isExtractingArchitecture ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {isExtractingArchitecture ? '抽取中...' : '抽取信息架构树'}
                </Button>
              </div>
              
              {/* 文件选择警告提示 */}
              {fileSelectionAlert && (
                <Alert variant="destructive" className="mt-2 py-2">
                  <AlertCircle className="h-3 w-3" />
                  <AlertTitle className="text-xs">警告</AlertTitle>
                  <AlertDescription className="text-xs">
                    {fileSelectionAlert}
                  </AlertDescription>
                </Alert>
              )}
              
              {/* 已上传文件列表和操作区域 */}
              {uploadedFiles.length > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-1">
                    <div>
                      <h3 className="text-xs font-medium text-gray-700">已上传文件列表</h3>
                      <p className="text-xs text-gray-500 mt-0.5">可多选文件：需求书转MD仅支持单选，测试用例生成支持多选，需求对比需选择两个文件</p>
                    </div>
                  </div>
                  
                  <div className="border rounded-md overflow-hidden max-h-[150px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            选择
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            文件名
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            文件ID
                          </th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            上传时间
                          </th>
                          <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {uploadedFiles.map((file) => (
                          <tr key={file.id}>
                            <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-900">
                              <Checkbox
                                checked={file.selected}
                                onCheckedChange={(checked) => handleSelectFile(file.id, checked === true)}
                                aria-label={`选择文件 ${file.name}`}
                              />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 flex items-center">
                              <FileIcon className="h-3 w-3 mr-1 text-orange-500" />
                              {file.name}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                              {file.id}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                              {file.uploadTime.toLocaleString('zh-CN')}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 text-right">
                              <button
                                onClick={() => handleDeleteFile(file.id)}
                                className="text-red-500 hover:text-red-700 rounded-full p-0.5 hover:bg-red-50 transition-colors"
                                title="删除文件"
                                aria-label="删除文件"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            {/* 输出内容标签页UI */}
            <div className="border rounded-lg p-4 mt-3 overflow-hidden">
              <div className="flex border-b mb-3">
                <button
                  onClick={() => setActiveTab('md')}
                  className={`px-3 py-1.5 font-medium text-xs rounded-t-lg mr-2 transition-colors ${
                    activeTab === 'md' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  需求书内容
                </button>
                <button
                  onClick={() => setActiveTab('test')}
                  className={`px-3 py-1.5 font-medium text-xs rounded-t-lg mr-2 transition-colors ${
                    activeTab === 'test' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  测试用例
                </button>
                <button
                  onClick={() => setActiveTab('boundary')}
                  className={`px-3 py-1.5 font-medium text-xs rounded-t-lg mr-2 transition-colors ${
                    activeTab === 'boundary' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  需求边界知识
                </button>
                <button
                  onClick={() => setActiveTab('terminology')}
                  className={`px-3 py-1.5 font-medium text-xs rounded-t-lg mr-2 transition-colors ${
                    activeTab === 'terminology' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  术语知识
                </button>
                <button
                  onClick={() => setActiveTab('architecture')}
                  className={`px-3 py-1.5 font-medium text-xs rounded-t-lg transition-colors ${
                    activeTab === 'architecture' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  信息架构树
                </button>
              </div>
              
              {/* 需求书内容 */}
              {activeTab === 'md' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-base font-semibold">需求书内容</h2>
                    <Button 
                      onClick={handleDownloadMd}
                      disabled={!mdContent}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载MD文件
                    </Button>
                  </div>
                  <div className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full" ref={mdContentRef}>
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染Markdown内容区域, isConverting:', isConverting, 'mdContent长度:', mdContent.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={mdContent} />
                  </div>
                </div>
              )}
              
              {/* 测试用例 */}
              {activeTab === 'test' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-base font-semibold">测试用例</h2>
                    <Button 
                      onClick={handleDownloadTest}
                      disabled={!testContent}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载测试用例
                    </Button>
                  </div>
                  <div className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full" ref={testContentRef}>
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染测试用例区域, isGeneratingTest:', isGeneratingTest, 'testContent长度:', testContent.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={testContent} />
                  </div>
                </div>
              )}
              
              {/* 边界知识 */}
              {activeTab === 'boundary' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-base font-semibold">需求边界知识</h2>
                    <Button 
                      onClick={handleDownloadBoundary}
                      disabled={!boundaryContent}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载边界知识
                    </Button>
                  </div>
                  <div className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full" ref={boundaryContentRef}>
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染边界知识区域, isComparing:', isComparing, 'boundaryContent长度:', boundaryContent.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={boundaryContent} />
                  </div>
                </div>
              )}
              
              {/* 术语知识 */}
              {activeTab === 'terminology' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-base font-semibold">业务术语知识</h2>
                    <Button 
                      onClick={handleDownloadTerminology}
                      disabled={!terminologyContent}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载术语知识
                    </Button>
                  </div>
                  <div className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full" ref={terminologyContentRef}>
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染术语知识区域, isExtractingTerminology:', isExtractingTerminology, 'terminologyContent长度:', terminologyContent.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={terminologyContent} />
                  </div>
                </div>
              )}
              
              {/* 信息架构树 */}
              {activeTab === 'architecture' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-base font-semibold">信息架构树</h2>
                    <Button 
                      onClick={handleDownloadArchitecture}
                      disabled={!architectureContent}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载信息架构
                    </Button>
                  </div>
                  <div className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full" ref={architectureContentRef}>
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染信息架构区域, isExtractingArchitecture:', isExtractingArchitecture, 'architectureContent长度:', architectureContent.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={architectureContent} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 需求章节输入弹窗 */}
      <Dialog open={showChapterDialog} onOpenChange={setShowChapterDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>输入需求章节</DialogTitle>
            <DialogDescription>
              请输入您想要处理的需求章节标题或描述（50字内），以便更精确地生成测试用例。
              如果不需要指定章节，可以留空。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="requirementChapter" className="text-right">
                需求章节
              </Label>
              <Input
                id="requirementChapter"
                value={requirementChapter}
                onChange={(e) => setRequirementChapter(e.target.value)}
                maxLength={50}
                placeholder="例如：用户登录功能"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChapterDialog(false)}>
              取消
            </Button>
            <Button onClick={handleConvertToTest}>
              开始生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Toaster />
    </>
  )
} 