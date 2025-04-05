import { NextResponse } from 'next/server';
import { mcpClientService } from '../../../../server/services/mcp-client.service';

// 会话创建请求
interface CreateSessionRequest {
  command: string;
  args: string[];
}

/**
 * 创建 MCP 会话
 * 用于在会话态下创建长期运行的 MCP 会话
 */
export async function POST(req: Request) {
  try {
    // 解析请求参数
    const { command, args } = await req.json() as CreateSessionRequest;
    
    // 验证配置
    const validation = mcpClientService.validateServerConfig(command, args);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    
    // 连接服务器并创建会话
    console.log(`[MCP会话] 创建会话: ${command} ${args.join(' ')}`);
    const { sessionId, tools } = await mcpClientService.connect(command, args);
    
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
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: '缺少会话ID' }, { status: 400 });
    }
    
    // 获取会话信息
    const sessionInfo = mcpClientService.getSessionInfo(sessionId);
    if (!sessionInfo) {
      return NextResponse.json({ error: '会话不存在或已过期' }, { status: 404 });
    }
    
    // 返回会话信息
    return NextResponse.json({
      sessionId,
      tools: sessionInfo.tools.map(t => ({ 
        name: t.name, 
        description: t.description,
        inputSchema: t.inputSchema
      }))
    });
  } catch (error) {
    console.error('[MCP会话] 获取会话信息失败:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : '获取会话信息时发生未知错误'
    }, { status: 500 });
  }
}

/**
 * 关闭会话
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: '缺少会话ID' }, { status: 400 });
    }
    
    // 关闭会话
    const success = await mcpClientService.closeSession(sessionId);
    
    if (!success) {
      return NextResponse.json({ error: '会话不存在或关闭失败' }, { status: 404 });
    }
    
    // 返回关闭结果
    return NextResponse.json({ message: '会话已成功关闭' });
  } catch (error) {
    console.error('[MCP会话] 关闭会话失败:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : '关闭会话时发生未知错误'
    }, { status: 500 });
  }
} 