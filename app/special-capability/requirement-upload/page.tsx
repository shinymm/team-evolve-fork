'use client'

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { useToast } from "@/components/ui/use-toast"
import { RequirementToMdService } from '@/lib/services/requirement-to-md-service'
import { RequirementToTestService } from '@/lib/services/requirement-to-test-service'
import { RequirementBoundaryComparisonService } from '@/lib/services/requirement-boundary-comparison-service'
import { RequirementTerminologyService } from '@/lib/services/requirement-terminology-service'
import { RequirementArchitectureService } from '@/lib/services/requirement-architecture-service'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Upload, File as FileIcon, X, Trash2, Download, Book, Loader2, AlertCircle, FileText, HelpCircle } from 'lucide-react'
import { Toaster } from "@/components/ui/toaster"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { flushSync } from 'react-dom'

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

// 添加统一的类型定义
type TabType = 'md' | 'test' | 'boundary' | 'terminology' | 'architecture';

interface TabConfig {
  id: TabType;
  title: string;
  buttonText: string;
  service: any;
  minFiles: number;
  maxFiles?: number;
  downloadFileName: string;
}

const TAB_CONFIGS: TabConfig[] = [
  {
    id: 'md',
    title: '需求书内容',
    buttonText: '需求书转MD',
    service: RequirementToMdService,
    minFiles: 1,
    maxFiles: 1,
    downloadFileName: '需求书'
  },
  {
    id: 'test',
    title: '测试用例',
    buttonText: '需求书转测试用例',
    service: RequirementToTestService,
    minFiles: 1,
    maxFiles: 1,
    downloadFileName: '测试用例'
  },
  {
    id: 'boundary',
    title: '需求边界知识',
    buttonText: '抽取边界知识',
    service: RequirementBoundaryComparisonService,
    minFiles: 2,
    maxFiles: 2,
    downloadFileName: '需求边界知识'
  },
  {
    id: 'terminology',
    title: '术语知识',
    buttonText: '抽取术语知识',
    service: RequirementTerminologyService,
    minFiles: 1,
    maxFiles: 1,
    downloadFileName: '业务术语知识'
  },
  {
    id: 'architecture',
    title: '信息架构树',
    buttonText: '抽取信息架构树',
    service: RequirementArchitectureService,
    minFiles: 1,
    maxFiles: 1,
    downloadFileName: '信息架构树'
  }
];

