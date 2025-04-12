/**
 * StreamableHttpClientTransport
 * 
 * 简化实现，直接模仿成功的Python客户端
 */

import { EventEmitter } from 'events';
import axios from 'axios';
import https from 'https';

// 创建自定义HTTPS代理，用于禁用SSL验证
const httpsAgent = new https.Agent({
  rejectUnauthorized: false // 禁用SSL验证
});

export class StreamableHttpClientTransport {
  private url: string;
  private options: {
    sessionId?: string;
    headers?: Record<string, string>;
    timeout?: number;
  };
  private isConnected: boolean = false;
  private eventEmitter: EventEmitter;
  private messageQueue: any[] = [];
  private requestCounter: number = 0;
  
  /**
   * 创建新的StreamableHttp客户端传输
   */
  constructor(url: string, options: {
    sessionId?: string;
    headers?: Record<string, string>;
    timeout?: number;
  } = {}) {
    this.url = url;
    this.options = {
      sessionId: options.sessionId, // 不自动生成，由服务器提供
      timeout: options.timeout || 30000, // 默认30秒超时，与Python一致
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json', 
        'User-Agent': 'mcp-robust-client/1.0',
        ...options.headers
      }
    };
    
    console.log(`[StreamableHttp] 初始化MCP HTTP客户端:`, {
      url: this.url,
      timeout: this.options.timeout
    });
    
