import { NextResponse } from "next/server";
import { mcpClientService } from "@/server/services/mcp-client.service";
import { decrypt } from "@/lib/utils/encryption-utils";
import { getApiEndpointAndHeaders } from "@/lib/services/ai-service";
import { AIModelConfig } from "@/lib/services/ai-service";
import { aiModelConfigService } from "@/lib/services/ai-model-config-service";
import { getRedisClient } from '@/lib/redis';

// 流式响应编码器
const encoder = new TextEncoder();

interface ConversationRequest {
  sessionId?: string;
  userMessage: string;
  memberInfo?: {
    name: string;
    role: string;
    responsibilities: string;
    mcpConfigJson?: string;  // 添加MCP配置字段
  };
  connectionParams?: any; // <-- 新增：接收连接参数
  previousToolState?: {  // 添加上一次工具状态
    name: string;
    state: any;
  }
}

// 消息类型定义
interface ChatMessage {
  role: string;
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

// 工具调用响应类型
interface ToolCallResult {
  name?: string;
  content?: string;
  message?: {
    content: string;
  };
  response?: string;
  text?: string;
  tool_calls?: any[];
  toolCalls?: any[];
  [key: string]: any;
}

// 定义 Redis key 的前缀和 TTL (与 session API 一致)
const REDIS_SESSION_PREFIX = 'mcp:session:';
const SESSION_TTL_SECONDS = 3 * 60 * 60; 

// Redis 会话数据接口 (需要与 session API 中的定义一致)
interface RedisSessionData {
  sessionId: string;
  connectionParams: any;
  tools: any[];
  formattedTools?: any[];
  aiModelConfig?: any;
  systemPrompt?: string;
  memberInfo?: any;
  startTime: number;
  lastUsed: number;
}

// 添加缓存机制，避免重复获取和解密
let globalDefaultConfig: any = null;
let globalDecryptedKey: string | null = null;

const redis = getRedisClient();

/**
 * 统一处理流式对话请求 - 支持实时推送工具调用和结果
 */
export async function POST(req: Request) {
  // 创建流式响应
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 解析请求参数，包含 connectionParams
        const { sessionId, userMessage, memberInfo, connectionParams, previousToolState } = await req.json() as ConversationRequest;
        
        // 验证必要参数
        if (!userMessage) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '缺少必要参数: userMessage' })}\n\n`));
          controller.close();
          return;
        }
        
        console.log(`[流式对话] 使用全局缓存状态:`, {
          hasGlobalConfig: !!globalDefaultConfig,
          hasGlobalKey: !!globalDecryptedKey,
          keyLength: globalDecryptedKey?.length || 0
        });
        
        // 获取会话中的工具状态
        let toolState = previousToolState;
        if (sessionId && !toolState) {
          const sessionInfo = mcpClientService.getSessionInfo(sessionId);
          if (sessionInfo && sessionInfo.toolState) {
            toolState = sessionInfo.toolState;
            console.log(`[流式对话] 从会话中恢复工具状态:`, {
              toolName: toolState.name,
              hasState: !!toolState.state
            });
          }
        }
        
        const hasMcpConfig = !!memberInfo?.mcpConfigJson || !!connectionParams; // 判断条件扩展
        let isConnectionInMemory = false; // 标记连接是否在当前实例内存中
        
        let effectiveSessionId = sessionId;
        let sessionData: RedisSessionData | null = null; // 存储从 Redis 读取的数据
        let sessionInfo: any = null; // <-- 移回外部声明
        
        // --- 步骤 1: 尝试从 Redis 获取会话数据 --- 
        if (effectiveSessionId) {
            const redisKey = REDIS_SESSION_PREFIX + effectiveSessionId;
            try {
                const sessionDataJson = await redis.get(redisKey);
                if (sessionDataJson) {
                    sessionData = JSON.parse(sessionDataJson) as RedisSessionData;
                    console.log(`[流式对话] 从 Redis 成功加载会话 ${effectiveSessionId}`);
                    
                    // 更新 lastUsed 和 TTL
                    sessionData.lastUsed = Date.now();
                    await redis.setex(redisKey, SESSION_TTL_SECONDS, JSON.stringify(sessionData));
                    
                    // 检查连接是否在当前内存中
                    isConnectionInMemory = mcpClientService.getSessionInfo(effectiveSessionId) !== null;
                    if (isConnectionInMemory) {
                       console.log(`[流式对话] 会话 ${effectiveSessionId} 连接在内存中活跃`);
                    }

                } else {
                    console.log(`[流式对话] Redis 中未找到会话 ${effectiveSessionId}，视为无效会话`);
                    effectiveSessionId = undefined; // 会话无效
                }
            } catch (redisError) {
                console.error(`[流式对话] 从 Redis 读取会话 ${effectiveSessionId} 失败:`, redisError);
                effectiveSessionId = undefined; // 出错也视为无效
            }
        }
        // --- Redis 获取结束 ---

        // --- 步骤 2: 如果会话在 Redis 中存在，但连接不在内存中，尝试重新连接 --- 
        if (sessionData && !isConnectionInMemory && effectiveSessionId) {
             console.log(`[流式对话] 会话 ${effectiveSessionId} 不在内存中，尝试使用 Redis 中的参数重新连接...`);
             const savedConnectionParams = sessionData.connectionParams;
             if (savedConnectionParams) {
                 try {
                    let connectCommand: string;
                    let connectArgs: string[];
                    if (savedConnectionParams.url) {
                        connectCommand = '_STREAMABLE_HTTP_';
                        connectArgs = ['--url', savedConnectionParams.url];
                    } else if (savedConnectionParams.command && savedConnectionParams.args) {
                        connectCommand = savedConnectionParams.command;
                        connectArgs = savedConnectionParams.args;
                    } else {
                        throw new Error('Redis 中存储的 connectionParams 无效');
                    }
                    
                    // 尝试重连，传入 sessionId
                    const connectResult = await mcpClientService.connect(connectCommand, connectArgs, effectiveSessionId);
                    
                    // --- 修复：确保 effectiveSessionId 更新为 connect 返回的新 ID ---
                    const newSessionIdAfterReconnect = connectResult.sessionId;
                    console.log('[流式对话] 按需重新连接成功，旧ID:', effectiveSessionId, '新ID:', newSessionIdAfterReconnect);
                    effectiveSessionId = newSessionIdAfterReconnect; // 强制更新为新 ID
                    // --- 修复结束 ---
                    
                    isConnectionInMemory = true; // 标记连接已在内存中
                    
                    // 重新获取一下 sessionInfo，因为 connect 可能更新了内存状态
                    sessionInfo = mcpClientService.getSessionInfo(effectiveSessionId);
                    if (!sessionInfo) {
                        console.warn(`[流式对话] 警告：重新连接成功后，未能立即从 mcpClientService 获取到新会话 ${effectiveSessionId} 的信息`);
                        // 即使内存信息获取稍有延迟，我们仍然有 Redis 中的 sessionData 可以继续
                    }

                 } catch (reconnectError) {
                     console.error('[流式对话] 按需重新连接失败:', reconnectError);
                     // 连接失败，但 sessionData 仍然有效，可以尝试无工具模式或报错
                     // 根据业务决定是报错还是继续 (当前会继续，但工具调用会失败)
                     sendStatusEvent(controller, '警告: 无法重新连接到工具服务');
                 }
             } else {
                 console.warn(`[流式对话] Redis 中会话 ${effectiveSessionId} 缺少 connectionParams，无法重新连接`);
             }
        }
        // --- 重连逻辑结束 ---

        // --- 确定对话模式 (只声明一次) --- 
        const useMcpMode = !!sessionData;
        console.log(`[流式对话] 模式判断 (基于Redis):`, {
          hasSessionData: !!sessionData,
          effectiveSessionId: effectiveSessionId || '无',
          isConnectionInMemory, 
          mode: useMcpMode ? 'MCP模式' : '普通对话模式'
        });
        sendStatusEvent(controller, `模式: ${useMcpMode ? 'MCP模式' : '普通对话模式'}`);

        // --- 准备系统提示词、工具列表和API配置 (只在外部声明一次) --- 
        let systemPrompt = "";
        let formattedTools: any[] = [];
        let apiConfig: any = null;
        let decryptedApiKeyForLLM: string | null = null; // <-- 存储最终解密后的 Key

        if (useMcpMode && sessionData) {
            // ===== MCP模式 - 从 Redis 加载数据 =====
            systemPrompt = sessionData.systemPrompt || "";
            formattedTools = sessionData.formattedTools || [];
            apiConfig = sessionData.aiModelConfig;
            
            // --- 关键：获取并解密 API Key --- 
            if (apiConfig && apiConfig.apiKeyId) {
                console.log(`[流式对话] 从 Redis 加载 AI 配置，需要重新解密密钥 (ID: ${apiConfig.apiKeyId})`);
                try {
                    const fullConfig = await aiModelConfigService.getConfigById(apiConfig.apiKeyId);
                    if (fullConfig && fullConfig.apiKey) {
                        decryptedApiKeyForLLM = await decrypt(fullConfig.apiKey); // 解密并存储
                        console.log('[流式对话] 成功解密 API Key (长度:', decryptedApiKeyForLLM.length, ')');
                        // 将解密后的 key 临时加入 apiConfig 供 getApiEndpointAndHeaders 使用
                        // 但不将其存回 Redis
                        apiConfig.apiKey = decryptedApiKeyForLLM; 
                    } else {
                         console.error(`数据库中未找到 ID 为 ${apiConfig.apiKeyId} 的配置或配置中缺少 apiKey`);
                         throw new Error(`无法找到或解密 ID 为 ${apiConfig.apiKeyId} 的 AI 模型配置`);
                    }
                } catch (decryptError) {
                    console.error('[流式对话] 从 Redis 配置重新解密 API Key 失败:', decryptError);
                    sendErrorEvent(controller, '无法安全加载 AI 配置，请联系管理员');
                    controller.close();
                    return;
                }
            } else {
                console.error('[流式对话] 警告：Redis 中的 aiModelConfig 缺少 apiKeyId，无法获取 API Key');
                // 这里可以选择报错退出或尝试使用全局默认配置（如果允许）
                // 为安全起见，暂时报错退出
                 sendErrorEvent(controller, '无法确定使用的 API Key，请检查会话配置');
                 controller.close();
                 return;
            }
            // --- API Key 处理结束 ---
            
            // 如果 Redis 中没有格式化工具，尝试从原始工具格式化
            if ((!formattedTools || formattedTools.length === 0) && sessionData.tools && sessionData.tools.length > 0) {
                 formattedTools = sessionData.tools.map(tool => {
                     if (typeof tool === 'string') {
                         return { name: tool, description: `使用${tool}工具执行操作`, input_schema: {} };
                     } else {
                         return { name: tool.name, description: tool.description || `使用${tool.name}工具执行操作`, input_schema: tool.inputSchema || {} };
                     }
                 });
                 console.log(`[流式对话] 从 Redis 原始工具列表格式化了 ${formattedTools.length} 个工具`);
                 // 可选：将格式化后的写回 Redis (如果频繁发生，可以优化)
                 // sessionData.formattedTools = formattedTools;
                 // await redis.setex(REDIS_SESSION_PREFIX + effectiveSessionId, SESSION_TTL_SECONDS, JSON.stringify(sessionData));
            }
            
            // 确保系统提示词存在
            if (!systemPrompt) {
                systemPrompt = sessionData.memberInfo?.name ? 
                    `你是一个名为${sessionData.memberInfo.name}的AI团队成员。${sessionData.memberInfo.role}。你的职责是${sessionData.memberInfo.responsibilities}。请提供专业、有价值的回复。` : 
                    "你是一个专业的AI助手。回答用户问题时简洁清晰，提供有价值的信息。";
            }
            
        } else {
            // ===== 普通对话模式 (或者 MCP 会话无效) =====
            // 生成系统提示词
            systemPrompt = memberInfo ? 
                `你是一个名为${memberInfo.name}的AI团队成员。${memberInfo.role}。你的职责是${memberInfo.responsibilities}。请提供专业、有价值的回复。` : 
                "你是一个专业的AI助手。回答用户问题时简洁清晰，提供有价值的信息。";
            
            try {
                // 优先使用全局缓存
                if (globalDefaultConfig && globalDecryptedKey) {
                    console.log('[流式对话] 普通模式使用全局缓存的API配置');
                    
                    // 使用缓存的配置
                    apiConfig = {
                        model: globalDefaultConfig.model,
                        baseURL: globalDefaultConfig.baseURL,
                        apiKey: globalDecryptedKey,
                        temperature: globalDefaultConfig.temperature || 0.7
                    };
                    decryptedApiKeyForLLM = globalDecryptedKey; // 使用全局缓存的Key
                } else {
                    // 全局缓存未命中，只获取一次配置并更新缓存
                    console.log('[流式对话] 普通模式下全局缓存未命中，从数据库获取配置');
                    
                    // 获取默认AI模型配置 - 仅在全局缓存不存在时执行
                    globalDefaultConfig = await aiModelConfigService.getDefaultConfig();
                    if (!globalDefaultConfig) {
                        sendErrorEvent(controller, '系统未配置默认的AI模型，无法处理对话请求');
                        controller.close();
                        return;
                    }
                    
                    // 解密API密钥 - 仅在全局缓存不存在时执行
                    globalDecryptedKey = await decrypt(globalDefaultConfig.apiKey);
                    
                    // 创建API配置
                    apiConfig = {
                        model: globalDefaultConfig.model,
                        baseURL: globalDefaultConfig.baseURL,
                        apiKey: globalDecryptedKey,
                        temperature: globalDefaultConfig.temperature || 0.7
                    };
                    decryptedApiKeyForLLM = globalDecryptedKey; // 使用新解密的Key
                    console.log('[流式对话] 普通模式：成功加载并解密默认 API Key');
                }
            } catch (error) {
                console.error('[流式对话] 加载默认配置失败:', error);
                sendErrorEvent(controller, '加载AI配置失败，请联系管理员');
                controller.close();
                return;
            }
        }
        
        // --- 确保最终有可用的 API Key --- 
        if (!apiConfig || !decryptedApiKeyForLLM) { // 检查解密后的 Key
          console.error('[流式对话] 无法获取有效的 AI 配置或解密的 API Key');
          sendErrorEvent(controller, '无法获取有效的AI配置或API Key');
          controller.close();
          return;
        }
        
        // 准备对话消息
        const messages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
        ];
        
        // 如果有sequentialthinking工具状态，加入上下文
        if (toolState && (toolState.name === 'sequentialthinking' || toolState.name === 'mcp_sequential_thinking_sequentialthinking') 
            && toolState.state && toolState.state.thought) {
          
          // 构建思考过程上下文
          const thoughtContext = `上次我们正在进行思考过程 ${toolState.state.thoughtNumber || '?'}/${toolState.state.totalThoughts || '?'}。
