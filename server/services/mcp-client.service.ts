/**
 * MCP 客户端服务 - 仅支持 Streamable HTTP
 * 基于官方Model Context Protocol SDK实现标准通信
 * 参考文档: https://modelcontextprotocol.io/quickstart/client
 */

// 使用 package.json exports 推荐的子路径 (再次尝试)
// import { Client } from '@modelcontextprotocol/sdk/client'; 
// import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio'; 

// 临时解决方案：使用 any 类型绕过类型检查
// import { Client as ClientType } from '@modelcontextprotocol/sdk/client';
// import { StdioClientTransport as StdioClientTransportType } from '@modelcontextprotocol/sdk/client/stdio';
// const Client: any = ClientType;
// const StdioClientTransport: any = StdioClientTransportType;

import { join } from "path";
import { readFileSync } from "fs";
// 移除 Vercel AI SDK 的导入
// import { experimental_createMCPClient } from "ai";
// import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";

// 导入HTTP模块
import * as http from "http";
import * as https from "https";
import { URL } from "url";
// 使用自己实现的StreamableHttpClientTransport
import { StreamableHttpClientTransport } from "@/lib/mcp/streamableHttp";

// 会话管理
type McpSessionInfo = {
  // 移除 client 字段
  transport: StreamableHttpClientTransport; // 类型明确为 StreamableHttpClientTransport
  tools: any[];
  formattedTools?: any[];
  aiModelConfig?: {
    model: string;
    baseURL: string;
    apiKey: string;
    temperature?: number;
  };
  systemPrompt?: string;
  memberInfo?: {
    name: string;
    role: string;
    responsibilities: string;
    userSessionKey?: string;
  };
  toolState?: {
    name: string;
    state: any;
  };
  startTime: number;
  lastUsed: number;
  isStreamableHttp: true; // 总是 true
};

// 活跃会话映射
const activeSessions = new Map<string, McpSessionInfo>();

// 会话配置
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟清理一次
const SESSION_MAX_IDLE_TIME = 30 * 60 * 1000; // 30分钟未使用自动清理
const SESSION_MAX_LIFETIME = 2 * 60 * 60 * 1000; // 3小时最大生命周期

/**
 * MCP客户端服务 (仅 Streamable HTTP)
 */
export class McpClientService {
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // 启动会话清理计时器
    this.startCleanupTimer();

