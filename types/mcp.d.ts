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

declare module '@modelcontextprotocol/sdk/client/stdio' {
  export function stdio_client(params: any): Promise<[any, any]>;
}

declare module 'mcp/dist/client/stdio' {
  export function stdio_client(params: any): Promise<[any, any]>;
}

declare module '@mintlify/mcp/src/client/stdio' {
  export function stdio_client(params: any): Promise<[any, any]>;
}

declare module '@modelcontextprotocol/sdk/dist/esm/client/stdio' {
  export function stdio_client(params: any): Promise<[any, any]>;
} 