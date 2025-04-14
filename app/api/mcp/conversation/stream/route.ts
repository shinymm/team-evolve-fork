import { NextResponse } from "next/server";
import { mcpClientService } from "@/server/services/mcp-client.service";
import { decrypt } from "@/lib/utils/encryption-utils";
import { getApiEndpointAndHeaders } from "@/lib/services/ai-service";
import { AIModelConfig } from "@/lib/services/ai-service";
import { aiModelConfigService } from "@/lib/services/ai-model-config-service";
import { getRedisClient } from '@/lib/redis';
import { QueuedToolCall } from '@/types/mcp'; // 导入QueuedToolCall接口
import { getCurrentUser } from '@/lib/utils/auth-utils'; // 导入获取用户信息的函数

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
  // --- 获取当前用户信息 --- 
  const user = await getCurrentUser();
  if (!user) {
      // 如果没有登录用户，根据你的业务逻辑处理
      // 可以返回 401 未授权错误，或者允许匿名访问（如果设计如此）
      console.error("[API Stream] Unauthorized: No authenticated user found.");
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const userId = user.id;
  const userEmail = user.email; 
  console.log(`[API Stream] Authenticated user: ${userEmail} (ID: ${userId})`);

  // 创建流式响应
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 初始化工具调用队列
        const toolCallQueue: QueuedToolCall[] = [];

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
        let availableTools: any[] = []; // 确保在外部声明
        let connectCommand: string | undefined;
        let connectArgs: string[] | undefined;
        // 移除错误的 session.user 访问
        // const user = session.user; 
        // const userId = user?.id;
        // const userEmail = user?.email || 'anonymous';

        // --- 生成或获取 Redis 会话 Key (使用真实用户信息) --- 
        const sessionKey = effectiveSessionId ? REDIS_SESSION_PREFIX + effectiveSessionId : REDIS_SESSION_PREFIX + `user:${userId}:${Date.now()}`; // 优先使用 userId
        console.log(`[API Stream] Using Redis session key: ${sessionKey}`);

        // --- 步骤 1: 尝试从 Redis 获取会话数据 --- 
        if (effectiveSessionId) {
            const redisKey = REDIS_SESSION_PREFIX + effectiveSessionId;
            try {
                // 改用 hgetall 读取 Hash
                const sessionDataHash = await redis.hgetall(redisKey);
                // 检查返回的是否是有效的 Hash (非空对象)
                if (sessionDataHash && Object.keys(sessionDataHash).length > 0) {
                    // 将 Hash 数据转换为 sessionData 对象 (注意类型转换)
                    sessionData = {
                        sessionId: sessionDataHash.sessionId,
                        connectionParams: JSON.parse(sessionDataHash.connectionParams || '{}'),
                        tools: JSON.parse(sessionDataHash.tools || '[]'),
                        formattedTools: JSON.parse(sessionDataHash.formattedTools || '[]'),
                        aiModelConfig: JSON.parse(sessionDataHash.aiModelConfig || '{}'),
                        systemPrompt: sessionDataHash.systemPrompt,
                        memberInfo: JSON.parse(sessionDataHash.memberInfo || '{}'),
                        startTime: parseInt(sessionDataHash.startTime || '0', 10),
                        lastUsed: parseInt(sessionDataHash.lastUsed || '0', 10),
                    };
                    console.log(`[流式对话] 从 Redis 成功加载会话 ${effectiveSessionId} (Hash)`);
                    
                    // 更新 lastUsed 和 TTL
                    sessionData.lastUsed = Date.now();
                    // 改为 hset 更新字段 + expire 设置 TTL
                    await redis.hset(redisKey, 'lastUsed', sessionData.lastUsed.toString()); 
                    await redis.expire(redisKey, SESSION_TTL_SECONDS);
                    console.log(`[流式对话] 更新会话 ${effectiveSessionId} 的 lastUsed 和 TTL`);
                    
                    // 检查连接是否在当前内存中
                    isConnectionInMemory = mcpClientService.getSessionInfo(effectiveSessionId) !== null;
                    if (isConnectionInMemory) {
                       console.log(`[流式对话] 会话 ${effectiveSessionId} 连接在内存中活跃`);
                    }

                } else {
                    console.log(`[流式对话] Redis 中未找到会话 ${effectiveSessionId} (或为空 Hash)，视为无效会话`);
                    effectiveSessionId = undefined; 
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
                 let httpUrl: string | undefined;
                 let isUnsupportedConfig = false;

                 if (savedConnectionParams.url) { // 只处理 URL 配置
                     httpUrl = savedConnectionParams.url;
                 } else {
                     // 其他配置（包括 Stdio 或无效配置）均视为不支持
                     isUnsupportedConfig = true;
                     console.error('[流式对话] Redis 中存储的 connectionParams 无效或为不支持的 Stdio 类型');
                 }

                 if (httpUrl) {
                     // --- Streamable HTTP 重连 --- 
                     console.log(`[流式对话] Reconnecting with Streamable HTTP: ${httpUrl}, Session ID: ${effectiveSessionId}`);
                     try {
                         const connectResult = await mcpClientService.connect(httpUrl, effectiveSessionId);
                         const newSessionIdAfterReconnect = connectResult.sessionId;
                         console.log(`[流式对话] Reconnect successful, new session ID: ${newSessionIdAfterReconnect}`);
                         effectiveSessionId = newSessionIdAfterReconnect;
                         sessionInfo = mcpClientService.getSessionInfo(effectiveSessionId);
                         if (sessionInfo) {
                             availableTools = sessionInfo.tools || [];
                         } else {
                            console.warn(`[流式对话] 重连成功但无法立即获取 sessionInfo for ${effectiveSessionId}`);
                            availableTools = connectResult.tools;
                         }
                         await redis.hmset(sessionKey, { sessionId: effectiveSessionId });
                         console.log(`[API Stream] Redis session ${sessionKey} updated with new sessionId after reconnect.`);
                         isConnectionInMemory = true;

                     } catch (reconnectError) {
                         console.error("[API Stream] Reconnect attempt failed:", reconnectError);
                         effectiveSessionId = undefined;
                         sessionInfo = null;
                         isConnectionInMemory = false;
                         await redis.hdel(sessionKey, 'sessionId');
                         sendStatusEvent(controller, `警告: 无法重新连接到工具服务 (${reconnectError instanceof Error ? reconnectError.message : String(reconnectError)})`);
                     }
                 } else if (isUnsupportedConfig) {
                      // --- 不支持的配置（Stdio 或无效）--- 
                      console.error(`[API Stream] Reconnect failed: Connection type from Redis is no longer supported or invalid.`);
                      effectiveSessionId = undefined; sessionInfo = null; isConnectionInMemory = false; await redis.hdel(sessionKey, 'sessionId');
                      sendStatusEvent(controller, '警告: 旧的或无效的连接方式不再支持，无法重连工具服务');
                 } else {
                      // --- 缺少必要参数 --- 
                      console.warn(`[流式对话] Redis 中会话 ${effectiveSessionId} 的 connectionParams 格式无效或不完整，无法重连`);
                      effectiveSessionId = undefined; sessionInfo = null; isConnectionInMemory = false; await redis.hdel(sessionKey, 'sessionId');
                 }
             } else {
                 console.warn(`[流式对话] Redis 中会话 ${effectiveSessionId} 缺少 connectionParams，无法重新连接`);
                 effectiveSessionId = undefined; sessionInfo = null; isConnectionInMemory = false; await redis.hdel(sessionKey, 'sessionId');
             }
        }
        // --- 重连逻辑结束 ---

        // --- 如果仍然没有会话 (首次连接或重连失败)，则创建新会话 --- 
        if (!sessionInfo) {
            console.log("[API Stream] No active session, creating a new one...");
            effectiveSessionId = undefined; 
            const mcpConfigJson = memberInfo?.mcpConfigJson;
            let mcpConfig: any = {}; // 初始化为空对象
            if (mcpConfigJson) {
                try {
                    mcpConfig = JSON.parse(mcpConfigJson);
                } catch (parseError) {
                    console.error("[API Stream] Failed to parse mcpConfigJson:", parseError);
                    // JSON 解析失败，视为没有有效配置
                    return new NextResponse(
                        JSON.stringify({ error: "提供的 MCP 配置 JSON 格式无效。"}),
                        { status: 400, headers: { 'Content-Type': 'application/json' } }
                    );
                }
            }
            
            // --- 添加检查：确保 mcpConfig 和 mcpConfig.mcpServers 有效 ---
            if (!mcpConfig || typeof mcpConfig !== 'object' || !mcpConfig.mcpServers || typeof mcpConfig.mcpServers !== 'object') {
                console.error("[API Stream] Invalid mcpConfig structure: mcpServers object is missing or invalid.", mcpConfig);
                return new NextResponse(
                   JSON.stringify({ error: "MCP 配置无效：缺少 mcpServers 对象或格式错误。"}),
                   { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }
            // --- 检查结束 ---

            const serverNames = Object.keys(mcpConfig.mcpServers);
            if (serverNames.length === 0) {
                console.error("[API Stream] mcpConfig.mcpServers is empty.");
                return new NextResponse(
                   JSON.stringify({ error: "MCP 配置无效：mcpServers 对象不能为空。"}),
                   { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }

            const firstServerName = serverNames[0];
            const firstServerConfig = mcpConfig.mcpServers[firstServerName];

            // 严格检查是否为 Streamable HTTP 配置
            if (firstServerConfig && typeof firstServerConfig === 'object' && 'url' in firstServerConfig && typeof firstServerConfig.url === 'string' && !('command' in firstServerConfig) && !('args' in firstServerConfig)) {
                const httpUrl = firstServerConfig.url;
                try {
                    console.log(`[API Stream] Connecting to new Streamable HTTP server: ${httpUrl}`);
                    const connectResult = await mcpClientService.connect(httpUrl);
                    effectiveSessionId = connectResult.sessionId;
                    availableTools = connectResult.tools;
                    sessionInfo = mcpClientService.getSessionInfo(effectiveSessionId);
                    console.log(`[API Stream] New connection successful, Session ID: ${effectiveSessionId}`);
                    
                    // 保存到 Redis (hmset 保持不变，但确保所有字段都是字符串)
                    const connectionParamsToSave = { url: httpUrl }; 
                    const dataToSave: Record<string, string> = {
                        sessionId: effectiveSessionId,
                        connectionParams: JSON.stringify(connectionParamsToSave),
                        tools: JSON.stringify(availableTools), // 确保 tools 是字符串
                        formattedTools: JSON.stringify(sessionInfo?.formattedTools || []), // 确保存储格式化工具
                        aiModelConfig: JSON.stringify(sessionInfo?.aiModelConfig || {}), // 确保 aiConfig 是字符串
                        systemPrompt: sessionInfo?.systemPrompt || '', // 确保 systemPrompt 是字符串
                        memberInfo: JSON.stringify(sessionInfo?.memberInfo || {}), // 确保 memberInfo 是字符串
                        startTime: sessionInfo?.startTime?.toString() || Date.now().toString(), // 确保存储时间戳
                        lastUsed: sessionInfo?.lastUsed?.toString() || Date.now().toString()
                    };
                    await redis.hmset(sessionKey, dataToSave);
                    // 设置 TTL
                    await redis.expire(sessionKey, SESSION_TTL_SECONDS);
                    console.log(`[API Stream] New session ${effectiveSessionId} saved to Redis (Hash) for ${sessionKey}`);

                } catch (connectError) {
                    console.error("[API Stream] Initial connection failed:", connectError);
                    // 使用 NextResponse 返回错误
                    return new NextResponse(
                      JSON.stringify({ error: `连接 MCP 服务器失败: ${connectError instanceof Error ? connectError.message : String(connectError)}` }),
                      { status: 500, headers: { 'Content-Type': 'application/json' } }
                    );
                }
            } else {
                 console.error("[API Stream] Invalid or unsupported MCP server configuration for initial connection:", firstServerConfig);
                 // 使用 NextResponse 返回错误
                 return new NextResponse(
                    JSON.stringify({ error: "无效或不支持的 MCP 服务器配置：只支持 Streamable HTTP URL 配置。请检查 mcpConfig.mcpServers 中的第一个条目。"}),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                 );
            }
        }

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
                  // if (rawChunk.includes('data:')) {
                  //     console.log('[流式对话] 收到原始 Chunk:', rawChunk);
                  // }
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
      
                              if (data.choices && data.choices[0]) {
                                const delta = data.choices[0].delta || {};
          
                                // 处理工具调用 - 方案二: 只记录工具调用的出现，不累积参数
                                if (delta.tool_calls && delta.tool_calls.length > 0) {
                                  toolCallDetected = true;
                                  
                                  // 遍历检测到的工具调用
                                  for (let i = 0; i < delta.tool_calls.length; i++) {
                                    const toolCall = delta.tool_calls[i];
                                    
                                    // 只处理有名称的新工具调用
                                    if (toolCall.function?.name && toolCall.id) {
                                      // 检查是否是新工具调用
                                      const existingTool = toolCallQueue.find(tc => tc.id === toolCall.id);
                                      if (!existingTool) {
                                        // 记录新工具
                                        const newTool = {
                                          id: toolCall.id,
                                          name: toolCall.function.name,
                                          args: {},
                                          executed: false
                                        };
                                        toolCallQueue.push(newTool);
                                        
                                        // 发送工具启动消息
                                        const toolStartMessage = `🔧 正在使用工具: ${toolCall.function.name}\n`;
                                        sendContentEvent(controller, toolStartMessage);
                                        
                                        console.log(`[流式对话] 检测到新工具: ${toolCall.function.name} (ID: ${toolCall.id})`);
                                      }
                                    }
                                  }
                                  
                                  // 显示"处理中"信息
                                  if (!accumContent.includes('处理中')) {
                                    sendContentEvent(controller, '处理中...');
                                    accumContent = '处理中...';
                                  }
                                }
                                // 处理普通内容更新
                                else if (delta.content) {
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
            console.log('[流式对话] 退出了流处理循环');
            
            // 方案二: 流处理结束后，向LLM API发送一次非流式请求，获取完整的工具调用信息
            if (toolCallDetected && toolCallQueue.length > 0) {
              try {
                console.log('[流式对话] 流结束后，发送非流式请求获取完整工具调用');
                
                // 使用相同的请求体，但禁用流式响应
                const completeRequestBody: any = {
                  model: apiConfig.model,
                  messages: messages,
                  temperature: apiConfig.temperature || 0.7,
                  max_tokens: 1000,
                  stream: false // 非流式请求
                };
                
                // 如果有工具列表，添加到请求中
                if (useMcpMode && formattedTools.length > 0) {
                  completeRequestBody.tools = formattedTools
                    .filter(tool => tool && typeof tool === 'object' && tool.name)
                    .map(tool => ({
                      type: "function",
                      function: {
                        name: tool.name,
                        description: tool.description || `使用${tool.name}工具执行操作`,
                        parameters: tool.input_schema || {}
                      }
                    }));
                  completeRequestBody.tool_choice = "auto";
                }
                
                // 发送非流式请求
                const completeResponse = await fetch(endpoint, {
                  method: "POST",
                  headers,
                  body: JSON.stringify(completeRequestBody),
                });
                
                if (!completeResponse.ok) {
                  throw new Error(`获取完整工具调用信息失败: ${completeResponse.status}`);
                }
                
                // 解析完整响应
                const completeResult = await completeResponse.json();
                console.log('[流式对话] 成功获取完整响应:', {
                  hasChoices: !!completeResult.choices,
                  choicesLength: completeResult.choices?.length || 0
                });
                
                // 从完整响应中提取工具调用信息
                if (completeResult.choices && completeResult.choices.length > 0 && 
                    completeResult.choices[0].message && 
                    completeResult.choices[0].message.tool_calls) {
                  
                  const completeTool_calls = completeResult.choices[0].message.tool_calls;
                  console.log(`[流式对话] 从完整响应中提取到 ${completeTool_calls.length} 个工具调用`);
                  
                  // 更新工具队列中的信息
                  for (const fullToolCall of completeTool_calls) {
                    // 查找对应的工具
                    const queuedTool = toolCallQueue.find(tc => tc.id === fullToolCall.id);
                    
                    if (queuedTool) {
                      // 如果工具在队列中，直接更新参数
                      try {
                        if (fullToolCall.function && fullToolCall.function.arguments) {
                          queuedTool.args = JSON.parse(fullToolCall.function.arguments);
                          console.log(`[流式对话] 成功解析工具 ${queuedTool.name} 的完整参数`);
                        } else {
                          console.warn(`[流式对话] 工具 ${queuedTool.name} 在完整响应中没有参数`);
                        }
                      } catch (parseError) {
                        console.error(`[流式对话] 解析工具 ${queuedTool.name} 参数失败:`, parseError);
                        // 尝试手动解析
                        try {
                          const argsString = fullToolCall.function.arguments.trim();
                          // 简单修复JSON格式问题
                          const fixedArgsString = argsString
                            .replace(/(\{|\,)\s*([a-zA-Z0-9_]+)\s*\:/g, '$1"$2":')
                            .replace(/\:\s*([a-zA-Z0-9_]+)(\s*[\,\}])/g, ':"$1"$2')
                            .replace(/([{,]\s*"[^"]+):\s*"([^"]*?)(?=,\s*"|\s*})/g, '$1":"$2"');
                          
                          queuedTool.args = JSON.parse(fixedArgsString);
                          console.log(`[流式对话] 修复后成功解析工具 ${queuedTool.name} 参数`);
                        } catch (e) {
                          // 如果仍然失败，使用包含原始字符串的对象
                          queuedTool.args = { raw: fullToolCall.function.arguments };
                          console.error(`[流式对话] 无法修复和解析工具 ${queuedTool.name} 参数`);
                        }
                      }
                    } else {
                      // 如果工具不在队列中（可能是之前漏了），添加到队列
                      try {
                        const args = fullToolCall.function && fullToolCall.function.arguments ? 
                          JSON.parse(fullToolCall.function.arguments) : {};
                          
                        toolCallQueue.push({
                          id: fullToolCall.id,
                          name: fullToolCall.function.name,
                          args: args,
                          executed: false
                        });
                        
                        console.log(`[流式对话] 从完整响应添加新工具 ${fullToolCall.function.name} 到队列`);
                      } catch (e) {
                        console.error(`[流式对话] 添加新工具失败:`, e);
                      }
                    }
                  }
                } else {
                  console.warn('[流式对话] 完整响应中未找到工具调用信息');
                }
              } catch (error) {
                console.error('[流式对话] 获取完整工具调用信息失败:', error);
              }
            }

            // <-- 日志：检查工具队列状态
            console.log('[流式对话] 工具解析完成后状态:', {
              toolCallDetected,
              queueSize: toolCallQueue.length,
              effectiveSessionId: effectiveSessionId || '无',
              isConnectionInMemory
            });

            // --- 工具调用逻辑 ---
            if (toolCallDetected && toolCallQueue.length > 0 && effectiveSessionId && isConnectionInMemory) {
                try {
                    console.log(`[流式对话] 开始按顺序处理 ${toolCallQueue.length} 个工具调用`);
                    
                    // 准备消息历史，从原始消息开始
                    let updatedMessages: ChatMessage[] = [...messages];
                    
                    // 依次处理每个工具调用
                    for (let i = 0; i < toolCallQueue.length; i++) {
                        const queuedTool = toolCallQueue[i];
                        
                        // 跳过无效的工具调用
                        if (!queuedTool.name || (Object.keys(queuedTool.args || {}).length === 0 && !queuedTool.argsString)) {
                            console.warn(`[流式对话] 跳过无效的工具调用 #${i+1}: ${queuedTool.name || '未命名'} (ID: ${queuedTool.id})`);
                            continue;
                        }
                        
                        console.log(`[流式对话] 执行工具 ${i+1}/${toolCallQueue.length}: ${queuedTool.name} (ID: ${queuedTool.id})`);
                        
                        // 检查工具名是否包含连接的多个工具名
                        const possibleToolPrefixes = [
                          'get_', 'search_', 'query_', 'fetch_', 'create_', 'update_', 'delete_'
                        ];
                        
                        let toolName = queuedTool.name;
                        // 解析可能连接的工具名
                        for (const prefix of possibleToolPrefixes) {
                          const prefixIndex = queuedTool.name.indexOf(prefix);
                          if (prefixIndex > 0) {
                            console.warn(`[流式对话] 执行前检测到工具名可能被错误连接: "${queuedTool.name}"`);
                            // 只保留前缀开始的部分作为实际工具名
                            toolName = queuedTool.name.substring(prefixIndex);
                            console.log(`[流式对话] 修复后的工具名: "${toolName}" (原始: "${queuedTool.name}")`);
                            break;
                          }
                        }
                        
                        try {
                            // 执行工具调用
                            console.log(`[流式对话] 调用工具 ${toolName}`, {
                              args: JSON.stringify(queuedTool.args).substring(0,100) + '...'
                            });
                            
                            const toolResult = await mcpClientService.callTool(effectiveSessionId, toolName, queuedTool.args);
                            console.log(`[流式对话] 工具 ${toolName} 调用完成，原始结果:`, 
                              JSON.stringify(toolResult).substring(0, 200) + (JSON.stringify(toolResult).length > 200 ? '...' : '')
                            );
                            
                            // 获取工具结果文本
                            let resultText = '';
                            try {
                              // 简化的工具结果处理逻辑，不尝试递归解析JSON
                              if (typeof toolResult === 'string') {
                                resultText = toolResult;
                              } else if (toolResult === null || toolResult === undefined) {
                                resultText = '工具未返回结果';
                              } else if (typeof toolResult === 'object') {
                                // 基础提取，尝试从常见字段获取结果
                                if (typeof toolResult.content === 'string') {
                                  resultText = toolResult.content;
                                } else if (typeof toolResult.text === 'string') {
                                  resultText = toolResult.text;
                                } else if (typeof toolResult.message?.content === 'string') {
                                  resultText = toolResult.message.content;
                                } else if (typeof toolResult.result === 'string') {
                                  resultText = toolResult.result;
                                } else if (Array.isArray(toolResult.content)) {
                                  // 简单处理content数组，不递归处理
                                  const textItem = toolResult.content.find((item: any) => item?.type === 'text' && typeof item.text === 'string');
                                  if (textItem) {
                                    resultText = textItem.text;
                                  }
                                } else {
                                  // 对象类型直接转JSON字符串
                                  try {
                                    resultText = JSON.stringify(toolResult);
                                  } catch (stringifyError) {
                                    resultText = "无法序列化工具结果对象";
                                  }
                                }
                              } else {
                                // 其他类型直接转字符串
                                resultText = String(toolResult);
                              }
                              
                              // 特殊处理sequentialthinking工具：在会话中保存状态
                              if ((toolName === 'sequentialthinking' || toolName === 'mcp_sequential_thinking_sequentialthinking')
                                  && typeof toolResult === 'object' && toolResult.nextThoughtNeeded === true) {
                                  mcpClientService.setSessionInfo(effectiveSessionId, {
                                    toolState: { name: toolName, state: toolResult }
                                  });
                                  if (toolResult.thoughtNumber && toolResult.totalThoughts) {
                                    resultText += `\n(进度: ${toolResult.thoughtNumber}/${toolResult.totalThoughts})`;
                                    sendStatusEvent(controller, `这是思考过程 ${toolResult.thoughtNumber}/${toolResult.totalThoughts}，请继续对话以完成思考`);
                                  }
                              }
                            } catch (e) {
                              resultText = `工具执行成功，但结果格式无法处理: ${e instanceof Error ? e.message : '未知错误'}`;
                            }
                            
                            // 确保结果是字符串并截断过长内容
                            resultText = String(resultText);
                            const maxContentLength = 2000; // 减小展示给用户的内容长度
                            const contentForDisplay = resultText.length > maxContentLength 
                              ? resultText.substring(0, maxContentLength) + `...\n(完整结果太长，已截断显示前${maxContentLength}字符)`
                              : resultText;
                            
                            // 标记工具为已执行并保存结果
                            queuedTool.executed = true;
                            queuedTool.result = resultText; // 保存完整结果，但在传输时会截断
                            
                            // 向用户发送当前工具的执行结果
                            sendContentEvent(controller, `\n⚙️ 工具 ${toolName} 执行结果:\n${contentForDisplay}`);
                            
                            // 发送工具状态更新
                            sendToolStateEvent(controller, queuedTool);
                            
                            // 将当前工具调用和结果添加到消息历史
                            updatedMessages.push({
                                role: "assistant",
                                content: null,
                                tool_calls: [{
                                    id: queuedTool.id,
                                    type: "function",
                                    function: {
                                        name: toolName,
                                        arguments: JSON.stringify(queuedTool.args)
                                    }
                                }]
                            });
                            
                            updatedMessages.push({
                                role: "tool",
                                tool_call_id: queuedTool.id,
                                name: toolName,
                                content: resultText
                            });
                            
                            console.log(`[流式对话] 工具 ${toolName} 执行完毕，已添加到消息历史`);
                            
                        } catch (singleToolError) {
                            // 记录单个工具执行错误，但继续处理队列中的下一个工具
                            console.error(`[流式对话] 工具 ${queuedTool.name} 执行失败:`, singleToolError);
                            const errorMessage = singleToolError instanceof Error
                                ? singleToolError.message
                                : JSON.stringify(singleToolError);
                                
                            // 向用户发送错误消息
                            sendContentEvent(controller, `\n❌ 工具 ${queuedTool.name} 执行失败: ${errorMessage}`);
                            
                            // 标记工具为已执行（尽管失败）
                            queuedTool.executed = true;
                            queuedTool.result = `执行失败: ${errorMessage}`;
                            
                            // 发送工具状态更新（失败）
                            sendToolStateEvent(controller, queuedTool);
                            
                            // 将失败的工具调用也添加到消息历史
                            updatedMessages.push({
                                role: "assistant",
                                content: null,
                                tool_calls: [{
                                    id: queuedTool.id,
                                    type: "function",
                                    function: {
                                        name: queuedTool.name,
                                        arguments: JSON.stringify(queuedTool.args)
                                    }
                                }]
                            });
                            
                            updatedMessages.push({
                                role: "tool",
                                tool_call_id: queuedTool.id,
                                name: queuedTool.name,
                                content: `执行失败: ${errorMessage}`
                            });
                        }
                        
                        // 打印当前队列的处理进度
                        console.log(`[流式对话] 工具队列处理进度: ${i+1}/${toolCallQueue.length}`);
                    }
                    
                    // 处理完所有工具后，发送最终的工具队列状态
                    if (toolCallQueue.length > 1) {
                        console.log(`[流式对话] 发送最终的工具队列状态 (共 ${toolCallQueue.length} 个工具)`);
                        sendToolStateEvent(controller, toolCallQueue);
                    }
                    
                    // 全部工具处理完成，检查并清除工具状态（除非有sequentialthinking工具设置了状态）
                    const currentSessionInfo = mcpClientService.getSessionInfo(effectiveSessionId);
                    const hasSequentialThinkingState = currentSessionInfo?.toolState?.name === 'sequentialthinking' || 
                                                      currentSessionInfo?.toolState?.name === 'mcp_sequential_thinking_sequentialthinking';
                    if (!hasSequentialThinkingState) {
                        mcpClientService.setSessionInfo(effectiveSessionId, { toolState: undefined });
                    }
                    
                    // 发送新轮次开始信号
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'new_turn' })}\n\n`));
                    console.log('[流式对话] 所有工具执行完毕，发送 new_turn 信号');
                    
                    // <-- 日志：准备最终 LLM 调用
                    console.log(`[流式对话] 准备进行最终 LLM 调用以生成回复 (消息数量: ${updatedMessages.length})`);
                    
                    // 消息验证与修复
                    for (let i = 0; i < updatedMessages.length; i++) {
                        const msg = updatedMessages[i];
                        // 修复 tool 消息，确保 content 字段存在且为字符串
                        if (msg.role === 'tool') {
                            if (msg.content === undefined || msg.content === null) {
                                console.warn(`[流式对话] 修复第${i}条消息(tool): 添加空字符串content`);
                                updatedMessages[i] = {...msg, content: ""};
                            } else if (typeof msg.content !== 'string') {
                                // 如果content不是字符串，转换为字符串
                                try {
                                    const contentStr = JSON.stringify(msg.content);
                                    console.warn(`[流式对话] 修复第${i}条消息(tool): 将非字符串content转换为JSON字符串`);
                                    updatedMessages[i] = {...msg, content: contentStr};
                                } catch (e) {
                                    console.warn(`[流式对话] 修复第${i}条消息(tool): 非字符串content转换失败，设为空字符串`);
                                    updatedMessages[i] = {...msg, content: ""};
                                }
                            }
                        }
                        // 针对 assistant 消息，如果没有tool_calls或tool_calls为空，确保content有值
                        if (msg.role === 'assistant') {
                            const hasCalls = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
                            if (!hasCalls && (msg.content === null || msg.content === undefined)) {
                                console.warn(`[流式对话] 修复第${i}条消息(assistant): 添加空字符串content`);
                                updatedMessages[i] = {...msg, content: ""};
                            }
                        }
                        
                        // 处理system和user消息
                        if ((msg.role === 'system' || msg.role === 'user') && 
                            (msg.content === null || msg.content === undefined)) {
                            console.warn(`[流式对话] 修复第${i}条消息(${msg.role}): 添加空字符串content`);
                            updatedMessages[i] = {...msg, content: ""};
                        }
                    }
                    
                    // 单独处理每条消息，确保完全符合API要求
                    const finalMessages = updatedMessages.map((msg, idx) => {
                        const result: any = { role: msg.role };
                        
                        // 根据消息类型设置必需字段
                        if (msg.role === 'assistant') {
                            // assistant消息可以有content和tool_calls，但至少有一个
                            if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
                                result.tool_calls = msg.tool_calls;
                                // 如果有tool_calls但没有content，需要显式设置为null
                                result.content = msg.content !== undefined ? msg.content : null;
                            } else {
                                // 如果没有tool_calls，content必须有值
                                result.content = msg.content || "";
                            }
                        } else if (msg.role === 'tool') {
                            // tool消息必须有tool_call_id、name和content
                            result.tool_call_id = msg.tool_call_id;
                            result.name = msg.name;
                            result.content = typeof msg.content === 'string' ? msg.content : "";
                        } else {
                            // system和user消息必须有content
                            result.content = msg.content || "";
                        }
                        
                        return result;
                    });
                    
                    // 检查消息结构
                    const messagesDebug = finalMessages.map((msg, idx) => ({
                        index: idx,
                        role: msg.role,
                        hasContent: msg.content !== undefined,
                        contentType: msg.content !== undefined ? typeof msg.content : 'undefined',
                        contentNull: msg.content === null,
                        hasTool: !!msg.tool_calls || !!msg.tool_call_id
                    }));
                    console.log(`[流式对话] 最终消息结构检查: ${JSON.stringify(messagesDebug)}`);
                    
                    // 最终LLM调用
                    const finalResponse = await fetch(endpoint, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            model: apiConfig.model,
                            messages: finalMessages, // 使用修复后的消息列表
                            temperature: apiConfig.temperature || 0.7,
                            max_tokens: 1000,
                            stream: true
                        }),
                    });
                    
                    // <-- 日志：最终 LLM 调用响应状态
                    console.log(`[流式对话] 最终 LLM 调用响应状态: ${finalResponse.status}`);

                    if (!finalResponse.ok) {
                      const finalText = await finalResponse.text();
                      // <-- 日志：最终 LLM 调用失败
                      console.error(`[流式对话] 最终 LLM 调用失败 (${finalResponse.status}): ${finalText}`);
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
                            // sendContentEvent(controller, `\n\n`); // 移除：不再需要手动添加换行分隔，由前端处理新气泡
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
                                    // 使用新的发送工具状态事件函数
                                    const toolStateInfo: QueuedToolCall = {
                                        id: `state_${Date.now()}`,
                                        name: currentSessionInfo.toolState.name,
                                        args: {},
                                        executed: false,
                                        result: JSON.stringify(currentSessionInfo.toolState.state)
                                    };
                                    sendToolStateEvent(controller, toolStateInfo);
                                }
                            }
                        }
                    }

                    // 更新 Redis TTL
                    if (effectiveSessionId) {
                       try {
                           const redisKey = REDIS_SESSION_PREFIX + effectiveSessionId;
                           // 使用hgetall替代get，因为Redis中存储的是哈希结构
                           const currentSessionDataHash = await redis.hgetall(redisKey);
                           if (currentSessionDataHash && Object.keys(currentSessionDataHash).length > 0) {
                               // 更新lastUsed字段
                               await redis.hset(redisKey, 'lastUsed', Date.now().toString());
                               // 刷新TTL
                               await redis.expire(redisKey, SESSION_TTL_SECONDS);
                               console.log(`[流式对话] 成功更新会话 ${effectiveSessionId} 的 Redis TTL`);
                           } else {
                               console.warn(`[流式对话] 更新 TTL 时未在 Redis 中找到会话 ${effectiveSessionId} 或哈希为空`);
                           }
                       } catch (redisError) {
                           console.error(`[流式对话] 更新会话 ${effectiveSessionId} 的 Redis TTL 失败:`, redisError);
                       }
                    }

                } catch (toolError) {
                    // <-- 日志：整体工具处理过程出错
                    console.error('[流式对话] 工具调用队列处理失败:', toolError);
                    const errorMessage = toolError instanceof Error
                      ? `工具调用处理失败: ${toolError.message}${toolError.cause ? `\n原因: ${JSON.stringify(toolError.cause)}` : ''}`
                      : `工具调用处理失败: ${JSON.stringify(toolError)}`;
                    sendContentEvent(controller, `\n❌ ${errorMessage}`);
                    sendErrorEvent(controller, errorMessage);
                }
            } else if (toolCallDetected && (!effectiveSessionId || !isConnectionInMemory)) {
                // <-- 日志：检测到工具调用但无法执行
                console.warn(`[流式对话] 检测到工具调用，但会话 ${effectiveSessionId || '无效'} 或连接不在内存中 (${isConnectionInMemory})，无法执行`);
                sendErrorEvent(controller, `无法执行工具调用：连接丢失或会话无效`);
            } else if (toolCallDetected && toolCallQueue.length === 0) {
                // <-- 日志：检测到工具调用但队列为空
                console.warn(`[流式对话] 检测到工具调用，但工具队列为空`);
                sendErrorEvent(controller, `无法执行工具调用：工具队列为空`);
            }

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

// 发送工具状态事件的辅助函数（支持多工具）
function sendToolStateEvent(controller: ReadableStreamDefaultController, toolCalls: QueuedToolCall | QueuedToolCall[]) {
  // 处理单个工具调用的情况
  if (!Array.isArray(toolCalls)) {
    toolCalls = [toolCalls];
  }
  
  // 如果数组为空，不发送任何事件
  if (toolCalls.length === 0) {
    return;
  }
  
  try {
    // 如果只有一个工具调用，使用传统格式发送
    if (toolCalls.length === 1) {
      const toolCall = toolCalls[0];
      
      // 安全处理结果，确保它是一个有效的字符串，但不再截断
      let safeResult = "";
      if (toolCall.result !== undefined && toolCall.result !== null) {
        try {
          if (typeof toolCall.result !== 'string') {
            safeResult = JSON.stringify(toolCall.result);
          } else {
            safeResult = toolCall.result;
          }
          // 移除截断代码，保留完整结果
        } catch (e) {
          safeResult = String(toolCall.result);
        }
      }
      
      const payload = {
        type: 'tool_state',
        state: {
          id: toolCall.id,
          type: 'function',
          name: toolCall.name,
          arguments: toolCall.args,
          status: toolCall.executed ? 'success' : 'running',
          result: safeResult
        }
      };
      
      const serialized = JSON.stringify(payload);
      controller.enqueue(encoder.encode(`data: ${serialized}\n\n`));
      
      console.log(`[流式对话] 发送单个工具 ${toolCall.name} 的状态: ${toolCall.executed ? 'success' : 'running'}, 结果长度: ${safeResult.length}`);
      return;
    }
    
    // 多个工具调用的情况，使用states数组
    const states = toolCalls.map(toolCall => {
      // 安全处理每个工具的结果，但不截断
      let safeResult = "";
      if (toolCall.result !== undefined && toolCall.result !== null) {
        try {
          if (typeof toolCall.result !== 'string') {
            safeResult = JSON.stringify(toolCall.result);
          } else {
            safeResult = toolCall.result;
          }
          // 移除截断代码，保留完整结果
        } catch (e) {
          safeResult = String(toolCall.result);
        }
      }
      
      return {
        id: toolCall.id,
        type: 'function',
        name: toolCall.name,
        arguments: toolCall.args,
        status: toolCall.executed ? 'success' : 'running',
        result: safeResult
      };
    });
    
    // 安全序列化完整载荷
    const payload = {
      type: 'tool_state',
      states: states
    };
    
    const serialized = JSON.stringify(payload);
    controller.enqueue(encoder.encode(`data: ${serialized}\n\n`));
    
    console.log(`[流式对话] 发送 ${states.length} 个工具的状态更新, 序列化数据长度: ${serialized.length}`);
  } catch (error) {
    console.error('[流式对话] 发送工具状态事件失败:', error);
    // 发生错误时尝试逐个发送工具状态，并且极度简化内容
    if (Array.isArray(toolCalls) && toolCalls.length > 1) {
      console.log('[流式对话] 尝试逐个发送极度简化的工具状态...');
      for (const tool of toolCalls) {
        try {
          // 创建极度简化版本的工具调用对象
          const simplifiedTool = {
            id: tool.id,
            name: tool.name,
            args: {},
            executed: tool.executed,
            result: tool.executed ? "执行成功（结果已简化）" : ""
          };
          sendToolStateEvent(controller, simplifiedTool);
        } catch (e) {
          console.error(`[流式对话] 发送简化工具 ${tool.name} 状态失败:`, e);
        }
      }
    }
  }
}

// 检查JSON字符串是否完整（括号和引号配对）
function isCompleteJson(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  
  // 简单检查：必须以{开始，以}结束
  if (!str.trim().startsWith('{') || !str.trim().endsWith('}')) {
    return false;
  }
  
  let braceCount = 0;
  let inString = false;
  let escaped = false;
  
  for (const char of str) {
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    
    if (char === '"' && !escaped) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
  }
  
  return braceCount === 0 && !inString;
}