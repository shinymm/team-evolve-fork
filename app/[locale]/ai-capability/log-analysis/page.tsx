'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, ChevronDown, ChevronRight, ArrowUpDown, X, Brain, FileText, Trash2 } from 'lucide-react'
import * as yaml from 'js-yaml'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { ExceptionAnalysisService } from '@/lib/services/exception-analysis-service'
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { getDefaultAIConfig } from '@/lib/services/ai-config-service'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/components/ui/use-toast"
import { useTranslations, useLocale } from 'next-intl'

interface Exception {
  request: string
  error: string
  stackTrace: string[]
}

type SortField = 'request' | 'error'
type SortOrder = 'asc' | 'desc'

export default function LogAnalysis({params}: {params: {locale: string}}) {
  const currentLocale = useLocale()
  const t = useTranslations('LogAnalysisPage')
  
  const [analyzing, setAnalyzing] = useState(false)
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [expandedRows, setExpandedRows] = useState<number[]>([])
  const [sortField, setSortField] = useState<SortField>('request')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedError, setSelectedError] = useState<string | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analysisResult, setAnalysisResult] = useState('')
  const [selectedException, setSelectedException] = useState<Exception | null>(null)
  const decoder = useRef(new TextDecoder())
  const [aiConfig, setAiConfig] = useState<any>(null)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getDefaultAIConfig()
        setAiConfig(config)
      } catch (error) {
        console.error('加载AI配置失败:', error)
        toast({
          title: t('loadFailed'),
          description: t('configureAITip'),
          variant: 'destructive',
        })
      }
    }
    loadConfig()
  }, [t])

  const toggleRow = (index: number) => {
    setExpandedRows(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const filteredExceptions = exceptions
    .filter(e => {
      if (selectedPath && e.request !== selectedPath) return false
      if (selectedError && e.error !== selectedError) return false
      return true
    })

  const sortedExceptions = [...filteredExceptions].sort((a, b) => {
    const compareResult = sortOrder === 'asc' ? 1 : -1
    if (sortField === 'request') {
      return a.request.localeCompare(b.request) * compareResult
    } else {
      const errorCompare = a.error.localeCompare(b.error)
      if (errorCompare === 0) {
        return a.request.localeCompare(b.request) * compareResult
      }
      return errorCompare * compareResult
    }
  })

  // 计算请求路径统计
  const requestStats = exceptions.reduce((acc, curr) => {
    const path = curr.request
    acc[path] = (acc[path] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // 计算错误信息统计
  const errorStats = exceptions.reduce((acc, curr) => {
    const error = curr.error
    acc[error] = (acc[error] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const sortedStats = Object.entries(requestStats)
    .sort(([, countA], [, countB]) => countB - countA)

  const sortedErrorStats = Object.entries(errorStats)
    .sort(([, countA], [, countB]) => countB - countA)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    if (file.type !== 'text/plain') {
      alert('请上传 .txt 格式的文件')
      return
    }

    setAnalyzing(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/logs/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('分析失败')
      }

      const data = await response.text()
      const parsedData = yaml.load(data) as Exception[]
      setExceptions(parsedData)
      setExpandedRows([]) // 重置展开状态
    } catch (error) {
      console.error('Error:', error)
      alert('分析过程中出现错误')
    } finally {
      setAnalyzing(false)
    }
  }

  const loadExampleFile = async () => {
    setAnalyzing(true)
    
    try {
      const response = await fetch('/api/logs/load-example')
      
      if (!response.ok) {
        throw new Error('加载示例文件失败')
      }

      const data = await response.text()
      const parsedData = yaml.load(data) as Exception[]
      setExceptions(parsedData)
      setExpandedRows([]) // 重置展开状态
      
      toast({
        title: t('exampleLoadSuccess'),
        description: t('exampleLoadSuccessDesc'),
      })
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: t('loadFailed'),
        description: t('loadFailedDesc'),
        variant: 'destructive',
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleAnalyze = async (exception: Exception) => {
    setSelectedException(exception)
    setShowAnalysis(true)
    setAnalysisResult('')
    setAnalyzing(true)

    try {
      const stream = await ExceptionAnalysisService.analyze(exception)
      const reader = stream.getReader()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // 处理 SSE 数据
        const text = decoder.current.decode(value)
        const lines = text.split('\n').filter(line => line.trim() !== '')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              // 检查是否有错误信息
              if (data.error) {
                console.error('分析错误:', data.error)
                setAnalysisResult(prev => prev + `\n错误: ${data.error}`)
                continue
              }
              // 检查并提取内容
              if (data.content) {
                setAnalysisResult(prev => prev + data.content)
              }
            } catch (e) {
              console.error('解析 SSE 消息失败:', e, line)
            }
          }
        }
      }
    } catch (error) {
      console.error('分析失败:', error)
      setAnalysisResult(t('analysisError'))
    } finally {
      setAnalyzing(false)
    }
  }

  const handleClear = () => {
    setExceptions([]);
    setExpandedRows([]);
    setSelectedPath(null);
    setSelectedError(null);
    setShowAnalysis(false);
    setAnalysisResult('');
    setSelectedException(null);
    setAnalyzing(false);
  }

  return (
    <div className="h-full w-full">
      <div className="max-w-[calc(100vw-14rem)] mx-auto">
        <div className="p-6">
          {!aiConfig && (
            <Alert className="mb-4">
              <AlertTitle>提示</AlertTitle>
              <AlertDescription>
                {t('configureAITip')}
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>
            <p className="text-gray-600 mb-4">
              {t('subtitle')}
            </p>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 cursor-pointer">
                <Upload className="w-4 w-4" />
                <span>{t('uploadLogFile')}</span>
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={loadExampleFile}
                disabled={analyzing}
              >
                <FileText className="w-4 h-4" />
                <span>{t('loadExampleLog')}</span>
              </Button>
              
              {exceptions.length > 0 && (
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50"
                  onClick={handleClear}
                  disabled={analyzing}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t('clearResults')}</span>
                </Button>
              )}
              
              {analyzing && <span className="text-gray-600">{t('analyzing')}</span>}
            </div>
          </div>

          {exceptions.length > 0 && (
            <>
              {/* 统计信息区域 */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">{t('statsInfo')}</h2>
                <div className="grid grid-cols-9 gap-6">
                  {/* 总数统计 */}
                  <div className="col-span-1 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">{t('totalExceptions')}</h3>
                    <p className="text-2xl font-semibold">
                      {filteredExceptions.length}
                    </p>
                  </div>
                  
                  {/* 请求路径分布 */}
                  <div className="col-span-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium text-gray-500">{t('requestPathDistribution')}</h3>
                      {selectedPath && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPath(null)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X className="h-4 w-4 mr-1" />
                          {t('clearFilter')}
                        </Button>
                      )}
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <tbody>
                          {sortedStats.map(([path, count]) => (
                            <tr 
                              key={path} 
                              className={`border-b last:border-0 hover:bg-gray-100 cursor-pointer
                                ${selectedPath === path ? 'bg-orange-50' : ''}`}
                              onClick={() => setSelectedPath(path === selectedPath ? null : path)}
                            >
                              <td className="py-2 pr-4 relative group">
                                <div className="w-[510px] truncate">{path}</div>
                                {path.length > 80 && (
                                  <div className="absolute z-50 left-0 top-full mt-1 p-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-normal max-w-[400px] break-all">
                                    {path}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 text-right font-medium w-16">{count}</td>
                              <td className="py-2 pl-4 text-right text-gray-500 w-16">
                                {((count / exceptions.length) * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 错误信息分布 */}
                  <div className="col-span-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium text-gray-500">{t('errorDistribution')}</h3>
                      {selectedError && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedError(null)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X className="h-4 w-4 mr-1" />
                          {t('clearFilter')}
                        </Button>
                      )}
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <tbody>
                          {sortedErrorStats.map(([error, count]) => (
                            <tr 
                              key={error} 
                              className={`border-b last:border-0 hover:bg-gray-100 cursor-pointer
                                ${selectedError === error ? 'bg-orange-50' : ''}`}
                              onClick={() => setSelectedError(error === selectedError ? null : error)}
                            >
                              <td className="py-2 pr-4 relative group">
                                <div className="w-[510px] truncate text-red-600">{error}</div>
                                {error.length > 80 && (
                                  <div className="absolute z-50 left-0 top-full mt-1 p-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-normal max-w-[400px] break-all">
                                    {error}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 text-right font-medium w-16">{count}</td>
                              <td className="py-2 pl-4 text-right text-gray-500 w-16">
                                {((count / exceptions.length) * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* 异常列表 */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">{t('exceptionList')}</h2>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {selectedPath && (
                      <div>{t('filteredPath')}：{selectedPath}</div>
                    )}
                    {selectedError && (
                      <div>{t('filteredError')}：
                        <span className="text-red-600 max-w-[300px] truncate inline-block align-bottom">
                          {selectedError}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="w-[180px]">
                          <button
                            onClick={() => handleSort('request')}
                            className="flex items-center gap-2 hover:text-gray-900"
                          >
                            {t('requestPath')}
                            <ArrowUpDown className="h-4 w-4" />
                            {sortField === 'request' && (
                              <span className="text-xs ml-1">
                                {sortOrder === 'desc' ? '↓' : '↑'}
                              </span>
                            )}
                          </button>
                        </TableHead>
                        <TableHead className="w-[400px]">
                          <button
                            onClick={() => handleSort('error')}
                            className="flex items-center gap-2 hover:text-gray-900"
                          >
                            {t('errorInfo')}
                            <ArrowUpDown className="h-4 w-4" />
                            {sortField === 'error' && (
                              <span className="text-xs ml-1">
                                {sortOrder === 'desc' ? '↓' : '↑'}
                              </span>
                            )}
                          </button>
                        </TableHead>
                        <TableHead>{t('stackInfo')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedExceptions.map((exception, index) => (
                        <TableRow key={index}>
                          <TableCell className="w-[40px] p-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-orange-600"
                              onClick={() => handleAnalyze(exception)}
                            >
                              <Brain className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell className="align-top font-medium w-[180px]">
                            <div className="truncate">{t('globalError')}::{exception.request}</div>
                          </TableCell>
                          <TableCell className="align-top w-[400px]">
                            <div className="text-red-600 break-words">{exception.error}</div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-col gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="w-fit"
                                onClick={() => toggleRow(index)}
                              >
                                <div className="flex items-center gap-2">
                                  {expandedRows.includes(index) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <span>{t('viewStack')}</span>
                                </div>
                              </Button>
                              {expandedRows.includes(index) && (
                                <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap bg-gray-50 p-2 rounded">
                                  {exception.stackTrace.join('\n')}
                                </pre>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={showAnalysis} onOpenChange={(open) => {
        setShowAnalysis(open);
        if (!open) {
          setAnalyzing(false); // 关闭对话框时重置分析状态
        }
      }}>
        <DialogContent className="w-[80vw] h-[85vh] p-0">
          <div className="h-full flex flex-col">
            {/* 头部区域 */}
            <div className="flex-none">
              <div className="px-6 py-4 flex items-center justify-between border-b">
                <h3 className="text-lg font-semibold">{t('aiAnalysis')}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setShowAnalysis(false);
                    setAnalyzing(false); // 点击关闭按钮时也重置分析状态
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="text-sm space-y-2">
                  <div className="flex">
                    <span className="text-gray-500 w-20 shrink-0">{t('requestPath')}：</span>
                    <span className="font-medium break-all flex-1">{selectedException?.request}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-20 shrink-0">{t('errorInfo')}：</span>
                    <span className="text-red-600 break-all flex-1">{selectedException?.error}</span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-orange-500" />
                    <h3 className="text-lg font-semibold">{t('aiAnalysisResult')}</h3>
                  </div>
                  {analyzing && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-500 border-t-transparent"></div>
                      <span>{t('analyzing')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 内容区域 - 使用绝对定位和固定高度 */}
            <div className="absolute inset-x-0 bottom-0 top-[200px] overflow-y-auto">
              <div className="p-6">
                <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-700">
                  {analysisResult || (analyzing && t('thinking'))}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 