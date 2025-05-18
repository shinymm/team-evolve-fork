'use client'

import { useState, useRef, useEffect } from 'react'
import { useToast } from "@/components/ui/use-toast"
import { ImageToProductInfoService } from '@/lib/services/image-to-product-info-service'
import { ImageToArchitectureService } from '@/lib/services/image-to-architecture-service'
import { VisionService } from '@/lib/services/vision-service'
import { CustomVisionAnalysisService } from '@/lib/services/custom-vision-analysis-service'
import { imageToProductInfoPrompt } from '@/lib/prompts/image-to-product-info'
import { imageToArchitecturePrompt } from '@/lib/prompts/image-to-architecture'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Upload, File as FileIcon, Trash2, Download, FileText, Loader2, AlertCircle, Image as ImageIcon, ChevronDown, ChevronRight } from 'lucide-react'
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
import { Textarea } from "@/components/ui/textarea"
import { RequirementFromPrototypeService } from '@/lib/services/requirement-from-prototype-service'

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
type TabType = 'product-info' | 'architecture' | 'vision-analysis' | 'requirement-draft';

// 补充信息弹窗类型
interface SupplementDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (text: string) => void;
  title: string;
  description: string;
}

// 补充信息弹窗组件
const SupplementDialog = ({ open, onClose, onConfirm, title, description }: SupplementDialogProps) => {
  const [text, setText] = useState('');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) onClose();
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[150px]"
            placeholder="请在此输入补充信息..."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => onConfirm(text)}>确认</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// 思考过程展示组件
