import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Pencil, Loader2, AlertCircle, CheckCircle, PlugZap, Code, ExternalLink, HelpCircle, Clipboard } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { parseMcpConfig, testMcpConnection, McpServerConfig } from '@/lib/mcp/client'

export interface MemberFormData {
  id?: string
  name: string
  introduction: string
  role: string
  responsibilities: string
  greeting?: string | null
  category?: string | null
  mcpConfigJson?: string | null
}

interface ParsedMcpServer {
  name: string;
  config: McpServerConfig;
}

interface ServerStatus {
  status: 'idle' | 'testing' | 'success' | 'error';
  tools: string[];
  error?: string;
}

interface MemberFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingMember: MemberFormData | null
  onSubmit: (data: MemberFormData) => Promise<void>
  onClose: () => void
}

// 放宽客户端命令格式验证规则
const isCommandPotentiallyTestable = (command?: string, args?: string[]) => {
  // 记录详细日志以便调试
  console.log('[isCommandPotentiallyTestable] 检查命令:', command, '参数:', args);
  
  // 如果没有命令或参数，不可测试
  if (!command || !args || args.length < 2) {
    console.log('[isCommandPotentiallyTestable] 命令或参数无效');
    return false;
  }
  
  // 放宽检查条件：只要命令是npx且有参数就行
  // 后端会严格验证白名单，前端只需基本检查命令格式
  if (command === 'npx' && args[0] === '-y') {
    console.log('[isCommandPotentiallyTestable] 命令格式有效:', command, args);
    return true;
  }
  
  console.log('[isCommandPotentiallyTestable] 命令格式无效');
  return false;
};