// 添加内容显示组件，使用ReactMarkdown展示Markdown内容
const ContentDisplay = memo(({ content }: { content: string }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // 如果内容为空，显示提示
  if (!content) {
    return (
      <div className="text-gray-500 text-sm flex items-center gap-2">
        <span>暂无内容</span>
      </div>
    );
  }

  // 如果内容是空白字符，也显示提示
  if (content.trim() === '') {
    return (
      <div className="text-gray-500 text-sm">
        内容为空白字符
      </div>
    );
  }

  // 渲染内容
  return (
    <div ref={contentRef} className="prose prose-xs max-w-none break-words whitespace-pre-wrap relative">
      <style jsx global>{`
        .prose {
          font-size: 0.875rem;
          line-height: 1.5;
        }
        .prose table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
          font-size: 0.875rem;
        }
        .prose table th {
          background-color: #f3f4f6;
          border: 1px solid #e5e7eb;
          padding: 0.5rem;
          text-align: left;
          font-weight: 600;
        }
        .prose table td {
          border: 1px solid #e5e7eb;
          padding: 0.5rem;
          vertical-align: top;
        }
        .prose table tr:nth-child(even) {
          background-color: #f9fafb;
        }
        .prose table tr:hover {
          background-color: #f3f4f6;
        }
        .prose h1 {
          font-size: 1.5rem;
          margin-top: 1.5rem;
          margin-bottom: 1rem;
        }
        .prose h2 {
          font-size: 1.25rem;
          margin-top: 1.25rem;
          margin-bottom: 0.75rem;
        }
        .prose h3 {
          font-size: 1.125rem;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .prose p {
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
        }
        .prose ul, .prose ol {
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .prose li {
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
        }
        .prose code {
          font-size: 0.875rem;
          padding: 0.2rem 0.4rem;
          background-color: #f3f4f6;
          border-radius: 0.25rem;
        }
        .prose pre {
          font-size: 0.875rem;
          padding: 0.75rem;
          background-color: #f3f4f6;
          border-radius: 0.375rem;
          overflow-x: auto;
        }
      `}</style>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
});

ContentDisplay.displayName = 'ContentDisplay';

export default function RequirementUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string>('')
  const [uploading, setUploading] = useState<boolean>(false)
  const [fileId, setFileId] = useState<string>('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('md')
  const [processing, setProcessing] = useState<boolean>(false)
  const [contents, setContents] = useState<Record<TabType, string>>({
    md: '',
    test: '',
    boundary: '',
    terminology: '',
    architecture: ''
  })
  const [showChapterDialog, setShowChapterDialog] = useState(false)
  const [requirementChapter, setRequirementChapter] = useState('')
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const mdContentRef = useRef<HTMLDivElement>(null)
  const testContentRef = useRef<HTMLDivElement>(null)
  const boundaryContentRef = useRef<HTMLDivElement>(null)
  const terminologyContentRef = useRef<HTMLDivElement>(null)
  const terminologyTextRef = useRef<string>('')
  const architectureContentRef = useRef<HTMLDivElement>(null)
  
  // 批处理设置参数
  const batchSizeRef = useRef<number>(200); // 默认批量大小
  
  // 添加一个强制重新渲染的机制
  const [, forceUpdate] = useState({});
  
  // 创建一个状态来跟踪最后一次内容更新
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const pendingContentRef = useRef<string>('');
  
  // 为每个操作添加独立的处理状态
  const [processingStates, setProcessingStates] = useState<Record<TabType, boolean>>({
    md: false,
    test: false,
    boundary: false,
    terminology: false,
    architecture: false
  });
  
  // 监听内容变化，自动滚动到底部
  useEffect(() => {
    if (mdContentRef.current) {
      mdContentRef.current.scrollTop = mdContentRef.current.scrollHeight;
    }
    console.log('mdContent变化了，新长度:', contents.md.length);
  }, [contents.md]);

  useEffect(() => {
    if (testContentRef.current) {
      testContentRef.current.scrollTop = testContentRef.current.scrollHeight;
    }
    console.log('testContent变化了，新长度:', contents.test.length);
  }, [contents.test]);

  useEffect(() => {
    if (boundaryContentRef.current) {
      boundaryContentRef.current.scrollTop = boundaryContentRef.current.scrollHeight;
    }
    console.log('boundaryContent变化了，新长度:', contents.boundary.length);
  }, [contents.boundary]);

  useEffect(() => {
    if (terminologyContentRef.current) {
      terminologyContentRef.current.scrollTop = terminologyContentRef.current.scrollHeight;
    }
    console.log('terminologyContent变化了，新长度:', contents.terminology.length);
  }, [contents.terminology]);

  useEffect(() => {
    if (architectureContentRef.current) {
      architectureContentRef.current.scrollTop = architectureContentRef.current.scrollHeight;
    }
    console.log('architectureContent变化了，新长度:', contents.architecture.length);
  }, [contents.architecture]);

  // 当内容变化时，强制重新渲染
  useEffect(() => {
    // 确保只在客户端运行
    if (typeof window === 'undefined') return;
    
    const timer = setInterval(() => {
      if (processing) {
        console.log('⏱️ 定时检查状态:', {
          processing,
          时间: new Date().toISOString()
        });
        
        // 仅在有处理过程进行时才更新
        forceUpdate({});
      }
    }, 1000); // 降低到每秒更新一次，减少性能负担
    
    return () => clearInterval(timer);
  }, [processing]);

  // 获取已上传文件列表
  useEffect(() => {
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

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', fileToUpload)

      console.log(`正在上传文件...`)

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

  // 统一的文档处理函数
  const handleProcessDocument = async (tabId: TabType, extraParams?: { requirementChapter?: string }) => {
    const config = TAB_CONFIGS.find(c => c.id === tabId);
    if (!config) return;

    // 切换到对应的tab
    setActiveTab(tabId);

    const selectedFiles = uploadedFiles.filter(file => file.selected);
    
    // 验证文件数量
    if (selectedFiles.length < config.minFiles) {
      setError(`请至少选择${config.minFiles}个文件`);
      return;
    }
    if (config.maxFiles && selectedFiles.length > config.maxFiles) {
      setError(`${config.title}功能最多只能选择${config.maxFiles}个文件`);
      return;
    }

    setError('');
    // 统一设置初始等待提示
    setContents(prev => ({
      ...prev,
      [tabId]: '等待大模型处理文件中...'
    }));
    
    // 更新特定按钮的处理状态
    setProcessingStates(prev => ({
      ...prev,
      [tabId]: true
    }));
    
    // 添加加载指示器
    const indicator = document.createElement('div');
    indicator.id = 'fixed-loading-indicator';
    indicator.innerHTML = `<div class="fixed top-0 left-0 w-full h-1 bg-orange-500 animate-pulse z-50">
      <div class="h-full bg-orange-600 animate-loading-bar"></div>
    </div>`;
    document.body.appendChild(indicator);

    try {
      const service = new config.service();
      const fileIds = selectedFiles.map(file => file.id);
      
      let isFirstContent = true;
      
      // 统一的内容处理回调
      const contentCallback = (content: string) => {
        setContents(prev => ({
          ...prev,
          [tabId]: isFirstContent ? content : prev[tabId] + content
        }));
        isFirstContent = false;
      };
      
      // 根据不同的服务调用不同的方法
      if (tabId === 'test') {
        await service.convertToTest(
          fileIds,
          contentCallback,
          extraParams?.requirementChapter
        );
      } else {
        const methodMap = {
          md: 'convertToMd',
          boundary: 'compareRequirements',
          terminology: 'extractTerminology',
          architecture: 'extractArchitecture'
        };
        
        await service[methodMap[tabId]](
          fileIds,
          contentCallback
        );
      }
    } catch (error) {
      console.error(`${config.title}处理失败:`, error);
      toast({
        title: `${config.title}失败`,
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      // 重置特定按钮的处理状态
      setProcessingStates(prev => ({
        ...prev,
        [tabId]: false
      }));
      
      // 移除加载指示器
      const indicator = document.getElementById('fixed-loading-indicator');
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }
  };

  // 统一的下载函数
  const handleDownload = (tabId: TabType) => {
    const config = TAB_CONFIGS.find(c => c.id === tabId);
    if (!config) return;

    const content = contents[tabId];
    if (!content) {
      toast({
        title: "下载失败",
        description: `没有可下载的${config.title}内容`,
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    try {
      const blob = new Blob([content], { 
        type: tabId === 'architecture' ? 'text/typescript' : 'text/markdown' 
      });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.downloadFileName}-${timestamp}.${tabId === 'architecture' ? 'ts' : 'md'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "下载成功",
        description: `${config.title}已保存为文件`,
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

  // 修改原有的处理函数，使用统一的处理函数
  const handleConvertToMd = () => handleProcessDocument('md');
  const handleCompareRequirements = () => handleProcessDocument('boundary');
  const handleExtractTerminology = () => handleProcessDocument('terminology');
  const handleExtractArchitecture = () => handleProcessDocument('architecture');

  // 修改原有的下载函数，使用统一的下载函数
  const handleDownloadMd = () => handleDownload('md');
  const handleDownloadTest = () => handleDownload('test');
  const handleDownloadBoundary = () => handleDownload('boundary');
  const handleDownloadTerminology = () => handleDownload('terminology');
  const handleDownloadArchitecture = () => handleDownload('architecture');

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
      setError("请至少选择一个需求文件进行转换")
      return
    }
    
    setError("")

    // 打开弹窗
    setRequirementChapter('')
    setShowChapterDialog(true)
  }

  // 修改handleConvertToTest函数
  const handleConvertToTest = () => {
    // 关闭弹窗
    setShowChapterDialog(false)
    
    // 切换到测试用例tab
    setActiveTab('test')
    
    // 设置初始等待提示
    setContents(prev => ({
      ...prev,
      test: '等待大模型处理文件中...'
    }))
    
    // 更新处理状态
    setProcessingStates(prev => ({
      ...prev,
      test: true
    }))
    
    // 添加加载指示器
    const indicator = document.createElement('div')
    indicator.id = 'fixed-loading-indicator'
    indicator.innerHTML = `<div class="fixed top-0 left-0 w-full h-1 bg-orange-500 animate-pulse z-50">
      <div class="h-full bg-orange-600 animate-loading-bar"></div>
    </div>`
    document.body.appendChild(indicator)

    // 调用统一处理函数
    handleProcessDocument('test', { requirementChapter })
  }

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
                  disabled={!file || uploading}
                  className={`px-3 py-1.5 rounded-md text-white text-xs
                    ${file && !uploading
                      ? 'bg-orange-500 hover:bg-orange-600' 
                      : 'bg-gray-400 cursor-not-allowed'
                    }`}
                >
                  {uploading ? '上传中...' : '上传文件'}
                </button>
                
                {/* 需求书转MD按钮 */}
                <Button
                  onClick={handleConvertToMd}
                  disabled={uploadedFiles.length === 0 || processingStates.md}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !processingStates.md
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {processingStates.md ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Book className="h-3 w-3" />
                  )}
                  {processingStates.md ? '转换中...' : '需求书转MD'}
                </Button>
                
                {/* 需求书转测试用例按钮 */}
                <Button
                  onClick={handleOpenTestDialog}
                  disabled={uploadedFiles.length === 0 || processingStates.test}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !processingStates.test
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {processingStates.test ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {processingStates.test ? '生成中...' : '需求书转测试用例'}
                </Button>
                
                {/* 需求对比抽取边界知识按钮 */}
                <Button
                  onClick={handleCompareRequirements}
                  disabled={uploadedFiles.length < 2 || processingStates.boundary}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length >= 2 && !processingStates.boundary
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {processingStates.boundary ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <HelpCircle className="h-3 w-3" />
                  )}
                  {processingStates.boundary ? '对比中...' : '抽取边界知识'}
                </Button>
                
                {/* 术语知识抽取按钮 */}
                <Button
                  onClick={handleExtractTerminology}
                  disabled={uploadedFiles.length === 0 || processingStates.terminology}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !processingStates.terminology
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {processingStates.terminology ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Book className="h-3 w-3" />
                  )}
                  {processingStates.terminology ? '抽取中...' : '抽取术语知识'}
                </Button>
                
                {/* 信息架构树抽取按钮 */}
                <Button
                  onClick={handleExtractArchitecture}
                  disabled={uploadedFiles.length === 0 || processingStates.architecture}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !processingStates.architecture
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {processingStates.architecture ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {processingStates.architecture ? '抽取中...' : '抽取信息架构树'}
                </Button>

              </div>
              
              {/* 文件选择警告提示 */}
              {error && (
                <Alert variant="destructive" className="mt-2 py-2">
                  <AlertCircle className="h-3 w-3" />
                  <AlertTitle className="text-xs">警告</AlertTitle>
                  <AlertDescription className="text-xs">
                    {error}
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
                      disabled={!contents.md}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载MD文件
                    </Button>
                  </div>
                  <div className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full" ref={mdContentRef}>
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染Markdown内容区域, processing:', processing, 'mdContent长度:', contents.md.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={contents.md} />
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
                      disabled={!contents.test}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载测试用例
                    </Button>
                  </div>
                  <div className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full" ref={testContentRef}>
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染测试用例区域, processing:', processing, 'testContent长度:', contents.test.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={contents.test} />
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
                      disabled={!contents.boundary}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载边界知识
                    </Button>
                  </div>
                  <div className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full" ref={boundaryContentRef}>
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染边界知识区域, processing:', processing, 'boundaryContent长度:', contents.boundary.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={contents.boundary} />
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
                      disabled={processing || !contents.terminology}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载术语知识
                    </Button>
                  </div>
                  <div 
                    id="terminology-content"
                    className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full relative" 
                    ref={terminologyContentRef}
                  >
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染术语知识区域, processing:', processing, 'terminologyContent长度:', contents.terminology.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={contents.terminology} />
                  </div>
                  
                  {/* 添加显式的状态指示器 */}
                  {processing && (
                    <div className="mt-2 text-sm text-orange-600 flex items-center gap-2">
                      <div className="animate-spin h-3 w-3 border-2 border-orange-500 rounded-full border-t-transparent"></div>
                      正在接收内容...
                    </div>
                  )}
                </div>
              )}
              
              {/* 信息架构树 */}
              {activeTab === 'architecture' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-base font-semibold">信息架构树</h2>
                    <Button 
                      onClick={handleDownloadArchitecture}
                      disabled={!contents.architecture}
                      className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载信息架构
                    </Button>
                  </div>
                  <div className="border rounded p-3 bg-gray-50 min-h-[800px] max-h-[1400px] overflow-auto w-full" ref={architectureContentRef}>
                    {/* 添加调试信息，使用自执行函数避免返回void */}
                    {(() => {
                      console.log('渲染信息架构区域, processing:', processing, 'architectureContent长度:', contents.architecture.length);
                      return null;
                    })()}
                    
                    {/* 显示内容，无论是否为空 */}
                    <ContentDisplay content={contents.architecture} />
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
            <Button 
              onClick={handleConvertToTest}
              disabled={processingStates.test}
            >
              {processingStates.test ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                '开始生成'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Toaster />
    </>
  )
} 