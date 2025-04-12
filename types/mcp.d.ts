declare module 'mcp' {
  export class ClientSession {
    constructor(stdio: any, write: any);
    initialize(): Promise<void>;
    list_tools(): Promise<{ tools: any[] }>;
    call_tool(toolName: string, input: any): Promise<any>;
    close(): Promise<void>;
  }

  export class StdioServerParameters {
    constructor(options: {
      command: string;
      args: string[];
      env?: any;
    });
  }
}

declare module '@modelcontextprotocol/sdk' {
  export class ClientSession {
    constructor(stdio: any, write: any);
    initialize(): Promise<void>;
    list_tools(): Promise<{ tools: any[] }>;
    call_tool(toolName: string, input: any): Promise<any>;
    close(): Promise<void>;
  }

  export class StdioServerParameters {
    constructor(options: {
      command: string;
      args: string[];
      env?: any;
    });
  }
}

declare module '@modelcontextprotocol/sdk/client' {
  export class Client {
    constructor(clientInfo: { name: string; version: string }, options?: any);
    connect(transport: any, options?: any): Promise<void>;
    close(): Promise<void>;
    request(request: any, schema?: any, options?: any): Promise<any>;
    notification(notification: any): Promise<void>;
    ping(options?: any): Promise<void>;
    complete(params: any, options?: any): Promise<any>;
    getPrompt(params: any, options?: any): Promise<any>;
    listPrompts(params: any, options?: any): Promise<any>;
    listResources(params: any, options?: any): Promise<any>;
    listResourceTemplates(params: any, options?: any): Promise<any>;
    readResource(params: any, options?: any): Promise<any>;
    subscribeResource(params: any, options?: any): Promise<any>;
    unsubscribeResource(params: any, options?: any): Promise<any>;
    callTool(params: any, resultSchema?: any, options?: any): Promise<any>;
    listTools(params?: any, options?: any): Promise<{tools: any[]}>;
  }
}

declare module '@modelcontextprotocol/sdk/client/stdio' {
  export class StdioClientTransport {
    constructor(options: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    });
    connect(): Promise<void>;
    close(): Promise<void>;
    send(message: any): Promise<void>;
    receive(): Promise<any>;
    isOpen(): boolean;
    process?: any; // 子进程引用
  }
}

// 为所有ESM版本模块添加声明
declare module '@modelcontextprotocol/sdk/dist/esm/client/index.js' {
  export * from '@modelcontextprotocol/sdk/client';
}

declare module '@modelcontextprotocol/sdk/dist/esm/client/stdio.js' {
  export * from '@modelcontextprotocol/sdk/client/stdio';
}

declare module '@modelcontextprotocol/sdk/dist/esm/index.js' {
  export * from '@modelcontextprotocol/sdk';
}