export function MemberFormDialog({
  open,
  onOpenChange,
  editingMember,
  onSubmit,
  onClose,
}: MemberFormDialogProps) {
  const [formData, setFormData] = useState<MemberFormData>({
    name: '',
    introduction: '',
    role: '',
    responsibilities: '',
    greeting: '',
    category: '',
    mcpConfigJson: ''
  })

  const [mcpJsonStringInternal, setMcpJsonStringInternal] = useState('');
  const [parsedServers, setParsedServers] = useState<ParsedMcpServer[]>([]);
  const [serverStatusMap, setServerStatusMap] = useState<Record<string, ServerStatus>>({});
  const [isEditingJson, setIsEditingJson] = useState(true);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('info');
  const [testingTools, setTestingTools] = useState(false);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const initialData = editingMember || {
        name: '',
        introduction: '',
        role: '',
        responsibilities: '',
        greeting: '',
        category: '',
        mcpConfigJson: ''
      };
      setFormData({
        ...initialData,
        greeting: initialData.greeting || '',
        category: initialData.category || '',
        mcpConfigJson: initialData.mcpConfigJson || ''
      });

      const initialJson = initialData.mcpConfigJson || '';
      setMcpJsonStringInternal(initialJson);
      if (initialJson) {
        const parsedOk = tryParseJson(initialJson, false);
        setIsEditingJson(!parsedOk);
      } else {
        setParsedServers([]);
        setServerStatusMap({});
        setIsEditingJson(true);
        setJsonError(null);
      }
      setActiveTab('info');
    } else {
      setFormData({ name: '', introduction: '', role: '', responsibilities: '', greeting: '', category: '', mcpConfigJson: '' });
      setMcpJsonStringInternal('');
      setParsedServers([]);
      setServerStatusMap({});
      setIsEditingJson(true);
      setJsonError(null);
    }
  }, [open, editingMember]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const tryParseJson = (jsonStr: string, forceEditOnError = true): boolean => {
    setJsonError(null);
    setServerStatusMap({});
    if (!jsonStr.trim()) {
       setParsedServers([]);
       if (forceEditOnError) setIsEditingJson(true);
       setFormData(prev => ({ ...prev, mcpConfigJson: null }));
       return true;
    }
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object' && parsed.mcpServers && typeof parsed.mcpServers === 'object') {
        const servers: ParsedMcpServer[] = Object.entries(parsed.mcpServers).map(([name, config]) => ({
          name,
          config: config as McpServerConfig,
        }));
        setParsedServers(servers);
        setIsEditingJson(false);
        setFormData(prev => ({ ...prev, mcpConfigJson: jsonStr.trim() }));
        return true;
      } else {
        throw new Error('JSON 结构无效，顶层必须包含 "mcpServers" 对象');
      }
    } catch (error: any) {
      setJsonError(`JSON 解析失败: ${error.message}`);
      setParsedServers([]);
       if (forceEditOnError) setIsEditingJson(true);
      return false;
    }
  };

  const handleMcpJsonChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newJson = event.target.value;
    setMcpJsonStringInternal(newJson);
    setJsonError(null);
  };

  const handleSaveAndPreviewJson = () => {
     tryParseJson(mcpJsonStringInternal);
  }

  const handleEditJson = () => {
    setIsEditingJson(true);
  }

  const handleTestConnection = async () => {
    // 清理之前的测试结果
    setTestingTools(true);
    setAvailableTools([]);
    setTestError(null);
    
    try {
      // 尝试解析MCP配置
      const mcpConfig = parseMcpConfig(formData.mcpConfigJson);
      if (!mcpConfig) {
        throw new Error('无效的MCP配置，请确保JSON格式正确');
      }
      
      // 检查是否有服务器配置
      const serverNames = Object.keys(mcpConfig);
      if (serverNames.length === 0) {
        throw new Error('未找到任何MCP服务器配置');
      }
      
      // 测试第一个服务器
      const serverName = serverNames[0];
      const serverConfig = mcpConfig[serverName];
      
      // 验证配置格式
      if (!serverConfig.command || !Array.isArray(serverConfig.args)) {
        throw new Error(`服务器 "${serverName}" 配置格式无效`);
      }
      
      console.log(`测试 MCP 服务器 "${serverName}" 连接:`, serverConfig);
      
      // 调用测试API
      const tools = await testMcpConnection(serverConfig);
      
      // 更新状态
      setAvailableTools(tools);
      console.log(`MCP服务器 "${serverName}" 测试成功，可用工具:`, tools);
    } catch (error) {
      console.error('MCP服务器测试失败:', error);
      setTestError(error instanceof Error ? error.message : '测试失败');
    } finally {
      setTestingTools(false);
    }
  };

  const handleFinalSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();

    if (!formData.name || !formData.introduction || !formData.role || !formData.responsibilities) {
        console.error("Required fields missing");
        if (!formData.name || !formData.introduction) setActiveTab('info');
        else if (!formData.role || !formData.responsibilities) setActiveTab('skills');
        return;
    }

    let finalMcpJson: string | null = null;
    let isJsonValid = true;

    if (isEditingJson && mcpJsonStringInternal.trim()) {
        isJsonValid = tryParseJson(mcpJsonStringInternal);
        if (isJsonValid) {
            finalMcpJson = mcpJsonStringInternal.trim() || null;
        }
    } else if (!isEditingJson) {
        finalMcpJson = formData.mcpConfigJson === undefined ? null : formData.mcpConfigJson;
        isJsonValid = true;
    } else {
        finalMcpJson = null;
        isJsonValid = true;
    }

    if (!isJsonValid) {
      setActiveTab('mcp');
      console.error("MCP JSON is invalid, cannot save.");
      return;
    }

    const dataToSubmit: MemberFormData = {
        id: formData.id,
        name: formData.name,
        introduction: formData.introduction,
        role: formData.role,
        responsibilities: formData.responsibilities,
        greeting: (formData.greeting || '').trim() || null,
        category: (formData.category || '').trim() || null,
        mcpConfigJson: finalMcpJson,
    };

    console.log('Submitting final validated data:', dataToSubmit);
    await onSubmit(dataToSubmit);
  };

  // 在解析 JSON 成功后，添加日志记录所有解析出的服务器
  useEffect(() => {
    if (parsedServers.length > 0) {
      console.log('======== 解析的服务器配置 ========');
      parsedServers.forEach(server => {
        console.log(`服务器: ${server.name}`);
        console.log(`配置:`, server.config);
        console.log(`命令可测试: ${isCommandPotentiallyTestable(server.config.command, server.config.args)}`);
        console.log('----------------------------');
      });
    }
  }, [parsedServers]);

  const handleConfigChange = (value: string) => {
    setFormData(prev => ({ ...prev, mcpConfigJson: value }));
    
    // 验证JSON格式
    if (!value.trim()) {
      setJsonError(null);
      return;
    }
    
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e) {
      setJsonError(`JSON格式错误: ${(e as Error).message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[60rem] w-[90%] h-[90vh] flex flex-col">
        <DialogHeader className="pb-1 flex-shrink-0">
          <DialogTitle>{editingMember?.id ? '编辑' : '添加'}AI团队成员</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-hidden pt-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
                <TabsTrigger 
                  value="info"
                  className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                >
                  基础信息
                </TabsTrigger>
                <TabsTrigger 
                  value="skills"
                  className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                >
                  技能设定
                </TabsTrigger>
                <TabsTrigger 
                  value="mcp"
                  className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                >
                  外挂工具
                </TabsTrigger>
              </TabsList>

              <div className="overflow-y-auto flex-grow px-1">
                <TabsContent value="info" className="space-y-3 mt-4 h-full p-1">
                   <div className="space-y-1">
                    <Label htmlFor="name">成员名称 *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      maxLength={50}
                      placeholder="请输入成员名称（最多50个字符）"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="introduction">个人简介 *</Label>
                    <div className="relative">
                      <Textarea
                        id="introduction"
                        name="introduction"
                        value={formData.introduction}
                        onChange={handleInputChange}
                        required
                        maxLength={200}
                        placeholder="请输入个人简介（最多200个字符）"
                        className="min-h-[60px] resize-none text-sm"
                        rows={3}
                      />
                      <span className="absolute bottom-2 right-2 text-xs text-gray-400">
                        {formData.introduction.length}/200
                      </span>
                    </div>
                  </div>
                   <div className="space-y-1.5">
                    <Label htmlFor="category">类别标签</Label>
                    <Input
                      id="category"
                      name="category"
                      value={formData.category || ''}
                      onChange={handleInputChange}
                      placeholder="请输入标签，用逗号分隔（如：需求分析,测试用例）"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="greeting">欢迎语</Label>
                    <div className="relative">
                      <Textarea
                        id="greeting"
                        name="greeting"
                        value={formData.greeting || ''}
                        onChange={handleInputChange}
                        maxLength={200}
                        placeholder="成员在对话开始时的问候语（最多200字符）"
                        className="min-h-[80px] resize-none text-sm"
                        rows={3}
                      />
                       <span className="absolute bottom-2 right-2 text-xs text-gray-400">
                        {(formData.greeting || '').length}/200
                      </span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="skills" className="space-y-3 mt-4 h-full p-1">
                   <div className="space-y-1.5">
                    <Label htmlFor="role">角色定位 *</Label>
                    <Textarea
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      required
                      placeholder={'详细描述该成员的角色，例如："你是一个资深测试工程师"'}
                      className="min-h-[100px] resize-none text-sm"
                      rows={4}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="responsibilities">任务与职责 *</Label>
                    <Textarea
                      id="responsibilities"
                      name="responsibilities"
                      value={formData.responsibilities}
                      onChange={handleInputChange}
                      required
                      placeholder={`详细描述成员的具体职责、能力范围和行为要求，这将影响其在对话中的表现。`}
                      className="min-h-[200px] resize-none text-sm"
                      rows={8}
                    />
                  </div>
                </TabsContent>

                 <TabsContent value="mcp" className="space-y-4 mt-4 h-full p-1">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">MCP 服务器配置</h3>
                      <div className="flex gap-2">
                        {isEditingJson ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={handleSaveAndPreviewJson}
                                  disabled={!mcpJsonStringInternal.trim()}
                                >
                                  <CheckCircle size={18} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>保存并预览</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={handleEditJson}
                                >
                                  <Pencil size={18} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>编辑JSON</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  const mcpServerConfig = {
                                    mcpServers: {
                                      "youtube-transcript": {
                                        command: "npx",
                                        args: ["-y", "@kimtaeyoon83/mcp-server-youtube-transcript", "--port", "8001"]
                                      },
                                      "sequential-thinking": {
                                        command: "npx",
                                        args: ["-y", "@smithery-ai/server-sequential-thinking", "--port", "8002"]
                                      }
                                    }
                                  };
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    mcpConfigJson: JSON.stringify(mcpServerConfig, null, 2) 
                                  }));
                                  tryParseJson(JSON.stringify(mcpServerConfig, null, 2));
                                }}
                              >
                                <Clipboard size={18} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>插入示例配置</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    
                    {isEditingJson ? (
                      <>
                        <div className="relative">
                          <Label htmlFor="mcpConfigJson">
                            MCP 配置 JSON
                          </Label>
                          <Textarea
                            id="mcpConfigJson"
                            placeholder='{"mcpServers": {"工具名称": {"command": "npx", "args": ["-y", "包名", "--port", "8001"]}}}'
                            className="font-mono text-sm h-[200px]"
                            value={mcpJsonStringInternal}
                            onChange={handleMcpJsonChange}
                          />
                        </div>
                        
                        {jsonError && (
                          <p className="text-red-500 text-sm mt-2">
                            <AlertCircle className="inline-block h-4 w-4 mr-1" />
                            {jsonError}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {parsedServers.map((server) => (
                            <Card key={server.name} className="overflow-hidden">
                              <CardHeader className="bg-muted/50 py-2 px-4">
                                <div className="flex justify-between items-center">
                                  <CardTitle className="text-sm flex items-center gap-2">
                                    <Code size={14} />
                                    {server.name}
                                  </CardTitle>
                                  <div className="flex gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        // 测试特定服务器连接
                                        const serverConfig = server.config;
                                        setServerStatusMap(prev => ({
                                          ...prev,
                                          [server.name]: {
                                            status: 'testing',
                                            tools: []
                                          }
                                        }));
                                        
                                        testMcpConnection(serverConfig)
                                          .then(tools => {
                                            setServerStatusMap(prev => ({
                                              ...prev,
                                              [server.name]: {
                                                status: 'success',
                                                tools
                                              }
                                            }));
                                            console.log(`服务器 "${server.name}" 测试成功，可用工具:`, tools);
                                          })
                                          .catch(error => {
                                            console.error(`服务器 "${server.name}" 测试失败:`, error);
                                            setServerStatusMap(prev => ({
                                              ...prev,
                                              [server.name]: {
                                                status: 'error',
                                                tools: [],
                                                error: error instanceof Error ? error.message : '测试失败'
                                              }
                                            }));
                                          });
                                      }}
                                      disabled={serverStatusMap[server.name]?.status === 'testing' || !isCommandPotentiallyTestable(server.config.command, server.config.args)}
                                      className="flex items-center px-2 h-7 text-xs"
                                    >
                                      {serverStatusMap[server.name]?.status === 'testing' ? (
                                        <>
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                          测试中
                                        </>
                                      ) : (
                                        <>
                                          <PlugZap className="h-3 w-3 mr-1" />
                                          测试
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="py-2 px-4 text-xs">
                                <div className="font-mono bg-muted/30 p-2 rounded max-h-20 overflow-auto">
                                  <div><span className="text-blue-600">command:</span> {server.config.command}</div>
                                  <div><span className="text-blue-600">args:</span> {JSON.stringify(server.config.args)}</div>
                                </div>
                                
                                {serverStatusMap[server.name]?.status === 'success' && (
                                  <div className="mt-1 text-green-600 flex items-center">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    可用工具: {serverStatusMap[server.name]?.tools.join(', ')}
                                  </div>
                                )}
                                
                                {serverStatusMap[server.name]?.status === 'error' && (
                                  <div className="mt-1 text-red-500 flex items-center">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    {serverStatusMap[server.name]?.error}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </>
                    )}
                  </TabsContent>
               </div>
            </Tabs>
        </div>
        <DialogFooter className="pt-2 border-t flex-shrink-0 bg-background">
            <Button type="button" variant="outline" onClick={onClose}>
            取消
            </Button>
            <Button type="button" onClick={() => handleFinalSubmit()}>
            {editingMember?.id ? '更新' : '保存'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 