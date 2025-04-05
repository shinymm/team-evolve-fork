/**
 * MCP 客户端服务
 * 基于官方Model Context Protocol SDK实现标准通信
 * 参考文档: https://modelcontextprotocol.io/quickstart/client
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'path';
import { readFileSync } from 'fs';
// 导入Vercel AI SDK的实验性MCP客户端
import { experimental_createMCPClient } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';

// 会话管理
type McpSessionInfo = {
  client: Client | any; // 修改为支持多种客户端类型
  transport: StdioClientTransport | any; // 修改为支持多种传输类型
  tools: any[];
  formattedTools?: any[]; // 格式化后的工具列表，直接供AI使用
  aiModelConfig?: {      // 缓存的AI模型配置
    model: string;
    baseURL: string;
    apiKey: string;     // 已解密的API密钥
    temperature?: number;
  };
  systemPrompt?: string; // 缓存的系统提示词
  memberInfo?: {         // 缓存的成员信息
    name: string;
    role: string;
    responsibilities: string;
    userSessionKey?: string;  // 添加用户会话键字段，用于会话复用
  };
  toolState?: {          // 工具状态，用于保存连续性工具的状态
    name: string;
    state: any;
  };
  startTime: number;
  lastUsed: number;
  isVercelSdk?: boolean; // 标记是否使用Vercel SDK连接
};

// 活跃会话映射
const activeSessions = new Map<string, McpSessionInfo>();

// 会话配置
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟清理一次
const SESSION_MAX_IDLE_TIME = 30 * 60 * 1000; // 30分钟未使用自动清理
const SESSION_MAX_LIFETIME = 2 * 60 * 60 * 1000; // 3小时最大生命周期

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
  private cleanupTimer: NodeJS.Timeout | null = null;
  
  constructor() {
    // 启动会话清理计时器
    this.startCleanupTimer();
    
    // 确保在进程结束时清理所有会话
    process.on('beforeExit', () => {
      this.cleanupAllSessions();
    });
  }
  
  /**
   * 启动定时清理会话的计时器
   */
  private startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupSessions();
    }, SESSION_CLEANUP_INTERVAL);
    
    // 确保计时器不会阻止进程退出
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
    
    console.log(`[MCP] 会话清理计时器已启动，每 ${SESSION_CLEANUP_INTERVAL/1000/60} 分钟执行一次`);
  }

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
   * 检测是否在Vercel环境中运行
   * 通过环境变量和文件路径判断
   */
  private isVercelEnvironment(): boolean {
    // 检查Vercel特有的环境变量
    if (process.env.VERCEL || process.env.VERCEL_ENV) {
      return true;
    }
    
    // 检查Vercel Lambda环境的特定目录
    try {
      const fs = require('fs');
      if (fs.existsSync('/var/task/.next')) {
        return true;
      }
    } catch (error) {
      // 忽略文件系统错误
    }
    
    // 默认为非Vercel环境
    return false;
  }
  
  /**
   * 使用Vercel AI SDK连接到MCP服务器
   * 适用于Vercel服务器环境
   */
  private async connectWithVercelSdk(command: string, args: string[], sessionId?: string): Promise<{ sessionId: string; tools: any[]; client: any; transport: any }> {
    // 生成唯一会话ID，如果未提供
    const newSessionId = sessionId || `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[MCP] 使用Vercel AI SDK创建会话 ${newSessionId}: ${command} ${args.join(' ')}`);
    
    try {
      // 使用Vercel AI SDK的MCP客户端
      const mcpClient = await experimental_createMCPClient({
        transport: new Experimental_StdioMCPTransport({
          command,
          args,
          env: { ...process.env } as Record<string, string>
        })
      });
      
      // 获取工具列表
      console.log('[MCP] 获取可用工具...');
      const toolsObj = await mcpClient.tools();
      const toolNames = Object.keys(toolsObj || {});
      console.log(`[MCP] 发现 ${toolNames.length} 个工具`);
      
      // 将工具转换为与现有格式兼容的结构
      const compatibleTools = toolNames.map(name => ({
        name,
        description: `使用${name}工具执行操作`,
        // 直接包装函数而不进行调用
        inputSchema: {}
      }));
      
      return {
        sessionId: newSessionId,
        tools: compatibleTools,
        client: mcpClient,
        transport: mcpClient // 不访问私有属性
      };
    } catch (error) {
      console.error('[MCP] Vercel AI SDK连接失败:', error);
      throw new Error(error instanceof Error ? error.message : '连接MCP服务器失败');
    }
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
    
    // 检测是否在Vercel环境
    const isVercel = this.isVercelEnvironment();
    console.log(`[MCP] 当前环境检测: ${isVercel ? 'Vercel服务器环境' : '本地开发环境'}`);
    
    try {
      let sessionInfo: McpSessionInfo;
      
      if (isVercel) {
        // 在Vercel环境中使用Vercel AI SDK连接
        const { sessionId: newSessionId, tools, client, transport } = await this.connectWithVercelSdk(command, args, sessionId);
        
        // 存储会话信息
        sessionInfo = {
          client,
          transport,
          tools,
          startTime: Date.now(),
          lastUsed: Date.now(),
          isVercelSdk: true
        };
        activeSessions.set(newSessionId, sessionInfo);
        
        return {
          sessionId: newSessionId,
          tools
        };
      } else {
        // 在本地环境中使用传统方式连接
        
        // 生成唯一会话ID，如果未提供
        const newSessionId = sessionId || `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        console.log(`[MCP] 创建会话 ${newSessionId}: ${command} ${args.join(' ')}`);
        
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
        sessionInfo = {
          client,
          transport,
          tools,
          startTime: Date.now(),
          lastUsed: Date.now(),
          isVercelSdk: false
        };
        activeSessions.set(newSessionId, sessionInfo);

        return {
          sessionId: newSessionId,
          tools
        };
      }
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
      
      // 根据会话类型选择调用方式
      if (sessionInfo.isVercelSdk) {
        // 使用Vercel SDK方式调用工具
        const toolsObj = await (sessionInfo.client.tools as Function)();
        if (!toolsObj || typeof toolsObj[toolName] !== 'function') {
          throw new Error(`工具 ${toolName} 在当前会话中不可用`);
        }
        return await toolsObj[toolName](input);
      } else {
        // 使用传统SDK调用工具
        const result = await sessionInfo.client.callTool({
          name: toolName,
          arguments: input
        });
        return result;
      }
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
      // 根据会话类型选择关闭方式
      if (sessionInfo.isVercelSdk) {
        // 关闭Vercel SDK客户端
        await sessionInfo.client.close();
        console.log(`[MCP] 会话 ${sessionId} Vercel SDK客户端已关闭`);
      } else {
        // 先尝试关闭MCP客户端连接
        try {
          await sessionInfo.client.close();
          console.log(`[MCP] 会话 ${sessionId} 客户端已关闭`);
        } catch (clientError) {
          console.warn(`[MCP] 关闭会话 ${sessionId} 客户端时发生错误:`, clientError);
          // 继续尝试关闭传输层
        }
        
        // 再关闭传输层连接
        try {
          await sessionInfo.transport.close();
          console.log(`[MCP] 会话 ${sessionId} 传输层已关闭`);
        } catch (transportError) {
          console.warn(`[MCP] 关闭会话 ${sessionId} 传输层时发生错误:`, transportError);
          
          // 如果常规关闭失败，尝试强制终止子进程
          try {
            const childProcess = (sessionInfo.transport as any)?.process;
            if (childProcess && typeof childProcess.kill === 'function') {
              console.log(`[MCP] 尝试强制终止会话 ${sessionId} 的子进程`);
              childProcess.kill('SIGTERM'); // 尝试正常终止
              
              // 给进程一点时间正常退出
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // 如果进程仍在运行，强制终止
              if (!childProcess.killed) {
                console.log(`[MCP] 会话 ${sessionId} 的子进程未响应SIGTERM，尝试SIGKILL`);
                childProcess.kill('SIGKILL');
              }
            }
          } catch (killError) {
            console.error(`[MCP] 强制终止会话 ${sessionId} 子进程失败:`, killError);
          }
        }
      }
      
      // 从活跃会话中移除
      activeSessions.delete(sessionId);
      console.log(`[MCP] 会话 ${sessionId} 已从活跃会话列表中移除`);
      return true;
    } catch (error) {
      console.error(`[MCP] 关闭会话 ${sessionId} 失败:`, error);
      
      // 确保会话被清理，即使发生错误
      try {
        // 如果是传统会话，尝试通过引用直接获取子进程并终止
        if (!sessionInfo.isVercelSdk) {
          const childProcess = (sessionInfo.transport as any)?.process;
          if (childProcess && typeof childProcess.kill === 'function') {
            try {
              childProcess.kill('SIGKILL');
              console.log(`[MCP] 已强制终止会话 ${sessionId} 子进程`);
            } catch (killError) {
              console.error(`[MCP] 强制终止会话 ${sessionId} 子进程失败:`, killError);
            }
          }
        }
        
        activeSessions.delete(sessionId);
        console.log(`[MCP] 会话 ${sessionId} 已强制从活跃会话列表中移除`);
      } catch (cleanupError) {
        console.error(`[MCP] 清理会话 ${sessionId} 时发生错误:`, cleanupError);
      }
      
      return false;
    }
  }

  /**
   * 获取会话信息
   */
  getSessionInfo(sessionId: string): McpSessionInfo | null {
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      console.log(`[MCP] 未找到会话 ${sessionId}`);
      return null;
    }
    
    // 记录日志，包含会话是否包含AI配置
    console.log(`[MCP] 获取会话 ${sessionId} 信息:`, {
      hasTools: sessionInfo.tools?.length > 0,
      toolsCount: sessionInfo.tools?.length || 0,
      hasFormattedTools: !!sessionInfo.formattedTools,
      hasSystemPrompt: !!sessionInfo.systemPrompt,
      hasAIConfig: !!sessionInfo.aiModelConfig,
      hasMemberInfo: !!sessionInfo.memberInfo,
      idleTime: Math.floor((Date.now() - sessionInfo.lastUsed) / 1000 / 60) + "分钟"
    });
    
    // 更新最后使用时间
    sessionInfo.lastUsed = Date.now();
    return sessionInfo;
  }

  /**
   * 更新会话信息（通用方法）
   */
  setSessionInfo(sessionId: string, updateData: Partial<Omit<McpSessionInfo, 'client' | 'transport'>>): boolean {
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      console.log(`[MCP] 会话 ${sessionId} 不存在，无法更新信息`);
      return false;
    }

    // 更新会话信息，但不允许更新client和transport
    Object.assign(sessionInfo, updateData);
    
    // 记录更新
    console.log(`[MCP] 会话 ${sessionId} 信息已更新:`, 
      Object.keys(updateData).map(k => `${k}: ${k === 'toolState' ? '(状态已保存)' : '已更新'}`).join(', ')
    );
    
    return true;
  }

  /**
   * 设置会话的AI配置信息
   */
  setSessionAIConfig(sessionId: string | undefined, aiConfig: McpSessionInfo['aiModelConfig'], 
                    systemPrompt?: string, memberInfo?: McpSessionInfo['memberInfo']): boolean {
    // 如果会话ID不存在，返回false
    if (!sessionId) {
      console.log('[MCP] 无法设置AI配置: 会话ID不存在');
      return false;
    }
    
    console.log(`[MCP] 保存会话 ${sessionId} 的AI配置:`, {
      model: aiConfig?.model,
      baseURL: aiConfig?.baseURL,
      hasApiKey: !!aiConfig?.apiKey,
      keyLength: aiConfig?.apiKey?.length || 0,
      hasSystemPrompt: !!systemPrompt,
      hasMemberInfo: !!memberInfo
    });
    
    const result = this.setSessionInfo(sessionId, {
      aiModelConfig: aiConfig,
      systemPrompt,
      memberInfo
    });
    
    if (result) {
      console.log(`[MCP] 成功保存会话 ${sessionId} 的AI配置`);
      
      // 验证保存是否成功
      const sessionInfo = this.getSessionInfo(sessionId);
      if (sessionInfo) {
        console.log(`[MCP] 验证会话 ${sessionId} 的AI配置:`, {
          hasConfig: !!sessionInfo.aiModelConfig,
          configModel: sessionInfo.aiModelConfig?.model,
          hasPrompt: !!sessionInfo.systemPrompt
        });
      }
    } else {
      console.error(`[MCP] 无法保存会话 ${sessionId} 的AI配置，会话可能不存在`);
    }
    
    return result;
  }
  
  /**
   * 设置会话的工具格式化信息
   */
  setSessionFormattedTools(sessionId: string, formattedTools: any[]): boolean {
    return this.setSessionInfo(sessionId, { formattedTools });
  }

  /**
   * 获取当前活跃会话数量
   */
  getActiveSessionCount(): number {
    return activeSessions.size;
  }

  /**
   * 清理过期会话
   */
  cleanupSessions(): void {
    const now = Date.now();
    let closedCount = 0;
    const idleSessions: string[] = [];
    const oldSessions: string[] = [];

    // 找出需要清理的会话
    for (const [sessionId, info] of activeSessions.entries()) {
      // 检查空闲时间
      if (now - info.lastUsed > SESSION_MAX_IDLE_TIME) {
        console.log(`[MCP] 会话 ${sessionId} 空闲超过 ${Math.floor((now - info.lastUsed) / 1000 / 60)} 分钟，准备清理`);
        idleSessions.push(sessionId);
      }
      // 检查总生命周期
      else if (now - info.startTime > SESSION_MAX_LIFETIME) {
        console.log(`[MCP] 会话 ${sessionId} 生命周期超过 ${Math.floor((now - info.startTime) / 1000 / 60 / 60)} 小时，准备清理`);
        oldSessions.push(sessionId);
      }
    }

    // 关闭空闲会话
    if (idleSessions.length > 0) {
      console.log(`[MCP] 准备清理 ${idleSessions.length} 个空闲会话...`);
      for (const sessionId of idleSessions) {
        this.closeSession(sessionId)
          .then(success => {
            if (success) closedCount++;
          })
          .catch(err => console.error(`[MCP] 清理空闲会话 ${sessionId} 失败:`, err));
      }
    }

    // 关闭生命周期过长的会话
    if (oldSessions.length > 0) {
      console.log(`[MCP] 准备清理 ${oldSessions.length} 个生命周期过长的会话...`);
      for (const sessionId of oldSessions) {
        this.closeSession(sessionId)
          .then(success => {
            if (success) closedCount++;
          })
          .catch(err => console.error(`[MCP] 清理过期会话 ${sessionId} 失败:`, err));
      }
    }

    // 定期打印当前活跃会话状态
    const activeSessionCount = activeSessions.size;
    if (activeSessionCount > 0) {
      const sessionsList = Array.from(activeSessions.keys());
      console.log(`[MCP] 当前活跃会话 (${activeSessionCount}): ${sessionsList.join(', ')}`);
      
      // 输出每个会话的详细信息
      for (const [sessionId, info] of activeSessions.entries()) {
        const idleMinutes = Math.floor((now - info.lastUsed) / 1000 / 60);
        const lifetimeHours = ((now - info.startTime) / 1000 / 60 / 60).toFixed(1);
        console.log(`[MCP] 会话 ${sessionId}: 空闲 ${idleMinutes} 分钟，存活 ${lifetimeHours} 小时，工具数量 ${info.tools.length}`);
      }
    }

    if (idleSessions.length > 0 || oldSessions.length > 0) {
      console.log(`[MCP] 会话清理完成，关闭了 ${closedCount} 个会话，当前活跃会话: ${activeSessions.size}`);
    }
  }

  /**
   * 清理所有会话
   */
  async cleanupAllSessions(): Promise<number> {
    console.log(`[MCP] 正在清理所有会话 (${activeSessions.size})...`);
    let closedCount = 0;
    
    // 停止清理计时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // 获取所有会话ID
    const sessionIds = Array.from(activeSessions.keys());
    
    // 关闭所有会话
    for (const sessionId of sessionIds) {
      try {
        const success = await this.closeSession(sessionId);
        if (success) closedCount++;
      } catch (error) {
        console.error(`[MCP] 清理会话 ${sessionId} 失败:`, error);
      }
    }
    
    console.log(`[MCP] 所有会话清理完成，成功关闭 ${closedCount}/${sessionIds.length} 个会话`);
    return closedCount;
  }

  /**
   * 获取所有活跃会话信息
   * 返回所有会话的映射
   */
  getAllSessions(): Record<string, McpSessionInfo> {
    // 将 Map 转换为普通对象
    const sessionsObject: Record<string, McpSessionInfo> = {};
    activeSessions.forEach((value, key) => {
      sessionsObject[key] = value;
    });
    return sessionsObject;
  }
}

// 导出单例服务
export const mcpClientService = new McpClientService(); 