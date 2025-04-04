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
import { Pencil, Loader2, AlertCircle, CheckCircle, PlugZap } from 'lucide-react'

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

interface McpServerConfig {
  url?: string;
  command?: string;
  args?: string[];
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

  const handleTestConnection = async (serverName: string, serverConfig: McpServerConfig) => {
    console.log(`[handleTestConnection] Testing: ${serverName}, Config:`, serverConfig);
    setServerStatusMap(prev => ({
      ...prev,
      [serverName]: { status: 'testing', tools: [], error: undefined }
    }));

    try {
      if (!serverConfig.url) {
        console.warn(`[handleTestConnection] No URL for ${serverName}, skipping test.`);
        throw new Error('目前仅支持测试基于 URL 的 MCP Server');
      }

      console.log(`[handleTestConnection] Fetching API for URL: ${serverConfig.url}`);
      const response = await fetch('/api/mcp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: serverConfig.url }),
      });
      console.log(`[handleTestConnection] API response status: ${response.status}`);

      const result = await response.json();
      console.log(`[handleTestConnection] API response JSON:`, result);

      if (!response.ok) {
        console.error(`[handleTestConnection] API error for ${serverName}:`, result.error || `HTTP ${response.status}`);
        throw new Error(result.error || `连接失败 (HTTP ${response.status})`);
      }

      console.log(`[handleTestConnection] Success for ${serverName}. Tools:`, result.tools);
      setServerStatusMap(prev => ({
        ...prev,
        [serverName]: { status: 'success', tools: result.tools || [], error: undefined }
      }));

    } catch (error: any) {
      console.error(`[handleTestConnection] CATCH block error for ${serverName}:`, error);
      setServerStatusMap(prev => ({
        ...prev,
        [serverName]: { status: 'error', tools: [], error: error.message }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[60rem] w-[90%] max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-1 flex-shrink-0">
          <DialogTitle>{editingMember?.id ? '编辑' : '添加'}AI团队成员</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-2 pt-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">基础信息</TabsTrigger>
                <TabsTrigger value="skills">技能设定</TabsTrigger>
                <TabsTrigger value="mcp">MCP Servers</TabsTrigger>
              </TabsList>

              <div>
                <TabsContent value="info" className="space-y-3 mt-4">
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

                <TabsContent value="skills" className="space-y-3 mt-4">
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

                 <TabsContent value="mcp" className="space-y-4 mt-4">
                    {isEditingJson ? (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                           <Label htmlFor="mcpJson" className="block text-sm font-medium">
                             MCP Server 配置 (JSON)
                           </Label>
                        </div>

                        <Textarea
                          id="mcpJson"
                          rows={15}
                          placeholder='输入 JSON 配置，例如：\n{\n  "mcpServers": {\n    "youtube-transcript": {\n      "url": "http://localhost:8001/sse"\n    },\n    "another-server": {\n       "url": "https://example.com/mcp/sse" \n    }\n  }\n}'
                          value={mcpJsonStringInternal}
                          onChange={handleMcpJsonChange}
                          onBlur={() => tryParseJson(mcpJsonStringInternal)}
                          className="font-mono text-sm"
                        />
                        {jsonError && <p className="text-red-500 text-sm mt-1">{jsonError}</p>}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={handleEditJson}>
                                <Pencil className="h-4 w-4 mr-1" /> 编辑 JSON
                            </Button>
                        </div>
                        {parsedServers.length === 0 && <p className="text-sm text-gray-500 text-center py-4">JSON 中未配置 MCP 服务器或 JSON 为空。</p>}
                        {parsedServers.map((server) => {
                          const status = serverStatusMap[server.name] || { status: 'idle', tools: [] };
                          return (
                            <Card key={server.name}>
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
                                <CardTitle className="text-base font-medium leading-none">{server.name}</CardTitle>
                                <div className="flex items-center space-x-2">
                                  {status.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                  {status.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                                  {status.status === 'idle' && <span className="text-xs text-gray-400">未测试</span>}

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={(e) => {
                                      console.log(`Testing connection for: ${server.name}`);
                                      e.stopPropagation();
                                      handleTestConnection(server.name, server.config);
                                    }}
                                    disabled={status.status === 'testing' || !server.config.url}
                                    title={!server.config.url ? "仅支持测试基于 URL 的服务器" : "测试连接"}
                                 >
                                   {status.status === 'testing' ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                   ) : (
                                      <PlugZap className="h-4 w-4" />
                                   )}
                                 </Button>
                                </div>
                              </CardHeader>

                              <CardContent className="pt-1 pb-3 px-4">
                                 {server.config.url && <p className="text-xs text-muted-foreground break-all">URL: {server.config.url}</p>}
                                 {server.config.command && <p className="text-xs text-muted-foreground truncate">Command: {server.config.command} {server.config.args?.join(' ')}</p>}

                                 <div className="mt-2">
                                    <h4 className="text-xs font-medium mb-1 text-gray-600">可用工具:</h4>
                                    {status.status === 'testing' && <span className='text-xs text-muted-foreground'>正在加载...</span>}
                                    {status.status === 'success' && (
                                        status.tools.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {status.tools.map(tool => <Badge key={tool} variant="secondary" className="text-xs font-normal">{tool}</Badge>)}
                                            </div>
                                        ) : (
                                            <span className='text-xs text-muted-foreground'>未发现工具</span>
                                        )
                                    )}
                                    {status.status === 'error' && <span className='text-xs text-red-500'>加载失败: {status.error}</span>}
                                    {status.status === 'idle' && <span className='text-xs text-muted-foreground'>点击测试获取</span>}
                                 </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
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