    // 确保在进程结束时清理所有会话
    process.on("beforeExit", () => {
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

    console.log(
      `[MCP] 会话清理计时器已启动，每 ${
        SESSION_CLEANUP_INTERVAL / 1000 / 60
      } 分钟执行一次`
    );
  }

  /**
   * 测试服务器可用性
   * 发送简单HTTP请求检查服务器是否可访问
   */
  private async testServerAvailability(url: string): Promise<boolean> {
    try {
      console.log(`[MCP] 测试服务器可用性: ${url}`);

      const urlObj = new URL(url);
      const isSecure = urlObj.protocol === "https:";
      const httpLib = isSecure ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isSecure ? 443 : 80),
        path: urlObj.pathname,
        method: "HEAD",
        timeout: 10000,
        headers: {
          "User-Agent": "MCP-Client-Test/1.0",
        },
      };

      return new Promise<boolean>((resolve, reject) => {
        const req = httpLib.request(options, (res) => {
          console.log(`[MCP] 服务器测试响应状态码: ${res.statusCode}`);
          resolve(true);
        });

        req.on("error", (err) => {
          console.error(`[MCP] 服务器测试失败: ${err.message}`);
          reject(new Error(`服务器测试失败: ${err.message}`));
        });

        req.on("timeout", () => {
          console.error(`[MCP] 服务器测试超时`);
          req.destroy();
          reject(new Error("服务器测试连接超时"));
        });

        req.end();
      });
    } catch (error) {
      console.error(
        `[MCP] 服务器测试异常: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new Error(
        `无法连接到服务器: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 连接到MCP服务器 (仅 Streamable HTTP)
   */
  async connect(
    // 参数只保留 sessionId，因为 command/args 暗示为 Streamable HTTP URL
    httpUrl: string, // 直接传入 URL
    sessionId?: string
  ): Promise<{ sessionId: string; tools: any[] }> {
    console.log("[MCP] 使用 StreamableHttp 连接方式");

    try {
      console.log(`[MCP] 连接到: ${httpUrl}`);

      // 创建Streamable HTTP传输层
      console.log("[MCP] 创建Streamable HTTP传输层");
      const httpTransport = new StreamableHttpClientTransport(httpUrl, {
          headers: {
            "User-Agent": "MCP-Client/1.0",
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
          },
      });

      // -- 执行手动初始化握手 --
      console.log("[MCP] 执行 Initialize 握手...");
      const initializeId = `init-${Date.now()}`;
      await httpTransport.send({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            capabilities: {},
            protocolVersion: "2025-03-26", // 或其他支持的版本
            clientInfo: { name: "qare-ai-team-client", version: "1.0.0" },
          },
          id: initializeId,
        });
      const initializeResponse = await httpTransport.receive();
      if (initializeResponse.error || !initializeResponse.result || !httpTransport.sessionId) {
         console.error("[MCP] Initialize 握手失败或未获取 Session ID:", initializeResponse);
         throw new Error("MCP Initialize 握手失败或未能获取 Session ID");
      }
      const actualSessionId = httpTransport.sessionId; // 使用服务器提供的 ID
      console.log(`[MCP] Initialize 握手成功，获取 Session ID: ${actualSessionId}`);

      // -- 获取工具列表 --
      console.log("[MCP] 发送 tools/list 请求...");
      const listToolsId = `listTools-${actualSessionId}`;
      await httpTransport.send({
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
        id: listToolsId,
      });
      const toolListResponse = await httpTransport.receive();
      if (!toolListResponse || !toolListResponse.result || !Array.isArray(toolListResponse.result.tools)) {
        console.error("[MCP] 无效的 tools/list 响应:", toolListResponse);
        throw new Error("从服务器获取工具列表失败");
      }
      const tools = toolListResponse.result.tools;
      console.log(`[MCP] 发现 ${tools.length} 个工具`);

      // 存储会话信息
      const sessionInfo: McpSessionInfo = {
        transport: httpTransport,
        tools,
        startTime: Date.now(),
        lastUsed: Date.now(),
        isStreamableHttp: true,
      };
      // 使用服务器提供的 sessionId 或传入的 sessionId (如果需要复用)
      const finalSessionId = sessionId || actualSessionId;
      activeSessions.set(finalSessionId, sessionInfo);
      console.log(`[MCP] 会话 ${finalSessionId} 已存储`);

      return { sessionId: finalSessionId, tools };

    } catch (error) {
       console.error("[MCP] Streamable HTTP 连接失败:", error);
       throw new Error(error instanceof Error ? error.message : "连接MCP服务器失败 (HTTP)");
    }
  }

  /**
   * 调用指定会话中的工具 (仅 Streamable HTTP)
   */
  async callTool(
    sessionId: string,
    toolName: string,
    input: any
  ): Promise<any> {
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      throw new Error(`会话 ${sessionId} 不存在或已过期`);
    }
    // 确保是 Streamable HTTP 会话 (虽然现在是唯一的类型)
    if (!sessionInfo.isStreamableHttp || !(sessionInfo.transport instanceof StreamableHttpClientTransport)) {
        throw new Error(`会话 ${sessionId} 不是有效的 Streamable HTTP 会话`);
    }
    sessionInfo.lastUsed = Date.now();

    try {
      console.log(`[MCP] 会话 ${sessionId} 调用工具 ${toolName} (HTTP)`);
      const callToolId = `callTool-${sessionId}-${Date.now()}`;
      const transport = sessionInfo.transport;
      const jsonRpcRequest = { jsonrpc: "2.0", method: "tools/call", params: { name: toolName, arguments: input }, id: callToolId };
      await transport.send(jsonRpcRequest);
      const response = await transport.receive();
      console.log(`[MCP] HTTP 传输收到工具 ${toolName} 原始响应: ${JSON.stringify(response).substring(0, 150)}...`);
      if (response && typeof response === "object") {
          if (response.error) {
              console.error(`[MCP] 工具 ${toolName} 调用错误 (HTTP):`, response.error);
              throw new Error(`工具调用失败: ${response.error.message || JSON.stringify(response.error)}`);
          } else if (response.hasOwnProperty("result")) {
              console.log(`[MCP] 工具 ${toolName} 调用成功 (HTTP)，结果: ${JSON.stringify(response.result).substring(0, 150)}...`);
              return response.result;
          } else {
               console.warn(`[MCP] 工具 ${toolName} 收到非标准 JSON-RPC 成功响应 (HTTP)，返回整个响应`);
               return response;
          }
      } else {
           console.error(`[MCP] 工具 ${toolName} 调用收到无效或空的响应 (HTTP):`, response);
           throw new Error("调用工具未收到有效响应 (HTTP)");
      }
    } catch (error) {
       console.error(`[MCP] 会话 ${sessionId} 调用工具 ${toolName} 过程中发生异常 (HTTP):`, error);
       throw error instanceof Error ? error : new Error(`工具调用异常: ${String(error)}`);
    }
  }

