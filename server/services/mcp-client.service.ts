/**
 * MCP 客户端服务
 * 基于官方Model Context Protocol SDK实现标准通信
 * 参考文档: https://modelcontextprotocol.io/quickstart/client
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'path';
import { readFileSync } from 'fs';

// 会话管理
type McpSessionInfo = {
  client: Client;
  transport: StdioClientTransport;
  tools: any[];
  startTime: number;
  lastUsed: number;
};

// 活跃会话映射
const activeSessions = new Map<string, McpSessionInfo>();

// 读取包白名单
let ALLOWED_NPM_PACKAGES: Set<string> = new Set();
let ALLOW_ALL_PACKAGES = false;

try {
  const allowlistPath = join(process.cwd(), 'config', 'mcp-allowlist.json');
  const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  if (Array.isArray(allowlist.allowedNpmPackages)) {
    // 检查是否包含通配符"*"
    if (allowlist.allowedNpmPackages.includes('*')) {
      ALLOW_ALL_PACKAGES = true;
      console.log('[MCP] 白名单配置为允许所有包');
    } else {
      ALLOWED_NPM_PACKAGES = new Set(allowlist.allowedNpmPackages);
      console.log(`[MCP] 已加载 ${ALLOWED_NPM_PACKAGES.size} 个白名单包`);
    }
  }
} catch (error) {
  console.error('[MCP] 无法加载MCP白名单配置:', error);
}

/**
 * MCP客户端服务
 * 提供了与MCP服务器交互的能力
 */
export class McpClientService {
  /**
   * 验证服务器配置的有效性
   */
  validateServerConfig(command: string, args: string[]): { valid: boolean; error?: string } {
    // 命令和参数必须存在
    if (!command || !Array.isArray(args)) {
      return { 
        valid: false, 
        error: '无效的服务器配置: 命令和参数必须存在' 
      };
    }

    // 检查命令是否为可执行的
    const allowedCommands = ['node', 'npx', 'python', 'python3', 'cargo'];
    const commandBase = command.split('/').pop()?.toLowerCase() || '';
    
    if (!allowedCommands.includes(commandBase)) {
      return { 
        valid: false, 
        error: `不支持的命令: ${command}。只允许: ${allowedCommands.join(', ')}` 
      };
    }

    // 如果是npx命令，检查包是否在白名单中（除非配置允许所有包）
    if (command === 'npx' && !ALLOW_ALL_PACKAGES) {
      // npx -y <包名> 格式
      if (args.length >= 2 && args[0] === '-y') {
        const packageName = args[1];
        if (!ALLOWED_NPM_PACKAGES.has(packageName)) {
          return { 
            valid: false, 
            error: `包 "${packageName}" 不在白名单中` 
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * 连接到MCP服务器并返回会话ID和工具列表
   */
  async connect(command: string, args: string[], sessionId?: string): Promise<{ sessionId: string; tools: any[] }> {
    // 验证配置合法性
    const validation = this.validateServerConfig(command, args);
    if (!validation.valid) {
      throw new Error(`无效的服务器配置: ${validation.error}`);
    }

    // 生成唯一会话ID，如果未提供
    const newSessionId = sessionId || `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[MCP] 创建会话 ${newSessionId}: ${command} ${args.join(' ')}`);

    try {
      // 创建传输层
      const transport = new StdioClientTransport({
        command,
        args,
        env: { ...process.env } as Record<string, string>
      });

      // 创建客户端
      const client = new Client({
        name: "MCP-Client",
        version: "1.0.0"
      }, {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      });

      // 连接到服务器
      console.log('[MCP] 连接到服务器...');
      await client.connect(transport);
      console.log('[MCP] 服务器连接成功');

      // 获取工具列表 - 调用标准的listTools方法
      console.log('[MCP] 获取可用工具...');
      const toolList = await client.listTools();
      const tools = toolList.tools || [];
      console.log(`[MCP] 发现 ${tools.length} 个工具`);

      // 存储会话信息
      const sessionInfo: McpSessionInfo = {
        client,
        transport,
        tools,
        startTime: Date.now(),
        lastUsed: Date.now()
      };
      activeSessions.set(newSessionId, sessionInfo);

      return {
        sessionId: newSessionId,
        tools
      };
    } catch (error) {
      console.error('[MCP] 连接失败:', error);
      throw new Error(error instanceof Error ? error.message : '连接MCP服务器失败');
    }
  }

  /**
   * 调用指定会话中的工具
   */
  async callTool(sessionId: string, toolName: string, input: any): Promise<any> {
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      throw new Error(`会话 ${sessionId} 不存在或已过期`);
    }

    // 更新最后使用时间
    sessionInfo.lastUsed = Date.now();

    try {
      console.log(`[MCP] 会话 ${sessionId} 调用工具 ${toolName} 参数:`, input);
      
      // 使用官方SDK调用工具
      const result = await sessionInfo.client.callTool({
        name: toolName,
        arguments: input
      });

      return result;
    } catch (error) {
      console.error(`[MCP] 工具 ${toolName} 调用失败:`, error);
      throw error;
    }
  }

  /**
   * 关闭指定的会话
   */
  async closeSession(sessionId: string): Promise<boolean> {
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      console.log(`[MCP] 会话 ${sessionId} 不存在，无需关闭`);
      return false;
    }

    console.log(`[MCP] 关闭会话 ${sessionId}`);
    
    try {
      // 使用正确的方法关闭传输连接
      await sessionInfo.transport.close();
      console.log(`[MCP] 会话 ${sessionId} 已关闭`);
      
      // 从活跃会话中移除
      activeSessions.delete(sessionId);
      return true;
    } catch (error) {
      console.error(`[MCP] 关闭会话 ${sessionId} 失败:`, error);
      return false;
    }
  }

  /**
   * 获取会话信息
   */
  getSessionInfo(sessionId: string): { tools: any[] } | null {
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      return null;
    }

    return {
      tools: sessionInfo.tools
    };
  }

  /**
   * 清理过期会话
   */
  cleanupSessions(maxAge: number = 30 * 60 * 1000): void {
    const now = Date.now();
    let closedCount = 0;

    for (const [sessionId, info] of activeSessions.entries()) {
      if (now - info.lastUsed > maxAge) {
        this.closeSession(sessionId)
          .then(success => {
            if (success) closedCount++;
          })
          .catch(err => console.error(`[MCP] 清理会话 ${sessionId} 失败:`, err));
      }
    }

    if (closedCount > 0) {
      console.log(`[MCP] 已清理 ${closedCount} 个过期会话`);
    }
  }
}

// 导出单例服务
export const mcpClientService = new McpClientService(); 