/**
 * MCP 客户端库
 * 用于与后端 MCP API 交互
 */

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface McpServerConfig {
  command: string;
  args: string[];
}

export interface McpSessionInfo {
  sessionId: string;
  tools: McpTool[];
}

/**
 * 测试 MCP 服务器连接
 * @param config 服务器配置
 * @returns 可用工具列表
 */
export async function testMcpConnection(config: McpServerConfig): Promise<string[]> {
  console.log('[MCP客户端] 测试连接:', config);
  
  const response = await fetch('/api/mcp/test-connection', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `连接失败 (${response.status})`);
  }
  
  const result = await response.json();
  return result.tools;
}

/**
 * MCP 会话客户端
 * 用于创建会话并调用工具
 */
export class McpSession {
  private sessionId: string | null = null;
  private tools: McpTool[] = [];
  
  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.sessionId !== null;
  }
  
  /**
   * 获取可用工具列表
   */
  getTools(): McpTool[] {
    return this.tools;
  }
  
  /**
   * 获取会话ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
  
  /**
   * 创建 MCP 会话
   * @param config 服务器配置
   */
  async connect(config: McpServerConfig): Promise<McpSessionInfo> {
    console.log('[MCP客户端] 创建会话:', config);
    
    const response = await fetch('/api/mcp/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `创建会话失败 (${response.status})`);
    }
    
    const session = await response.json();
    this.sessionId = session.sessionId;
    this.tools = session.tools;
    
    return session;
  }
  
  /**
   * 调用 MCP 工具
   * @param toolName 工具名称
   * @param input 工具输入
   */
  async callTool(toolName: string, input: any): Promise<any> {
    if (!this.sessionId) {
      throw new Error('未连接到 MCP 服务器');
    }
    
    console.log(`[MCP客户端] 调用工具 "${toolName}":`, input);
    
    const response = await fetch('/api/mcp/tool', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: this.sessionId,
        toolName,
        input
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `工具调用失败 (${response.status})`);
    }
    
    return response.json();
  }
  
  /**
   * 关闭 MCP 会话
   */
  async close(): Promise<void> {
    if (!this.sessionId) {
      return;
    }
    
    console.log(`[MCP客户端] 关闭会话: ${this.sessionId}`);
    
    try {
      await fetch(`/api/mcp/session?sessionId=${this.sessionId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('[MCP客户端] 关闭会话出错:', error);
    } finally {
      this.sessionId = null;
      this.tools = [];
    }
  }
}

/**
 * 创建 MCP 会话
 */
export function createMcpSession(): McpSession {
  return new McpSession();
}

/**
 * 从 JSON 字符串解析 MCP 配置
 * @param json MCP 配置 JSON 字符串
 * @returns 解析后的配置，如果解析失败则返回 null
 */
export function parseMcpConfig(json: string | null | undefined): Record<string, McpServerConfig> | null {
  if (!json) {
    return null;
  }
  
  try {
    const config = JSON.parse(json);
    if (config && typeof config === 'object' && config.mcpServers && typeof config.mcpServers === 'object') {
      return config.mcpServers;
    }
    return null;
  } catch (error) {
    console.error('[MCP客户端] 解析配置失败:', error);
    return null;
  }
} 