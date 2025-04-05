import { NextResponse } from 'next/server';
import { mcpClientService } from '../../../../server/services/mcp-client.service';

// 工具调用请求结构
interface ToolCallRequest {
  sessionId: string;
  toolName: string;
  input: any;
}

/**
 * 处理 MCP 工具调用
 * 使用官方 MCP SDK 调用工具并返回结果
 */
export async function POST(req: Request) {
  try {
    // 解析请求参数
    const { sessionId, toolName, input } = await req.json() as ToolCallRequest;
    
    // 验证参数
    if (!sessionId || !toolName) {
      return NextResponse.json({ error: '缺少必要参数: sessionId, toolName' }, { status: 400 });
    }
    
    // 查询会话信息
    const sessionInfo = mcpClientService.getSessionInfo(sessionId);
    if (!sessionInfo) {
      return NextResponse.json({ error: '会话不存在或已过期' }, { status: 404 });
    }
    
    // 验证工具是否可用
    const toolExists = sessionInfo.tools.some((tool: any) => tool.name === toolName);
    if (!toolExists) {
      return NextResponse.json({ 
        error: `工具 "${toolName}" 在当前会话中不可用` 
      }, { status: 400 });
    }
    
    // 调用工具
    console.log(`[MCP工具] 调用会话 ${sessionId} 中的工具 "${toolName}"`);
    const result = await mcpClientService.callTool(sessionId, toolName, input);
    
    // 返回结果
    return NextResponse.json(result);
  } catch (error) {
    // 处理错误
    console.error('[MCP工具] 调用失败:', error);
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '调用工具时发生未知错误'
    }, { status: 500 });
  }
} 