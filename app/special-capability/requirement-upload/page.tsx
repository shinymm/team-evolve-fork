'use client'

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { Upload, File as FileIcon, X, Trash2, Download, Book, Loader2, AlertCircle, FileText, HelpCircle } from 'lucide-react'
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/components/ui/use-toast"
import { getAIConfig } from '@/lib/ai-config-service'
import type { AIModelConfig } from '@/lib/ai-service'
import { streamingAICall } from '@/lib/ai-service'
import { Button } from "@/components/ui/button"
import { RequirementToMdService } from '@/lib/services/requirement-to-md-service'
import { RequirementToTestService } from '@/lib/services/requirement-to-test-service'
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
  
  // 添加一个直接显示内容的div，用于调试
  return (
    <div>
      <div className="markdown-content">
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
            )
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
  const [isConverting, setIsConverting] = useState(false)
  const [isGeneratingTest, setIsGeneratingTest] = useState(false)
  const [fileSelectionAlert, setFileSelectionAlert] = useState<string>('')
  const [showChapterDialog, setShowChapterDialog] = useState(false)
  const [requirementChapter, setRequirementChapter] = useState('')
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const mdContentRef = useRef<HTMLDivElement>(null)
  const testContentRef = useRef<HTMLDivElement>(null)
  
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

  // 添加一个强制重新渲染的机制
  const [, forceUpdate] = useState({});
  
  // 当内容变化时，强制重新渲染
  useEffect(() => {
    const timer = setInterval(() => {
      if (isConverting || isGeneratingTest) {
        console.log('强制重新渲染，当前时间:', new Date().toISOString());
        forceUpdate({});
      }
    }, 500); // 每500ms强制重新渲染一次
    
    return () => clearInterval(timer);
  }, [isConverting, isGeneratingTest]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    setError('')

    if (!selectedFile) {
      return
    }

    validateAndSetFile(selectedFile)
  }

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
      return;
    }

    setFile(selectedFile);
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
      validateAndSetFile(droppedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) {
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
      formData.append('file', file)
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
    // 需求书转MD功能只能选择一个文件，所以选中一个时，取消其他所有文件的选中状态
    const updatedFiles = uploadedFiles.map(file => ({
      ...file,
      selected: file.id === fileId ? checked : false
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

    // 初始化内容
    console.log('初始化mdContent:', '正在生成Markdown内容，请稍候...\n\n');

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
      setFileSelectionAlert("请先选择需求文件进行转换")
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
    setShowChapterDialog(false)
    
    // 重置状态
    // 初始化内容
    setTestContent('');
    
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
      // 移除isGeneratingTest状态的设置
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

  return (
    <>
      <div className="mx-auto py-6 w-[90%]">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center">
                <h1 className="text-2xl font-bold tracking-tight">需求书综合处理</h1>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="ml-2 cursor-help">
                        <AlertCircle className="h-5 w-5 text-orange-500" />
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
              <p className="text-muted-foreground text-sm mt-2">
                请上传需求书文档（支持 .docx、.txt、.pdf、.xlsx、.md 格式），我们将帮助您进行智能拆解。
              </p>
              {!aiConfig && (
                <p className="text-red-500 text-sm mt-2">
                  未检测到AI模型配置，请先在设置中配置模型
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="border rounded-lg p-6">
              <div 
                ref={dropAreaRef}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors duration-200"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Upload className="h-12 w-12 text-gray-400" />
                  <div className="text-sm text-gray-600">
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
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                </div>
              </div>

              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading || !aiConfig}
                  className={`px-4 py-2 rounded-md text-white text-sm
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
                  disabled={uploadedFiles.length === 0}
                  className={`flex items-center gap-2 ${
                    uploadedFiles.length > 0 
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  <Book className="h-4 w-4" />
                  需求书转MD
                </Button>
                
                {/* 需求书转测试用例按钮 */}
                <Button
                  onClick={handleOpenTestDialog}
                  disabled={uploadedFiles.length === 0}
                  className={`flex items-center gap-2 ${
                    uploadedFiles.length > 0 
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  需求书转测试用例
                </Button>
              </div>
              
              {/* 文件选择警告提示 */}
              {fileSelectionAlert && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>警告</AlertTitle>
                  <AlertDescription>
                    {fileSelectionAlert}
                  </AlertDescription>
                </Alert>
              )}
              
              {/* 已上传文件列表和操作区域 */}
              {uploadedFiles.length > 0 && (
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-gray-700">已上传文件列表</h3>
                  </div>
                  
                  <div className="border rounded-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            选择
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            文件名
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            文件ID
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            上传时间
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {uploadedFiles.map((file) => (
                          <tr key={file.id}>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                              <Checkbox
                                checked={file.selected}
                                onCheckedChange={(checked) => handleSelectFile(file.id, checked === true)}
                                aria-label={`选择文件 ${file.name}`}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 flex items-center">
                              <FileIcon className="h-4 w-4 mr-2 text-orange-500" />
                              {file.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {file.id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {file.uploadTime.toLocaleString('zh-CN')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                              <button
                                onClick={() => handleDeleteFile(file.id)}
                                className="text-red-500 hover:text-red-700 rounded-full p-1 hover:bg-red-50 transition-colors"
                                title="删除文件"
                                aria-label="删除文件"
                              >
                                <Trash2 className="h-4 w-4" />
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
            
            {/* 内容显示部分 - 始终显示，无论是否有内容 */}
            <div className="border rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">需求书内容</h2>
                <Button 
                  onClick={handleDownloadMd}
                  disabled={!mdContent}
                  className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  下载MD文件
                </Button>
              </div>
              <div className="border rounded p-4 bg-gray-50 min-h-[300px] overflow-auto" ref={mdContentRef}>
                {/* 添加调试信息，使用自执行函数避免返回void */}
                {(() => {
                  console.log('渲染Markdown内容区域, isConverting:', isConverting, 'mdContent长度:', mdContent.length);
                  return null;
                })()}
                
                {/* 显示内容，无论是否为空 */}
                <ContentDisplay content={mdContent} />
              </div>
            </div>
            
            {/* 测试用例显示部分 - 始终显示，无论是否有内容 */}
            <div className="border rounded-lg p-6 mt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">测试用例</h2>
                <Button 
                  onClick={handleDownloadTest}
                  disabled={!testContent}
                  className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  下载测试用例
                </Button>
              </div>
              <div className="border rounded p-4 bg-gray-50 min-h-[300px] overflow-auto" ref={testContentRef}>
                {/* 添加调试信息，使用自执行函数避免返回void */}
                {(() => {
                  console.log('渲染测试用例区域, isGeneratingTest:', isGeneratingTest, 'testContent长度:', testContent.length);
                  return null;
                })()}
                
                {/* 显示内容，无论是否为空 */}
                <ContentDisplay content={testContent} />
              </div>
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