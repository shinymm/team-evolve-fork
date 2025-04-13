import { NextResponse } from 'next/server';
import { mcpClientService } from '@/server/services/mcp-client.service';
import { aiModelConfigService } from '@/lib/services/ai-model-config-service';
import { decrypt } from '@/lib/utils/encryption-utils';
import { getApiEndpointAndHeaders } from '@/lib/services/ai-service';
import { getRedisClient } from '@/lib/redis';

// 导入 Redis 客户端实例
const redis = getRedisClient(); // 在模块顶部获取实例

// 会话创建请求 (只接受 Streamable HTTP)
interface CreateSessionRequest {
  url: string; // 必须有 URL
  headers?: Record<string, string>; // 可选 headers
  memberInfo?: {
    name: string;
    role: string;
    responsibilities: string;
  };
  userSessionKey?: string; 
}

// 会话在 Redis 中存储的数据结构接口 (示例)
interface RedisSessionData {
  sessionId: string;
  connectionParams: any;
  tools: any[];
  formattedTools?: any[];
  aiModelConfig?: any; // 考虑是否存储解密后的 key
  systemPrompt?: string;
  memberInfo?: any;
  startTime: number;
  lastUsed: number;
}

// 定义 Redis key 的前缀
const REDIS_SESSION_PREFIX = 'mcp:session:';
// 定义会话 TTL (例如：3小时，与 mcpClientService 配置一致)
const SESSION_TTL_SECONDS = 3 * 60 * 60; 

// 使用服务端会话存储替代本地变量，避免热重载问题
const getUserSessionId = (userKey: string): string | null => {
  // 检查用户是否已经有关联会话，并验证会话是否有效
  try {
    // 从 mcpClientService 获取可能存在的会话ID
    const sessions = mcpClientService.getAllSessions();
    
    // 查找与用户关联的会话
    for (const sessionId of Object.keys(sessions)) {
      const session = sessions[sessionId];
      if (session && session.memberInfo && 
          session.memberInfo.userSessionKey === userKey) {
        // 找到用户关联的会话
        return sessionId;
      }
    }
  } catch (error) {
    console.error(`[会话API] 获取用户会话映射出错:`, error);
  }
  
  return null;
}

const saveUserSessionMapping = (userKey: string, sessionId: string) => {
  try {
    // 获取当前会话信息
    const currentSession = mcpClientService.getSessionInfo(sessionId);
    
    // 确保memberInfo存在且包含所有必要字段
    const updatedMemberInfo = {
      name: currentSession?.memberInfo?.name || 'Unknown',
      role: currentSession?.memberInfo?.role || 'AI助手',
      responsibilities: currentSession?.memberInfo?.responsibilities || '提供信息和帮助',
      userSessionKey: userKey
    };
    
    // 将用户会话键存储到会话信息中
    mcpClientService.setSessionInfo(sessionId, {
      memberInfo: updatedMemberInfo
    });
    
    console.log(`[会话API] 已关联用户 ${userKey} 到会话 ${sessionId}`);
  } catch (error) {
    console.error(`[会话API] 保存用户会话映射出错:`, error);
  }
}

/**
 * 创建 MCP 会话 (仅支持 Streamable HTTP)
 */
