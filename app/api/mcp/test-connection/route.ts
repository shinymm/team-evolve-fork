import { NextResponse } from 'next/server';
import { mcpClientService } from '../../../../server/services/mcp-client.service';

// 测试连接请求结构
interface TestConnectionRequest {
  command: string;
  args: string[];
}

/**
 * 测试 MCP 服务器连接
 * 使用官方 MCP SDK 建立连接并获取工具列表
 */
export async function POST(req: Request) {
  try {
    // 解析请求参数
    const { command, args } = await req.json() as TestConnectionRequest;
    
    // 验证配置
    const validation = mcpClientService.validateServerConfig(command, args);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    
    // 连接服务器
    console.log(`[MCP测试] 测试连接: ${command} ${args.join(' ')}`);
    const { sessionId, tools } = await mcpClientService.connect(command, args);
    
    // 连接成功，返回工具列表
    console.log(`[MCP测试] 测试成功, 会话ID: ${sessionId}, 工具:`, tools.map(t => t.name));
    
    // 测试完成后关闭会话
    await mcpClientService.closeSession(sessionId);
    
    // 返回成功结果
    return NextResponse.json({ 
      tools: tools.map(t => t.name)
    });
  } catch (error) {
    // 处理错误
    console.error('[MCP测试] 测试连接失败:', error);
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
} 