/**
 * Model Context Protocol (MCP) 客户端 SDK
 * 基于官方 MCP 协议规范 (https://modelcontextprotocol.io/quickstart/client)
 */

export interface McpServerConfig {
  command: string;
  args: string[];
}

export interface McpToolDescription {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface McpSessionInfo {
  sessionId: string;
  port: number;
  tools: string[];
}

export interface McpToolResult {
  content: any;
  [key: string]: any;
}

/**
 * MCP 客户端类
 * 用于连接和管理 MCP 服务器
 */
export class McpClient {
  private baseUrl: string;
  private sessionInfo: McpSessionInfo | null = null;

  /**
   * 创建新的 MCP 客户端实例
   * @param baseUrl API 基础URL，默认为当前域名
   */
  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  }

  /**
   * 连接到 MCP 服务器
   * @param config 服务器配置
   * @param sessionId 可选的会话ID，用于复用已有会话
   * @returns 会话信息，包含端口和可用工具
   */
  async connect(config: McpServerConfig, sessionId?: string): Promise<McpSessionInfo> {
    console.log('[McpClient] 连接到服务器, 配置:', config);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: config.command,
          args: config.args,
          sessionId
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`连接失败: ${error.error || response.statusText}`);
      }
      
      const sessionInfo = await response.json() as McpSessionInfo;
      this.sessionInfo = sessionInfo;
      console.log('[McpClient] 连接成功, 会话信息:', this.sessionInfo);
      
      return sessionInfo;
    } catch (error) {
      console.error('[McpClient] 连接错误:', error);
      throw error;
    }
  }

  /**
   * 获取当前会话信息
   * @returns 会话信息
   */
  getSessionInfo(): McpSessionInfo | null {
    return this.sessionInfo;
  }

  /**
   * 检查是否已连接
   * @returns 是否已连接
   */
  isConnected(): boolean {
    return this.sessionInfo !== null;
  }

  /**
   * 获取可用工具列表
   * @returns 工具名称数组
   */
  getAvailableTools(): string[] {
    return this.sessionInfo?.tools || [];
  }

  /**
   * 调用工具
   * @param tool 工具名称
   * @param input 工具输入参数
   * @returns 工具执行结果
   */
  async callTool(tool: string, input: any): Promise<McpToolResult> {
    if (!this.isConnected()) {
      throw new Error('未连接到 MCP 服务器');
    }
    
    if (!this.sessionInfo?.tools.includes(tool)) {
      throw new Error(`工具 "${tool}" 不可用，可用工具: ${this.sessionInfo?.tools.join(', ')}`);
    }
    
    console.log(`[McpClient] 调用工具 "${tool}", 输入:`, input);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionInfo.sessionId,
          tool,
          input
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`工具调用失败: ${error.error || response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`[McpClient] 工具 "${tool}" 调用成功, 结果:`, result);
      
      return result;
    } catch (error) {
      console.error(`[McpClient] 工具 "${tool}" 调用错误:`, error);
      throw error;
    }
  }

  /**
   * 关闭会话
   * @returns 是否成功关闭
   */
  async disconnect(): Promise<boolean> {
    if (!this.isConnected() || !this.sessionInfo) {
      return true;
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/client?sessionId=${this.sessionInfo.sessionId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.warn(`[McpClient] 断开连接警告: ${error.error || response.statusText}`);
        return false;
      }
      
      console.log('[McpClient] 会话已关闭');
      this.sessionInfo = null;
      return true;
    } catch (error) {
      console.error('[McpClient] 断开连接错误:', error);
      return false;
    }
  }
}

/**
 * 创建 MCP 客户端实例
 * @param baseUrl API 基础URL
 * @returns MCP 客户端实例
 */
export function createMcpClient(baseUrl?: string): McpClient {
  return new McpClient(baseUrl);
}

/**
 * 从 JSON 字符串中解析 MCP 服务器配置
 * @param json MCP 配置 JSON 字符串
 * @returns 服务器配置映射
 */
export function parseMcpConfig(json: string | null | undefined): Record<string, McpServerConfig> | null {
  if (!json) return null;
  
  try {
    const config = JSON.parse(json);
    if (config && config.mcpServers && typeof config.mcpServers === 'object') {
      return config.mcpServers;
    }
    return null;
  } catch (error) {
    console.error('[McpClient] 解析 MCP 配置失败:', error);
    return null;
  }
} 