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

// 恢复子模块声明，并使用简单的定义以满足编译器
declare module '@modelcontextprotocol/sdk/client' {
  // export class Client {} // 或者使用 type = any
  export type Client = any;
}

declare module '@modelcontextprotocol/sdk/client/stdio' {
  // export class StdioClientTransport {} // 或者使用 type = any
  export type StdioClientTransport = any;
}

/*
declare module '@modelcontextprotocol/sdk/client/index' { 
  export * from '@modelcontextprotocol/sdk/client';
}
*/

export interface QueuedToolCall {
  id: string;              // 工具调用ID
  name: string;            // 工具名称
  args: any;               // 工具参数
  argsString?: string;     // 参数的原始字符串形式（用于累积参数）
  executed: boolean;       // 是否已执行
  result?: string;         // 执行结果
}

