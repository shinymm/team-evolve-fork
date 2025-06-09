"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload, FileText, AlertCircle, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { useDocumentStore } from "@/lib/stores/documentStore"
import { useRouter } from "next/navigation"

interface UploadTabProps {
  onStartAnalysis: (docId: string, shouldAnalyze: boolean) => void
  onDocumentSelect: (docId: string) => void
  onCompleteUpload?: () => void
}

export function UploadTab({
  onStartAnalysis,
  onDocumentSelect,
  onCompleteUpload = () => {},
}: UploadTabProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const { 
    documents,
    currentDocument,
    uploadProgress,
    isLoading,
    error,
    uploadDocument,
    clearError,
    fetchDocuments,
    setError,
    total,
    limit
  } = useDocumentStore()
  const router = useRouter();
  const [analysisStatusMap, setAnalysisStatusMap] = useState<Record<string, boolean>>({});
  const analysisStatusFetched = useRef<Record<string, boolean>>({});
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

  // 组件加载时获取文档列表
  useEffect(() => {
    setIsMounted(true)
    fetchDocuments(0, limit).catch(console.error)
    return () => {
      setIsMounted(false)
    }
  }, [fetchDocuments, limit])

  // 处理页码变化
  const handlePageChange = useCallback((newPage: number) => {
    const skip = (newPage - 1) * limit
    setCurrentPage(newPage)
    fetchDocuments(skip, limit).catch(console.error)
  }, [fetchDocuments, limit])

  // 计算总页数
  const totalPages = Math.ceil(total / limit)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    clearError()

    if (!isMounted) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.type === "application/msword" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        try {
          await uploadDocument(file)
          // 上传成功后刷新第一页
          handlePageChange(1)
        } catch (err) {
          console.error('Upload error:', err)
          setError(err instanceof Error ? err.message : '上传失败，请重试')
        }
      } else {
        setError('仅支持 Word 文档格式')
      }
    }
  }, [uploadDocument, clearError, setError, isMounted, handlePageChange])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    clearError()

    if (!isMounted) return

    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.type === "application/msword" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        try {
          await uploadDocument(file)
          // 上传成功后刷新第一页
          handlePageChange(1)
        } catch (err) {
          console.error('Upload error:', err)
          setError(err instanceof Error ? err.message : '上传失败，请重试')
        }
      } else {
        setError('仅支持 Word 文档格式')
      }
    }
  }, [uploadDocument, clearError, setError, isMounted, handlePageChange])

  // 当上传完成时，自动进入下一步
  useEffect(() => {
    if (
      isMounted &&
      uploadProgress?.status === 'completed' &&
      currentDocument &&
      typeof onCompleteUpload === 'function'
    ) {
      onCompleteUpload();
    }
  }, [uploadProgress?.status, currentDocument, onCompleteUpload, isMounted])

  // 新增：批量获取分析状态
  useEffect(() => {
    async function fetchAnalysisStatus() {
      const statusMap: Record<string, boolean> = {};
      await Promise.all(documents.map(async (doc) => {
        if (!doc.id || analysisStatusFetched.current[doc.id]) return;
        try {
          const res = await fetch(`${BASE_URL}/files/${doc.id}/latest-evaluation`);
          if (res.ok) {
            const data = await res.json();
            statusMap[doc.id] = Array.isArray(data) ? data.length > 0 : !!data;
          } else {
            statusMap[doc.id] = false;
          }
        } catch {
          statusMap[doc.id] = false;
        }
        analysisStatusFetched.current[doc.id] = true;
      }));
      setAnalysisStatusMap(prev => ({ ...prev, ...statusMap }));
    }
    if (documents.length > 0) {
      fetchAnalysisStatus();
    }
  }, [documents]);

  if (!isMounted) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>上传文档</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center ${
            isDragging ? "border-orange-500 bg-orange-50" : "border-gray-300"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="space-y-4">
            <div className="flex justify-center">
              <FileText className="w-12 h-12 text-gray-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900">拖拽文件到此处</h3>
              <p className="text-sm text-gray-500">支持 Word 格式</p>
            </div>
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="bg-orange-500 text-primary-foreground"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById("file-upload")?.click()
                }}
                disabled={isLoading}
              >
                选择文件
              </Button>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept=".doc,.docx"
                onChange={handleFileSelect}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">上传进度</span>
              <span className="text-sm text-gray-500">{uploadProgress?.progress || 0}%</span>
            </div>
            <Progress value={uploadProgress?.progress || 0} className="h-2" />
            {uploadProgress?.message && (
              <p className="text-sm text-gray-500">{uploadProgress.message}</p>
            )}
          </div>
        )}

        {uploadProgress?.status === 'completed' && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-700">文档上传成功</span>
            </div>
          </div>
        )}

        {uploadProgress?.status === 'error' && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-red-700">上传失败，请重试</span>
            </div>
          </div>
        )}

        <div>
          <h3 className="font-medium text-gray-900 mb-4">已上传文档</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文档名称</TableHead>
                  <TableHead>上传日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>进度</TableHead>
                  <TableHead>问题数</TableHead>
                  <TableHead>已修复</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const analyzed = analysisStatusMap[doc.id];
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.filename.replace(/\.[^/.]+$/, "")}</TableCell>
                      <TableCell>{doc.created_at}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            analyzed
                              ? "default"
                              : doc.status === "completed"
                                ? "default"
                                : doc.status === "reviewing"
                                  ? "secondary"
                                  : doc.status === "analyzing"
                                    ? "secondary"
                                    : "outline"
                          }
                        >
                          {analyzed
                            ? "已分析"
                            : doc.status === "completed"
                              ? "已完成"
                              : doc.status === "reviewing"
                                ? "评审中"
                                : doc.status === "analyzing"
                                  ? "分析中"
                                  : "已上传"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress value={doc.progress} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell>{doc.issues}</TableCell>
                      <TableCell>{doc.fixed}</TableCell>
                      <TableCell>
                        {analyzed ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onStartAnalysis(doc.id, false)}
                            className="text-blue-600"
                          >
                            查看
                          </Button>
                        ) : doc.status === "uploaded" ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => onStartAnalysis(doc.id, true)}
                            className="bg-orange-500 hover:bg-orange-600"
                          >
                            开始分析
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDocumentSelect(doc.id)}
                            className="text-blue-600"
                          >
                            查看
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* 分页控制 */}
          {total > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                共 {total} 条记录，当前第 {currentPage} 页
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 