  /**
   * 关闭指定的会话 (仅 Streamable HTTP)
   */
  async closeSession(sessionId: string): Promise<boolean> {
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      console.log(`[MCP] 会话 ${sessionId} 不存在，无需关闭`);
      return false;
    }
    console.log(`[MCP] 关闭会话 ${sessionId} (HTTP)`);

    try {
       // 只需关闭 transport
       await sessionInfo.transport.close();
       console.log(`[MCP] 会话 ${sessionId} Transport 已关闭`);

      activeSessions.delete(sessionId);
      console.log(`[MCP] 会话 ${sessionId} 已从活跃会话列表中移除`);
      return true;

    } catch (error) {
      console.error(`[MCP] 关闭会话 ${sessionId} 失败 (HTTP):`, error);
      // Streamable HTTP 通常没有子进程需要强制关闭，但还是确保移除
      activeSessions.delete(sessionId);
      console.log(`[MCP] 会话 ${sessionId} 已强制从活跃会话列表中移除 (关闭失败后)`);
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
      idleTime:
        Math.floor((Date.now() - sessionInfo.lastUsed) / 1000 / 60) + "分钟",
    });

    // 更新最后使用时间
    sessionInfo.lastUsed = Date.now();
    return sessionInfo;
  }

  /**
   * 更新会话信息（通用方法）
   */
  setSessionInfo(
    sessionId: string,
    updateData: Partial<Omit<McpSessionInfo, "client" | "transport">>
  ): boolean {
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) {
      console.log(`[MCP] 会话 ${sessionId} 不存在，无法更新信息`);
      return false;
    }

    // 更新会话信息，但不允许更新client和transport
    Object.assign(sessionInfo, updateData);

    // 记录更新
    console.log(
      `[MCP] 会话 ${sessionId} 信息已更新:`,
      Object.keys(updateData)
        .map((k) => `${k}: ${k === "toolState" ? "(状态已保存)" : "已更新"}`)
        .join(", ")
    );

    return true;
  }

  /**
   * 设置会话的AI配置信息
   */
  setSessionAIConfig(
    sessionId: string | undefined,
    aiConfig: McpSessionInfo["aiModelConfig"],
    systemPrompt?: string,
    memberInfo?: McpSessionInfo["memberInfo"]
  ): boolean {
    // 如果会话ID不存在，返回false
    if (!sessionId) {
      console.log("[MCP] 无法设置AI配置: 会话ID不存在");
      return false;
    }

    console.log(`[MCP] 保存会话 ${sessionId} 的AI配置:`, {
      model: aiConfig?.model,
      baseURL: aiConfig?.baseURL,
      hasApiKey: !!aiConfig?.apiKey,
      keyLength: aiConfig?.apiKey?.length || 0,
      hasSystemPrompt: !!systemPrompt,
      hasMemberInfo: !!memberInfo,
    });

    const result = this.setSessionInfo(sessionId, {
      aiModelConfig: aiConfig,
      systemPrompt,
      memberInfo,
    });

    if (result) {
      console.log(`[MCP] 成功保存会话 ${sessionId} 的AI配置`);

      // 验证保存是否成功
      const sessionInfo = this.getSessionInfo(sessionId);
      if (sessionInfo) {
        console.log(`[MCP] 验证会话 ${sessionId} 的AI配置:`, {
          hasConfig: !!sessionInfo.aiModelConfig,
          configModel: sessionInfo.aiModelConfig?.model,
          hasPrompt: !!sessionInfo.systemPrompt,
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
        console.log(
          `[MCP] 会话 ${sessionId} 空闲超过 ${Math.floor(
            (now - info.lastUsed) / 1000 / 60
          )} 分钟，准备清理`
        );
        idleSessions.push(sessionId);
      }
      // 检查总生命周期
      else if (now - info.startTime > SESSION_MAX_LIFETIME) {
        console.log(
          `[MCP] 会话 ${sessionId} 生命周期超过 ${Math.floor(
            (now - info.startTime) / 1000 / 60 / 60
          )} 小时，准备清理`
        );
        oldSessions.push(sessionId);
      }
    }

    // 关闭空闲会话
    if (idleSessions.length > 0) {
      console.log(`[MCP] 准备清理 ${idleSessions.length} 个空闲会话...`);
      for (const sessionId of idleSessions) {
        this.closeSession(sessionId)
          .then((success) => {
            if (success) closedCount++;
          })
          .catch((err) =>
            console.error(`[MCP] 清理空闲会话 ${sessionId} 失败:`, err)
          );
      }
    }

    // 关闭生命周期过长的会话
    if (oldSessions.length > 0) {
      console.log(
        `[MCP] 准备清理 ${oldSessions.length} 个生命周期过长的会话...`
      );
      for (const sessionId of oldSessions) {
        this.closeSession(sessionId)
          .then((success) => {
            if (success) closedCount++;
          })
          .catch((err) =>
            console.error(`[MCP] 清理过期会话 ${sessionId} 失败:`, err)
          );
      }
    }

    // 定期打印当前活跃会话状态
    const activeSessionCount = activeSessions.size;
    if (activeSessionCount > 0) {
      const sessionsList = Array.from(activeSessions.keys());
      console.log(
        `[MCP] 当前活跃会话 (${activeSessionCount}): ${sessionsList.join(", ")}`
      );

      // 输出每个会话的详细信息
      for (const [sessionId, info] of activeSessions.entries()) {
        const idleMinutes = Math.floor((now - info.lastUsed) / 1000 / 60);
        const lifetimeHours = ((now - info.startTime) / 1000 / 60 / 60).toFixed(
          1
        );
        console.log(
          `[MCP] 会话 ${sessionId}: 空闲 ${idleMinutes} 分钟，存活 ${lifetimeHours} 小时，工具数量 ${info.tools.length}`
        );
      }
    }

    if (idleSessions.length > 0 || oldSessions.length > 0) {
      console.log(
        `[MCP] 会话清理完成，关闭了 ${closedCount} 个会话，当前活跃会话: ${activeSessions.size}`
      );
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

    console.log(
      `[MCP] 所有会话清理完成，成功关闭 ${closedCount}/${sessionIds.length} 个会话`
    );
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
