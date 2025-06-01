import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { encrypt, decrypt } from '@/lib/utils/encryption-utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslations } from 'next-intl'

export interface MemberFormData {
  id?: string
  name: string
  introduction: string
  role: string
  responsibilities: string
  greeting?: string | null
  category?: string | null
  mcpConfigJson?: string | null
  aiModelName?: string | null
  aiModelBaseUrl?: string | null
  aiModelApiKey?: string | null
  aiModelTemperature?: number | null
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

// 可用的AI模型预设
const modelPresets = [
  {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-4o','gpt-4o-mini','gpt-3.5-turbo']
  },
  {
    name: '智谱AI',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-long', 'glm-4-flash', 'glm-4-plus', 'GLM-Zero-Preview']
  },
  {
    name: 'Qwen',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-long']
  },
  {
    name: 'Deepseek',
    baseURL: 'https://api.deepseek.com',
    models: ['deepseek-chat']
  },
  {
    name: 'Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash-lite','gemini-2.0-flash-thinking-exp-01-21']
  }
]

const jsonTemplate = `{
  "mcpServers": {
    "<server-name>": { 
      "url": "<Complete URL of Streamable HTTP server>",
      "headers": { "Optional-Header": "value" } 
    }
  }
}`;

export function MemberFormDialog({
  open,
  onOpenChange,
  editingMember,
  onSubmit,
  onClose,
}: MemberFormDialogProps) {
  const t = useTranslations('MemberFormDialog')
  const [formData, setFormData] = useState<MemberFormData>({
    name: '',
    introduction: '',
    role: '',
    responsibilities: '',
    greeting: '',
    category: '',
    mcpConfigJson: '',
    aiModelName: '',
    aiModelBaseUrl: '',
    aiModelApiKey: '',
    aiModelTemperature: 0.2
  })

  const [mcpJsonStringInternal, setMcpJsonStringInternal] = useState('');
  const [parsedServers, setParsedServers] = useState<ParsedMcpServer[]>([]);
  const [serverStatusMap, setServerStatusMap] = useState<Record<string, ServerStatus>>({});
  const [isEditingJson, setIsEditingJson] = useState(true);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('info');

  // 新增模型相关状态
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [decryptedApiKey, setDecryptedApiKey] = useState('')
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptError, setDecryptError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      const initialData = editingMember || {
        name: '',
        introduction: '',
        role: '',
        responsibilities: '',
        greeting: '',
        category: '',
        mcpConfigJson: '',
        aiModelName: '',
        aiModelBaseUrl: '',
        aiModelApiKey: '',
        aiModelTemperature: 0.2
      };
      setFormData({
        ...initialData,
        greeting: initialData.greeting || '',
        category: initialData.category || '',
        mcpConfigJson: initialData.mcpConfigJson || '',
        aiModelName: initialData.aiModelName || '',
        aiModelBaseUrl: initialData.aiModelBaseUrl || '',
        aiModelApiKey: initialData.aiModelApiKey || '',
        aiModelTemperature: initialData.aiModelTemperature || 0.2,
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

      // 如果有API Key，尝试解密
      if (initialData.aiModelApiKey) {
        handleDecryptApiKey(initialData.aiModelApiKey);
      } else {
        setDecryptedApiKey('');
      }

      // 尝试匹配预设提供商
      if (initialData.aiModelBaseUrl) {
        const provider = modelPresets.find(p => p.baseURL === initialData.aiModelBaseUrl);
        if (provider) {
          setSelectedProvider(provider.name);
          // 如果当前模型名称存在于选中的提供商的模型列表中，设置为选中
          if (initialData.aiModelName && provider.models.includes(initialData.aiModelName)) {
            setSelectedModel(initialData.aiModelName);
          } else {
            setSelectedModel(null);
          }
        } else {
          setSelectedProvider(null);
          setSelectedModel(null);
        }
      } else {
        setSelectedProvider(null);
        setSelectedModel(null);
      }

      setActiveTab('info');
    } else {
      setFormData({ 
        name: '', 
        introduction: '', 
        role: '', 
        responsibilities: '', 
        greeting: '', 
        category: '', 
        mcpConfigJson: '',
        aiModelName: '',
        aiModelBaseUrl: '',
        aiModelApiKey: '',
        aiModelTemperature: 0.2
      });
      setMcpJsonStringInternal('');
      setParsedServers([]);
      setServerStatusMap({});
      setIsEditingJson(true);
      setJsonError(null);
      setDecryptedApiKey('');
      setSelectedProvider(null);
      setSelectedModel(null);
      setDecryptError(null);
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
             throw new Error(t('errors.invalidServerConfig', { name }));
           }
        }
        setParsedServers(servers);
        setIsEditingJson(false);
        setFormData(prev => ({ ...prev, mcpConfigJson: jsonStr.trim() }));
        return true;
      } else {
        throw new Error(t('errors.invalidJsonStructure'));
      }
    } catch (error: any) {
      setJsonError(t('errors.jsonParseError', { message: error.message }));
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

    // 处理API密钥的加密
    let encryptedApiKey: string | null = null;
    if (decryptedApiKey.trim()) {
      try {
        encryptedApiKey = await encrypt(decryptedApiKey.trim());
      } catch (error) {
        console.error('加密API Key失败:', error);
        setActiveTab('model');
        setDecryptError('无法加密API密钥，请稍后重试');
        return;
      }
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
        aiModelName: formData.aiModelName || null,
        aiModelBaseUrl: formData.aiModelBaseUrl || null,
        aiModelApiKey: encryptedApiKey,
        aiModelTemperature: formData.aiModelTemperature
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

  // 处理模型提供商选择
  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    const provider = modelPresets.find(p => p.name === value);
    if (provider) {
      setFormData(prev => ({
        ...prev,
        aiModelBaseUrl: provider.baseURL,
        aiModelName: ''
      }));
      setSelectedModel(null);
    }
  }

  // 处理模型选择
  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    setFormData(prev => ({
      ...prev,
      aiModelName: value
    }));
  }

  // 温度滑块变化
  const handleTemperatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setFormData(prev => ({
      ...prev,
      aiModelTemperature: value
    }));
  }

  // API Key变化时的处理
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDecryptedApiKey(value);
  }

  // 尝试解密API Key
  const handleDecryptApiKey = async (encryptedKey: string) => {
    if (!encryptedKey) {
      setDecryptedApiKey('');
      return;
    }

    setIsDecrypting(true);
    setDecryptError(null);
    
    try {
      const decrypted = await decrypt(encryptedKey);
      setDecryptedApiKey(decrypted);
    } catch (error) {
      console.error('解密API Key失败:', error);
      setDecryptError('无法解密API Key，请重新输入');
      setDecryptedApiKey('');
    } finally {
      setIsDecrypting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[60rem] w-[90%] h-[90vh] flex flex-col">
        <DialogHeader className="pb-1 flex-shrink-0">
          <DialogTitle>{editingMember?.id ? t('title.edit') : t('title.add')}</DialogTitle>
          <DialogDescription>
            {editingMember?.id ? t('description.edit') : t('description.add')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden pt-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
                <TabsTrigger 
                  value="info"
                  className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                >
                  {t('tabs.info')}
                </TabsTrigger>
                <TabsTrigger 
                  value="skills"
                  className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                >
                  {t('tabs.skills')}
                </TabsTrigger>
                <TabsTrigger 
                  value="model"
                  className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                >
                  {t('tabs.model')}
                </TabsTrigger>
                <TabsTrigger 
                  value="mcp"
                  className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                >
                  {t('tabs.mcp')}
                </TabsTrigger>
              </TabsList>

              <div className="overflow-y-auto flex-grow px-1">
                <TabsContent value="info" className="space-y-3 mt-4 h-full p-1">
                   <div className="space-y-1">
                    <Label htmlFor="name">{t('basicInfo.name')} *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      maxLength={50}
                      placeholder={t('placeholders.name')}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="introduction">{t('basicInfo.introduction')} *</Label>
                    <div className="relative">
                      <Textarea
                        id="introduction"
                        name="introduction"
                        value={formData.introduction}
                        onChange={handleInputChange}
                        required
                        maxLength={200}
                        placeholder={t('placeholders.introduction')}
                        className="min-h-[60px] resize-none text-sm"
                        rows={3}
                      />
                      <span className="absolute bottom-2 right-2 text-xs text-gray-400">
                        {formData.introduction.length}/200
                      </span>
                    </div>
                  </div>
                   <div className="space-y-1.5">
                    <Label htmlFor="category">{t('basicInfo.category')}</Label>
                    <Input
                      id="category"
                      name="category"
                      value={formData.category || ''}
                      onChange={handleInputChange}
                      placeholder={t('placeholders.category')}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="greeting">{t('basicInfo.greeting')}</Label>
                    <div className="relative">
                      <Textarea
                        id="greeting"
                        name="greeting"
                        value={formData.greeting || ''}
                        onChange={handleInputChange}
                        maxLength={200}
                        placeholder={t('placeholders.greeting')}
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
                    <Label htmlFor="role">{t('skills.role')} *</Label>
                    <Textarea
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      required
                      placeholder={t('skillsPlaceholders.role')}
                      className="min-h-[100px] resize-none text-sm"
                      rows={4}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="responsibilities">{t('skills.responsibilities')} *</Label>
                    <Textarea
                      id="responsibilities"
                      name="responsibilities"
                      value={formData.responsibilities}
                      onChange={handleInputChange}
                      required
                      placeholder={t('skillsPlaceholders.responsibilities')}
                      className="min-h-[200px] resize-none text-sm"
                      rows={8}
                    />
                  </div>
                </TabsContent>

                 <TabsContent value="model" className="overflow-y-auto flex-grow pt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium">{t('modelConfig.title')}</h3>
                      <p className="text-sm text-gray-500">
                        {t('modelConfig.description')}
                      </p>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="modelProvider">{t('modelConfig.provider')}</Label>
                          <Select 
                            value={selectedProvider || ''} 
                            onValueChange={handleProviderChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('modelConfig.provider')} />
                            </SelectTrigger>
                            <SelectContent>
                              {modelPresets.map((provider) => (
                                <SelectItem key={provider.name} value={provider.name}>
                                  {provider.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="baseUrl">{t('modelConfig.baseUrl')}</Label>
                          <Input
                            id="baseUrl"
                            name="aiModelBaseUrl"
                            value={formData.aiModelBaseUrl || ''}
                            onChange={handleInputChange}
                            placeholder="https://api.example.com/v1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="modelName">{t('modelConfig.modelName')}</Label>
                          {selectedProvider ? (
                            <Select 
                              value={selectedModel || ''} 
                              onValueChange={handleModelChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('modelConfig.modelName')} />
                              </SelectTrigger>
                              <SelectContent>
                                {modelPresets
                                  .find(p => p.name === selectedProvider)
                                  ?.models.map((model) => (
                                    <SelectItem key={model} value={model}>
                                      {model}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id="modelName"
                              name="aiModelName"
                              value={formData.aiModelName || ''}
                              onChange={handleInputChange}
                              placeholder={t('modelConfig.modelName')}
                            />
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="apiKey">{t('modelConfig.apiKey')}</Label>
                          <div className="relative">
                            <Input
                              id="apiKey"
                              type="password"
                              value={decryptedApiKey}
                              onChange={handleApiKeyChange}
                              placeholder="sk-xxxx..."
                              disabled={isDecrypting}
                            />
                            {isDecrypting && (
                              <div className="absolute right-3 top-2">
                                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                              </div>
                            )}
                          </div>
                          {decryptError && (
                            <p className="text-sm text-red-500">{t('modelConfig.errors.decryptFailed')}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label htmlFor="temperature">{t('modelConfig.temperature')} ({formData.aiModelTemperature || 0.2})</Label>
                          <span className="text-sm text-gray-500">{t('modelConfig.temperatureHint')}</span>
                        </div>
                        <Input
                          id="temperature"
                          name="aiModelTemperature"
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={formData.aiModelTemperature || 0.2}
                          onChange={handleTemperatureChange}
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{t('modelConfig.temperatureLabels.precise')}</span>
                          <span>{t('modelConfig.temperatureLabels.creative')}</span>
                        </div>
                      </div>
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{t('modelConfig.notice.title')}</AlertTitle>
                      <AlertDescription>
                        {t('modelConfig.notice.description')}
                      </AlertDescription>
                    </Alert>
                  </div>
                </TabsContent>

                <TabsContent value="mcp" className="space-y-4 mt-4 h-full p-1">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">{t('mcpConfig.title')}</h3>
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
                                <p>{t('mcpConfig.tooltips.savePreview')}</p>
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
                                <p>{t('mcpConfig.tooltips.editJson')}</p>
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
                                        url: "https://mcpframework-http-server-94494a527897.herokuapp.com/mcp"
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
                              <p>{t('mcpConfig.tooltips.insertExample')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                      <HelpCircle className="h-4 w-4 !text-blue-800" />
                      <AlertTitle className="font-semibold">{t('mcpConfig.notice.title')}</AlertTitle>
                      <AlertDescription>
                        {t('mcpConfig.notice.description')}
                      </AlertDescription>
                    </Alert>
                    
                    {isEditingJson ? (
                      <>
                        <div className="relative">
                          <Label htmlFor="mcpConfigJson">
                            {t('mcpConfig.jsonEditor.label')}
                          </Label>
                          <Textarea
                            id="mcpConfigJson"
                            placeholder={jsonTemplate}
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
                                            <span>{t('mcpConfig.serverCard.testing')}</span>
                                          </>
                                        ) : (
                                          <>
                                            <PlugZap size={12} />
                                            <span>{t('mcpConfig.serverCard.testButton')}</span>
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
                                      <p className="mt-1">{t('mcpConfig.serverCard.connectingMessage')}</p>
                                    </div>
                                  </CardFooter>
                                )}
                                
                                {currentStatus.status === 'success' && (
                                  <CardFooter className="bg-green-50 py-2 px-4 text-xs border-t">
                                    <div className="w-full">
                                      <div className="flex items-center gap-1 text-green-600 mb-1">
                                        <CheckCircle size={14} />
                                        <span>{t('mcpConfig.serverCard.successMessage', { count: currentStatus.tools.length })}</span>
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
                                        <span>{t('mcpConfig.serverCard.connectionFailed', { error: currentStatus.error || '' })}</span>
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
              {t('buttons.cancel')}
            </Button>
            <Button type="button" onClick={() => handleFinalSubmit()}>
              {editingMember?.id ? t('buttons.update') : t('buttons.save')}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 