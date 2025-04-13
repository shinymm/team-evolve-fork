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
import { parseMcpConfig, testMcpConnection, McpStreamableHttpConfig } from '@/lib/mcp/client'

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
  config: McpStreamableHttpConfig;
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

const isConfigTestable = (config: McpStreamableHttpConfig) => {
  try {
    const urlObj = new URL(String(config.url));
    return true;
  } catch (e) {
    console.log('[isConfigTestable] 无效URL:', config.url, e);
    return false;
  }
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
        const servers: ParsedMcpServer[] = [];
        for (const [name, config] of Object.entries(parsed.mcpServers)) {
           if (config && typeof config === 'object' && 'url' in config && !('command' in config) && !('args' in config)) {
             servers.push({ name, config: config as McpStreamableHttpConfig });
           } else {
             throw new Error(`服务器 "${name}" 配置无效：只支持包含 'url' 字段的 Streamable HTTP 配置，不允许包含 'command' 或 'args'。`);
           }
        }
        setParsedServers(servers);
        setIsEditingJson(false);
        setFormData(prev => ({ ...prev, mcpConfigJson: jsonStr.trim() }));
        return true;
      } else {
        throw new Error('JSON 结构无效，顶层必须包含 "mcpServers" 对象');
      }
    } catch (error: any) {
      setJsonError(`JSON 解析或验证失败: ${error.message}`);
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

  const handleTestConnection = async (serverName: string, serverConfig: McpStreamableHttpConfig) => {
    setServerStatusMap(prev => ({ 
        ...prev, 
        [serverName]: { status: 'testing', tools: [] } 
    }));
    
    try {
      console.log(`测试 MCP 服务器 "${serverName}" 连接 (HTTP):`, serverConfig);
      const toolsResult = await testMcpConnection(serverConfig);
      
      setServerStatusMap(prev => ({ 
          ...prev, 
          [serverName]: { status: 'success', tools: toolsResult }
      }));
      console.log(`MCP服务器 "${serverName}" 测试成功，可用工具:`, toolsResult);

    } catch (error) {
      console.error(`MCP服务器 "${serverName}" 测试失败:`, error);
      const errorMessage = error instanceof Error ? error.message : '测试连接失败';
      setServerStatusMap(prev => ({ 
          ...prev, 
          [serverName]: { status: 'error', tools: [], error: errorMessage } 
      }));
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
        isJsonValid = tryParseJson(mcpJsonStringInternal, false);
        if (isJsonValid) {
            finalMcpJson = mcpJsonStringInternal.trim();
        } else {
            setActiveTab('mcp');
            console.error("MCP JSON is invalid, cannot save.");
            return;
        }
    } else if (!isEditingJson) {
        finalMcpJson = formData.mcpConfigJson && formData.mcpConfigJson.trim() ? formData.mcpConfigJson.trim() : null;
        isJsonValid = true;
    } else {
        finalMcpJson = null;
        isJsonValid = true;
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

  useEffect(() => {
    if (parsedServers.length > 0) {
      console.log('======== 解析的服务器配置 ========');
      parsedServers.forEach(server => {
        console.log(`服务器: ${server.name}`);
        console.log(`配置:`, server.config);
        console.log(`可测试: ${isConfigTestable(server.config)}`);
        console.log('----------------------------');
      });
    }
  }, [parsedServers]);

  const handleConfigChange = (value: string) => {
    setFormData(prev => ({ ...prev, mcpConfigJson: value }));
    
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
                      <h3 className="text-lg font-medium">MCP 服务器配置 (仅支持 HTTP URL)</h3>
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
                                  const mcpStreamableHttpConfig = {
                                    mcpServers: {
                                      "heroku-mcp-server": {
                                        url: "https://mcpframework-http-server-94494a527897.herokuapp.com//mcp"
                                      }
                                    }
                                  };
                                  const exampleJson = JSON.stringify(mcpStreamableHttpConfig, null, 2);
                                  setMcpJsonStringInternal(exampleJson);
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    mcpConfigJson: exampleJson
                                  }));
                                  tryParseJson(exampleJson);
                                }}
                              >
                                <ExternalLink size={18} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>插入Streamable HTTP配置示例</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                      <HelpCircle className="h-4 w-4 !text-blue-800" />
                      <AlertTitle className="font-semibold">提示</AlertTitle>
                      <AlertDescription>
                        当前系统只支持连接和使用 JSON 配置中 `mcpServers` 对象里的 **第一个** 服务器及其工具。
                      </AlertDescription>
                    </Alert>
                    
                    {isEditingJson ? (
                      <>
                        <div className="relative">
                          <Label htmlFor="mcpConfigJson">
                            MCP 配置 JSON
                          </Label>
                          <Textarea
                            id="mcpConfigJson"
                            placeholder='{
  "mcpServers": {
    "<服务器名称>": { 
      "url": "<Streamable HTTP 服务器的完整 URL>",
      "headers": { "Optional-Header": "value" } 
    }
  }
}'
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
                          {parsedServers.map((server) => {
                            const currentStatus = serverStatusMap[server.name] || { status: 'idle', tools: [] };
                            return (
                              <Card key={server.name} className="overflow-hidden">
                                <CardHeader className="bg-muted/50 py-2 px-4">
                                  <div className="flex justify-between items-center">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                      <ExternalLink size={14} />
                                      {server.name}
                                    </CardTitle>
                                    
                                    {isConfigTestable(server.config) && (
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="flex gap-1 items-center h-7"
                                        onClick={() => handleTestConnection(server.name, server.config)}
                                        disabled={currentStatus.status === 'testing'}
                                      >
                                        {currentStatus.status === 'testing' ? (
                                          <>
                                            <Loader2 size={12} className="animate-spin" />
                                            <span>测试中</span>
                                          </>
                                        ) : (
                                          <>
                                            <PlugZap size={12} />
                                            <span>测试</span>
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </CardHeader>
                                <CardContent className="py-2 px-4 text-xs">
                                  <div className="font-mono bg-muted/30 p-2 rounded max-h-20 overflow-auto">
                                    <div><span className="text-blue-600">url:</span> {server.config.url}</div>
                                    {server.config.headers && (
                                      <div>
                                        <span className="text-blue-600">headers:</span>
                                        <pre className="mt-1 pl-2">
                                          {JSON.stringify(server.config.headers, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                                
                                {currentStatus.status === 'testing' && (
                                  <CardFooter className="bg-muted/20 py-2 px-4 text-xs border-t">
                                    <div className="w-full text-center">
                                      <Loader2 size={16} className="animate-spin mx-auto" />
                                      <p className="mt-1">连接服务器中...</p>
                                    </div>
                                  </CardFooter>
                                )}
                                
                                {currentStatus.status === 'success' && (
                                  <CardFooter className="bg-green-50 py-2 px-4 text-xs border-t">
                                    <div className="w-full">
                                      <div className="flex items-center gap-1 text-green-600 mb-1">
                                        <CheckCircle size={14} />
                                        <span>连接成功，发现 {currentStatus.tools.length} 个工具</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {currentStatus.tools.map(tool => (
                                          <Badge key={tool} variant="outline" className="bg-white">
                                            {tool}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </CardFooter>
                                )}
                                
                                {currentStatus.status === 'error' && (
                                  <CardFooter className="bg-red-50 py-2 px-4 text-xs border-t">
                                    <div className="w-full">
                                      <div className="flex items-center gap-1 text-red-600">
                                        <AlertCircle size={14} />
                                        <span>连接失败: {currentStatus.error}</span>
                                      </div>
                                    </div>
                                  </CardFooter>
                                )}
                              </Card>
                            )
                          })}
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