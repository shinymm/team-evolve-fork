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
import { UploadedFile, TabType, ProcessingStates, ReasoningVisibility, AnalysisContents, ReasoningContents } from '@/types/image-processing'
import { ContentDisplay } from '@/components/image-processing/ContentDisplay'
import { SupplementDialog } from '@/components/image-processing/SupplementDialog'
import { ReasoningDisplay } from '@/components/image-processing/ReasoningDisplay'
import { UploadDialog } from '@/components/image-processing/UploadDialog'
import { ImageList } from '@/components/image-processing/ImageList'
import { TabsNavigation } from '@/components/image-processing/TabsNavigation'
import { ActionButtons } from '@/components/image-processing/ActionButtons'
import { ContentHeader } from '@/components/image-processing/ContentHeader'
import { RequirementInputDialog } from '@/components/image-processing/RequirementInputDialog'
import { TabContent } from '@/components/image-processing/TabContent'

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
  const [imagesLoading, setImagesLoading] = useState<boolean>(true)
  const [contents, setContents] = useState<AnalysisContents>({
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
  const [reasonings, setReasonings] = useState<ReasoningContents>({
    'product-info': '',
    'architecture': '',
    'vision-analysis': '',
    'requirement-draft': ''
  })
  // 图片列表默认为折叠状态
  const [isImagesExpanded, setIsImagesExpanded] = useState<boolean>(false)
  // 为每个标签页添加独立的思考过程显示状态
  const [reasoningVisibility, setReasoningVisibility] = useState<ReasoningVisibility>({
    'product-info': false,
    'architecture': false,
    'vision-analysis': false,
    'requirement-draft': false
  })
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // 获取系统状态
  const { selectedSystemId, systems } = useSystemStore()
  
  // 获取当前选中系统的名称
  const selectedSystemName = selectedSystemId ? 
    systems.find(system => system.id === selectedSystemId)?.name || '' : 
    '';
  
  // 处理状态
  const [processingStates, setProcessingStates] = useState<ProcessingStates>({
    'product-info': false,
    'architecture': false,
    'vision-analysis': false,
    'requirement-draft': false
  });
  
  // 强制更新机制
  const [, forceUpdate] = useState({});
  
  // 获取已上传文件列表
  useEffect(() => {
    // 确保有系统ID
    if (!selectedSystemId) {
      setImagesLoading(false); // 如果没有系统ID，设置为非加载状态
      return;
    }

    const loadImages = async () => {
      setImagesLoading(true); // 开始加载时设置状态
      
      try {
        // 从API加载图片
        const response = await fetch(`/api/image?systemId=${selectedSystemId}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`从数据库加载了 ${data.images.length} 张图片`);
          
          // 处理返回的图片数据
          if (data.images && Array.isArray(data.images)) {
            const filesWithDates = data.images.map((file: any) => ({
              ...file,
              uploadTime: new Date(file.uploadTime),
              selected: data.images.length === 1 ? true : false, // 只有一个文件时默认选中
            }));
            setUploadedFiles(filesWithDates);
          }
        } else {
          console.error('加载图片失败:', response.statusText);
        }
      } catch (error) {
        console.error('加载图片出错:', error);
      } finally {
        setImagesLoading(false); // 无论成功还是失败，都结束加载状态
      }
    };

    // 执行加载
    loadImages();
  }, [selectedSystemId]);

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

  // 处理上传图片
  const handleUploadFile = async (fileToUpload: File) => {
    if (!fileToUpload) {
      setError('请先选择文件');
      return;
    }

    if (!selectedSystemId) {
      setError('请先选择系统');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);

      console.log('正在上传图片到OSS...');

      // 构建API URL，添加系统名称参数
      let apiUrl = '/api/image';
      if (selectedSystemName) {
        const safeSystemName = selectedSystemName.replace(/[^a-zA-Z0-9-_]/g, ''); // 移除不安全字符
        apiUrl += `?systemName=${encodeURIComponent(safeSystemName)}`;
      }

      // 使用图片上传API
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '上传失败');
      }

      console.log('上传成功:', result);

      // 上传成功后刷新图片列表
      refreshImageList();

      // 重置文件选择
      setFile(null);
      setError('');
      setFileId(result.file.id);
      setShowUploadDialog(false);
      
      // 上传成功后自动展开图片列表
      setIsImagesExpanded(true);
      
      toast({
        title: "上传成功",
        description: `文件 ${result.file.name} 已成功上传`,
      });
    } catch (error) {
      console.error('上传图片出错:', error);
      setError(error instanceof Error ? error.message : '未知错误');
      toast({
        variant: "destructive",
        title: "上传失败",
        description: error instanceof Error ? error.message : "未知错误",
      });
    } finally {
      setUploading(false);
    }
  };

  // 刷新图片列表
  const refreshImageList = async () => {
    if (!selectedSystemId) return;
    
    setImagesLoading(true); // 开始刷新时设置加载状态
    
    type ApiResponseType = {
      images: Array<{
        id: string;
        name: string;
        url: string;
        uploadTime: string;
        provider: string;
        fileSize?: number;
        fileType?: string;
        selected?: boolean;
      }>;
    };
    
    try {
      const response = await fetch(`/api/image?systemId=${selectedSystemId}`);
      
      if (response.ok) {
        const data = await response.json() as ApiResponseType;
        console.log(`刷新图片列表：从数据库加载了 ${data.images.length} 张图片`);
        
        if (data.images && Array.isArray(data.images)) {
          const filesWithDates: UploadedFile[] = data.images.map((file) => ({
            ...file,
            uploadTime: new Date(file.uploadTime),
            selected: false,
          }));
          
          // 保留当前选中状态
          const selectedIds = uploadedFiles
            .filter(f => f.selected)
            .map(f => f.id);
            
          if (selectedIds.length > 0) {
            filesWithDates.forEach((file) => {
              file.selected = selectedIds.includes(file.id);
            });
          } else if (filesWithDates.length === 1) {
            filesWithDates[0].selected = true;
          }
          
          setUploadedFiles(filesWithDates);
        }
      } else {
        console.error('刷新图片列表失败:', response.statusText);
      }
    } catch (error) {
      console.error('刷新图片列表出错:', error);
    } finally {
      setImagesLoading(false); // 无论成功还是失败，都结束加载状态
    }
  };
  
  // 处理删除图片
  const handleDeleteFile = async (fileId: string) => {
    if (!selectedSystemId) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: "请先选择系统",
      });
      return;
    }

    try {
      // 使用新的API端点，包含systemId参数
      const response = await fetch(`/api/image?key=${encodeURIComponent(fileId)}&systemId=${encodeURIComponent(selectedSystemId)}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '删除失败');
      }

      // 从本地状态中移除文件
      setUploadedFiles(prev => prev.filter(file => file.id !== fileId));

      toast({
        title: "删除成功",
        description: "文件已从存储中删除",
      });
    } catch (error) {
      console.error('删除图片出错:', error);
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error instanceof Error ? error.message : "未知错误",
      });
    }
  };
  
  // 处理文件选择状态变更
  const handleSelectFile = (fileId: string, checked: boolean) => {
    const updatedFiles = uploadedFiles.map(file => ({
      ...file,
      selected: file.id === fileId ? checked : file.selected
    }))
    
    setUploadedFiles(updatedFiles)
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
      <RequirementInputDialog
        open={showRequirementDialog}
        onClose={() => setShowRequirementDialog(false)}
        onSubmit={handleSubmitRequirementOverview}
        initialValue={requirementOverview}
      />

      {/* 上传对话框 */}
      <UploadDialog
        open={showUploadDialog}
        onClose={() => {
          setShowUploadDialog(false);
          setFile(null);
          setError('');
        }}
        onUpload={handleUploadFile}
        uploading={uploading}
        error={error}
      />

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
            <ImageList
              uploadedFiles={uploadedFiles}
              isImagesExpanded={isImagesExpanded}
              setIsImagesExpanded={setIsImagesExpanded}
              onSelectFile={handleSelectFile}
              onDeleteFile={handleDeleteFile}
              onUploadClick={() => setShowUploadDialog(true)}
              processing={processing}
              imagesLoading={imagesLoading}
            />
          </div>
          
          {/* 功能按钮组 */}
          <ActionButtons
            processingStates={processingStates}
            processing={processing}
            hasSelectedImages={uploadedFiles.filter(f => f.selected).length > 0}
            onExtractProductInfo={handleExtractProductInfo}
            onExtractArchitecture={handleExtractArchitecture}
            onVisionAnalysis={handleVisionAnalysis}
            onGenerateRequirementDraft={handleGenerateRequirementDraft}
          />
          
          {/* 标签页区域 */}
          <TabsNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          
          {/* 内容区域 */}
          <div className="border rounded-md p-4">
            {activeTab === 'product-info' && (
              <TabContent
                tabType="product-info"
                title="产品基础信息"
                content={contents['product-info']}
                reasoning={reasonings['product-info']}
                isQVQModel={isQVQModel}
                reasoningVisible={reasoningVisibility['product-info']}
                onToggleReasoning={() => setReasoningVisibility(prev => ({
                  ...prev,
                  'product-info': !prev['product-info']
                }))}
                onDownload={handleDownload}
                onDownloadReasoning={handleDownloadReasoning}
              />
            )}
            
            {activeTab === 'architecture' && (
              <TabContent
                tabType="architecture"
                title="信息架构"
                content={contents['architecture']}
                reasoning={reasonings['architecture']}
                isQVQModel={isQVQModel}
                reasoningVisible={reasoningVisibility['architecture']}
                onToggleReasoning={() => setReasoningVisibility(prev => ({
                  ...prev,
                  'architecture': !prev['architecture']
                }))}
                onDownload={handleDownloadArchitecture}
                onDownloadReasoning={handleDownloadReasoning}
                exportType="JSON"
                className="whitespace-pre-wrap font-mono text-xs border rounded-md p-3 bg-gray-50"
              />
            )}
            
            {activeTab === 'vision-analysis' && (
              <TabContent
                tabType="vision-analysis"
                title="视觉分析结果"
                content={contents['vision-analysis']}
                reasoning={reasonings['vision-analysis']}
                isQVQModel={isQVQModel}
                reasoningVisible={reasoningVisibility['vision-analysis']}
                onToggleReasoning={() => setReasoningVisibility(prev => ({
                  ...prev,
                  'vision-analysis': !prev['vision-analysis']
                }))}
                onDownload={handleDownloadVisionAnalysis}
                onDownloadReasoning={handleDownloadReasoning}
              />
            )}
            
            {activeTab === 'requirement-draft' && (
              <TabContent
                tabType="requirement-draft"
                title="需求初稿"
                content={contents['requirement-draft']}
                reasoning={reasonings['requirement-draft']}
                isQVQModel={isQVQModel}
                reasoningVisible={reasoningVisibility['requirement-draft']}
                onToggleReasoning={() => setReasoningVisibility(prev => ({
                  ...prev,
                  'requirement-draft': !prev['requirement-draft']
                }))}
                onDownload={handleDownloadRequirementDraft}
                onDownloadReasoning={handleDownloadReasoning}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}