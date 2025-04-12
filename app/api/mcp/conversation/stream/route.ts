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

        try { // <--- 添加新的 try...catch 块
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

            // 处理流式响应
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

            // 读取和处理流式响应
            while (true) {
              const { done, value } = await reader.read();

              if (value) {
                  const rawChunk = new TextDecoder().decode(value);
                  if (rawChunk.includes('data:')) {
                      console.log('[流式对话] 收到原始 Chunk:', rawChunk.substring(0, 200) + (rawChunk.length > 200 ? '...' : ''));
                  }
              }

              if (done) {
                  console.log('[流式对话] 读取流完成 (done=true)');
                  break;
              }

              const chunk = new TextDecoder().decode(value);
              buffer += chunk;

              // --- 修改后的处理逻辑 --- 
              // 查找 "data: " 前缀，处理直到下一个 "data: " 或 buffer 结尾
              let dataPrefixIndex = buffer.indexOf('data: ');
              while(dataPrefixIndex !== -1) {
                  // 查找当前 "data: " 块的结束位置（下一个 "data: " 或结尾）
                  const nextDataPrefixIndex = buffer.indexOf('data: ', dataPrefixIndex + 6);
                  const endOfData = (nextDataPrefixIndex === -1) ? buffer.length : nextDataPrefixIndex;
                  
                  // 提取当前 "data: " 块的内容
                  const lineContent = buffer.substring(dataPrefixIndex + 6, endOfData).trim();
                  
                  // 尝试处理这个块的内容
                  if (lineContent) {
                      if (lineContent === '[DONE]') {
                          console.log('[流式对话] 收到 [DONE] 标记');
                      } else {
                          try {
                              const data = JSON.parse(lineContent);
                              // <-- 日志：打印解析后的 data 对象
                              console.log('[流式对话] 解析后的行数据:', JSON.stringify(data));
      
                              if (data.choices && data.choices[0]) {
                                const delta = data.choices[0].delta || {};
                                // <-- 日志：打印 delta 对象以供检查
                                console.log('[流式对话] 准备检查 delta:', JSON.stringify(delta));
          
                                // 处理工具调用
                                if (delta.tool_calls && delta.tool_calls.length > 0) {
                                  toolCallDetected = true;
                                  // <-- 日志：确认 toolCallDetected 被设置
                                  console.log('[流式对话] 循环内部: toolCallDetected 被设置为 true。当前状态:', {
                                      toolCallDetected, 
                                      toolCallName: toolCallName || '(空)', 
                                      argsChunk: delta.tool_calls[0].function?.arguments?.substring(0,50) + '...' || '(无参数块)',
                                      linePreview: lineContent.substring(0, 60) + '...'
                                  });

                                  // --- Check for Tool Name ---
                                  if (delta.tool_calls[0].function?.name) {
                                      const currentToolName = delta.tool_calls[0].function.name;
                                      // Accumulate the name (though usually it comes in one go)
                                      if (!toolCallName.includes(currentToolName)) {
                                           toolCallName += currentToolName;
                                      }
                                      // --- Send Tool Start Message ONCE when name is first detected ---
                                      const toolStartMessage = `🔧 正在使用工具: ${toolCallName}\\n`;
                                      if (!accumContent.includes(toolStartMessage)) { // Use the full message for the check
                                           sendContentEvent(controller, toolStartMessage);
                                           accumContent = toolStartMessage; // Set accumContent immediately
                                           console.log(`[流式对话] 发送工具启动消息: ${toolCallName}`); // Add log
                                      }
                                  }

                                  // --- Check for Tool ID ---
                                  if (delta.tool_calls[0].id && !toolCallId) {
                                      toolCallId = delta.tool_calls[0].id;
                                  }

                                  // --- Check for Tool Arguments ---
                                  if (delta.tool_calls[0].function?.arguments) {
                                      rawArgsString += delta.tool_calls[0].function.arguments;
                                      // Argument parsing logic remains the same
                                      try {
                                          // 尝试解析累积的参数字符串为 JSON 对象
                                          // 确保在完整的 JSON 结构出现时才解析
                                          if (rawArgsString.trim().startsWith('{') && rawArgsString.trim().endsWith('}')) {
                                              toolCallArgs = JSON.parse(rawArgsString);
                                              console.log(`[流式对话] 解析工具参数: ${toolCallName}`, toolCallArgs); // Add log
                                          }
                                      } catch (e) { /* 解析错误忽略, 等待更多数据 */ }
                                  }
                                }
                                // 处理普通内容更新
                                else if (delta.content) {
                                  // 当检测到工具调用后，如果先收到内容块，显示 "处理中..."
                                  if (toolCallDetected && accumContent.includes('正在使用工具') && !accumContent.includes('处理中')) {
                                    sendContentEvent(controller, '处理中...');
                                    accumContent = '处理中...'; // 更新状态避免重复发送
                                  }
                                  sendContentEvent(controller, delta.content);
                                  accumContent += delta.content;
                                }
                              }
                          } catch (error) {
                              console.error('[流式对话] 解析事件出错:', error, 'Invalid JSON block:', lineContent);
                          }
                      }
                  }
                  
                  // 从 buffer 中移除已处理的部分
                  buffer = buffer.substring(endOfData);
                  // 查找下一个 "data: "
                  dataPrefixIndex = buffer.indexOf('data: ');
              }
              // --- 处理逻辑结束 ---
            }
            console.log('[流式对话] 退出了流处理循环'); // <-- 增加日志：确认循环退出

            // <-- 日志：检查进入工具调用块前的状态
            console.log('[流式对话] 检查工具调用条件:', {
              toolCallDetected,
              toolCallName,
              toolCallArgs: JSON.stringify(toolCallArgs), // 打印解析后的参数
              toolCallArgsKeys: Object.keys(toolCallArgs).length,
              effectiveSessionId: effectiveSessionId || '无',
              isConnectionInMemory
            });

            // --- 工具调用逻辑 ---
            if (toolCallDetected && toolCallName && typeof toolCallArgs === 'object' && toolCallArgs !== null && effectiveSessionId && isConnectionInMemory) {
                try {
                    // <-- 日志：准备调用工具
                    console.log(`[流式对话] 准备执行工具调用 (会话: ${effectiveSessionId}, 连接内存状态: ${isConnectionInMemory}): ${toolCallName}`, {
                      args: JSON.stringify(toolCallArgs).substring(0,100) + '...' // 记录部分参数
                    });
                    const toolResult = await mcpClientService.callTool(effectiveSessionId, toolCallName, toolCallArgs);
                    // <-- 日志：工具调用完成，记录原始结果
                    console.log(`[流式对话] 工具 ${toolCallName} 调用完成，原始结果:`, 
                      JSON.stringify(toolResult).substring(0, 200) + (JSON.stringify(toolResult).length > 200 ? '...' : '')
                    );

                    // 获取工具结果文本
                    let resultText = '';
                    try {
                      // 通用结果处理逻辑，不依赖特定工具名称
                      if (typeof toolResult === 'string') {
                        resultText = toolResult;
                      } else if (toolResult === null || toolResult === undefined) {
                        resultText = '工具未返回结果';
                      } else if (typeof toolResult === 'object') {
                        const possibleContentFields = ['content', 'text', 'message', 'result', 'data', 'thought'];
                        let foundContent = false;

                        for (const field of possibleContentFields) {
                          if (toolResult[field] !== undefined) {
                            // 1. 检查字段本身是否为字符串
                            if (typeof toolResult[field] === 'string') {
                              resultText = toolResult[field]; // 直接赋值
                              foundContent = true;
                              console.log(`[流式对话] 工具结果提取方式1: 直接使用字段 ${field}`);
                              break;
                            } 
                            // 2. 检查字段是否为对象且包含 .content 字符串
                            else if (toolResult[field] && typeof toolResult[field] === 'object' && typeof toolResult[field].content === 'string') {
                              resultText = toolResult[field].content; // 直接赋值
                              foundContent = true;
                              console.log(`[流式对话] 工具结果提取方式2: 使用字段 ${field}.content`);
                              break;
                            }
                            // 3. 检查字段是否为数组
                            else if (Array.isArray(toolResult[field])) {
                                for (const item of toolResult[field]) {
                                    if (item && typeof item === 'object' && item.type === 'text' && typeof item.text === 'string') {
                                        resultText = item.text; // 直接赋值
                                        foundContent = true;
                                        console.log(`[流式对话] 工具结果提取方式3: 从字段 ${field} 数组中找到 type: 'text'`);
                                        break; 
                                    }
                                }
                                if (foundContent) {
                                    break; 
                                }
                            }
                          }
                        }

                        // --- 移除循环解包逻辑 ---
                        // if (foundContent && initialExtractedText) { ... } else { ... }
                        // --- 恢复简单的回退逻辑 ---
                        if (!foundContent) {
                             // 如果初步提取失败，则执行原来的回退逻辑
                            console.log(`[流式对话] 未能从特定字段提取工具结果，将 Stringify 整个对象`);
                            try {
                                resultText = JSON.stringify(toolResult, null, 2);
                            } catch (stringifyError) {
                                resultText = "无法序列化工具结果对象";
                            }
                        }
                        // --- 回退逻辑结束 ---

                        // ... (后续 thoughtNumber/totalThoughts 处理保持不变，使用提取或 stringify 后的 resultText)
                        if (toolResult.thoughtNumber && toolResult.totalThoughts) {
                          resultText = `${resultText ? resultText : ''}${resultText ? '\n' : ''}(进度: ${toolResult.thoughtNumber}/${toolResult.totalThoughts})`;
                        }
                        // 4. 如果以上都没找到，或者对象结构复杂，则 stringify 整个对象
                        if (!foundContent) {
                            // 仅当对象包含多个顶层键时才 stringify，避免简单结果也被 stringify
                            // （如果 toolResult 只有 content 一个键，即使没提取成功，也可能不希望 stringify）
                            // 优化：只有在明确找不到内容，*且* 对象看起来复杂时才 stringify
                            // if (Object.keys(toolResult).length > 1) { 
                            //  更简单的回退：如果没找到就 stringify
                            console.log(`[流式对话] 未能从特定字段提取工具结果，将 Stringify 整个对象`);
                           try {
                                resultText = JSON.stringify(toolResult, null, 2);
                            } catch (stringifyError) {
                                resultText = "无法序列化工具结果对象";
                            }
                            // }
                        }
                      } else {
                        // 其他类型直接转字符串
                        resultText = String(toolResult);
                      }

                      // 特殊处理sequentialthinking工具：在会话中保存状态
                       if ((toolCallName === 'sequentialthinking' || toolCallName === 'mcp_sequential_thinking_sequentialthinking')
                            && typeof toolResult === 'object' && toolResult.nextThoughtNeeded === true) {
                            mcpClientService.setSessionInfo(effectiveSessionId, {
                              toolState: { name: toolCallName, state: toolResult }
                            });
                            if (toolResult.thoughtNumber && toolResult.totalThoughts) {
                              sendStatusEvent(controller, `这是思考过程 ${toolResult.thoughtNumber}/${toolResult.totalThoughts}，请继续对话以完成思考`);
                            }
                       } else {
                            // 如果不是 sequential thinking 或思考完成，清除工具状态
                            mcpClientService.setSessionInfo(effectiveSessionId, { toolState: undefined });
                       }

                    } catch (e) {
                      resultText = `工具执行成功，但结果格式无法处理: ${e instanceof Error ? e.message : '未知错误'}`;
                    }
                    resultText = String(resultText); // 确保是字符串
                    sendContentEvent(controller, `\n⚙️ 工具执行结果:\n${resultText.substring(0, 1000)}${resultText.length > 1000 ? '...' : ''}`);

                    // 构建包含工具调用和结果的完整消息历史
                    const updatedMessages: ChatMessage[] = [
                      ...messages,
                      {
                        role: "assistant",
                        content: null, // 必须为 null
                        tool_calls: [{
                          id: toolCallId || `call_${Date.now()}`,
                          type: "function",
                          function: {
                            name: toolCallName,
                            arguments: JSON.stringify(toolCallArgs) // 确保参数是字符串
                          }
                        }]
                      },
                      {
                        role: "tool",
                        tool_call_id: toolCallId || `call_${Date.now()}`,
                        name: toolCallName, // OpenAI 格式需要 name
                        content: resultText // 结果是字符串
                      }
                    ];
                    
                    // <-- 日志：准备第二次 LLM 调用
                    console.log(`[流式对话] 准备进行第二次 LLM 调用以生成最终回复 (消息数量: ${updatedMessages.length})`);
                    // console.log('[流式对话] 发送给第二次 LLM 的消息:', JSON.stringify(updatedMessages)); // 可选：打印完整消息体，可能很长

                    // 再次调用模型获取最终回复
                    const finalResponse = await fetch(endpoint, {
                      method: "POST",
                      headers,
                      body: JSON.stringify({
                        model: apiConfig.model,
                        messages: updatedMessages,
                        temperature: apiConfig.temperature || 0.7,
                        max_tokens: 1000,
                        stream: true // 仍然使用流式获取最终回复
                      }),
                    });
                    
                    // <-- 日志：第二次 LLM 调用响应状态
                    console.log(`[流式对话] 第二次 LLM 调用响应状态: ${finalResponse.status}`);

                    if (!finalResponse.ok) {
                      const finalText = await finalResponse.text();
                      // <-- 日志：第二次 LLM 调用失败
                      console.error(`[流式对话] 第二次 LLM 调用失败 (${finalResponse.status}): ${finalText}`);
                      sendErrorEvent(controller, `获取工具调用后的回复失败 (${finalResponse.status}): ${finalText.substring(0, 200)}...`);
                      // 注意：这里没有关闭流，让流程继续到最后的 controller.close()
                    } else {
                        // 处理最终回复的流
                        const finalReader = finalResponse.body?.getReader();
                        if (!finalReader) {
                            // <-- 日志：无法读取最终回复流
                            console.error('[流式对话] 无法读取最终回复流');
                            sendErrorEvent(controller, '无法读取最终回复流');
                        } else {
                            // <-- 日志：开始处理最终回复流
                            console.log('[流式对话] 开始处理最终回复流...');
                            sendContentEvent(controller, `\n\n`); // 添加换行分隔
                            let finalBuffer = '';
                            while (true) {
                                const { done: finalDone, value: finalValue } = await finalReader.read();
                                if (finalDone) {
                                    // <-- 日志：最终回复流处理完成
                                    console.log('[流式对话] 最终回复流处理完成 (done=true)');
                                    break;
                                }
                                finalBuffer += new TextDecoder().decode(finalValue);
                                const finalLines = finalBuffer.split('\n');
                                finalBuffer = finalLines.pop() || '';
                                for (const finalLine of finalLines) {
                                    if (finalLine.startsWith('data: ') && finalLine.trim() !== 'data: [DONE]') {
                                        try {
                                            const finalData = JSON.parse(finalLine.substring(6));
                                            if (finalData.choices && finalData.choices[0]?.delta?.content) {
                                                sendContentEvent(controller, finalData.choices[0].delta.content);
                                            }
                                        } catch (e) {
                                             console.error('[流式对话] 解析最终回复事件出错:', e, 'Line:', finalLine);
                                        }
                                    }
                                }
                            }
                            // 如果有工具状态，通知客户端
                             if (effectiveSessionId) {
                                const currentSessionInfo = mcpClientService.getSessionInfo(effectiveSessionId);
                                if (currentSessionInfo && currentSessionInfo.toolState) {
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                      type: 'tool_state',
                                      state: currentSessionInfo.toolState
                                    })}\n\n`));
                                }
                             }
                        }
                    }

                    // 更新 Redis TTL (移到 try 块的末尾，确保成功后再更新)
                    if (effectiveSessionId) { // 再次检查，以防万一
                       try {
                           const redisKey = REDIS_SESSION_PREFIX + effectiveSessionId;
                           const currentSessionDataJson = await redis.get(redisKey);
                           if (currentSessionDataJson) {
                               const currentSessionData = JSON.parse(currentSessionDataJson);
                               currentSessionData.lastUsed = Date.now();
                               await redis.setex(redisKey, SESSION_TTL_SECONDS, JSON.stringify(currentSessionData));
                               console.log(`[流式对话] 成功更新会话 ${effectiveSessionId} 的 Redis TTL`);
                           } else {
                               console.warn(`[流式对话] 更新 TTL 时未在 Redis 中找到会话 ${effectiveSessionId}`);
                           }
                       } catch (redisError) {
                           console.error(`[流式对话] 更新会话 ${effectiveSessionId} 的 Redis TTL 失败:`, redisError);
                       }
                    }

                } catch (toolError) {
                    // <-- 日志：工具调用或后续处理出错
                    console.error('[流式对话] 工具调用或后续处理失败:', toolError);
                    const errorMessage = toolError instanceof Error
                      ? `工具调用失败: ${toolError.message}${toolError.cause ? `\n原因: ${JSON.stringify(toolError.cause)}` : ''}`
                      : `工具调用失败: ${JSON.stringify(toolError)}`;
                    sendContentEvent(controller, `\n❌ ${errorMessage}`);
                    sendErrorEvent(controller, errorMessage); // 发送错误事件
                    // 这里不关闭 controller，让流程自然走到最后的 close
                }
            } else if (toolCallDetected && (!effectiveSessionId || !isConnectionInMemory)) {
                // <-- 日志：检测到工具调用但无法执行
                console.warn(`[流式对话] 检测到工具调用 ${toolCallName}，但会话 ${effectiveSessionId || '无效'} 或连接不在内存中 (${isConnectionInMemory})，无法执行`);
                sendErrorEvent(controller, `无法执行工具 ${toolCallName}：连接丢失或会话无效`);
            }
            // --- 工具调用结束 ---

        } catch (fetchError) { // <--- 捕获构造请求体或 fetch 调用本身的错误
            // <-- 日志：第一次 LLM 调用出错
            console.error('[流式对话] 调用第一次 LLM API 前或期间出错:', fetchError);
            sendErrorEvent(controller, `调用 LLM API 时出错: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
            // 不再关闭控制器，让外层 catch 处理
            throw fetchError; // 重新抛出，让外层捕获
        }

        // <-- 日志：准备关闭流
        console.log('[流式对话] 所有处理完成或遇到无法恢复的错误，准备关闭流');
        controller.close(); // 确保在所有逻辑结束后关闭

      } catch (error) {
         // ... (整体错误处理) ...
         // <-- 日志：最外层捕获到错误
         console.error('[流式对话] 最外层捕获到未处理的错误:', error);
         // 确保即使内部有错误，也尝试关闭控制器
         try {
            sendErrorEvent(controller, error instanceof Error ? error.message : '处理对话时发生未知错误');
         } catch (enqueueError) {
            console.error('[流式对话] 发送最终错误信息失败:', enqueueError);
         } finally {
            // <-- 日志：在最终 finally 块中关闭流
            console.log('[流式对话] 在最终 finally 块中关闭流');
            controller.close();
         }
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