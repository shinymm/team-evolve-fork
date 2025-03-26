'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, Plus, Check, X, Loader2 } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { useVectorConfigStore } from '@/lib/stores/vector-config-store'
import { getVectorConfig } from '@/lib/vector-config-service'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// 硬编码的用户ID
const HARDCODED_USER_ID = '43170448'

// 术语类型定义
type GlossaryItem = {
  id: number
  term: string
  aliases: string | null
  explanation: string
  domain: string
  status: 'pending' | 'approved'
  createdAt: string
  updatedAt: string
  createdBy: string | null
  approvedAt: string | null
  approvedBy: string | null
  similarity?: number // 向量搜索结果中的相似度
  matchType: 'exact' | 'semantic'
}

// 分页信息类型
type Pagination = {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function GlossaryPage() {
  // 状态管理
  const [items, setItems] = useState<GlossaryItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 15, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isApproving, setIsApproving] = useState(false)  // 新增审核中状态
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [domainFilter, setDomainFilter] = useState('') // 添加领域过滤状态
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [minSimilarity, setMinSimilarity] = useState(0.7) // 添加相似度阈值状态
  const [mounted, setMounted] = useState(false)
  
  // 编辑状态管理
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({
    term: '',
    aliases: '',
    explanation: '',
    domain: 'qare',
  })
  
  // 从 store 获取配置
  const getDefaultConfig = useVectorConfigStore(state => state.getDefaultConfig)
  
  // 添加警告弹窗
  const [showEditApprovedDialog, setShowEditApprovedDialog] = useState(false)
  const [pendingEditItem, setPendingEditItem] = useState<GlossaryItem | null>(null)
  
  // 加载术语列表
  const loadGlossaryItems = async (page = 1) => {
    setIsLoading(true)
    try {
      let url = `/api/glossary?page=${page}&limit=${pagination.limit}`
      
      if (searchTerm) {
        url += `&term=${encodeURIComponent(searchTerm)}`
      }
      
      if (statusFilter) {
        url += `&status=${statusFilter}`
      }

      if (domainFilter) {
        url += `&domain=${encodeURIComponent(domainFilter)}`
      }
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('加载术语失败')
      
      const data = await response.json()
      setItems(data.items)
      setPagination(data.pagination)
    } catch (error) {
      toast({
        title: '错误',
        description: '加载术语列表失败',
        variant: 'destructive',
      })
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }
  
  // 初始加载
  useEffect(() => {
    loadGlossaryItems()
  }, [])
  
  // 当过滤条件改变时重新加载
  useEffect(() => {
    loadGlossaryItems(1)
  }, [searchTerm, statusFilter, domainFilter])
  
  // 处理页码变化
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadGlossaryItems(newPage)
    }
  }
  
  // 开始编辑前的检查
  const startEdit = (item: GlossaryItem) => {
    if (item.status === 'approved') {
      setPendingEditItem(item)
      setShowEditApprovedDialog(true)
    } else {
      proceedWithEdit(item)
    }
  }

  // 实际执行编辑操作
  const proceedWithEdit = (item: GlossaryItem) => {
    setEditingId(item.id)
    setFormData({
      term: item.term,
      aliases: item.aliases || '',
      explanation: item.explanation,
      domain: item.domain,
    })
  }
  
  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null)
    setIsAdding(false)
    setPendingEditItem(null)
    setFormData({ term: '', aliases: '', explanation: '', domain: 'qare' })
  }
  
  // 处理表单提交
  const handleSubmit = async (isEdit = false) => {
    try {
      if (!formData.term || !formData.explanation) {
        toast({
          title: '验证失败',
          description: '术语名称和解释是必填项',
          variant: 'destructive',
        })
        return
      }
      
      const url = isEdit ? `/api/glossary/${editingId}` : '/api/glossary'
      const method = isEdit ? 'PUT' : 'POST'
      
      // 如果是编辑已审核的术语，需要将状态改为待审核
      const isEditingApproved = isEdit && items.find(item => item.id === editingId)?.status === 'approved'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          createdBy: HARDCODED_USER_ID,
          // 如果是编辑已审核术语，强制设置状态为待审核，并清空embedding
          ...(isEditingApproved ? {
            status: 'pending',
            clearEmbedding: true,  // 后端会根据这个标志清空embedding
            approvedAt: null,
            approvedBy: ''  // 改为空字符串而不是 null
          } : {})
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '操作失败')
      }
      
      toast({
        title: '成功',
        description: isEdit ? '术语已更新' : '术语已添加',
      })
      
      // 重置编辑状态
      cancelEdit()  // 使用统一的取消编辑函数
      loadGlossaryItems()
    } catch (error) {
      toast({
        title: '错误',
        description: error instanceof Error ? error.message : '操作失败',
        variant: 'destructive',
      })
      console.error(error)
    }
  }
  
  // 开始添加
  const startAdd = () => {
    setIsAdding(true)
    setFormData({ term: '', aliases: '', explanation: '', domain: 'qare' })
  }
  
  // 处理删除
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个术语吗？')) return
    
    try {
      const response = await fetch(`/api/glossary/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '删除失败')
      }
      
      toast({
        title: '成功',
        description: '术语已删除',
      })
      
      loadGlossaryItems()
    } catch (error) {
      toast({
        title: '错误',
        description: error instanceof Error ? error.message : '删除失败',
        variant: 'destructive',
      })
      console.error(error)
    }
  }
  
  // 选择/取消选择所有项
  const toggleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(items.map(item => item.id))
    }
  }
  
  // 选择/取消选择单个项
  const toggleSelectItem = (id: number) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(itemId => itemId !== id))
    } else {
      setSelectedItems([...selectedItems, id])
    }
  }
  
  // 批量审核通过
  const handleBatchApprove = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: '提示',
        description: '请至少选择一个术语',
      })
      return
    }
    
    const vectorConfig = getDefaultConfig()
    console.log('获取到的默认配置:', vectorConfig)
    
    if (!vectorConfig) {
      toast({
        title: '错误',
        description: '未找到默认向量模型配置，请在设置中设置默认配置',
        variant: 'destructive',
      })
      return
    }

    // 验证配置是否完整
    if (!vectorConfig.baseURL || !vectorConfig.apiKey || !vectorConfig.model) {
      toast({
        title: '错误',
        description: '向量模型配置不完整，请检查 baseURL、apiKey 和 model',
        variant: 'destructive',
      })
      return
    }
    
    if (!confirm(`确定要审核通过选中的 ${selectedItems.length} 个术语吗？这将生成它们的向量嵌入值，可能需要一些时间。`)) return
    
    setIsApproving(true)  // 使用新的审核中状态
    
    try {
      const results = []
      const errors = []
      
      // 逐个更新每个术语
      for (const id of selectedItems) {
        const item = items.find(item => item.id === id)
        if (!item) continue
        
        try {
          const requestBody = {
            ...item,
            status: 'approved',
            approvedBy: HARDCODED_USER_ID,
            vectorConfig
          }
          
          console.log('准备发送请求，ID:', id)
          console.log('请求体:', {
            ...requestBody,
            vectorConfig: {
              ...requestBody.vectorConfig,
              apiKey: '***' // 隐藏 API Key
            }
          })
          
          const response = await fetch(`/api/glossary/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            console.error('更新术语失败，响应:', errorData)
            errors.push({ term: item.term, error: errorData.error || '审核失败' })
            continue
          }
          
          const data = await response.json()
          console.log('更新术语成功:', data)
          results.push(data)
        } catch (error) {
          console.error('处理术语时出错:', error)
          errors.push({ term: item.term, error: error instanceof Error ? error.message : '审核失败' })
        }
      }
      
      // 显示结果
      if (errors.length > 0) {
        toast({
          title: '部分审核失败',
          description: (
            <div className="mt-2">
              <p>成功: {results.length} 个</p>
              <p>失败: {errors.length} 个</p>
              <ul className="mt-2 text-sm">
                {errors.map((error, index) => (
                  <li key={index} className="text-destructive">
                    {error.term}: {error.error}
                  </li>
                ))}
              </ul>
            </div>
          ),
          variant: 'destructive',
        })
      } else {
        toast({
          title: '成功',
          description: `${results.length} 个术语已审核通过`,
        })
      }
      
      // 清空选择
      setSelectedItems([])
      // 重新加载数据
      loadGlossaryItems()
    } catch (error) {
      toast({
        title: '错误',
        description: error instanceof Error ? error.message : '批量审核失败',
        variant: 'destructive',
      })
      console.error(error)
    } finally {
      setIsApproving(false)  // 重置审核中状态
    }
  }
  
  // 处理搜索
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: '提示',
        description: '请输入搜索关键词',
      })
      return
    }
    
    setIsLoading(true)
    setIsSearchMode(true)
    try {
      // 获取默认向量配置
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
      
      const response = await fetch(`/api/glossary/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchTerm,
          status: statusFilter || 'all',
          page: 1,
          limit: pagination.limit,
          vectorConfig,
          minSimilarity
        }),
      })
      
      if (!response.ok) {
        throw new Error('搜索失败')
      }
      
      const data = await response.json()
      setItems(data.results)
      setPagination({
        total: data.total,
        page: data.page,
        limit: data.limit,
        totalPages: Math.ceil(data.total / data.limit)
      })
    } catch (error) {
      toast({
        title: '搜索失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
      console.error('搜索失败', error)
      // 搜索失败时，重新加载原始数据
      loadGlossaryItems(1)
      setIsSearchMode(false)
    } finally {
      setIsLoading(false)
    }
  }
  
  // 添加清除搜索的函数
  const clearSearch = () => {
    setSearchTerm('')
    setIsSearchMode(false)
    loadGlossaryItems(1)  // 这里已经有加载数据的调用了
  }
  
  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="w-[90%] mx-auto text-xs">
      <h1 className="text-2xl font-bold mb-4">术语知识管理</h1>
      
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              placeholder="搜索术语..."
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
                清除
              </Button>
            )}
          </div>
          
          {mounted && (
            <Select 
              name="status-filter"
              defaultValue={statusFilter || 'all'} 
              onValueChange={(value) => setStatusFilter(value === 'all' ? null : value)}
            >
              <SelectTrigger className="w-[180px] text-xs h-8">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">全部状态</SelectItem>
                <SelectItem value="pending" className="text-xs">待审核</SelectItem>
                <SelectItem value="approved" className="text-xs">已审核</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Input
            placeholder="过滤领域..."
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="w-32 text-xs h-8"
          />

          <div className="flex flex-col gap-1 min-w-[200px]">
            <div className="flex justify-between items-center">
              <Label className="text-xs">相似度阈值</Label>
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
            添加术语
          </Button>
          
          <Button
            onClick={handleBatchApprove}
            disabled={selectedItems.length === 0 || isApproving}
            variant="outline"
            className="relative text-xs h-8 px-3"
          >
            {isApproving && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
            )}
            审核通过 ({selectedItems.length})
          </Button>
        </div>
      </div>
      
      {/* 搜索结果/列表视图 */}
      {isSearchMode ? (
        <div className="grid grid-cols-1 gap-2">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="pt-2 pb-2 px-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1">
                      <h3 className="text-sm font-medium">{item.term}</h3>
                      {item.aliases && <span className="text-muted-foreground text-xs">({item.aliases})</span>}
                      <Badge variant={item.status === 'approved' ? 'outline' : 'outline'} className={`text-[10px] px-1 ${item.status === 'approved' 
                        ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-400"
                        : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                      }`}>
                        {item.status === 'approved' ? '已审核' : '待审核'}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      领域: {item.domain} | 创建时间: {formatDate(item.createdAt)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-[10px] text-muted-foreground">
                      {item.matchType === 'exact' ? '精确匹配' : '语义匹配'}
                    </div>
                    <div className="text-[10px] text-orange-600 font-medium">
                      相似度: {((item.similarity || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-xs mt-1">{item.explanation}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader className="bg-gray-50/80">
              <TableRow className="text-[10px]">
                <TableHead className="w-[40px] py-2">
                  <Checkbox
                    checked={items.length > 0 && selectedItems.length === items.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[150px] py-2">术语名称</TableHead>
                <TableHead className="w-[120px] py-2">别名</TableHead>
                <TableHead className="py-2">解释说明</TableHead>
                <TableHead className="w-[180px] py-2">领域</TableHead>
                <TableHead className="w-[80px] py-2">状态</TableHead>
                <TableHead className="w-[150px] py-2">创建时间</TableHead>
                <TableHead className="w-[100px] py-2">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-[10px]">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-3 text-[10px]">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 && !isAdding ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-3 text-[10px]">
                    没有找到术语
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {isAdding && (
                    <TableRow className="bg-muted/50">
                      <TableCell className="py-1">
                        <Checkbox disabled />
                      </TableCell>
                      <TableCell className="py-1">
                        <Input
                          value={formData.term}
                          onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                          placeholder="输入术语名称"
                          className="text-xs h-6"
                        />
                      </TableCell>
                      <TableCell className="py-1">
                        <Input
                          value={formData.aliases}
                          onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                          placeholder="输入别名（多个请用逗号分隔）"
                          className="text-xs h-6"
                        />
                      </TableCell>
                      <TableCell className="py-1">
                        <Textarea
                          value={formData.explanation}
                          onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                          placeholder="输入解释说明"
                          className="min-h-[40px] text-xs"
                        />
                      </TableCell>
                      <TableCell className="py-1">
                        <Input
                          value={formData.domain}
                          onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                          placeholder="输入领域"
                          className="text-xs h-6"
                        />
                      </TableCell>
                      <TableCell className="py-1">
                        <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 whitespace-nowrap">
                          待审核
                        </Badge>
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
                    <TableRow key={item.id} className={`${selectedItems.includes(item.id) && isApproving ? 'relative opacity-50' : ''}`}>
                      {selectedItems.includes(item.id) && isApproving && (
                        <TableCell colSpan={8} className="absolute inset-0 p-0">
                          <div className="flex items-center justify-center w-full h-full bg-background/30 z-10">
                            <Loader2 className="h-3 w-3 animate-spin" />
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="py-1">
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => toggleSelectItem(item.id)}
                          disabled={item.status === 'approved' || (isApproving && selectedItems.includes(item.id))}
                        />
                      </TableCell>
                      <TableCell className="py-1">
                        {editingId === item.id ? (
                          <Input
                            value={formData.term}
                            onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                            className="text-xs h-6"
                          />
                        ) : (
                          <span className="font-medium text-xs">{item.term}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-1">
                        {editingId === item.id ? (
                          <Input
                            value={formData.aliases}
                            onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                            className="text-xs h-6"
                          />
                        ) : (
                          <span className="text-[10px]">{item.aliases || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-1">
                        {editingId === item.id ? (
                          <Textarea
                            value={formData.explanation}
                            onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                            className="min-h-[40px] text-xs"
                          />
                        ) : (
                          <span className="max-w-[300px] truncate text-xs">{item.explanation}</span>
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
                            {item.domain.split(/[,，]/).map((domain, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10"
                              >
                                {domain.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-1">
                        {item.status === 'approved' ? (
                          <Badge variant="outline" className="text-[10px] bg-orange-500 hover:bg-orange-600 text-white border-orange-400 whitespace-nowrap">
                            已审核
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 whitespace-nowrap">
                            待审核
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-1">{formatDate(item.createdAt)}</TableCell>
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
            显示 {pagination.total} 条中的 {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} 条
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="h-6 px-2 text-[12px]"
            >
              上一页
            </Button>
            <span>
              第 {pagination.page} 页，共 {pagination.totalPages} 页
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="h-6 px-2 text-[12px]"
            >
              下一页
            </Button>
          </div>
        </div>
      )}
      
      {/* 添加警告弹窗 */}
      <AlertDialog open={showEditApprovedDialog} onOpenChange={(open) => {
        setShowEditApprovedDialog(open)
        if (!open) {
          setPendingEditItem(null)  // 关闭弹窗时清理待编辑项
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认编辑已审核术语？</AlertDialogTitle>
            <AlertDialogDescription>
              编辑已审核的术语将导致其状态变更为待审核状态，需要重新进行审核。
              同时，该术语的向量嵌入值将被清空，需要在重新审核时重新生成。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingEditItem) {
                proceedWithEdit(pendingEditItem)
              }
            }}>继续编辑</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 