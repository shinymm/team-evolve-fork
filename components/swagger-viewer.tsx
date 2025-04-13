'use client'

// import { useState, useEffect } from 'react'
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
// import { Loader2, AlertCircle } from 'lucide-react'

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
}

interface SwaggerViewerProps {
  spec: OpenAPISpec | null
}

export function SwaggerViewer({ spec }: SwaggerViewerProps) {
  // const [spec, setSpec] = useState<OpenAPISpec | null>(null);
  // const [isLoading, setIsLoading] = useState(false);
  // const [error, setError] = useState<string | null>(null);

  if (!spec) {
    return <div className="text-center text-gray-500 py-8">No API documentation provided.</div>;
  }

  const paths = spec.paths || {};
  const firstPathKey = Object.keys(paths)[0];
  const firstPath = firstPathKey ? paths[firstPathKey] : null;
  const firstMethodKey = firstPath ? Object.keys(firstPath)[0] : null;
  const operation = firstMethodKey && firstPath ? firstPath[firstMethodKey] : null;

  const requestBodySchema = operation?.requestBody?.content?.['application/json']?.schema;
  const responseSchema = operation?.responses?.['200']?.content?.['application/json']?.schema ??
                         operation?.responses?.['default']?.content?.['application/json']?.schema;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{spec.info?.title || 'API Documentation'} <span className="text-sm text-gray-400">v{spec.info?.version}</span></h3>
        {spec.info?.description && <p className="text-sm text-gray-500 mt-1">{spec.info.description}</p>}
      </div>

      {!firstPathKey || !firstMethodKey || !operation ? (
         <div className="text-center text-gray-500 py-4">No path information found in the specification.</div>
      ) : (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Request Endpoint</h4>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="uppercase">{firstMethodKey}</Badge>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm">{firstPathKey}</code>
            </div>
            {operation.summary && <p className="text-xs text-gray-500 mt-1">{operation.summary}</p>}
          </div>

          {requestBodySchema ? (
            <div>
              <h4 className="text-sm font-medium mb-1">Request Body Schema</h4>
              <ScrollArea className="h-[200px] max-h-[300px] rounded-md border p-4 bg-gray-50">
                <pre className="text-xs">{JSON.stringify(requestBodySchema, null, 2)}</pre>
              </ScrollArea>
            </div>
          ) : (
             <p className="text-xs text-gray-400">No request body defined for this operation.</p>
          )}

          {responseSchema ? (
            <div>
              <h4 className="text-sm font-medium mb-1">Response Schema (Success)</h4>
              <ScrollArea className="h-[200px] max-h-[300px] rounded-md border p-4 bg-gray-50">
                <pre className="text-xs">{JSON.stringify(responseSchema, null, 2)}</pre>
              </ScrollArea>
            </div>
           ) : (
             <p className="text-xs text-gray-400">No success response schema defined for this operation.</p>
           )}
        </div>
      )}
    </div>
  )
} 