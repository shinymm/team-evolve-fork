'use client'

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { swaggerDocs, type SwaggerDocs } from "@/lib/swagger-docs"

interface SwaggerViewerProps {
  endpoint: keyof SwaggerDocs
}

export function SwaggerViewer({ endpoint }: SwaggerViewerProps) {
  const spec = swaggerDocs[endpoint]
  if (!spec) return null
  
  const paths = spec.paths as any
  const path = Object.keys(paths)[0]
  const method = Object.keys(paths[path])[0]
  const operation = paths[path][method]
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">API 文档</h3>
        <p className="text-sm text-gray-500 mt-1">{spec.info.description}</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-1">请求地址</h4>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="uppercase">{method}</Badge>
            <code className="bg-gray-100 px-2 py-1 rounded text-sm">{path}</code>
          </div>
        </div>
        
        {operation.requestBody && (
          <div>
            <h4 className="text-sm font-medium mb-1">请求体</h4>
            <ScrollArea className="h-[200px] rounded-md border p-4">
              <pre className="text-xs">{JSON.stringify(operation.requestBody.content['application/json'].schema, null, 2)}</pre>
            </ScrollArea>
          </div>
        )}
        
        <div>
          <h4 className="text-sm font-medium mb-1">响应</h4>
          <ScrollArea className="h-[200px] rounded-md border p-4">
            <pre className="text-xs">{JSON.stringify(operation.responses['200'].content['application/json'].schema, null, 2)}</pre>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
} 