'use client'

import { useState, useEffect } from 'react'
import { Eye, Bell, ChevronRight, X, Loader2, Settings } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { SwaggerViewer } from "@/components/swagger-viewer"
// import { SwaggerDocs } from "@/lib/swagger-docs" // No longer needed if swaggerEndpoint is just a string
// import { SubscriptionViewer } from "@/components/subscription-viewer" // Removed subscription feature
import { useSystemStore } from '@/lib/stores/system-store'; // Import system store
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Define APIInterface type locally, including swaggerDoc
interface APIInterface {
  id: string;
  systemId: string;
  name: string;
  description: string;
  type: string;
  endpoint: string;
  operation: string;
  swaggerEndpoint: string | null; // Still keep it, might be used elsewhere or for reference
  swaggerDoc: any | null; // Store the actual spec object
  createdAt: string; // Or Date
  updatedAt: string; // Or Date
}

// Define a detailed type for the Swagger spec, matching SwaggerViewer
// Remove the old simple type: type OpenAPISpec = Record<string, any> | null;
interface OpenAPISpec {
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: {
    [path: string]: {
      [method: string]: {
        summary?: string;
        description?: string;
        requestBody?: {
          content: {
            [contentType: string]: {
              schema: any;
            };
          };
        };
        responses: {
          [statusCode: string]: {
            description?: string;
            content?: {
              [contentType: string]: {
                schema: any;
              };
            };
          };
        };
      };
    };
  };
  // Add other OpenAPI fields as needed
}

