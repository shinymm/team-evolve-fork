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
  try {
    const config = await request.json() as McpServerConfig | McpSseConfig | McpStreamableHttpConfig;
    
    // 如果是URL配置（SSE或Streamable HTTP）
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
      const { sessionId, tools } = await mcpClientService.connect(
        '_STREAMABLE_HTTP_',
        ['--url', url]
      );

      return NextResponse.json({ tools: tools.map(tool => tool.name) });
    } else {
      // 命令行配置
      if (!config.command || !Array.isArray(config.args)) {
        return NextResponse.json({ error: '配置格式无效' }, { status: 400 });
      }

      const { sessionId, tools } = await mcpClientService.connect(
        config.command,
        config.args
      );

      return NextResponse.json({ tools: tools.map(tool => tool.name) });
    }
  } catch (error) {
    console.error('MCP连接测试失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '连接失败' },
      { status: 500 }
    );
  }
} 