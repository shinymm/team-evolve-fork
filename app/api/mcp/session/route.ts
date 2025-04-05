import { NextResponse } from 'next/server';
import { mcpClientService } from '@/server/services/mcp-client.service';
import { aiModelConfigService } from '@/lib/services/ai-model-config-service';
import { decrypt } from '@/lib/utils/encryption-utils';
import { getApiEndpointAndHeaders } from '@/lib/services/ai-service';

// 会话创建请求
interface CreateSessionRequest {
  command: string;
  args: string[];
  memberInfo?: {
    name: string;
    role: string;
    responsibilities: string;
  };
  userSessionKey?: string; // 添加用户会话标识，用于复用会话
}

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
 * 创建 MCP 会话
 * 用于在会话态下创建长期运行的 MCP 会话
 */
export async function POST(req: Request) {
  try {
    // 解析请求参数
    const { command, args, memberInfo, userSessionKey } = await req.json() as CreateSessionRequest;
    
    // 如果提供了用户会话键，检查是否已存在会话
    if (userSessionKey) {
      const existingSessionId = getUserSessionId(userSessionKey);
      if (existingSessionId) {
        console.log(`[MCP会话] 检测到用户会话键 ${userSessionKey} 已经有会话 ${existingSessionId}`);
        
        // 验证现有会话是否有效
        const sessionInfo = mcpClientService.getSessionInfo(existingSessionId);
        if (sessionInfo) {
          console.log(`[MCP会话] 复用现有会话 ${existingSessionId}`);
          
          // 更新会话使用时间
          mcpClientService.setSessionInfo(existingSessionId, { lastUsed: Date.now() });
          
          // 返回现有会话信息
          return NextResponse.json({
            sessionId: existingSessionId,
            tools: sessionInfo.tools ? sessionInfo.tools.map(t => ({
              name: typeof t === 'string' ? t : t.name,
              description: typeof t === 'string' ? `使用${t}工具执行操作` : (t.description || `使用${t.name}工具执行操作`),
              inputSchema: typeof t === 'string' ? {} : (t.inputSchema || {})
            })) : [],
            reused: true // 标记为复用会话
          });
        } else {
          console.log(`[MCP会话] 会话 ${existingSessionId} 已失效，将创建新会话`);
        }
      }
    }
    
    // 验证配置
    const validation = mcpClientService.validateServerConfig(command, args);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    
    // 连接服务器并创建会话
    console.log(`[MCP会话] 创建会话: ${command} ${args.join(' ')}`);
    const { sessionId, tools } = await mcpClientService.connect(command, args);
    
    // 如果提供了用户会话键，保存映射关系
    if (userSessionKey) {
      saveUserSessionMapping(userSessionKey, sessionId);
      console.log(`[MCP会话] 保存用户会话映射: ${userSessionKey} -> ${sessionId}`);
    }
    
    // =====================================
    // 获取并缓存AI模型配置和密钥 - 提前完成初始化
    // =====================================
    try {
      console.log(`[MCP会话] 为会话 ${sessionId} 加载AI模型配置...`);
      
      // 从数据库获取默认AI模型配置
      const defaultConfig = await aiModelConfigService.getDefaultConfig();
      if (!defaultConfig) {
        throw new Error("未配置默认AI模型");
      }
      
      // 解密API密钥
      const decryptedApiKey = await decrypt(defaultConfig.apiKey);
      
      // 构建系统提示词
      let systemPrompt = "你是一个专业的AI助手。回答用户问题时简洁清晰，提供有价值的信息。";
      
      if (memberInfo) {
        // 如果提供了成员信息，生成自定义系统提示词
        systemPrompt = `你是一个名为${memberInfo.name}的AI团队成员。${memberInfo.role}。你的职责是${memberInfo.responsibilities}。请提供专业、有价值的回复。`;
      }
      
      // 缓存成员信息到会话
      if (memberInfo) {
        mcpClientService.setSessionAIConfig(
          sessionId, 
          {
            model: defaultConfig.model,
            baseURL: defaultConfig.baseURL,
            apiKey: decryptedApiKey,
            temperature: defaultConfig.temperature || 0.7
          },
          systemPrompt,
          memberInfo
        );
      } else {
        mcpClientService.setSessionAIConfig(
          sessionId, 
          {
            model: defaultConfig.model,
            baseURL: defaultConfig.baseURL,
            apiKey: decryptedApiKey,
            temperature: defaultConfig.temperature || 0.7
          },
          systemPrompt
        );
      }
      
      // 格式化工具列表并缓存
      const formattedTools = tools.map(tool => {
        if (typeof tool === 'string') {
          // 如果只有工具名称，创建基本工具描述
          return {
            name: tool,
            description: `使用${tool}工具执行操作`
          };
        } else {
          // 如果有完整工具信息，直接使用
          return {
            name: tool.name,
            description: tool.description || `使用${tool.name}工具执行操作`,
            input_schema: tool.inputSchema || {}
          };
        }
      });
      
      // 将格式化的工具缓存到会话
      mcpClientService.setSessionFormattedTools(sessionId, formattedTools);
      
      console.log(`[MCP会话] 会话 ${sessionId} 配置已加载和缓存`);
    } catch (configError) {
      console.error(`[MCP会话] 加载AI配置失败:`, configError);
      // 即使配置加载失败，仍然返回会话信息，后续可以重试
    }
    
    // 添加成员信息到会话
    mcpClientService.setSessionInfo(sessionId, {
      memberInfo
    });
    
    // 返回会话信息
    return NextResponse.json({
      sessionId,
      tools: tools.map(t => ({ 
        name: t.name, 
        description: t.description,
        inputSchema: t.inputSchema
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
 * 获取会话信息
 */
export async function GET(request: Request) {
  try {
    // 获取会话ID
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    
    // 检查会话ID是否提供
    if (!sessionId) {
      console.log('[会话API] 获取会话请求未提供会话ID');
      return NextResponse.json({ success: false, error: '需要提供会话ID' }, { status: 400 });
    }
    
    // 检查会话是否存在
    const sessionInfo = mcpClientService.getSessionInfo(sessionId);
    
    if (!sessionInfo) {
      console.log(`[会话API] 请求的会话 ${sessionId} 不存在`);
      return NextResponse.json({ success: false, error: '会话不存在' }, { status: 404 });
    }
    
    console.log(`[会话API] 成功获取会话 ${sessionId} 信息`);
    
    // 返回会话信息（排除敏感数据）
    const safeSessionInfo = {
      sessionId: sessionId,
      createdAt: Date.now(),
      lastUsed: sessionInfo.lastUsed,
      toolsCount: sessionInfo.tools?.length || 0,
      // 不返回API密钥等敏感信息
    };
    
    return NextResponse.json({ success: true, session: safeSessionInfo });
  } catch (error) {
    console.error('[会话API] 获取会话信息出错:', error);
    return NextResponse.json({ success: false, error: '获取会话信息时出错' }, { status: 500 });
  }
}

/**
 * 关闭会话
 */
export async function DELETE(request: Request) {
  try {
    // 获取会话ID
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    
    // 检查会话ID是否提供
    if (!sessionId) {
      console.log('[会话API] 关闭会话请求未提供会话ID');
      return NextResponse.json({ success: false, error: '需要提供会话ID' }, { status: 400 });
    }
    
    // 检查会话是否存在
    const sessionExists = mcpClientService.getSessionInfo(sessionId) !== null;
    
    // 即使会话不存在也不抛出错误，以便前端可以妥善处理
    if (!sessionExists) {
      console.log(`[会话API] 请求关闭的会话 ${sessionId} 不存在，返回成功状态以避免前端错误`);
      return NextResponse.json({ success: true, message: '会话不存在或已关闭' }, { status: 200 });
    }
    
    console.log(`[会话API] 正在关闭会话 ${sessionId}`);
    
    // 关闭会话
    try {
      await mcpClientService.closeSession(sessionId);
      console.log(`[会话API] 成功关闭会话 ${sessionId}`);
    } catch (closeError) {
      // 即使关闭时出错也返回成功，避免前端重试逻辑
      console.error(`[会话API] 关闭会话 ${sessionId} 时出错，但仍返回成功:`, closeError);
    }
    
    return NextResponse.json({ success: true, message: '会话已关闭' });
  } catch (error) {
    console.error('[会话API] 关闭会话出错:', error);
    // 即使发生错误也返回成功，避免前端重试逻辑
    return NextResponse.json({ success: true, message: '已尝试关闭会话' }, { status: 200 });
  }
} 