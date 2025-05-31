'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, Plus, Check, X, Loader2, RefreshCw } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { useVectorConfigStore } from '@/lib/stores/vector-config-store'
import { useSystemStore } from '@/lib/stores/system-store'
import { useTranslations } from 'next-intl'

// 硬编码的用户ID
const HARDCODED_USER_ID = '43170448'

// 需求摘要类型定义
type RequirementSummary = {
  id: number
  name: string
  summary: string
  domain: string
  relatedModules: string[]
  createdAt: string
  updatedAt: string
  createdBy: string | null
  similarity?: number // 向量搜索结果中的相似度
  matchType: 'exact' | 'semantic'
  embedding?: number[] | null // 添加embedding字段
}

// 分页信息类型
type Pagination = {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function RequirementSummariesPage() {
  const t = useTranslations('RequirementSummaryPage')
  
  // 状态管理
  const [items, setItems] = useState<RequirementSummary[]>([])
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 15, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [vectorizingIds, setVectorizingIds] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [domainFilter, setDomainFilter] = useState('')
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [minSimilarity, setMinSimilarity] = useState(0.7)
  const [mounted, setMounted] = useState(false)
  const [vectorFilter, setVectorFilter] = useState<'all' | 'vectorized' | 'unvectorized'>('all')
  
  // 从 store 获取系统信息
  const selectedSystemId = useSystemStore(state => state.selectedSystemId)
  const systems = useSystemStore(state => state.systems)
  const currentSystem = systems.find(sys => sys.id === selectedSystemId)
  
  // 在页面加载和系统变化时设置默认领域过滤
  useEffect(() => {
    if (currentSystem?.name && !domainFilter) {
      setDomainFilter(currentSystem.name)
    }
  }, [currentSystem])
  
  // 编辑状态管理
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    summary: '',
    domain: '',
    relatedModules: [] as string[]
  })
  
  // 从 store 获取配置
  const getDefaultConfig = useVectorConfigStore(state => state.getDefaultConfig)
  
  // 加载需求摘要列表
  const loadRequirementSummaries = async (page = 1) => {
    setIsLoading(true)
    try {
      let url = `/api/requirement-summaries?page=${page}&limit=${pagination.limit}`
      
      if (searchTerm) {
        url += `&term=${encodeURIComponent(searchTerm)}`
      }
      
      // 如果有手动设置的领域过滤，优先使用手动设置的
      // 否则使用当前系统名称作为默认领域过滤
      const effectiveDomainFilter = domainFilter || (currentSystem?.name || '')
      if (effectiveDomainFilter) {
        url += `&domain=${encodeURIComponent(effectiveDomainFilter)}`
      }

      if (vectorFilter !== 'all') {
        url += `&vectorized=${vectorFilter === 'vectorized'}`
      }
      
      const response = await fetch(url)
      if (!response.ok) throw new Error(t('operationFailed'))
      
      const data = await response.json()
      setItems(data.items)
      setPagination(data.pagination)
    } catch (error) {
      toast({
        title: t('error'),
        description: t('operationFailed'),
        variant: 'destructive',
      })
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }
  
  // 初始加载
  useEffect(() => {
    loadRequirementSummaries()
  }, [])
  
  // 当过滤条件改变时重新加载
  useEffect(() => {
    loadRequirementSummaries(1)
  }, [searchTerm, domainFilter, vectorFilter])
  
  // 处理页码变化
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadRequirementSummaries(newPage)
    }
  }
  
  // 开始编辑
  const startEdit = (item: RequirementSummary) => {
    setEditingId(item.id)
    setFormData({
      name: item.name,
      summary: item.summary,
      domain: item.domain,
      relatedModules: item.relatedModules
    })
  }
  
  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null)
    setIsAdding(false)
    setFormData({ name: '', summary: '', domain: '', relatedModules: [] })
  }
  
  // 处理表单提交
  const handleSubmit = async (isEdit = false) => {
    try {
      if (!formData.name || !formData.summary) {
        toast({
          title: t('validationFailed'),
          description: t('nameAndSummaryRequired'),
          variant: 'destructive',
        })
        return
      }
      
      const url = isEdit ? `/api/requirement-summaries/${editingId}` : '/api/requirement-summaries'
      const method = isEdit ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          createdBy: HARDCODED_USER_ID,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('operationFailed'))
      }
      
      toast({
        title: t('success'),
        description: isEdit ? t('summaryUpdated') : t('summaryAdded'),
      })
      
      cancelEdit()
      loadRequirementSummaries()
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('operationFailed'),
        variant: 'destructive',
      })
      console.error(error)
    }
  }
  
  // 开始添加
  const startAdd = () => {
    setIsAdding(true)
    setFormData({ name: '', summary: '', domain: '', relatedModules: [] })
  }
  
  // 处理删除
  const handleDelete = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return
    
    try {
      const response = await fetch(`/api/requirement-summaries/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('deleteFailed'))
      }
      
      toast({
        title: t('success'),
        description: t('summaryDeleted'),
      })
      
      loadRequirementSummaries()
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('deleteFailed'),
        variant: 'destructive',
      })
      console.error(error)
    }
  }

  // 处理向量化
  const handleVectorize = async (id: number) => {
    const vectorConfig = getDefaultConfig()
    
    if (!vectorConfig) {
      toast({
        title: t('error'),
        description: t('configNotFound'),
        variant: 'destructive',
      })
      return
    }

    if (!vectorConfig.baseURL || !vectorConfig.apiKey || !vectorConfig.model) {
      toast({
        title: t('error'),
        description: t('configIncomplete'),
        variant: 'destructive',
      })
      return
    }

    setVectorizingIds(prev => new Set([...prev, id]))
    
    try {
      const response = await fetch(`/api/requirement-summaries/${id}/vectorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vectorConfig }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('vectorizeFailed'))
      }
      
      toast({
        title: t('success'),
        description: t('vectorizeDesc'),
      })
      
      loadRequirementSummaries()
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('vectorizeFailed'),
        variant: 'destructive',
      })
      console.error(error)
    } finally {
      setVectorizingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }
  
  // 处理搜索
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: t('notice'),
        description: t('enterSearchKeyword'),
      })
      return
    }
    
    setIsLoading(true)
    setIsSearchMode(true)
    
    // 显示搜索开始的提示
    toast({
      title: t('searchStarted'),
      description: t('searchStarted'),
    })
    
    try {
      // 直接从 store 获取配置
      const vectorConfig = getDefaultConfig()
      
      if (!vectorConfig) {
        console.log(`[${new Date().toISOString()}] 警告: 未找到默认向量配置，将只进行精确匹配搜索`)
      } else {
        console.log(`[${new Date().toISOString()}] 使用默认向量配置:`, {
          name: vectorConfig.name,
          model: vectorConfig.model,
          baseURL: vectorConfig.baseURL
        })
      }
      
      const response = await fetch(`/api/requirement-summaries/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchTerm,
          page: 1,
          limit: pagination.limit,
          vectorConfig,  // 直接传递 store 中的配置
          minSimilarity
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('searchFailed'))
      }
      
      const data = await response.json()
      setItems(data.results)
      setPagination({
        total: data.total,
        page: data.page,
        limit: data.limit,
        totalPages: Math.ceil(data.total / data.limit)
      })
      
      // 显示搜索完成的提示
      toast({
        title: t('searchComplete'),
        description: t('searchCompleteDesc').replace('{count}', data.total.toString()),
      })
    } catch (error) {
      toast({
        title: t('searchFailed'),
        description: error instanceof Error ? error.message : t('unknownError'),
        variant: 'destructive',
      })
      console.error('搜索失败', error)
      loadRequirementSummaries(1)
      setIsSearchMode(false)
    } finally {
      setIsLoading(false)
    }
  }
  
  // 清除搜索
  const clearSearch = () => {
    setSearchTerm('')
    setIsSearchMode(false)
    loadRequirementSummaries(1)
  }
  
  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="mx-auto py-6 w-[90%]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground text-sm mt-2">
            {t('subtitle') || '管理需求摘要，支持语义搜索与分类管理'}
          </p>
        </div>
      
        <div className="space-y-4">
          {/* 工具栏 */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Input
                  placeholder={t('search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch()
                    }
                  }}
                  className="w-64 text-xs h-7"
                />
                {isSearchMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSearch}
                    className="h-7 px-2 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    {t('clear')}
                  </Button>
                )}
              </div>

              <Input
                placeholder={t('domainFilter')}
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="w-32 text-xs h-8"
              />

              <select
                value={vectorFilter}
                onChange={(e) => setVectorFilter(e.target.value as 'all' | 'vectorized' | 'unvectorized')}
                className="h-8 text-xs rounded-md border border-input bg-background px-3"
              >
                <option value="all">{t('all')}</option>
                <option value="vectorized">{t('vectorized')}</option>
                <option value="unvectorized">{t('unvectorized')}</option>
              </select>

              <div className="flex flex-col gap-1 min-w-[200px]">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">{t('similarityThreshold')}</Label>
                  <span className="text-xs text-muted-foreground">
                    {(minSimilarity * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[minSimilarity * 100]}
                  onValueChange={(values) => setMinSimilarity(values[0] / 100)}
                  min={50}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={startAdd}
                disabled={isAdding}
                className="text-xs h-8 px-3"
              >
                <Plus className="h-3 w-3 mr-1" />
                {t('addRequirementSummary')}
              </Button>
            </div>
          </div>
          
          {/* 搜索结果/列表视图 */}
          {isSearchMode ? (
            <div className="grid grid-cols-1 gap-2">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">{t('loading')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getDefaultConfig() ? t('searchStarted') : t('loading')}
                  </p>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">{t('noSummariesFound')}</p>
                </div>
              ) : (
                items.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="pt-2 pb-2 px-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1">
                            <h3 className="text-sm font-medium">{item.name}</h3>
                            <div className="flex flex-wrap gap-1">
                              {item.relatedModules.map((module, index) => (
                                <Badge key={index} variant="outline" className="text-[10px]">
                                  {module}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {t('domain')}: {item.domain} | {t('createdTime')}: {formatDate(item.createdAt)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-[10px] text-muted-foreground">
                            {item.matchType === 'exact' ? t('exactMatch') : t('semanticMatch')}
                          </div>
                          <div className="text-[10px] text-orange-600 font-medium">
                            {t('similarity').replace('{percent}', ((item.similarity || 0) * 100).toFixed(1))}
                          </div>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-xs mt-1 break-words">{item.summary}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-gray-50/80">
                  <TableRow className="text-[10px]">
                    <TableHead className="w-[150px] py-2">{t('requirementName')}</TableHead>
                    <TableHead className="py-2">{t('requirementSummary')}</TableHead>
                    <TableHead className="w-[120px] py-2">{t('domain')}</TableHead>
                    <TableHead className="w-[180px] py-2">{t('relatedModules')}</TableHead>
                    <TableHead className="w-[150px] py-2">{t('createdTime')}</TableHead>
                    <TableHead className="w-[80px] py-2 text-center">{t('vectorized')}</TableHead>
                    <TableHead className="w-[120px] py-2">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-[10px]">
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-3 text-[10px]">
                        {t('loading')}
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 && !isAdding ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-3 text-[10px]">
                        {t('noSummariesFound')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {isAdding && (
                        <TableRow className="bg-muted/50">
                          <TableCell className="py-1">
                            <Input
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder={t('enterRequirementName')}
                              className="text-xs h-6"
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <Textarea
                              value={formData.summary}
                              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                              placeholder={t('enterSummary')}
                              className="min-h-[40px] text-xs"
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <Input
                              value={formData.domain}
                              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                              placeholder={t('enterDomain')}
                              className="text-xs h-6"
                            />
                          </TableCell>
                          <TableCell className="py-1">
                            <Input
                              value={formData.relatedModules.join(',')}
                              onChange={(e) => setFormData({ ...formData, relatedModules: e.target.value.split(',') })}
                              placeholder={t('enterRelatedModules')}
                              className="text-xs h-6"
                            />
                          </TableCell>
                          <TableCell className="py-1">-</TableCell>
                          <TableCell className="py-1">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSubmit(false)}
                                className="h-6 w-6 text-green-600 hover:text-green-700"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={cancelEdit}
                                className="h-6 w-6 text-destructive hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="py-1">
                            {editingId === item.id ? (
                              <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="text-xs h-6"
                              />
                            ) : (
                              <span className="font-medium text-xs">{item.name}</span>
                            )}
                          </TableCell>
                          <TableCell className="py-1">
                            {editingId === item.id ? (
                              <Textarea
                                value={formData.summary}
                                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                                className="min-h-[40px] text-xs"
                              />
                            ) : (
                              <div className="max-w-[500px] break-words whitespace-pre-wrap text-xs line-clamp-3 hover:line-clamp-none">
                                {item.summary}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-1">
                            {editingId === item.id ? (
                              <Input
                                value={formData.domain}
                                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                                className="text-xs h-6"
                              />
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                                  {item.domain}
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-1">
                            {editingId === item.id ? (
                              <Input
                                value={formData.relatedModules.join(',')}
                                onChange={(e) => setFormData({ ...formData, relatedModules: e.target.value.split(',') })}
                                className="text-xs h-6"
                              />
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {item.relatedModules.map((module, index) => (
                                  <Badge key={index} variant="outline" className="text-[10px]">
                                    {module}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-1">{formatDate(item.createdAt)}</TableCell>
                          <TableCell className="py-1 text-center">
                            {item.embedding && item.embedding.length > 0 ? (
                              <span className="text-green-600">✓</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="py-1">
                            <span className="flex items-center gap-2">
                              {editingId === item.id ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSubmit(true)}
                                    className="h-6 w-6 text-green-600 hover:text-green-700"
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={cancelEdit}
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => startEdit(item)}
                                    className="h-6 w-6"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(item.id)}
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleVectorize(item.id)}
                                    disabled={vectorizingIds.has(item.id)}
                                    className="h-6 w-6"
                                  >
                                    <RefreshCw className={`h-3 w-3 ${vectorizingIds.has(item.id) ? 'animate-spin' : ''}`} />
                                  </Button>
                                </>
                              )}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-2 text-[10px]">
              <div>
                {t('showingResults')
                  .replace('{start}', ((pagination.page - 1) * pagination.limit + 1).toString())
                  .replace('{end}', Math.min(pagination.page * pagination.limit, pagination.total).toString())
                  .replace('{total}', pagination.total.toString())}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="h-6 px-2 text-[12px]"
                >
                  {t('previousPage')}
                </Button>
                <span>
                  {t('page')
                    .replace('{current}', pagination.page.toString())
                    .replace('{total}', pagination.totalPages.toString())}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="h-6 px-2 text-[12px]"
                >
                  {t('nextPage')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 