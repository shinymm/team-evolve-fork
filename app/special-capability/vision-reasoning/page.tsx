'use client'

import { useState, useRef, useEffect } from 'react'
import { useToast } from "@/components/ui/use-toast"
import { VisionService } from '@/lib/services/vision-service'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Upload, File as FileIcon, Trash2, Download, FileText, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react'
import { Toaster } from "@/components/ui/toaster"
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

// 已上传文件类型定义
type UploadedFile = {
  id: string;
  name: string;
  uploadTime: Date;
  selected?: boolean;
  provider: string;
  url?: string;
};

// 内容显示组件
const ContentDisplay = ({ content }: { content: string }) => {
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
          font-size: 0.75rem;
          line-height: 1.3;
        }
        .prose h1, .prose h2, .prose h3 {
          margin-top: 1.2rem;
          margin-bottom: 0.8rem;
          font-weight: 600;
        }
        .prose p {
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
        }
        .prose ul, .prose ol {
          margin-top: 0.3rem;
          margin-bottom: 0.3rem;
          padding-left: 1.5rem;
          font-size: 0.75rem;
        }
        .prose li {
          margin-top: 0.1rem;
          margin-bottom: 0.1rem;
          font-size: 0.75rem;
          line-height: 1.2;
        }
        .prose code {
          font-size: 0.75rem;
          padding: 0.2rem 0.4rem;
          background-color: #f3f4f6;
          border-radius: 0.25rem;
        }
        .prose pre {
          font-size: 0.75rem;
          padding: 0.75rem;
          background-color: #f3f4f6;
          border-radius: 0.375rem;
          overflow-x: auto;
        }
      `}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({children}: {children: React.ReactNode}) => <h1 className="text-xl font-bold mb-2 pb-1 border-b">{children}</h1>,
          h2: ({children}: {children: React.ReactNode}) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
          h3: ({children}: {children: React.ReactNode}) => <h3 className="text-base font-medium mb-1 mt-2">{children}</h3>,
          p: ({children}: {children: React.ReactNode}) => <p className="text-gray-600 my-1 leading-normal text-sm">{children}</p>,
          ul: ({children}: {children: React.ReactNode}) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
          ol: ({children}: {children: React.ReactNode}) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
          li: ({children}: {children: React.ReactNode}) => <li className="text-gray-600 text-sm">{children}</li>,
          blockquote: ({children}: {children: React.ReactNode}) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1 italic text-sm">{children}</blockquote>,
          code: ({children}: {children: React.ReactNode}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default function VisionReasoning() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string>('')
  const [uploading, setUploading] = useState<boolean>(false)
  const [fileId, setFileId] = useState<string>('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [prompt, setPrompt] = useState<string>('')
  const [reasoning, setReasoning] = useState<string>('')
  const [answer, setAnswer] = useState<string>('')
  const [processing, setProcessing] = useState<boolean>(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [isQVQModel, setIsQVQModel] = useState<boolean>(false)
  const [modelName, setModelName] = useState<string>('')
  
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // 检查当前使用的模型类型
  useEffect(() => {
    const checkModelType = async () => {
      try {
        const response = await fetch('/api/ai/config/default');
        if (response.ok) {
          const data = await response.json();
          const modelName = data.model || '';
          setModelName(modelName);
          setIsQVQModel(modelName.includes('qvq'));
          console.log(`当前使用模型: ${modelName}, 是否为推理型: ${modelName.includes('qvq')}`);
        }
      } catch (error) {
        console.error('获取模型配置失败:', error);
      }
    };
    
    checkModelType();
  }, []);
  
  // 获取已上传文件列表
  useEffect(() => {
    // 从localStorage恢复已上传文件列表
    const storedFiles = localStorage.getItem('uploaded-image-files')
    if (storedFiles) {
      try {
        const parsedFiles = JSON.parse(storedFiles)
        // 将字符串日期转换回Date对象
        const filesWithDates = parsedFiles.map((file: any) => ({
          ...file,
          uploadTime: new Date(file.uploadTime),
          selected: parsedFiles.length === 1 ? true : false, // 只有一个文件时默认选中
          provider: file.provider || 'openai', // 记录文件提供者
          url: file.url // 新增：OSS URL
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
      localStorage.setItem('uploaded-image-files', JSON.stringify(uploadedFiles))
    }
  }, [uploadedFiles])

  // 验证文件格式
  const validateAndSetFile = (selectedFile: File) => {
    // 支持的文件类型列表
    const validTypes = [
      'image/jpeg', 
      'image/png', 
      'image/gif', 
      'image/webp', 
      'image/bmp'
    ];
    
    // 检查文件扩展名作为备选验证方式
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    
    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension || '')) {
      setError('不支持的文件格式，请上传 JPG、PNG、GIF、WEBP 或 BMP 图片文件');
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

  // 处理上传图片
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

      console.log(`正在上传图片到OSS...`)

      // 构建API URL
      const apiUrl = '/api/image';

      // 使用新的图片上传API
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '上传失败')
      }

      console.log('上传成功:', result)

      // 添加到文件列表，现在包含url字段
      setUploadedFiles(prev => [
        ...prev,
        {
          id: result.file.id,
          name: result.file.name,
          url: result.file.url,
          uploadTime: new Date(),
          selected: true,
          provider: result.file.provider
        }
      ])

      // 重置文件选择
      setFile(null)
      setError('')
      setFileId(result.file.id)
      setShowUploadDialog(false)
      toast({
        title: "上传成功",
        description: `文件 ${result.file.name} 已成功上传，存储位置: ${result.file.provider}`,
      })
    } catch (error) {
      console.error('上传图片出错:', error)
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
  
  // 处理上传按钮点击
  const handleUpload = async () => {
    if (!file) {
      setError('请先选择文件')
      return
    }
    
    await handleUploadFile(file);
  }

  // 处理文件删除
  const handleDeleteFile = async (fileId: string) => {
    try {
      // 显示删除中状态
      toast({
        title: "删除中",
        description: "正在从存储中删除文件...",
      });
      
      // 调用API删除OSS中的图片
      const response = await fetch(`/api/image?key=${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '删除失败');
      }
      
      console.log('OSS删除结果:', result);
      
      // 从已上传文件列表中移除文件
      const updatedFiles = uploadedFiles.filter(file => file.id !== fileId)
      
      // 如果删除后只剩一个文件，则自动选中
      if (updatedFiles.length === 1) {
        updatedFiles[0].selected = true
      }
      
      setUploadedFiles(updatedFiles)
      
      // 更新localStorage
      localStorage.setItem('uploaded-image-files', JSON.stringify(updatedFiles))
      
      // 显示删除成功的提示
      toast({
        title: "删除成功",
        description: "文件已从系统中完全移除",
      });
    } catch (error) {
      console.error('删除文件错误:', error);
      // 显示错误提示，但保留在UI列表中的文件
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error instanceof Error ? error.message : "删除图片文件失败，请重试",
      });
    }
  };
  
  // 处理文件选择状态变更
  const handleSelectFile = (fileId: string, checked: boolean) => {
    // 更新为支持多选功能
    const updatedFiles = uploadedFiles.map(file => ({
      ...file,
      selected: file.id === fileId ? checked : file.selected
    }))
    
    setUploadedFiles(updatedFiles)
    localStorage.setItem('uploaded-image-files', JSON.stringify(updatedFiles))
  }

  // 处理图像分析
  const handleAnalyzeImage = async () => {
    // 检查是否有文件上传
    if (uploadedFiles.length === 0) {
      toast({
        title: "处理失败",
        description: "请先上传至少一个图片文件",
        variant: "destructive",
      })
      return
    }
    
    // 检查是否有选中的文件
    const selectedFiles = uploadedFiles.filter(file => file.selected)
    if (selectedFiles.length === 0) {
      setError("请至少选择一个图片文件进行处理")
      return
    }
    
    // 检查提示词
    if (!prompt.trim()) {
      setError("请输入提示词")
      return
    }
    
    // 重置内容
    setReasoning('')
    setAnswer('')
    
    // 更新处理状态
    setProcessing(true)

    // 设置初始等待提示
    setAnswer('等待模型处理图片中...')
    
    // 添加加载指示器
    const indicator = document.createElement('div')
    indicator.id = 'fixed-loading-indicator'
    indicator.innerHTML = `<div class="fixed top-0 left-0 w-full h-1 bg-orange-500 animate-pulse z-50">
      <div class="h-full bg-orange-600 animate-loading-bar"></div>
    </div>`
    document.body.appendChild(indicator)

    try {
      const fileIds = selectedFiles.map(file => file.id)
      
      // 调用视觉服务
      const service = new VisionService()
      await service.analyzeImage(
        fileIds, 
        prompt,
        (reasoningContent: string) => {
          console.log(`收到推理过程内容:`, reasoningContent.length, '字符')
          setReasoning(reasoningContent)
        },
        (answerContent: string) => {
          console.log(`收到回答内容:`, answerContent.length, '字符')
          setAnswer(answerContent)
        }
      )

    } catch (error) {
      console.error(`图像分析失败:`, error)
      toast({
        title: "处理失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
        duration: 3000
      })
      // 设置错误内容
      setAnswer(`处理失败: ${error instanceof Error ? error.message : "未知错误"}`)
    } finally {
      // 重置处理状态
      setProcessing(false)
      
      // 移除加载指示器
      const indicator = document.getElementById('fixed-loading-indicator')
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator)
      }
    }
  }

  // 下载内容为文件
  const handleDownload = (content: string, fileType: string) => {
    if (!content) {
      toast({
        title: "下载失败",
        description: `没有可下载的${fileType}内容`,
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    try {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `视觉${fileType}-${timestamp}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "下载成功",
        description: `${fileType}已保存为文件`,
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
                <h1 className="text-2xl font-bold tracking-tight">视觉{isQVQModel ? '推理' : '分析'}</h1>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="ml-2 cursor-help">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md p-4 bg-white shadow-lg rounded-lg border border-gray-200">
                      <div className="text-sm">
                        <p className="font-bold text-gray-900 mb-1">当前使用模型: {modelName}</p>
                        <p className="text-gray-700">
                          {isQVQModel 
                            ? '推理型视觉模型能够展示思考过程和最终结果' 
                            : '普通视觉模型只展示最终结果'}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-muted-foreground text-xs mt-1">
                {isQVQModel 
                  ? '上传图片并提出问题，查看AI的思考过程和结论' 
                  : '上传图片并提出问题，获取AI的分析结果'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3 overflow-x-auto">
              <div className="border rounded-lg p-3">
                <div className="flex justify-start gap-2">
                  <Button
                    onClick={() => setShowUploadDialog(true)}
                    className="flex items-center gap-1 px-3 py-1.5 h-auto text-xs bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Upload className="h-3 w-3" />
                    上传图片
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
                        <p className="text-xs text-gray-500 mt-0.5">请选择要处理的图片文件</p>
                      </div>
                    </div>
                    
                    <div className="border rounded-md overflow-hidden max-h-[230px] overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              选择
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              文件名
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
                                <ImageIcon className="h-3 w-3 mr-1 text-orange-500" />
                                {file.name}
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
              
              {/* 提示词输入区域 */}
              <div className="border rounded-lg p-3">
                <h2 className="text-sm font-medium mb-2">输入提示词</h2>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="请输入您的问题或分析要求..."
                  className="w-full h-24 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    onClick={handleAnalyzeImage}
                    disabled={processing || uploadedFiles.length === 0 || !prompt.trim()}
                    className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                      !processing && uploadedFiles.length > 0 && prompt.trim()
                        ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                        : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                    }`}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        处理中...
                      </>
                    ) : (
                      <>
                        <FileText className="h-3 w-3" />
                        分析图像
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* 推理过程显示区域 - 只在使用QVQ模型时显示 */}
              {isQVQModel && (
                <div className="border rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-sm font-medium">推理过程</h2>
                    {reasoning && (
                      <Button 
                        onClick={() => handleDownload(reasoning, '推理过程')}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center gap-1 px-2 py-1 h-6 text-xs"
                      >
                        <Download className="h-3 w-3" />
                        下载
                      </Button>
                    )}
                  </div>
                  <div className="border rounded-md p-3 bg-gray-50 min-h-[250px] max-h-[400px] overflow-auto">
                    <pre className="whitespace-pre-wrap text-xs font-mono">
                      {reasoning || '等待AI推理...'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
            
            {/* 答案内容显示区域 */}
            <div className="space-y-3 overflow-x-auto">
              <div className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-sm font-medium">分析结果</h2>
                  {answer && (
                    <Button 
                      onClick={() => handleDownload(answer, '分析结果')}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center gap-1 px-2 py-1 h-6 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      下载
                    </Button>
                  )}
                </div>
                <div className="border rounded-md p-3 bg-gray-50 min-h-[600px] max-h-[800px] overflow-auto">
                  <ContentDisplay content={answer} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 文件上传弹窗 */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>上传图片文件</DialogTitle>
            <DialogDescription>
              请上传需要分析的图片，支持 JPG、PNG、GIF 等常见图片格式。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div 
              ref={dropAreaRef}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors duration-200"
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
                      <p>拖拽图片到此处或</p>
                      <label className="cursor-pointer text-orange-600 hover:text-orange-700">
                        点击上传
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileChange}
                        />
                      </label>
                    </>
                  )}
                </div>
                {error && <p className="text-red-500 text-xs">{error}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUploadDialog(false)
              setFile(null)
              setError('')
            }}>
              取消
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={!file || uploading}
              className={file && !uploading ? 'bg-orange-500 hover:bg-orange-600' : undefined}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  上传中...
                </>
              ) : '上传图片'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Toaster />
    </>
  )
} 