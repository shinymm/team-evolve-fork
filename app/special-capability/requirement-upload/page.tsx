'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, File as FileIcon, X, Trash2 } from 'lucide-react'
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/components/ui/use-toast"
import { getAIConfig } from '@/lib/ai-config-service'
import type { AIModelConfig } from '@/lib/ai-service'

// 已上传文件类型定义
type UploadedFile = {
  id: string;
  name: string;
  uploadTime: Date;
};

export default function RequirementUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string>('')
  const [uploading, setUploading] = useState<boolean>(false)
  const [fileId, setFileId] = useState<string>('')
  const [aiConfig, setAiConfig] = useState<AIModelConfig | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)

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
  }, [])

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

    if (!aiConfig || !aiConfig.apiKey) {
      setError('未设置AI模型配置或API密钥为空')
      toast({
        variant: "destructive",
        title: "配置错误",
        description: "请先在设置中配置AI模型",
      })
      return
    }

    setUploading(true)
    setError('')

    try {
      // 创建 FormData 对象
      const formData = new FormData()
      formData.append('file', file)
      formData.append('filename', file.name)
      // 添加AI配置信息
      formData.append('apiKey', aiConfig.apiKey)
      formData.append('baseURL', aiConfig.baseURL)

      // 通过自定义API端点处理文件
      const response = await fetch('/api/upload-requirement', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorText = errorData?.error || response.statusText
        throw new Error(`上传失败: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      const fileId = data.id || data.fileId
      
      // 保存文件ID供后续使用
      setFileId(fileId)
      
      // 添加到已上传文件列表
      setUploadedFiles(prev => [...prev, {
        id: fileId,
        name: file.name,
        uploadTime: new Date()
      }])
      
      // 显示成功提示
      toast({
        title: "上传成功",
        description: `文件 ${file.name} A已成功上传，文件ID: ${fileId}`,
      })
      
      // 重置文件选择状态，以便继续上传新文件
      setFile(null)
      
      console.log('上传成功:', data)
    } catch (err) {
      console.error('上传错误:', err)
      setError(`上传失败: ${err instanceof Error ? err.message : '未知错误'}`)
      toast({
        variant: "destructive",
        title: "上传失败",
        description: `${err instanceof Error ? err.message : '未知错误'}`,
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteFile = (fileId: string) => {
    // 从已上传文件列表中移除文件
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
    
    // 显示删除成功的提示
    toast({
      title: "删除成功",
      description: "文件已从列表中移除",
    });
  };

  return (
    <>
      <div className="mx-auto py-6 w-[90%]">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">需求书拆解</h1>
            <p className="text-muted-foreground text-sm mt-2">
              请上传需求书文档（支持 .docx、.txt、.pdf、.xlsx、.md 格式），我们将帮助您进行智能拆解。
            </p>
            {!aiConfig && (
              <p className="text-red-500 text-sm mt-2">
                未检测到AI模型配置，请先在设置中配置模型
              </p>
            )}
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

              <div className="mt-6 flex justify-center">
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
              </div>
              
              {/* 已上传文件列表 */}
              {uploadedFiles.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">已上传文件列表</h3>
                  <div className="border rounded-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
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
          </div>
        </div>
      </div>
      <Toaster />
    </>
  )
} 