export default function APIInterfacesPage() {
  const [interfaces, setInterfaces] = useState<APIInterface[]>([])
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State to track which API's doc is selected and the doc content itself
  const [selectedApiIdForDoc, setSelectedApiIdForDoc] = useState<string | null>(null);
  // Allow state to be OpenAPISpec OR null
  const [selectedSwaggerDoc, setSelectedSwaggerDoc] = useState<OpenAPISpec | null>(null);

  const { systems, selectedSystemId } = useSystemStore();
  const { toast } = useToast();
  const currentSystem = systems.find(sys => sys.id === selectedSystemId);

  useEffect(() => {
    const fetchApiInterfaces = async () => {
      if (!selectedSystemId) {
        setInterfaces([]);
        setIsLoading(false);
        setError(null);
        setSelectedApiIdForDoc(null); // Reset selection on system change
        setSelectedSwaggerDoc(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      setSelectedApiIdForDoc(null); // Reset selection
      setSelectedSwaggerDoc(null);
      try {
        const response = await fetch(`/api/systems/${selectedSystemId}/api-interfaces`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch API interfaces (${response.status})`);
        }
        const data: APIInterface[] = await response.json();
        setInterfaces(data);
      } catch (err) {
        console.error('Failed to fetch API interfaces:', err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(errorMessage);
        toast({
          title: "获取失败",
          description: errorMessage,
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchApiInterfaces();
  }, [selectedSystemId, toast]);

  const handleToggleSwaggerDoc = (api: APIInterface) => {
    // 检查 swaggerDoc 是否存在
    if (!api.swaggerDoc) {
      toast({
        title: "无法显示文档",
        description: "此API接口没有关联有效的Swagger文档内容。",
        variant: "destructive"
      });
      // 确保取消选择
      if (selectedApiIdForDoc === api.id) {
          setSelectedApiIdForDoc(null);
          setSelectedSwaggerDoc(null);
      }
      return;
    }

    // 如果这个 API 的文档已经选中，则取消选择
    if (selectedApiIdForDoc === api.id) {
      setSelectedApiIdForDoc(null);
      setSelectedSwaggerDoc(null);
    } else {
      try {
        // 判断 swaggerDoc 是字符串还是对象
        let parsedDoc: OpenAPISpec;
        
        if (typeof api.swaggerDoc === 'string') {
          // 如果是字符串，尝试 JSON 解析
          parsedDoc = JSON.parse(api.swaggerDoc) as OpenAPISpec;
        } else if (typeof api.swaggerDoc === 'object') {
          // 如果已经是对象，直接使用
          parsedDoc = api.swaggerDoc as OpenAPISpec;
        } else {
          throw new Error(`Unexpected swaggerDoc type: ${typeof api.swaggerDoc}`);
        }
        
        // 基本验证
        if (!parsedDoc || typeof parsedDoc !== 'object' || !parsedDoc.info || !parsedDoc.paths) {
          console.warn('swaggerDoc 缺少必要的信息：', parsedDoc);
          throw new Error("文档内容格式不符合OpenAPI规范。");
        }
        
        // 设置状态
        setSelectedApiIdForDoc(api.id);
        setSelectedSwaggerDoc(parsedDoc);
      } catch (parseError) {
        console.error("处理 swaggerDoc 时出错:", parseError);
        console.log("问题的 swaggerDoc 内容:", api.swaggerDoc);
        console.log("swaggerDoc 类型:", typeof api.swaggerDoc);
        toast({
          title: "无法解析文档",
          description: `Swagger文档内容无效或格式错误: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          variant: "destructive"
        });
        // 确保取消选择
        setSelectedApiIdForDoc(null);
        setSelectedSwaggerDoc(null);
      }
    }
  };

  const getTypeColor = (type: APIInterface['type']) => {
    const colors: Record<string, string> = {
      'REST': 'bg-blue-50 text-blue-700',
      'Kafka': 'bg-green-50 text-green-700',
      'RPC': 'bg-purple-50 text-purple-700',
      'GraphQL': 'bg-pink-50 text-pink-700'
    }
    return colors[type] || 'bg-gray-50 text-gray-700'
  }

  if (!selectedSystemId) {
    return (
      <div className="w-[90%] mx-auto py-8">
        <p className="text-gray-500 text-center">请先从左侧选择一个系统以查看其API接口。</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-[90%] mx-auto py-8 flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-[90%] mx-auto py-8">
        <p className="text-red-500 text-center">加载API接口失败: {error}</p>
      </div>
    );
  }

  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{currentSystem?.name || '系统'} - API开放接口</h1>
        <p className="mt-2 text-sm text-gray-500">
          这里展示了系统 <span className='font-medium'>{currentSystem?.name}</span> 对外开放的API接口。
        </p>
      </div>
      
      {interfaces.length === 0 ? (
        <div className="text-center text-gray-500 py-10">
          该系统暂无定义的API接口。
          {/* TODO: Add a button or link to add interfaces? */}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {interfaces.map((api) => (
            <div key={api.id} className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
              <div className="p-6 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-medium text-gray-900">{api.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(api.type)}`}>
                        {api.type}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{api.description}</p>
                    <div className="mt-2 text-sm text-gray-700">
                      <span className="font-medium">{api.operation}</span> {api.endpoint}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {/* Button now toggles based on swaggerDoc presence and selection state */}
                    {api.swaggerDoc && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleToggleSwaggerDoc(api)}
                        disabled={!api.swaggerDoc} // Disable if no doc
                        title={!api.swaggerDoc ? "无可用文档" : (selectedApiIdForDoc === api.id ? '隐藏文档' : '查看文档')}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {selectedApiIdForDoc === api.id ? '隐藏文档' : '查看文档'}
                      </Button>
                    )}
                    {!api.swaggerDoc && api.swaggerEndpoint && (
                       <Button variant="outline" size="sm" disabled title="无嵌入式文档">
                         <Eye className="mr-2 h-4 w-4 text-gray-400" />
                         <span className="text-gray-400">无文档</span>
                       </Button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Conditionally render SwaggerViewer for the selected API */}
              {selectedApiIdForDoc === api.id && (
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                  <div className="flex justify-end mb-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleToggleSwaggerDoc(api)} // Use the same toggle function
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    {/* Pass the selected swaggerDoc content as the spec prop */}
                    <SwaggerViewer spec={selectedSwaggerDoc} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 