上次的思考是: "${toolState.state.thought}"
请继续这个思考过程，考虑我的回答: "${userMessage}"`;
          
          messages.push({ role: "user", content: thoughtContext });
        } else {
          // 正常用户消息
          messages.push({ role: "user", content: userMessage });
        }
        
        console.log("[流式对话] 发送消息:", {
          mode: useMcpMode ? 'MCP模式' : '普通对话模式',
          sessionId: effectiveSessionId || '无会话',
          systemPrompt: systemPrompt.substring(0, 50) + (systemPrompt.length > 50 ? '...' : ''),
          userMessage: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
          toolsCount: formattedTools.length,
          isConnectionInMemory // 新增日志
        });
        
        // --- 获取 Endpoint 和 Headers --- 
        const { endpoint, headers } = getApiEndpointAndHeaders({
            ...apiConfig,
            apiKey: decryptedApiKeyForLLM, // 显式传递解密后的 Key
            id: apiConfig.apiKeyId || 'default', // 确保有 id
            name: apiConfig.model || 'Default Model' // 确保有 name
        } as AIModelConfig);
        
        // 安全地记录 Headers (隐藏敏感信息)
        const headersForLog: Record<string, string> = {}; // 创建一个新对象用于日志
        for (const key in headers) {
            // 显式检查 key 是否是 headers 自身的属性 (最佳实践)
            if (Object.prototype.hasOwnProperty.call(headers, key)) {
                 // 将不敏感的头部信息复制到新对象
                 const lowerCaseKey = key.toLowerCase();
                 if (lowerCaseKey !== 'authorization' && lowerCaseKey !== 'x-goog-api-key') { 
                    // 需要类型断言来访问联合类型的属性
                    headersForLog[key] = headers[key as keyof typeof headers];
                 }
            }
        }
        console.log('[流式对话] 调用 LLM API Headers (已隐藏敏感信息):', headersForLog);
        // ---
        
        try {
            // 准备API请求参数
            const requestBody: any = {
              model: apiConfig.model,
              messages: messages,
              temperature: apiConfig.temperature || 0.7,
              max_tokens: 1000,
              stream: true // 使用流式响应
            };
            
            // 如果是MCP模式且有工具列表，添加到请求中
            if (useMcpMode && formattedTools.length > 0) {
              console.log(`[流式对话] 添加 ${formattedTools.length} 个工具到请求`);
              requestBody.tools = formattedTools
                .filter(tool => tool && typeof tool === 'object' && tool.name) // 过滤掉无效工具
                .map(tool => ({
                  type: "function",
                  function: {
                    name: tool.name,
                    description: tool.description || `使用${tool.name}工具执行操作`,
                    parameters: tool.input_schema || {}
                  }
                }));
              requestBody.tool_choice = "auto"; // 允许模型自动选择是否使用工具
            }
            
            // <-- 增加日志：确认执行到 fetch 前
            console.log(`[流式对话] 准备调用 LLM API: ${endpoint}`, { 
                model: requestBody.model, 
                messageCount: requestBody.messages.length,
                hasTools: !!requestBody.tools 
            });
    
            // 发送请求给大模型API
            const response = await fetch(endpoint, {
              method: "POST",
              headers, // 确保这里使用原始的、包含认证信息的 headers
              body: JSON.stringify(requestBody),
            });
            
            // <--- 在 fetch 调用之后确认响应状态
            console.log(`[流式对话] LLM API 响应状态: ${response.status}`);

            if (!response.ok) {
              const errorText = await response.text();
              // 使用辅助函数发送错误
              sendErrorEvent(controller, `LLM API请求失败 (${response.status}): ${errorText}`);
              controller.close();
              return;
            }
        
            // 处理流式响应 (移到 try 块外部或保持在内部)
            const reader = response.body?.getReader();
            if (!reader) {
              sendErrorEvent(controller, '无法读取模型响应流');
              controller.close();
              return;
            }
            
            let buffer = '';
            let accumContent = '';
            let toolCallDetected = false;
            let toolCallName = '';
            let toolCallArgs = {};
            let toolCallId = '';
            let rawArgsString = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                // 解码当前块
                const chunk = new TextDecoder().decode(value);
                buffer += chunk;
                
                // 处理完整的事件
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                  if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
                    try {
                      const data = JSON.parse(line.substring(6));
                      
                      // 提取内容增量
                      if (data.choices && data.choices[0]) {
                        const delta = data.choices[0].delta || {};
                        
                        // 处理工具调用
                        if (delta.tool_calls && delta.tool_calls.length > 0) {
                          // 标记工具调用被检测到
                          toolCallDetected = true;
                          
                          // 累积工具名称
                          if (delta.tool_calls[0].function?.name) {
                            toolCallName += delta.tool_calls[0].function.name;
                          }
                          
                          // 记录工具调用ID
                          if (delta.tool_calls[0].id && !toolCallId) {
                            toolCallId = delta.tool_calls[0].id;
                          }
                          
                          // 累积工具参数 (作为字符串，稍后解析)
                          if (delta.tool_calls[0].function?.arguments) {
                            rawArgsString += delta.tool_calls[0].function.arguments;
                            
                            // 只在工具名称第一次出现时发送消息，或当工具名称变化时
                            if (toolCallName && !accumContent.includes(`🔧 正在使用工具: ${toolCallName}`)) {
                              // 发送工具调用开始通知，但不包含参数
                              const toolStartMessage = `🔧 正在使用工具: ${toolCallName}\n`;
                              sendContentEvent(controller, toolStartMessage);
                              accumContent = toolStartMessage;
                            }
                            
                            // 同时尝试解析参数对象 (仅用于工具调用，不影响显示)
                            try {
                              if (rawArgsString.includes('{') && rawArgsString.includes('}')) {
                                const match = rawArgsString.match(/\{[\s\S]*\}/);
                                if (match) {
                                  toolCallArgs = JSON.parse(match[0]);
                                }
                              }
                            } catch (e) {
                              // 解析错误不影响流程
                            }
                          }
                        }
                        // 处理普通内容更新
                        else if (delta.content) {
                          // 如果之前检测到工具调用，先发送处理中消息
                          if (toolCallDetected && accumContent.includes('正在使用工具') && !accumContent.includes('处理中')) {
                            sendContentEvent(controller, '处理中...');
                            accumContent = '处理中...';
                          }
                          
                          // 发送内容增量
                          sendContentEvent(controller, delta.content);
                          
                          // 追加到累积内容
                          accumContent += delta.content;
                        }
                      }
                    } catch (error) {
                      console.error('[流式对话] 解析事件出错:', error);
                    }
                  } else if (line.trim() === 'data: [DONE]') {
                    console.log('[流式对话] 流结束');
                  }
                }
            }
            
            // --- 工具调用逻辑 --- 
            // (移到 try 块外部或保持在内部，取决于错误处理策略)
            if (toolCallDetected && toolCallName && Object.keys(toolCallArgs).length > 0 && effectiveSessionId && isConnectionInMemory) {
                try {
                    console.log(`[流式对话] 执行工具调用 (连接状态: ${isConnectionInMemory}): ${toolCallName}`, toolCallArgs);
                    const toolResult = await mcpClientService.callTool(effectiveSessionId, toolCallName, toolCallArgs);
                    
                    // 获取工具结果文本
                    let resultText = '';
                    try {
                      // 通用结果处理逻辑，不依赖特定工具名称
                      if (typeof toolResult === 'string') {
                        // 字符串结果直接显示
                        resultText = toolResult;
                      } else if (toolResult === null || toolResult === undefined) {
                        // 空结果处理
                        resultText = '工具未返回结果';
                      } else if (typeof toolResult === 'object') {
                        // 智能检测常见的结果字段名称
                        // 按优先级尝试获取内容字段
                        const possibleContentFields = ['content', 'text', 'message', 'result', 'data', 'thought'];
                        
                        // 首先检查是否有常见的内容字段
                        let foundContent = false;
                        for (const field of possibleContentFields) {
                          if (toolResult[field] !== undefined) {
                            if (typeof toolResult[field] === 'string') {
                              resultText = toolResult[field];
                              foundContent = true;
                              break;
                            } else if (toolResult[field] && typeof toolResult[field] === 'object' && toolResult[field].content) {
                              resultText = toolResult[field].content;
                              foundContent = true;
                              break;
                            }
                          }
                        }
                        
                        // 如果没有找到常见字段，但发现有意义的可能"进度"信息字段，添加到显示
                        if (toolResult.thoughtNumber && toolResult.totalThoughts) {
                          resultText = `${resultText ? resultText : ''}${resultText ? '\n' : ''}(进度: ${toolResult.thoughtNumber}/${toolResult.totalThoughts})`;
                        }
                        
                        // 如果仍未找到内容或需要完整显示，格式化整个对象
                        if (!foundContent || Object.keys(toolResult).length > 1) {
                          resultText = JSON.stringify(toolResult, null, 2);
                        }
                      } else {
                        // 兜底处理其他数据类型
                        resultText = String(toolResult);
                      }
                      
                      // 特殊处理sequentialthinking工具：在会话中保存状态
                      if ((toolCallName === 'sequentialthinking' || toolCallName === 'mcp_sequential_thinking_sequentialthinking') 
                          && typeof toolResult === 'object' && toolResult.nextThoughtNeeded === true) {
                        // 将工具状态保存到会话中
                        mcpClientService.setSessionInfo(effectiveSessionId, {
                          toolState: {
                            name: toolCallName,
                            state: toolResult
                          }
                        });
                        
                        // 提示用户这是多轮思考过程
                        if (toolResult.thoughtNumber && toolResult.totalThoughts) {
                          sendStatusEvent(controller, `这是思考过程 ${toolResult.thoughtNumber}/${toolResult.totalThoughts}，请继续对话以完成思考`);
                        }
                      }
                    } catch (e) {
                      // 最终安全检查
                      resultText = `工具执行成功，但结果格式无法处理: ${e instanceof Error ? e.message : '未知错误'}`;
                    }
                    
                    // 确保结果是字符串后再使用substring
                    resultText = String(resultText);
                    
                    // 发送执行结果通知 - 清晰显示结果并添加换行
                    sendContentEvent(controller, `\n⚙️ 工具执行结果:\n${resultText.substring(0, 1000)}${resultText.length > 1000 ? '...' : ''}`);
                    
                    // 构建包含工具调用和结果的完整消息历史
                    const updatedMessages = [
                      ...messages,
                      { 
                        role: "assistant", 
                        content: null,
                        tool_calls: [{
                          id: toolCallId || `call_${Date.now()}`,
                          type: "function",
                          function: {
                            name: toolCallName,
                            arguments: JSON.stringify(toolCallArgs)
                          }
                        }]
                      },
                      {
                        role: "tool",
                        tool_call_id: toolCallId || `call_${Date.now()}`,
                        content: resultText
                      }
                    ];
                    
                    // 再次调用模型获取最终回复
                    const finalResponse = await fetch(endpoint, {
                      method: "POST",
                      headers,
                      body: JSON.stringify({
                        model: apiConfig.model,
                        messages: updatedMessages,
                        temperature: apiConfig.temperature || 0.7,
                        max_tokens: 1000,
                        stream: false
                      }),
                    });
                    
                    if (!finalResponse.ok) {
                      sendErrorEvent(controller, '获取工具调用后的回复失败');
                    } else {
                      const finalData = await finalResponse.json();
                      
                      // 获取最终回复内容
                      if (finalData.choices && finalData.choices[0] && finalData.choices[0].message) {
                        const finalContent = finalData.choices[0].message.content || '';
                        sendContentEvent(controller, `\n\n${finalContent}`);
                        
                        // 如果有工具状态，通知客户端
                        if (effectiveSessionId) {
                          const sessionInfo = mcpClientService.getSessionInfo(effectiveSessionId);
                          if (sessionInfo && sessionInfo.toolState) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                              type: 'tool_state', 
                              state: sessionInfo.toolState
                            })}\n\n`));
                          }
                        }
                      }
                    }
                    
                    // 可以在成功调用后更新 Redis TTL
                    const currentSessionDataJson = await redis.get(REDIS_SESSION_PREFIX + effectiveSessionId);
                    if (currentSessionDataJson) {
                        const currentSessionData = JSON.parse(currentSessionDataJson);
                        currentSessionData.lastUsed = Date.now();
                        await redis.setex(REDIS_SESSION_PREFIX + effectiveSessionId, SESSION_TTL_SECONDS, JSON.stringify(currentSessionData));
                    }
                } catch (toolError) {
                    console.error('[流式对话] 工具调用失败:', toolError);
                    // 改进错误处理，确保在UI中显示详细错误
                    const errorMessage = toolError instanceof Error 
                      ? `工具调用失败: ${toolError.message}${toolError.cause ? `\n原因: ${JSON.stringify(toolError.cause)}` : ''}`
                      : `工具调用失败: ${JSON.stringify(toolError)}`;
                    
                    // 发送错误信息到UI，添加换行以提高可读性
                    sendContentEvent(controller, `\n❌ ${errorMessage}`);
                    
                    // 同时通过错误事件通知系统
                    sendErrorEvent(controller, errorMessage);
                }
            } else if (toolCallDetected && (!effectiveSessionId || !isConnectionInMemory)) {
                // 如果需要调用工具，但会话无效或连接不在内存中
                console.warn(`[流式对话] 检测到工具调用 ${toolCallName}，但会话 ${effectiveSessionId} 无效或连接不在内存中，无法执行`);
                sendErrorEvent(controller, `无法执行工具 ${toolCallName}：连接丢失或会话无效`);
            }
            
        } catch (fetchError) { // <--- 捕获构造请求体或 fetch 调用本身的错误
            console.error('[流式对话] 调用 LLM API 前或期间出错:', fetchError);
            sendErrorEvent(controller, `调用 LLM API 时出错: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
            controller.close();
            return; // 确保在此处返回
        }
        
        controller.close();
      } catch (error) {
        console.error('[流式对话] 整体处理失败:', error);
        sendErrorEvent(controller, error instanceof Error ? error.message : '处理对话时发生未知错误');
        controller.close();
      }
    }
  });
  
  // 返回流式响应
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

// 辅助函数：发送错误事件
function sendErrorEvent(controller: ReadableStreamDefaultController, message: string) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
    type: 'error', 
    content: message 
  })}\n\n`));
}

// 辅助函数：发送状态事件
function sendStatusEvent(controller: ReadableStreamDefaultController, message: string) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
    type: 'status', 
    content: message 
  })}\n\n`));
}

// 辅助函数：发送内容更新事件
function sendContentEvent(controller: ReadableStreamDefaultController, content: string) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
    type: 'content', 
    content 
  })}\n\n`));
}