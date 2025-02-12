'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { swaggerDocs, type SwaggerDocs } from "@/lib/swagger-docs"

interface SwaggerViewerProps {
  isOpen: boolean
  onClose: () => void
  endpoint: keyof SwaggerDocs
}

export function SwaggerViewer({ isOpen, onClose, endpoint }: SwaggerViewerProps) {
  const spec = swaggerDocs[endpoint]
  if (!spec) return null
  
  const paths = spec.paths as any
  const path = Object.keys(paths)[0]
  const method = Object.keys(paths[path])[0]
  const operation = paths[path][method]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh]">
        <DialogHeader>
          <DialogTitle>{spec.info.title}</DialogTitle>
          <DialogDescription id="dialog-description">
            {spec.info.description || `查看 ${path} 接口的详细信息`}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-full pr-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">基本信息</h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500">接口路径：</span>
                  <code className="px-2 py-1 bg-gray-100 rounded text-sm">{path}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500">请求方法：</span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                    {method.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500">版本：</span>
                  <span className="text-sm">{spec.info.version}</span>
                </div>
              </div>
            </div>

            {/* 请求参数部分 */}
            {operation.requestBody && (
              <div>
                <h3 className="text-sm font-medium mb-2">请求参数</h3>
                <div className="border rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">参数名</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">必填</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">描述</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.entries(operation.requestBody.content['application/json'].schema.properties).map(([name, prop]: [string, any]) => (
                        <tr key={name}>
                          <td className="px-4 py-2 text-sm font-medium">{name}</td>
                          <td className="px-4 py-2 text-sm">{prop.type}</td>
                          <td className="px-4 py-2 text-sm">
                            {operation.requestBody.content['application/json'].schema.required?.includes(name) ? '是' : '否'}
                          </td>
                          <td className="px-4 py-2 text-sm">{prop.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 响应示例部分 */}
            {operation.responses && (
              <div>
                <h3 className="text-sm font-medium mb-2">响应示例</h3>
                <div className="space-y-2">
                  {Object.entries(operation.responses).map(([code, response]) => (
                    <div key={code}>
                      <h4 className="text-xs font-medium text-gray-500 mb-1">
                        {code === '200' ? '成功响应' : '错误响应'} ({code})
                      </h4>
                      <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto">
                        {JSON.stringify(response, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
} 