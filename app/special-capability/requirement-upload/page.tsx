'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, File as FileIcon, X, Trash2, Download, Book, Loader2, AlertCircle } from 'lucide-react'
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/components/ui/use-toast"
import { getAIConfig } from '@/lib/ai-config-service'
import type { AIModelConfig } from '@/lib/ai-service'
import { Button } from "@/components/ui/button"
import { RequirementToMdService } from '@/lib/services/requirement-to-md-service'
import ReactMarkdown from 'react-markdown'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"

// 已上传文件类型定义
type UploadedFile = {
  id: string;
  name: string;
  uploadTime: Date;
  selected?: boolean;  // 新增：是否被选中
};

export default function RequirementUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string>('')
  const [uploading, setUploading] = useState<boolean>(false)
  const [fileId, setFileId] = useState<string>('')
  const [aiConfig, setAiConfig] = useState<AIModelConfig | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [mdContent, setMdContent] = useState<string>('')
  const [isConverting, setIsConverting] = useState(false)
  const [fileSelectionAlert, setFileSelectionAlert] = useState<string>('')
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

    // 从localStorage恢复已上传文件列表
    const storedFiles = localStorage.getItem('uploaded-requirement-files')
    if (storedFiles) {
      try {
        const parsedFiles = JSON.parse(storedFiles)
        // 将字符串日期转换回Date对象
        const filesWithDates = parsedFiles.map((file: any) => ({
          ...file,
          uploadTime: new Date(file.uploadTime),
          selected: parsedFiles.length === 1 ? true : false // 只有一个文件时默认选中
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
      const newFile = {
        id: fileId,
        name: file.name,
        uploadTime: new Date(),
        selected: uploadedFiles.length === 0 // 如果是第一个文件，默认选中
      }
      
      // 如果只有这一个新文件，设为选中状态
      const updatedFiles = [...uploadedFiles, newFile]
      setUploadedFiles(updatedFiles)
      
      // 保存到localStorage
      localStorage.setItem('uploaded-requirement-files', JSON.stringify(updatedFiles))
      
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
      setFileSelectionAlert("请先选择一个需求文件进行转换")
      return
    } else if (selectedFiles.length > 1) {
      setFileSelectionAlert("需求书转MD功能一次只能处理一个文件，请只选择一个文件")
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

    // 重置状态
    setIsConverting(true)
    setMdContent('')

    try {
      const service = new RequirementToMdService()
      const fileIds = selectedFiles.map(file => file.id)

      await service.convertToMd(
        fileIds,
        aiConfig,
        (content: string) => {
          // 直接更新状态，与其他页面保持一致
          setMdContent(prev => prev + content)
        }
      )
    } catch (error) {
      console.error('转换失败:', error)
      toast({
        title: "转换失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setIsConverting(false)
    }
  }

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

  return (
    <>
      <div className="mx-auto py-6 w-[90%]">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">需求书综合处理</h1>
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
                
                {/* 并排放置的需求书转MD按钮 */}
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
            
            {/* Markdown显示部分 - 直接显示在文件列表下方，而不是弹窗 */}
            {(mdContent || isConverting) && (
              <div className="border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">需求书Markdown</h2>
                  <Button 
                    onClick={handleDownloadMd}
                    disabled={!mdContent || isConverting}
                    className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    下载MD文件
                  </Button>
                </div>
                <div className="border rounded p-4 bg-gray-50 min-h-[300px]">
                  {isConverting ? (
                    <div className="h-full flex items-center justify-center py-10">
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-2" />
                        <p className="text-sm text-gray-500">正在生成Markdown内容...</p>
                      </div>
                    </div>
                  ) : (
                    <ReactMarkdown className="prose prose-sm max-w-none">
                      {mdContent}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <Toaster />
    </>
  )
} 