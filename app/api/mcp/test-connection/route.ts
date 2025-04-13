import { NextResponse } from 'next/server';
import { mcpClientService } from '@/server/services/mcp-client.service';
import { McpServerConfig, McpSseConfig, McpStreamableHttpConfig } from '@/lib/mcp/client';

// 测试连接请求结构 (只接受 Streamable HTTP)
interface TestConnectionRequest extends McpStreamableHttpConfig { 
  // 明确只包含 url 和可选的 headers
}

/**
 * 测试 MCP 服务器连接 (仅支持 Streamable HTTP)
 */
export async function POST(request: Request) {
  let sessionId: string | null = null; 
  try {
    const config = await request.json() as TestConnectionRequest;
    let tools: any[] = [];
    
    // 严格检查是否为有效的 Streamable HTTP 配置
    if (config && typeof config === 'object' && 'url' in config && typeof config.url === 'string' && !('command' in config) && !('args' in config)) {
      const url = config.url;

      // 验证URL格式
      try {
        new URL(url);
      } catch (e) {
        return NextResponse.json({ error: `URL格式无效: ${url}` }, { status: 400 });
      }

      console.log(`[测试连接API] 测试 Streamable HTTP 连接: ${url}`);
      // 使用新的 connect 签名调用 (url)
      const connectResult = await mcpClientService.connect(url);
      sessionId = connectResult.sessionId; // 存储 sessionId
      tools = connectResult.tools;

    } else {
      // 如果不是有效的 Streamable HTTP 配置 (包括 Stdio 或无效格式)，返回错误
      console.error("[测试连接API] 收到无效或不支持的配置类型:", config);
      return NextResponse.json({ 
        error: '配置格式无效或不受支持。测试连接只支持包含 "url" 字段的 Streamable HTTP 配置。'
      }, { status: 400 });
    }
    
    // 成功获取工具列表，返回给前端
    // 注意：这里只返回工具名称，因为测试连接的主要目的是确认连通性和可用工具
    return NextResponse.json({ tools: tools.map(tool => tool.name) });

  } catch (error) {
    console.error('MCP连接测试失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '连接失败' },
      { status: 500 }
    );
  } finally {
    // 关闭临时会话
    if (sessionId) {
      console.log(`[测试连接API] 测试完成，正在关闭临时会话: ${sessionId}`);
      try {
        await mcpClientService.closeSession(sessionId);
        console.log(`[测试连接API] 临时会话 ${sessionId} 已关闭`);
      } catch (closeError) {
        console.error(`[测试连接API] 关闭临时会话 ${sessionId} 失败:`, closeError);
      }
    }
  }
} 