export async function POST(req: Request) {
  try {
    // 明确请求体类型，移除 command/args
    const { url, headers, memberInfo, userSessionKey } = await req.json() as CreateSessionRequest;
    
    // --- 参数验证 --- 
    if (!url) {
       return NextResponse.json({ error: '请求体必须包含 "url" 字段' }, { status: 400 });
    }
    // 可以在这里添加更严格的 URL 验证
    try {
        new URL(url);
    } catch (e) {
        return NextResponse.json({ error: `URL 格式无效: ${url}` }, { status: 400 });
    }

    // --- 会话复用逻辑 (如果需要，保持或调整) --- 
    // ... (这部分逻辑如果不再需要可以简化或移除) ...

    let sessionId: string;
    let tools: any[] = [];
    const connectionParams = { url }; // 只保存 URL

    // --- 连接逻辑 (只处理 Streamable HTTP) ---
    console.log(`[MCP会话] 创建 Streamable HTTP 会话: ${url}`);
    try {
        // 使用新的 connect 签名调用
        const connectResult = await mcpClientService.connect(url);
        sessionId = connectResult.sessionId;
        tools = connectResult.tools;
    } catch (connectError) {
        console.error(`[MCP会话] 连接到 ${url} 失败:`, connectError);
        return NextResponse.json({ 
            error: `连接 MCP 服务器失败: ${connectError instanceof Error ? connectError.message : String(connectError)}` 
        }, { status: 500 });
    }
    // --- 连接逻辑结束 ---

    // --- 获取 AI 配置和格式化工具 (逻辑不变) ---
    let aiConfig: any = null;
    let systemPrompt = "";
    let formattedTools: any[] = [];
    try {
        console.log(`[MCP会话] 为会话 ${sessionId} 加载AI模型配置...`);
        const defaultConfig = await aiModelConfigService.getDefaultConfig();
        if (defaultConfig) {
            const decryptedApiKey = await decrypt(defaultConfig.apiKey);
            aiConfig = {
                model: defaultConfig.model,
                baseURL: defaultConfig.baseURL,
                apiKey: "***REDACTED***", // 不存储解密后的 Key 到 Redis
                apiKeyId: defaultConfig.id, // 存储 Key 的 ID
                temperature: defaultConfig.temperature || 0.7
            };
            systemPrompt = memberInfo ? 
                `你是一个名为${memberInfo.name}的AI团队成员。${memberInfo.role}。你的职责是${memberInfo.responsibilities}。请提供专业、有价值的回复。` : 
                "你是一个专业的AI助手。回答用户问题时简洁清晰，提供有价值的信息。";
            
            formattedTools = tools.map(tool => {
                if (typeof tool === 'string') {
                    return { name: tool, description: `使用${tool}工具执行操作`, input_schema: {} };
                } else {
                    return {
                        name: tool.name,
                        description: tool.description || `使用${tool.name}工具执行操作`,
                        input_schema: tool.inputSchema || {}
                    };
                }
            });
             console.log(`[MCP会话] 会话 ${sessionId} 配置已加载`);
        } else {
             throw new Error("未配置默认AI模型");
        }
    } catch (configError) {
      console.error(`[MCP会话] 加载AI配置失败:`, configError);
      // 即使配置加载失败，也继续创建会话，但可能功能受限
    }
    // --- 配置加载结束 ---
    
    // --- 将会话数据写入 Redis (改用 HMSET) --- 
    const now = Date.now();
    const redisKey = REDIS_SESSION_PREFIX + sessionId;
    const finalMemberInfo = memberInfo ? { ...memberInfo, userSessionKey } : { userSessionKey };
    // 准备要写入 Hash 的数据，确保所有值都是字符串
    const dataToSave: Record<string, string> = {
        sessionId: sessionId,
        connectionParams: JSON.stringify(connectionParams), // connectionParams 只含 url
        tools: JSON.stringify(tools), // 序列化工具列表
        formattedTools: JSON.stringify(formattedTools), // 序列化格式化后的工具
        aiModelConfig: JSON.stringify(aiConfig || {}), // 序列化 AI 配置
        systemPrompt: systemPrompt || '', // 确保存储字符串
        memberInfo: JSON.stringify(finalMemberInfo || {}), // 序列化成员信息
        startTime: now.toString(), // 存储时间戳字符串
        lastUsed: now.toString()   // 存储时间戳字符串
    };

    try {
        // 使用 hmset 写入 Hash
        await redis.hmset(redisKey, dataToSave); 
        // 单独设置 TTL
        await redis.expire(redisKey, SESSION_TTL_SECONDS); 
        console.log(`[MCP会话] 会话 ${sessionId} 数据已写入 Redis (Hash)`);
    } catch (redisError) {
        console.error(`[MCP会话] 写入 Redis 失败 for ${sessionId}:`, redisError);
         // 保持之前的错误处理逻辑
         return NextResponse.json({ 
             sessionId, 
             tools: tools.map(t => ({ name: typeof t === 'string' ? t : t.name, description: typeof t === 'string' ? `使用${t}工具执行操作` : (t.description || `使用${t.name}工具执行操作`), inputSchema: typeof t === 'string' ? {} : (t.inputSchema || {})})), 
             warning: '会话已创建但状态可能未持久化' 
         }, { status: 201 }); 
    }
    // --- Redis 写入结束 ---

    // --- 返回给前端的数据 --- 
    return NextResponse.json({
      sessionId,
      tools: tools.map(t => ({ // 返回原始工具列表给前端
        name: typeof t === 'string' ? t : t.name, 
        description: typeof t === 'string' ? `使用${t}工具执行操作` : (t.description || `使用${t.name}工具执行操作`),
        inputSchema: typeof t === 'string' ? {} : (t.inputSchema || {})
      }))
    });
  } catch (error) {
    console.error('[MCP会话] 创建会话失败:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : '创建会话时发生未知错误'
    }, { status: 500 });
  }
}

