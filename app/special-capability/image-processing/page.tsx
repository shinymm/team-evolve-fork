'use client'

import { useState, useRef, useEffect } from 'react'
import { useToast } from "@/components/ui/use-toast"
import { ImageToProductInfoService } from '@/lib/services/image-to-product-info-service'
import { ImageToArchitectureService } from '@/lib/services/image-to-architecture-service'
import { VisionService } from '@/lib/services/vision-service'
import { imageToProductInfoPrompt } from '@/lib/prompts/image-to-product-info'
import { imageToArchitecturePrompt } from '@/lib/prompts/image-to-architecture'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Upload, File as FileIcon, Trash2, Download, FileText, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react'
import { Toaster } from "@/components/ui/toaster"
import { useSystemStore } from '@/lib/stores/system-store'
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

// 标签页类型定义
type TabType = 'product-info' | 'architecture' | 'vision-analysis';

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
        .prose h1 {
          font-size: 1.25rem;
          margin-top: 1.2rem;
          margin-bottom: 0.8rem;
          font-weight: 600;
        }
        .prose h2 {
          font-size: 1.125rem;
          margin-top: 1rem;
          margin-bottom: 0.6rem;
          font-weight: 600;
        }
        .prose h3 {
          font-size: 1rem;
          margin-top: 0.8rem;
          margin-bottom: 0.4rem;
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
        .prose li > ul, .prose li > ol {
          margin-top: 0.1rem;
          margin-bottom: 0.1rem;
        }
        .prose li p {
          margin-top: 0.1rem;
          margin-bottom: 0.1rem;
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

export default function ImageProcessing() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string>('')
  const [uploading, setUploading] = useState<boolean>(false)
  const [fileId, setFileId] = useState<string>('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('product-info')
  const [processing, setProcessing] = useState<boolean>(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [contents, setContents] = useState<Record<TabType, string>>({
    'product-info': '',
    'architecture': '',
    'vision-analysis': ''
  })
  const [isQVQModel, setIsQVQModel] = useState<boolean>(false)
  const [modelName, setModelName] = useState<string>('')
  const [reasoning, setReasoning] = useState<string>('')
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // 获取系统状态
  const { selectedSystemId, systems } = useSystemStore()
  
  // 获取当前选中系统的名称
  const selectedSystemName = selectedSystemId ? 
    systems.find(system => system.id === selectedSystemId)?.name || '' : 
    '';
  
  // 处理状态
  const [processingStates, setProcessingStates] = useState<Record<TabType, boolean>>({
    'product-info': false,
    'architecture': false,
    'vision-analysis': false
  });
  
  // 强制更新机制
  const [, forceUpdate] = useState({});
  
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

  // 检查当前使用的模型类型
  useEffect(() => {
    const checkModelType = async () => {
      try {
        // 修改为获取默认视觉模型配置
        const response = await fetch('/api/ai/config/default?type=vision');
        if (response.ok) {
          const data = await response.json();
          if (data.config) {
            const modelName = data.config.model || '';
            setModelName(modelName);
            setIsQVQModel(modelName.includes('qvq'));
            console.log(`当前使用视觉模型: ${modelName}, 是否为推理型: ${modelName.includes('qvq')}`);
          } else {
            console.log('未找到默认视觉模型配置');
          }
        }
      } catch (error) {
        console.error('获取视觉模型配置失败:', error);
      }
    };
    
    checkModelType();
  }, []);

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

      // 构建API URL，添加系统名称参数
      let apiUrl = '/api/image';
      if (selectedSystemName) {
        const safeSystemName = selectedSystemName.replace(/[^a-zA-Z0-9-_]/g, ''); // 移除不安全字符
        apiUrl += `?systemName=${encodeURIComponent(safeSystemName)}`;
      }

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

  // 处理产品基础信息提取
  const handleExtractProductInfo = async () => {
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

    // 切换到产品信息tab
    setActiveTab('product-info')
    
    // 重置上一次的内容
    setReasoning('')
    setContents(prev => ({
      ...prev,
      'product-info': ''
    }))
    
    // 更新处理状态
    setProcessingStates(prev => ({
      ...prev,
      'product-info': true
    }))
    setProcessing(true)

    // 设置初始等待提示
    setContents(prev => ({
      ...prev,
      'product-info': '等待大模型处理图片中...'
    }))
    
    // 添加加载指示器
    const indicator = document.createElement('div')
    indicator.id = 'fixed-loading-indicator'
    indicator.innerHTML = `<div class="fixed top-0 left-0 w-full h-1 bg-orange-500 animate-pulse z-50">
      <div class="h-full bg-orange-600 animate-loading-bar"></div>
    </div>`
    document.body.appendChild(indicator)

    try {
      // 获取图片URL列表
      const imageUrls = selectedFiles.map(file => file.url || `https://team-evolve.oss-ap-southeast-1.aliyuncs.com/${file.id}`)
      
      // 调用视觉服务
      const service = new VisionService()
      await service.analyzeImage(
        imageUrls, 
        imageToProductInfoPrompt,
        (reasoningContent: string) => {
          console.log(`收到产品信息推理过程内容:`, reasoningContent.length, '字符')
          setReasoning(reasoningContent)
        },
        (answerContent: string) => {
          console.log(`收到产品信息内容:`, answerContent.length, '字符')
          setContents(prev => ({
            ...prev,
            'product-info': answerContent
          }))
        },
        '你是一个产品分析专家，善于从界面截图中识别产品特征并提炼核心信息。'
      )
    } catch (error) {
      console.error(`提取产品信息失败:`, error)
      toast({
        title: "处理失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
        duration: 3000
      })
      // 设置错误内容
      setContents(prev => ({
        ...prev,
        'product-info': `处理失败: ${error instanceof Error ? error.message : "未知错误"}`
      }))
    } finally {
      // 重置处理状态
      setProcessingStates(prev => ({
        ...prev,
        'product-info': false
      }))
      setProcessing(false)
      
      // 移除加载指示器
      const indicator = document.getElementById('fixed-loading-indicator')
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator)
      }
    }
  }

  // 处理抽取信息架构
  const handleExtractArchitecture = async () => {
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

    // 切换到信息架构tab
    setActiveTab('architecture')
    
    // 重置上一次的内容
    setReasoning('')
    setContents(prev => ({
      ...prev,
      'architecture': ''
    }))
    
    // 更新处理状态
    setProcessingStates(prev => ({
      ...prev,
      'architecture': true
    }))
    setProcessing(true)

    // 设置初始等待提示
    setContents(prev => ({
      ...prev,
      'architecture': '等待大模型处理图片中...'
    }))
    
    // 添加加载指示器
    const indicator = document.createElement('div')
    indicator.id = 'fixed-loading-indicator'
    indicator.innerHTML = `<div class="fixed top-0 left-0 w-full h-1 bg-orange-500 animate-pulse z-50">
      <div class="h-full bg-orange-600 animate-loading-bar"></div>
    </div>`
    document.body.appendChild(indicator)

    try {
      // 获取图片URL列表
      const imageUrls = selectedFiles.map(file => file.url || `https://team-evolve.oss-ap-southeast-1.aliyuncs.com/${file.id}`)
      
      // 调用视觉服务
      const service = new VisionService()
      await service.analyzeImage(
        imageUrls, 
        imageToArchitecturePrompt,
        (reasoningContent: string) => {
          console.log(`收到信息架构推理过程内容:`, reasoningContent.length, '字符')
          setReasoning(reasoningContent)
        },
        (answerContent: string) => {
          console.log(`收到信息架构内容:`, answerContent.length, '字符')
          setContents(prev => ({
            ...prev,
            'architecture': answerContent
          }))
        },
        '你是一个产品架构分析专家，善于从界面截图中识别产品模块结构并提炼信息架构。'
      )
    } catch (error) {
      console.error(`提取信息架构失败:`, error)
      toast({
        title: "处理失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
        duration: 3000
      })
      // 设置错误内容
      setContents(prev => ({
        ...prev,
        'architecture': `处理失败: ${error instanceof Error ? error.message : "未知错误"}`
      }))
    } finally {
      // 重置处理状态
      setProcessingStates(prev => ({
        ...prev,
        'architecture': false
      }))
      setProcessing(false)
      
      // 移除加载指示器
      const indicator = document.getElementById('fixed-loading-indicator')
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator)
      }
    }
  }

  // 处理视觉分析
  const handleVisionAnalysis = async () => {
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

    // 打开输入提示词对话框
    const prompt = window.prompt("请输入分析提示词", "请详细分析这张图片的内容并提供关键信息")
    if (!prompt) {
      return
    }

    // 切换到视觉分析tab
    setActiveTab('vision-analysis')
    
    // 重置上一次的内容
    setReasoning('')
    setContents(prev => ({
      ...prev,
      'vision-analysis': ''
    }))
    
    // 更新处理状态
    setProcessingStates(prev => ({
      ...prev,
      'vision-analysis': true
    }))
    setProcessing(true)

    // 设置初始等待提示
    setContents(prev => ({
      ...prev,
      'vision-analysis': '等待视觉模型处理图片中...'
    }))
    
    // 添加加载指示器
    const indicator = document.createElement('div')
    indicator.id = 'fixed-loading-indicator'
    indicator.innerHTML = `<div class="fixed top-0 left-0 w-full h-1 bg-orange-500 animate-pulse z-50">
      <div class="h-full bg-orange-600 animate-loading-bar"></div>
    </div>`
    document.body.appendChild(indicator)

    try {
      // 获取图片URL列表
      const imageUrls = selectedFiles.map(file => file.url || `https://team-evolve.oss-ap-southeast-1.aliyuncs.com/${file.id}`)
      
      // 调用视觉服务
      const service = new VisionService()
      await service.analyzeImage(
        imageUrls, 
        prompt,
        (reasoningContent: string) => {
          console.log(`收到推理过程内容:`, reasoningContent.length, '字符')
          setReasoning(reasoningContent)
        },
        (answerContent: string) => {
          console.log(`收到视觉分析内容:`, answerContent.length, '字符')
          setContents(prev => ({
            ...prev,
            'vision-analysis': answerContent
          }))
        }
      )

    } catch (error) {
      console.error(`视觉分析失败:`, error)
      toast({
        title: "处理失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
        duration: 3000
      })
      // 设置错误内容
      setContents(prev => ({
        ...prev,
        'vision-analysis': `处理失败: ${error instanceof Error ? error.message : "未知错误"}`
      }))
    } finally {
      // 重置处理状态
      setProcessingStates(prev => ({
        ...prev,
        'vision-analysis': false
      }))
      setProcessing(false)
      
      // 移除加载指示器
      const indicator = document.getElementById('fixed-loading-indicator')
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator)
      }
    }
  }

  // 下载视觉分析内容
  const handleDownloadVisionAnalysis = () => {
    const content = contents['vision-analysis'];
    if (!content) {
      toast({
        title: "下载失败",
        description: "没有可下载的视觉分析内容",
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
      a.download = `视觉分析结果-${timestamp}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "下载成功",
        description: "视觉分析结果已保存为文件",
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

  // 下载推理过程（如果有）
  const handleDownloadReasoning = () => {
    if (!reasoning) {
      toast({
        title: "下载失败",
        description: "没有可下载的推理过程内容",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    try {
      const blob = new Blob([reasoning], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `视觉推理过程-${timestamp}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "下载成功",
        description: "推理过程已保存为文件",
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
  
  // 下载产品信息为文件
  const handleDownload = () => {
    const content = contents['product-info'];
    if (!content) {
      toast({
        title: "下载失败",
        description: "没有可下载的产品信息内容",
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
      a.download = `产品基础信息-${timestamp}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "下载成功",
        description: "产品基础信息已保存为文件",
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

  // 下载架构为文件
  const handleDownloadArchitecture = () => {
    const content = contents['architecture'];
    if (!content) {
      toast({
        title: "下载失败",
        description: "没有可下载的信息架构内容",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    try {
      // 尝试格式化JSON
      let formattedContent = content;
      try {
        const jsonData = JSON.parse(content);
        formattedContent = JSON.stringify(jsonData, null, 2);
      } catch (e) {
        console.error('信息架构内容不是有效的JSON格式:', e);
        // 如果不是有效JSON，保持原内容
      }

      const blob = new Blob([formattedContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `信息架构-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "下载成功",
        description: "信息架构已保存为JSON文件",
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
                <h1 className="text-2xl font-bold tracking-tight">图片综合处理</h1>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="ml-2 cursor-help">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md p-4 bg-white shadow-lg rounded-lg border border-gray-200">
                      <div className="text-sm">
                        <p className="font-bold text-gray-900 mb-1">功能说明</p>
                        <p className="text-gray-700">通过视觉AI分析功能，提取产品信息、构建信息架构和进行自定义视觉分析。{isQVQModel ? '当前使用推理型视觉模型，可查看AI思考过程。' : '当前使用标准视觉模型。'}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-muted-foreground text-xs mt-1">
                上传产品界面截图，智能分析提炼产品核心信息、构建信息架构或进行自定义视觉分析。{isQVQModel && '（当前支持查看AI推理过程）'}
              </p>
            </div>
          </div>

          <div className="space-y-3 overflow-x-auto">
            <div className="border rounded-lg p-3">
              <div className="flex justify-center gap-2">
                <Button
                  onClick={() => setShowUploadDialog(true)}
                  className="flex items-center gap-1 px-3 py-1.5 h-auto text-xs bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Upload className="h-3 w-3" />
                  上传图片
                </Button>
                
                {/* 提炼产品基础信息按钮 */}
                <Button
                  onClick={handleExtractProductInfo}
                  disabled={uploadedFiles.length === 0 || processingStates['product-info']}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !processingStates['product-info']
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {processingStates['product-info'] ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {processingStates['product-info'] ? '提炼中...' : '提炼产品基础信息'}
                </Button>
                
                {/* 抽取信息架构按钮 */}
                <Button
                  onClick={handleExtractArchitecture}
                  disabled={uploadedFiles.length === 0 || processingStates['architecture']}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !processingStates['architecture']
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {processingStates['architecture'] ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {processingStates['architecture'] ? '抽取中...' : '抽取信息架构'}
                </Button>
                
                {/* 视觉分析按钮 */}
                <Button
                  onClick={handleVisionAnalysis}
                  disabled={uploadedFiles.length === 0 || processingStates['vision-analysis']}
                  className={`flex items-center gap-1 px-3 py-1.5 h-auto text-xs ${
                    uploadedFiles.length > 0 && !processingStates['vision-analysis']
                      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                      : 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  }`}
                >
                  {processingStates['vision-analysis'] ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ImageIcon className="h-3 w-3" />
                  )}
                  {processingStates['vision-analysis'] ? '分析中...' : '视觉分析'}
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
                              <ImageIcon className="h-3 w-3 mr-1 text-orange-500" />
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
            
            {/* 结果标签页 */}
            <div className="border rounded-lg p-4 mt-3 overflow-hidden">
              <div className="flex border-b mb-3">
                <button
                  onClick={() => setActiveTab('product-info')}
                  className={`px-3 py-1.5 font-medium text-xs rounded-t-lg mr-2 transition-colors ${
                    activeTab === 'product-info' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  产品基础信息
                </button>
                <button
                  onClick={() => setActiveTab('architecture')}
                  className={`px-3 py-1.5 font-medium text-xs rounded-t-lg mr-2 transition-colors ${
                    activeTab === 'architecture' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  信息架构
                </button>
                <button
                  onClick={() => setActiveTab('vision-analysis')}
                  className={`px-3 py-1.5 font-medium text-xs rounded-t-lg mr-2 transition-colors ${
                    activeTab === 'vision-analysis' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  视觉分析
                </button>
              </div>
              
              {/* 产品基础信息内容 */}
              {activeTab === 'product-info' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      <h2 className="text-base font-semibold">产品基础信息</h2>
                      {isQVQModel && (
                        <div className="ml-2 bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded">
                          推理型模型: {modelName}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isQVQModel && reasoning && activeTab === 'product-info' && (
                        <Button 
                          onClick={handleDownloadReasoning}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1 px-3 py-1 h-8 text-xs"
                        >
                          <Download className="h-3 w-3" />
                          下载推理过程
                        </Button>
                      )}
                      <Button 
                        onClick={handleDownload}
                        disabled={!contents['product-info']}
                        className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                      >
                        <Download className="h-3 w-3" />
                        下载信息
                      </Button>
                    </div>
                  </div>
                  
                  {/* 如果是推理型模型且有推理内容，显示推理过程 */}
                  {isQVQModel && reasoning && activeTab === 'product-info' && (
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-medium">推理过程</h3>
                      </div>
                      <div className="border rounded p-3 bg-gray-50 max-h-[250px] overflow-auto w-full">
                        <ContentDisplay content={reasoning} />
                      </div>
                    </div>
                  )}
                  
                  <div className="border rounded p-3 bg-gray-50 min-h-[600px] max-h-[1200px] overflow-auto w-full" ref={contentRef}>
                    <ContentDisplay content={contents['product-info']} />
                  </div>
                </div>
              )}
              
              {/* 信息架构内容 */}
              {activeTab === 'architecture' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      <h2 className="text-base font-semibold">信息架构</h2>
                      {isQVQModel && (
                        <div className="ml-2 bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded">
                          推理型模型: {modelName}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isQVQModel && reasoning && activeTab === 'architecture' && (
                        <Button 
                          onClick={handleDownloadReasoning}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1 px-3 py-1 h-8 text-xs"
                        >
                          <Download className="h-3 w-3" />
                          下载推理过程
                        </Button>
                      )}
                      <Button 
                        onClick={handleDownloadArchitecture}
                        disabled={!contents['architecture']}
                        className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                      >
                        <Download className="h-3 w-3" />
                        下载架构
                      </Button>
                    </div>
                  </div>
                  
                  {/* 如果是推理型模型且有推理内容，显示推理过程 */}
                  {isQVQModel && reasoning && activeTab === 'architecture' && (
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-medium">推理过程</h3>
                      </div>
                      <div className="border rounded p-3 bg-gray-50 max-h-[250px] overflow-auto w-full">
                        <ContentDisplay content={reasoning} />
                      </div>
                    </div>
                  )}
                  
                  <div className="border rounded p-3 bg-gray-50 min-h-[600px] max-h-[1200px] overflow-auto w-full">
                    <pre className="whitespace-pre-wrap text-xs font-mono">
                      {contents['architecture'] ? 
                        (() => {
                          try {
                            // 尝试格式化JSON以便更好地显示
                            const jsonData = JSON.parse(contents['architecture']);
                            return JSON.stringify(jsonData, null, 2);
                          } catch (e) {
                            // 如果不是有效的JSON，直接显示原始内容
                            return contents['architecture'];
                          }
                        })() : '暂无内容'
                      }
                    </pre>
                  </div>
                </div>
              )}
              
              {/* 视觉分析内容 */}
              {activeTab === 'vision-analysis' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      <h2 className="text-base font-semibold">视觉分析结果</h2>
                      {isQVQModel && (
                        <div className="ml-2 bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded">
                          推理型模型: {modelName}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isQVQModel && reasoning && (
                        <Button 
                          onClick={handleDownloadReasoning}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1 px-3 py-1 h-8 text-xs"
                        >
                          <Download className="h-3 w-3" />
                          下载推理过程
                        </Button>
                      )}
                      <Button 
                        onClick={handleDownloadVisionAnalysis}
                        disabled={!contents['vision-analysis']}
                        className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 px-3 py-1 h-8 text-xs"
                      >
                        <Download className="h-3 w-3" />
                        下载分析结果
                      </Button>
                    </div>
                  </div>
                  
                  {/* 如果是推理型模型且有推理内容，显示推理过程 */}
                  {isQVQModel && reasoning && (
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-medium">推理过程</h3>
                      </div>
                      <div className="border rounded p-3 bg-gray-50 max-h-[250px] overflow-auto w-full">
                        <ContentDisplay content={reasoning} />
                      </div>
                    </div>
                  )}
                  
                  {/* 分析结果 */}
                  <div className="border rounded p-3 bg-gray-50 min-h-[600px] max-h-[1200px] overflow-auto w-full">
                    <ContentDisplay content={contents['vision-analysis']} />
                  </div>
                </div>
              )}
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
              请上传产品截图或相关图片，支持 JPG、PNG、GIF 等常见图片格式。
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