    this.eventEmitter = new EventEmitter();
  }

  /**
   * 启动传输层（供SDK Client调用）
   * 实际连接逻辑在connect方法中
   */
  async start(): Promise<void> {
    console.log('[StreamableHttp] SDK Client called start(). Delegating to connect().');
    // 调用现有的connect方法来处理初始化
    await this.connect();
  }

  /**
   * 获取会话ID
   */
  get sessionId(): string | undefined {
    return this.options.sessionId;
  }

  /**
   * 获取请求ID
   */
  private getNextRequestId(): string {
    this.requestCounter++;
    return `req-${this.requestCounter}`;
  }

  /**
   * 准备请求头
   */
  private getHeaders(isInit: boolean = false): Record<string, string> {
    const headers = {...this.options.headers};
    
    // 不是初始化请求且有会话ID时添加头
    if (!isInit && this.options.sessionId) {
      // 使用与Python客户端一致的格式
      headers['Mcp-Session-Id'] = this.options.sessionId;
    }
    
    return headers;
  }

  /**
   * 连接到MCP服务器 (由SDK Client调用，仅标记状态)
   */
  async connect(): Promise<void> {
    // 对于无状态的HTTP传输，connect/start主要是标记传输层已准备好
    // 实际的初始化由SDK Client通过发送initialize消息完成
    console.log(`[StreamableHttp] connect() called. Marking transport as ready.`);
    this.isConnected = true; 
    // 不再发送初始化请求，由SDK Client处理
  }

  /**
   * 检查连接状态
   */
  isOpen(): boolean {
    return this.isConnected;
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    this.isConnected = false;
    this.messageQueue = [];
    this.eventEmitter.removeAllListeners();
    console.log(`[StreamableHttp] 关闭连接, 会话ID: ${this.options.sessionId}`);
  }

  /**
   * 发送消息到服务器
   */
  async send(message: any): Promise<void> {
    if (!this.isConnected) {
      console.warn(`[StreamableHttp] 自动连接到服务器...`);
      try {
        await this.connect();
      } catch (connectError) {
        throw new Error(`自动连接失败: ${connectError instanceof Error ? connectError.message : '未知错误'}`);
      }
    }
    
    try {
      // 转换为JSON-RPC消息
      const jsonRpcMessage = this.convertToJsonRpc(message);
      console.log(`[StreamableHttp] 发送消息: ${JSON.stringify(jsonRpcMessage).substring(0, 150)}...`);
      
      // 判断是否为初始化请求
      const isInitializeRequest = jsonRpcMessage && jsonRpcMessage.method === 'initialize';
      
      // 根据是否为初始化请求获取正确的请求头
      const headers = this.getHeaders(isInitializeRequest);
      console.log(`[StreamableHttp] 请求头:`, headers);
      
      // 直接使用axios发送请求
      const response = await axios({
        method: 'post',
        url: this.url,
        data: jsonRpcMessage,
        headers: headers,
        timeout: this.options.timeout,
        httpsAgent: httpsAgent,
        validateStatus: () => true // 允许任何状态码
      });
      
      // 检查响应头中是否有会话ID (特别是初始化响应)
      if (!this.options.sessionId) {
        const sessionIdHeader = 
          response.headers['Mcp-Session-Id'] || 
          response.headers['mcp-session-id'] ||
          response.headers['MCP-SESSION-ID'];
        if (sessionIdHeader) {
          this.options.sessionId = sessionIdHeader;
          console.log(`[StreamableHttp] 从响应头获取到会话ID: ${this.options.sessionId}`);
        }
      }
      
      if (response.data) {
        console.log(`[StreamableHttp] 收到响应原始数据: ${JSON.stringify(response.data).substring(0, 150)}...`);

        // 处理可能的批处理响应 (数组)
        const responses = Array.isArray(response.data) ? response.data : [response.data];

        for (const singleResponse of responses) {
          console.log(`[StreamableHttp] 处理单个响应: ${JSON.stringify(singleResponse).substring(0,150)}...`);
          // 在放入队列前进行转换
          const convertedResponse = this.convertFromJsonRpc(singleResponse);
          console.log(`[StreamableHttp] 转换后准备放入队列: ${JSON.stringify(convertedResponse).substring(0,150)}...`);
          // 将单个 *转换后* 的响应放入队列
          this.messageQueue.push(convertedResponse);
          // 为每个 *转换后* 的响应触发消息事件
          this.eventEmitter.emit('message', convertedResponse);
        }
      } else {
        console.warn(`[StreamableHttp] 收到空响应`);
      }
    } catch (error) {
      console.error(`[StreamableHttp] 发送消息失败:`, error);
      throw error;
    }
  }

  /**
   * 将MCP SDK消息转换为JSON-RPC 2.0格式
   */
  private convertToJsonRpc(message: any): any {
    console.log('[StreamableHttp] convertToJsonRpc received:', JSON.stringify(message));
    // 已经是JSON-RPC格式
    if (message && message.jsonrpc === "2.0") {
      console.log('[StreamableHttp] Message is already JSON-RPC, returning as is.');
      return message;
    }
    
    console.log('[StreamableHttp] Message is NOT JSON-RPC, converting...');
    // 转换为JSON-RPC格式
    const jsonRpcMessage: any = {
      jsonrpc: "2.0",
      id: this.getNextRequestId()
    };
    
    if (message.method) {
      // 方法名转换
      const methodMap: Record<string, string> = {
        "tools/list": "list_tools",
        "tools/call": "call_tool",
        "initialize": "initialize",
      };
      
      jsonRpcMessage.method = methodMap[message.method] || message.method;
      
      // 处理参数
      if (message.params) {
        if (message.method === "tools/call" && message.params) {
          // 工具调用参数特殊处理
          jsonRpcMessage.params = {
            name: message.params.name,
            parameters: message.params.arguments
          };
        } else {
          jsonRpcMessage.params = message.params;
        }
      }
    }
    
    return jsonRpcMessage;
  }

  /**
   * 接收消息
   * 从队列中获取下一条消息或等待新消息
   */
  async receive(): Promise<any> {
    // 队列中有消息直接返回 (已经是转换后的格式)
    if (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      console.log(`[StreamableHttp] receive(): Returning message from queue: ${JSON.stringify(message).substring(0,150)}...`);
      return message;
    }
    
    // 等待消息 (已经是转换后的格式)
    return new Promise((resolve) => {
      const handler = (message: any) => {
        this.eventEmitter.off('message', handler);
        console.log(`[StreamableHttp] receive(): Returning message from event: ${JSON.stringify(message).substring(0,150)}...`);
        resolve(message);
      };
      
      this.eventEmitter.once('message', handler);
    });
  }
  
  /**
   * 将JSON-RPC 2.0响应转换为MCP SDK格式
   */
  private convertFromJsonRpc(message: any): any {
    if (message && message.jsonrpc === "2.0") {
      // list_tools 响应需要特殊处理，提取 tools 数组
      if (message.result && message.result.tools && Array.isArray(message.result.tools) && message.id && message.id.startsWith('req-')) {
        // 确认是 list_tools 的响应 (可以根据请求 ID 或方法名进一步判断，但这里简化处理)
        console.log('[StreamableHttp] Converting list_tools response.');
        return { tools: message.result.tools };
      }
      
      // 对于 initialize 或其他标准 JSON-RPC 响应，直接返回完整的消息对象
      // SDK Client 可能需要完整的对象来处理 connect 逻辑
      if (message.id && (message.result || message.error)) {
          console.log('[StreamableHttp] Returning full JSON-RPC response object.');
          return message; 
      }

      // 如果只有 result 而没有 id (不太规范，但也处理一下)
      if (message.result) {
        console.warn('[StreamableHttp] JSON-RPC response missing ID, returning result only.');
        return message.result;
      }
      
      // 处理错误
      if (message.error) {
        throw new Error(`JSON-RPC错误: ${message.error.message || JSON.stringify(message.error)}`);
      }
    }
    
    // 如果不是标准的 JSON-RPC 2.0 格式，直接返回
    console.warn('[StreamableHttp] Received non-standard JSON-RPC message:', message);
    return message;
  }
} 