/**
 * 获取会话信息 (从 Redis 读取)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: '缺少 sessionId 参数' }, { status: 400 });
  }

  try {
    const redisKey = REDIS_SESSION_PREFIX + sessionId;
    const sessionDataJson = await redis.get(redisKey);

    if (!sessionDataJson) {
      console.log(`[会话API] Redis 中未找到会话 ${sessionId}`);
      return NextResponse.json({ error: `会话 ${sessionId} 不存在或已过期` }, { status: 404 });
    }
    
    const sessionData: RedisSessionData = JSON.parse(sessionDataJson);
    
    // 更新 Redis 中的 lastUsed 时间戳并重置 TTL (滑动过期)
    sessionData.lastUsed = Date.now();
    await redis.setex(redisKey, SESSION_TTL_SECONDS, JSON.stringify(sessionData));

    // 返回简化的会话信息
    return NextResponse.json({
      sessionId: sessionData.sessionId,
      startTime: sessionData.startTime,
      lastUsed: sessionData.lastUsed,
      hasTools: sessionData.tools && sessionData.tools.length > 0,
      // 可以根据需要添加更多从 sessionData 返回的信息，如 memberInfo
      memberInfo: sessionData.memberInfo 
    });
  } catch (error) {
    console.error(`[会话API] 从 Redis 获取会话 ${sessionId} 信息失败:`, error);
    return NextResponse.json({ error: '获取会话信息时发生错误' }, { status: 500 });
  }
}

/**
 * 关闭 MCP 会话 (删除 Redis 数据并尝试关闭内存连接)
 */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: '缺少 sessionId 参数' }, { status: 400 });
  }

  let redisDeleted = false;
  let connectionClosed = false;
  let closeError: any = null;

  try {
    // 1. 从 Redis 删除会话数据
    const redisKey = REDIS_SESSION_PREFIX + sessionId;
    const deletedCount = await redis.del(redisKey);
    if (deletedCount > 0) {
      redisDeleted = true;
      console.log(`[会话API] 已从 Redis 删除会话 ${sessionId}`);
    } else {
      console.log(`[会话API] Redis 中未找到会话 ${sessionId}，无需删除`);
      // 即使 Redis 中没有，也继续尝试关闭内存中的连接，以防万一
    }

    // 2. 尝试关闭内存中的连接/进程 (如果存在)
    try {
      console.log(`[会话API] 尝试关闭内存中的会话连接 ${sessionId}`);
      connectionClosed = await mcpClientService.closeSession(sessionId);
      if (connectionClosed) {
         console.log(`[会话API] 成功关闭内存中的会话连接 ${sessionId}`);
      } else {
         console.log(`[会话API] 内存中未找到会话连接 ${sessionId} 或关闭失败`);
      }
    } catch (error) {
      console.error(`[会话API] 关闭内存连接 ${sessionId} 时发生错误:`, error);
      closeError = error; // 记录错误，但继续返回
    }

    // 根据操作结果返回消息
    if (redisDeleted || connectionClosed) {
      return NextResponse.json({ message: `会话 ${sessionId} 已处理关闭请求` });
    } else {
      // Redis 和内存中都找不到
      return NextResponse.json({ message: `会话 ${sessionId} 不存在或已被关闭` }, { status: 404 });
    }
    
  } catch (error) {
    console.error(`[会话API] 处理关闭会话 ${sessionId} 请求失败:`, error);
    return NextResponse.json({ error: '关闭会话时发生错误' }, { status: 500 });
  }
} 