const ReasoningDisplay = ({ 
  content, 
  isVisible, 
  onToggle,
  onDownload
}: { 
  content: string; 
  isVisible: boolean; 
  onToggle: () => void;
  onDownload: () => void;
}) => {
  if (!content) {
    return null;
  }

  return (
    <div className="mt-4 border rounded-md">
      <div 
        className="flex justify-between items-center p-2 bg-gray-50 border-b cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center">
          {isVisible ? 
            <ChevronDown className="h-4 w-4 mr-1.5 text-gray-500" /> : 
            <ChevronRight className="h-4 w-4 mr-1.5 text-gray-500" />
          }
          <h3 className="text-sm font-medium">思考过程</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 hover:text-orange-700"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
        >
          <Download className="h-3 w-3 mr-1" />
          导出
        </Button>
      </div>
      {isVisible && (
        <div className="p-3 bg-orange-50/50 max-h-[300px] overflow-auto">
          <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap text-xs leading-relaxed">
            {content}
          </div>
        </div>
      )}
    </div>
  );
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
  const [showRequirementDialog, setShowRequirementDialog] = useState(false)
  const [requirementOverview, setRequirementOverview] = useState('')
  const [contents, setContents] = useState<Record<TabType, string>>({
    'product-info': '',
    'architecture': '',
    'vision-analysis': '',
    'requirement-draft': ''
  })
  // 添加产品信息和架构信息的补充信息弹窗状态
  const [showProductInfoDialog, setShowProductInfoDialog] = useState(false);
  const [showArchitectureDialog, setShowArchitectureDialog] = useState(false);
  const [productInfoSupplement, setProductInfoSupplement] = useState('');
  const [architectureSupplement, setArchitectureSupplement] = useState('');
  const [isQVQModel, setIsQVQModel] = useState<boolean>(false)
  const [modelName, setModelName] = useState<string>('')
  // 修改思考过程为对应每个标签页的独立内容
  const [reasonings, setReasonings] = useState<Record<TabType, string>>({
    'product-info': '',
    'architecture': '',
    'vision-analysis': '',
    'requirement-draft': ''
  })
  // 图片列表默认为折叠状态
  const [isImagesExpanded, setIsImagesExpanded] = useState<boolean>(false)
  // 为每个标签页添加独立的思考过程显示状态
  const [reasoningVisibility, setReasoningVisibility] = useState<Record<TabType, boolean>>({
    'product-info': false,
    'architecture': false,
    'vision-analysis': false,
    'requirement-draft': false
  })
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
    'vision-analysis': false,
    'requirement-draft': false
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
      // 上传成功后自动展开图片列表
      setIsImagesExpanded(true)
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
      // 如果没有选中文件，自动展开图片列表
      setIsImagesExpanded(true);
      setError("请至少选择一个图片文件进行处理")
      return
    }

    // 打开补充信息弹窗
    setShowProductInfoDialog(true);
  }

  // 处理提取产品信息的确认
  const handleProductInfoConfirm = async (supplementText: string) => {
    // 关闭弹窗
    setShowProductInfoDialog(false);
    // 保存补充信息
    setProductInfoSupplement(supplementText);
    
    // 切换到产品信息tab
    setActiveTab('product-info')
    
    // 重置上一次的内容和推理过程
    setReasonings(prev => ({
      ...prev,
      'product-info': ''
    }))
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
    
    // 自动折叠图片列表区域
    setIsImagesExpanded(false)

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
      const selectedFiles = uploadedFiles.filter(file => file.selected)
      const imageUrls = selectedFiles.map(file => file.url || `https://team-evolve.oss-ap-southeast-1.aliyuncs.com/${file.id}`)
      
      // 获取当前选中的系统信息
      const currentSystem = selectedSystemId ? 
        systems.find(system => system.id === selectedSystemId) : 
        undefined
      
      // 使用专门的服务类
      const service = new ImageToProductInfoService()
      await service.extractProductInfo(
        imageUrls,
        (answerContent: string) => {
          console.log(`收到产品信息内容:`, answerContent.length, '字符')
          setContents(prev => ({
            ...prev,
            'product-info': answerContent
          }))
        },
        (reasoningContent: string) => {
          console.log(`收到产品信息推理过程内容:`, reasoningContent.length, '字符')
          setReasonings(prev => ({
            ...prev,
            'product-info': reasoningContent
          }))
        },
        currentSystem,
        supplementText
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
      // 如果没有选中文件，自动展开图片列表
      setIsImagesExpanded(true);
      setError("请至少选择一个图片文件进行处理")
      return
    }

    // 打开补充信息弹窗
    setShowArchitectureDialog(true);
  }

  // 处理抽取信息架构的确认
  const handleArchitectureConfirm = async (supplementText: string) => {
    // 关闭弹窗
    setShowArchitectureDialog(false);
    // 保存补充信息
    setArchitectureSupplement(supplementText);
    
    // 切换到信息架构tab
    setActiveTab('architecture')
    
    // 重置上一次的内容和推理过程
    setReasonings(prev => ({
      ...prev,
      'architecture': ''
    }))
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
    
    // 自动折叠图片列表区域
    setIsImagesExpanded(false)

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
      const selectedFiles = uploadedFiles.filter(file => file.selected)
      const imageUrls = selectedFiles.map(file => file.url || `https://team-evolve.oss-ap-southeast-1.aliyuncs.com/${file.id}`)
      
      // 获取当前选中的系统信息
      const currentSystem = selectedSystemId ? 
        systems.find(system => system.id === selectedSystemId) : 
        undefined
      
      // 使用专门的服务类
      const service = new ImageToArchitectureService()
      await service.extractArchitecture(
        imageUrls,
        (answerContent: string) => {
          console.log(`收到信息架构内容:`, answerContent.length, '字符')
          setContents(prev => ({
            ...prev,
            'architecture': answerContent
          }))
        },
        (reasoningContent: string) => {
          console.log(`收到信息架构推理过程内容:`, reasoningContent.length, '字符')
          setReasonings(prev => ({
            ...prev,
            'architecture': reasoningContent
          }))
        },
        currentSystem,
        supplementText
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
      // 如果没有选中文件，自动展开图片列表
      setIsImagesExpanded(true);
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
    
    // 重置上一次的内容和推理过程
    setReasonings(prev => ({
      ...prev,
      'vision-analysis': ''
    }))
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
    
    // 自动折叠图片列表区域
    setIsImagesExpanded(false)

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
      
      // 获取当前选中的系统信息
      const currentSystem = selectedSystemId ? 
        systems.find(system => system.id === selectedSystemId) : 
        undefined
      
      // 使用专门的服务类
      const service = new CustomVisionAnalysisService()
      await service.analyzeWithCustomPrompt(
        imageUrls,
        prompt,
        (answerContent: string) => {
          console.log(`收到视觉分析内容:`, answerContent.length, '字符')
          setContents(prev => ({
            ...prev,
            'vision-analysis': answerContent
          }))
        },
        (reasoningContent: string) => {
          console.log(`收到推理过程内容:`, reasoningContent.length, '字符')
          setReasonings(prev => ({
            ...prev,
            'vision-analysis': reasoningContent
          }))
        },
        currentSystem
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

  // 处理思考过程下载
  const handleDownloadReasoning = () => {
    // 根据当前激活的标签页获取对应的推理内容
    const currentReasoning = reasonings[activeTab];
    
    if (!currentReasoning) {
      toast({
        title: "下载失败",
        description: "没有可下载的推理过程内容",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    try {
      const blob = new Blob([currentReasoning], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab}-推理过程-${timestamp}.md`;
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

  // 处理生成需求初稿
  const handleGenerateRequirementDraft = async () => {
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
      // 如果没有选中文件，自动展开图片列表
      setIsImagesExpanded(true);
      setError("请至少选择一个图片文件进行处理")
      return
    }

    // 打开需求概述输入弹窗
    setShowRequirementDialog(true)
  }
  
  // 处理提交需求概述并生成初稿
  const handleSubmitRequirementOverview = async () => {
    // 检查需求概述是否为空
    if (!requirementOverview.trim()) {
      toast({
        title: "处理失败",
        description: "需求概述不能为空",
        variant: "destructive",
      })
      return
    }
    
    // 关闭弹窗
    setShowRequirementDialog(false)
    
    // 切换到需求初稿标签页
    setActiveTab('requirement-draft')
    
    // 重置上一次的内容和推理过程
    setReasonings(prev => ({
      ...prev,
      'requirement-draft': ''
    }))
    setContents(prev => ({
      ...prev,
      'requirement-draft': ''
    }))
    
    // 更新处理状态
    setProcessingStates(prev => ({
      ...prev,
      'requirement-draft': true
    }))
    setProcessing(true)
    
    // 自动折叠图片列表区域
    setIsImagesExpanded(false)

    // 设置初始等待提示
    setContents(prev => ({
      ...prev,
      'requirement-draft': '正在处理原型图和需求概述，生成需求初稿中...'
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
      const selectedFiles = uploadedFiles.filter(file => file.selected)
      const imageUrls = selectedFiles.map(file => file.url || `https://team-evolve.oss-ap-southeast-1.aliyuncs.com/${file.id}`)
      
      // 1. 获取当前系统ID
      const systemId = selectedSystemId
      if (!systemId) {
        throw new Error('未找到当前系统ID，请先选择一个系统')
      }
      
      console.log('当前系统ID:', systemId)
      
      // 调用服务生成需求初稿
      const service = new RequirementFromPrototypeService()
      await service.generateRequirementFromPrototype(
        systemId,
        imageUrls,
        requirementOverview,
        // 推理过程更新回调
        (reasoningContent) => {
          setReasonings(prev => ({
            ...prev,
            'requirement-draft': reasoningContent
          }))
        },
        // 内容更新回调
        (content) => {
          setContents(prev => ({
            ...prev,
            'requirement-draft': content
          }))
        }
      )

    } catch (error) {
      console.error(`生成需求初稿失败:`, error)
      toast({
        title: "处理失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
        duration: 3000
      })
      // 设置错误内容
      setContents(prev => ({
        ...prev,
        'requirement-draft': `处理失败: ${error instanceof Error ? error.message : "未知错误"}`
      }))
    } finally {
      // 重置处理状态
      setProcessingStates(prev => ({
        ...prev,
        'requirement-draft': false
      }))
      setProcessing(false)
      
      // 移除加载指示器
      const indicator = document.getElementById('fixed-loading-indicator')
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator)
      }
    }
  }
  
  // 下载需求初稿
  const handleDownloadRequirementDraft = () => {
    const content = contents['requirement-draft'];
    if (!content) {
      toast({
        title: "下载失败",
        description: "没有可下载的需求初稿内容",
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
      a.download = `需求初稿-${timestamp}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "下载成功",
        description: "需求初稿已保存为文件",
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
    <div className="flex flex-col min-h-screen">
      <Toaster />
      
      {/* 产品信息补充弹窗 */}
      <SupplementDialog
        open={showProductInfoDialog}
        onClose={() => setShowProductInfoDialog(false)}
        onConfirm={handleProductInfoConfirm}
        title="提供产品信息的补充说明"
        description="请输入任何关于产品的补充信息，以帮助AI更好地理解和分析图片内容。"
      />
      
      {/* 信息架构补充弹窗 */}
      <SupplementDialog
        open={showArchitectureDialog}
        onClose={() => setShowArchitectureDialog(false)}
        onConfirm={handleArchitectureConfirm}
        title="提供信息架构的补充说明"
        description="请输入任何关于信息架构的补充信息，以帮助AI更好地分析图片中的信息架构。"
      />
      
      {/* 需求生成弹窗 */}
      <Dialog open={showRequirementDialog} onOpenChange={setShowRequirementDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>输入需求概述</DialogTitle>
            <DialogDescription>
              请输入需求概述，帮助AI更好地理解需求内容并生成需求初稿
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Textarea
              id="message"
              value={requirementOverview}
              onChange={(e) => setRequirementOverview(e.target.value)}
              className="col-span-2 h-[200px]"
              placeholder="请输入需求描述，例如：希望设计一个移动端产品功能，实现用户可以便捷地进行商品类型筛选..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequirementDialog(false)}>取消</Button>
            <Button onClick={handleSubmitRequirementOverview} disabled={!requirementOverview.trim()}>生成需求初稿</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 上传对话框 */}
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
              setShowUploadDialog(false);
              setFile(null);
              setError('');
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

      <div className="w-full max-w-full overflow-x-hidden">
        <div className="space-y-4 px-4 py-4 mx-auto w-[90%]">
          {/* 标题区域 */}
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold">图片分析工具</h1>
          </div>
          
          {/* 错误消息 */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>错误</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* 文件列表 */}
          <div className="grid gap-4">
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between items-center border rounded-md p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" 
                   onClick={() => setIsImagesExpanded(!isImagesExpanded)}>
                <div className="flex items-center">
                  {isImagesExpanded ? 
                    <ChevronDown className="h-4 w-4 mr-1.5 text-gray-500" /> : 
                    <ChevronRight className="h-4 w-4 mr-1.5 text-gray-500" />
                  }
                  <h2 className="text-sm font-medium flex items-center">
                    已上传图片（{uploadedFiles.length}）
                    {uploadedFiles.filter(f => f.selected).length > 0 && (
                      <span className="text-xs ml-2 text-orange-500 font-medium">
                        已选择 {uploadedFiles.filter(f => f.selected).length} 张
                      </span>
                    )}
                  </h2>
                  
                  {/* 显示选中图片的小缩略图 */}
                  {!isImagesExpanded && uploadedFiles.filter(f => f.selected).length > 0 && (
                    <div className="flex -space-x-2 ml-3">
                      {uploadedFiles.filter(f => f.selected).slice(0, 3).map(file => (
                        <div key={file.id} className="h-6 w-6 rounded-full border border-white overflow-hidden bg-white">
                          <img 
                            src={file.url || `https://team-evolve.oss-ap-southeast-1.aliyuncs.com/${file.id}`}
                            alt={file.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                      {uploadedFiles.filter(f => f.selected).length > 3 && (
                        <div className="h-6 w-6 rounded-full bg-gray-200 border border-white flex items-center justify-center text-xs">
                          +{uploadedFiles.filter(f => f.selected).length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {!isImagesExpanded && (
                    <span className="text-xs text-gray-500">
                      点击展开
                    </span>
                  )}
                  <Button 
                    variant="ghost"
                    className="px-2 py-1 h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white" 
                    onClick={(e) => {
                      e.stopPropagation(); // 防止触发父元素的点击事件
                      setShowUploadDialog(true);
                    }}
                    disabled={processing}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    上传图片
                  </Button>
                </div>
              </div>
              
              {isImagesExpanded && (
                <>
                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 ml-1">
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation(); // 防止触发父元素的点击事件
                          // 全选/全不选文件
                          const allSelected = uploadedFiles.every(file => file.selected)
                          setUploadedFiles(prev => prev.map(file => ({
                            ...file,
                            selected: !allSelected
                          })))
                        }}
                        variant="outline"
                        className="h-7 px-2 py-1 text-xs"
                        size="sm"
                      >
                        {uploadedFiles.every(file => file.selected) ? '取消全选' : '全选'}
                      </Button>
                    </div>
                  )}
                  
                  {uploadedFiles.length === 0 ? (
                    <div className="text-gray-400 text-sm p-4 text-center border border-dashed rounded-lg">
                      尚未上传图片文件
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
                      {uploadedFiles.map(file => (
                        <div 
                          key={file.id}
                          className={`border rounded-lg overflow-hidden flex flex-col ${file.selected ? 'border-orange-500 shadow-sm' : 'border-gray-200'}`}
                        >
                          <div className="relative p-2 h-48 bg-gray-50 flex items-center justify-center">
                            {file.url ? (
                              <img 
                                src={file.url}
                                alt={file.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <img 
                                src={`https://team-evolve.oss-ap-southeast-1.aliyuncs.com/${file.id}`}
                                alt={file.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            )}
                          </div>
                          
                          <div className="p-2 border-t bg-white">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate" title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(file.uploadTime).toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-400">
                                  来源: {file.provider}
                                </p>
                              </div>
                              
                              <div className="flex items-center ml-2">
                                <Checkbox 
                                  checked={file.selected}
                                  onCheckedChange={(checked) => handleSelectFile(file.id, checked as boolean)}
                                  className="h-4 w-4"
                                />
                              </div>
                            </div>
                            
                            <div className="flex justify-end mt-2">
                              <Button 
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => handleDeleteFile(file.id)}
                              >
                                <Trash2 className="h-3 w-3 text-gray-500 hover:text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* 功能按钮组 */}
          <div className="flex flex-wrap space-x-2 pt-4">
            <Button
              onClick={handleExtractProductInfo}
              disabled={processing || uploadedFiles.filter(f => f.selected).length === 0}
              className="h-10 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {processingStates['product-info'] ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              提炼产品基础信息
            </Button>
            
            <Button
              onClick={handleExtractArchitecture}
              disabled={processing || uploadedFiles.filter(f => f.selected).length === 0}
              className="h-10 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {processingStates['architecture'] ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              抽取信息架构
            </Button>
            
            <Button
              onClick={handleVisionAnalysis}
              disabled={processing || uploadedFiles.filter(f => f.selected).length === 0}
              className="h-10 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {processingStates['vision-analysis'] ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="mr-2 h-4 w-4" />
              )}
              自定义视觉分析
            </Button>
            
            <Button
              onClick={handleGenerateRequirementDraft}
              disabled={processing || uploadedFiles.filter(f => f.selected).length === 0}
              className="h-10 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {processingStates['requirement-draft'] ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              生成需求初稿
            </Button>
          </div>
          
          {/* 标签页区域 */}
          <div className="flex border-b border-gray-200">
            <button
              className={`px-4 py-2 text-base font-medium border-b-2 transition-colors ${
                activeTab === 'product-info' 
                ? 'border-orange-500 text-orange-600 bg-orange-50' 
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('product-info')}
            >
              产品信息
            </button>
            <button
              className={`px-4 py-2 text-base font-medium border-b-2 transition-colors ${
                activeTab === 'architecture' 
                ? 'border-orange-500 text-orange-600 bg-orange-50' 
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('architecture')}
            >
              信息架构
            </button>
            <button
              className={`px-4 py-2 text-base font-medium border-b-2 transition-colors ${
                activeTab === 'vision-analysis' 
                ? 'border-orange-500 text-orange-600 bg-orange-50' 
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('vision-analysis')}
            >
              视觉分析
            </button>
            <button
              className={`px-4 py-2 text-base font-medium border-b-2 transition-colors ${
                activeTab === 'requirement-draft' 
                ? 'border-orange-500 text-orange-600 bg-orange-50' 
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('requirement-draft')}
            >
              需求初稿
            </button>
          </div>
          
          {/* 内容区域 */}
          <div className="border rounded-md p-4">
            {/* 产品信息内容 */}
            {activeTab === 'product-info' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium">产品基础信息</h2>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                          onClick={handleDownload}
                          disabled={!contents['product-info']}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          导出MD
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>导出为Markdown文件</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                {/* 推理过程显示（如果是QVQ模型且有推理内容） */}
                {isQVQModel && reasonings['product-info'] && (
                  <ReasoningDisplay 
                    content={reasonings['product-info']} 
                    isVisible={reasoningVisibility['product-info']} 
                    onToggle={() => setReasoningVisibility(prev => ({
                      ...prev,
                      'product-info': !prev['product-info']
                    }))} 
                    onDownload={handleDownloadReasoning}
                  />
                )}
                
                <ContentDisplay content={contents['product-info']} />
              </div>
            )}
            
            {/* 信息架构内容 */}
            {activeTab === 'architecture' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium">信息架构</h2>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                          onClick={handleDownloadArchitecture}
                          disabled={!contents['architecture']}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          导出JSON
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>导出为JSON文件</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                {/* 推理过程显示（如果是QVQ模型且有推理内容） */}
                {isQVQModel && reasonings['architecture'] && (
                  <ReasoningDisplay 
                    content={reasonings['architecture']} 
                    isVisible={reasoningVisibility['architecture']} 
                    onToggle={() => setReasoningVisibility(prev => ({
                      ...prev,
                      'architecture': !prev['architecture']
                    }))} 
                    onDownload={handleDownloadReasoning}
                  />
                )}
                
                <div className="whitespace-pre-wrap font-mono text-xs border rounded-md p-3 bg-gray-50">
                  <ContentDisplay content={contents['architecture']} />
                </div>
              </div>
            )}
            
            {/* 视觉分析内容 */}
            {activeTab === 'vision-analysis' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium">视觉分析结果</h2>
                  <div className="flex gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                            onClick={handleDownloadVisionAnalysis}
                            disabled={!contents['vision-analysis']}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            导出结果
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>导出为Markdown文件</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                
                {/* 推理过程显示（如果是QVQ模型且有推理内容） */}
                {isQVQModel && reasonings['vision-analysis'] && (
                  <ReasoningDisplay 
                    content={reasonings['vision-analysis']} 
                    isVisible={reasoningVisibility['vision-analysis']} 
                    onToggle={() => setReasoningVisibility(prev => ({
                      ...prev,
                      'vision-analysis': !prev['vision-analysis']
                    }))} 
                    onDownload={handleDownloadReasoning}
                  />
                )}
                
                <ContentDisplay content={contents['vision-analysis']} />
              </div>
            )}
            
            {/* 需求初稿内容 */}
            {activeTab === 'requirement-draft' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium">需求初稿</h2>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                          onClick={handleDownloadRequirementDraft}
                          disabled={!contents['requirement-draft']}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          导出MD
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>导出为Markdown文件</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                {/* 推理过程显示（如果是QVQ模型且有推理内容） */}
                {isQVQModel && reasonings['requirement-draft'] && (
                  <ReasoningDisplay 
                    content={reasonings['requirement-draft']} 
                    isVisible={reasoningVisibility['requirement-draft']} 
                    onToggle={() => setReasoningVisibility(prev => ({
                      ...prev,
                      'requirement-draft': !prev['requirement-draft']
                    }))} 
                    onDownload={handleDownloadReasoning}
                  />
                )}
                
                <ContentDisplay content={contents['requirement-draft']} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}