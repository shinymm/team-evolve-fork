import { NextResponse } from 'next/server';
import { mcpClientService } from '@/server/services/mcp-client.service';
import { McpServerConfig, McpSseConfig, McpStreamableHttpConfig } from '@/lib/mcp/client';

// 测试连接请求结构
interface TestConnectionRequest {
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
}

/**
 * 测试 MCP 服务器连接
 * 使用官方 MCP SDK 建立连接并获取工具列表
 */
export async function POST(request: Request) {
  let sessionId: string | null = null; // 声明 sessionId 用于 finally 块
  try {
    const config = await request.json() as McpServerConfig | McpSseConfig | McpStreamableHttpConfig;
    let tools: any[] = [];
    
    if ('url' in config) {
      const url = config.url;
      if (!url) {
        return NextResponse.json({ error: 'URL不能为空' }, { status: 400 });
      }

      // 验证URL格式
      try {
        new URL(url);
      } catch (e) {
        return NextResponse.json({ error: `URL格式无效: ${url}` }, { status: 400 });
      }

      // 使用Streamable HTTP方式连接
      const connectResult = await mcpClientService.connect(
        '_STREAMABLE_HTTP_',
        ['--url', url]
      );
      sessionId = connectResult.sessionId; // 存储 sessionId
      tools = connectResult.tools;

    } else {
      // 命令行配置
      if (!config.command || !Array.isArray(config.args)) {
        return NextResponse.json({ error: '配置格式无效' }, { status: 400 });
      }

      const connectResult = await mcpClientService.connect(
        config.command,
        config.args
      );
      sessionId = connectResult.sessionId; // 存储 sessionId
      tools = connectResult.tools;
    }
    
    // 成功获取工具列表，返回给前端
    return NextResponse.json({ tools: tools.map(tool => tool.name) });

  } catch (error) {
    console.error('MCP连接测试失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '连接失败' },
      { status: 500 }
    );
  } finally {
    // --- 关键：确保在 finally 块中关闭会话 --- 
    if (sessionId) {
      console.log(`[测试连接API] 测试完成，正在关闭临时会话: ${sessionId}`);
      try {
        await mcpClientService.closeSession(sessionId);
        console.log(`[测试连接API] 临时会话 ${sessionId} 已关闭`);
      } catch (closeError) {
        // 记录关闭错误，但不影响给前端的响应
        console.error(`[测试连接API] 关闭临时会话 ${sessionId} 失败:`, closeError);
      }
    }
    // --- 关闭逻辑结束 ---
  }
} 