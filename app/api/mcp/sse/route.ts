import { NextResponse } from 'next/server';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// 创建基础的 MCP 服务器实例
console.log('创建 MCP 服务器实例...');
const server = new Server(
  {
    name: "example-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// 注册工具列表处理器
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log('处理工具列表请求');
  return {
    tools: [{
      name: "echo",
      description: "Echo back the input message",
      arguments: [{
        name: "message",
        description: "Message to echo",
        required: true
      }]
    }]
  };
});

// 注册工具调用处理器
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.log('处理工具调用请求:', request);
  if (request.params.name === "echo" && request.params.arguments && typeof request.params.arguments.message === 'string') {
    const response = {
      content: [{
        type: "text",
        text: `Echo: ${request.params.arguments.message}`
      }]
    };
    
    // 通过 transport 发送响应
    if (request.transport) {
      await request.transport.send({
        jsonrpc: "2.0",
        result: response,
        id: request.id
      });
    }
    
    return response;
  }
  throw new Error(`Invalid tool call: ${request.params.name}`);
});

// 存储活跃的传输连接
const transports: { [sessionId: string]: SSEServerTransport } = {};

export async function GET(req: Request) {
  console.log('收到 SSE 连接请求...');
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  try {
    // 创建一个完整的 response-like 对象
    const headers = new Map<string, string>();
    const customResponse = {
      write: (data: string) => {
        console.log('发送数据:', data);
        writer.write(encoder.encode(data));
      },
      end: () => {
        console.log('结束连接');
        writer.close();
      },
      writeHead: (statusCode: number, statusMessage?: string, headers?: Record<string, string>) => {
        console.log('写入头部:', statusCode, statusMessage, headers);
      },
      setHeader: (name: string, value: string) => {
        console.log('设置头部:', name, value);
        headers.set(name, value);
      },
      getHeader: (name: string) => {
        return headers.get(name);
      },
      removeHeader: (name: string) => {
        headers.delete(name);
      },
      addTrailers: () => {},
      setTimeout: () => {},
      statusCode: 200,
      statusMessage: 'OK',
      headersSent: false,
      sendDate: true,
      finished: false,
      connection: null,
      socket: null,
      on: (event: string, handler: () => void) => {
        console.log('注册事件:', event);
        if (event === 'close') {
          req.signal.addEventListener('abort', handler);
        }
      },
      once: (event: string, handler: () => void) => {
        console.log('注册一次性事件:', event);
        if (event === 'close') {
          req.signal.addEventListener('abort', handler, { once: true });
        }
      },
      emit: (event: string) => {
        console.log('触发事件:', event);
        return true;
      },
      writeContinue: () => {},
      writeProcessing: () => {}
    };

    // 创建 SSE 传输
    console.log('创建 SSE 传输...');
    const transport = new SSEServerTransport('/api/mcp/messages', customResponse as any);
    const sessionId = Math.random().toString(36).substring(7);
    transports[sessionId] = transport;

    // 连接服务器
    console.log('连接到 MCP 服务器...');
    await server.connect(transport);

    // 发送 sessionId 给客户端
    console.log('发送 sessionId:', sessionId);
    writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'connection', sessionId })}\n\n`));

    // 每 5 秒发送一个心跳
    const heartbeat = setInterval(() => {
      console.log('发送心跳...');
      writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`));
    }, 5000);

    // 当连接关闭时清理
    req.signal.addEventListener('abort', () => {
      console.log('连接关闭，清理资源...');
      clearInterval(heartbeat);
      delete transports[sessionId];
    });

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
      }
    });
  } catch (error) {
    console.error('SSE 错误:', error);
    return new NextResponse(
      `data: ${JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : 'Internal Server Error' })}\n\n`,
      { 
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
        }
      }
    );
  }
}

export async function POST(req: Request) {
  console.log('收到 POST 请求...');
  const sessionId = new URL(req.url).searchParams.get('sessionId');
  console.log('sessionId:', sessionId);
  
  const transport = sessionId ? transports[sessionId] : null;
  if (!transport) {
    console.error('未找到对应的传输连接');
    return NextResponse.json({ error: 'No transport found for sessionId' }, { status: 400 });
  }

  try {
    const body = await req.json();
    console.log('收到消息:', body);
    
    // 处理 echo 请求
    if (body.method === 'echo' && body.params?.message) {
      const response = {
        jsonrpc: "2.0" as const,
        result: {
          content: [{
            type: "text",
            text: `Echo: ${body.params.message}`
          }],
          _meta: {}
        },
        id: body.id || Date.now()
      };
      
      // 通过 transport 发送响应
      await transport.send(response);
    } else {
      // 使用默认的 JSON-RPC 格式发送消息
      await transport.send({
        jsonrpc: "2.0" as const,
        method: body.method || 'echo',
        params: body.params || {},
        id: body.id || Date.now()
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('处理消息错误:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to handle message' 
    }, { status: 500 });
  }
}