import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { access } from 'fs/promises';

// 用于存储当前所有活跃的 MCP 服务器进程
const activeMcpServers: Map<string, { pid: number, port: number, tools: string[] }> = new Map();

// 安全清单 - 从配置文件读取
let ALLOWED_NPM_PACKAGES: Set<string> = new Set();
try {
  const allowlistPath = join(process.cwd(), 'config', 'mcp-allowlist.json');
  const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  if (Array.isArray(allowlist.allowedNpmPackages)) {
    ALLOWED_NPM_PACKAGES = new Set(allowlist.allowedNpmPackages);
  }
} catch (error) {
  console.error('无法加载 MCP 安全白名单:', error);
  // 出错时使用空白名单（不允许任何包）
}

// 客户端请求接口定义
interface McpClientRequest {
  command: string;
  args: string[];
  sessionId?: string; // 客户端可以提供会话ID以复用服务器
}

interface McpToolsResponse {
  tools: Array<{
    name: string;
    description?: string;
    inputSchema?: any;
  }>;
}

// 将输出转换为可读格式
const formatOutput = (output: string): string => {
  try {
    return JSON.stringify(JSON.parse(output), null, 2);
  } catch {
    return output;
  }
};

// 清理进程
const safeKill = (pid: number | undefined) => {
  if (!pid) return;
  
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`[MCP客户端] 已终止进程 ${pid}`);
  } catch (e) {
    console.log(`[MCP客户端] 终止进程 ${pid} 时出错:`, e);
  }
};

// 启动并连接到 MCP 服务器
export async function POST(req: Request) {
  try {
    const { command, args, sessionId } = await req.json() as McpClientRequest;
    
    // 1. 参数验证
    if (!command || !Array.isArray(args) || args.length < 2) {
      return NextResponse.json({ error: '无效的服务器配置' }, { status: 400 });
    }
    
    // 2. 安全验证
    if (command !== 'npx') {
      return NextResponse.json({ error: '验证失败: 只允许 "npx" 命令' }, { status: 400 });
    }
    
    if (args.length < 2 || args[0] !== '-y') {
      return NextResponse.json({ error: '验证失败: 参数必须以 "-y <包名>" 开始' }, { status: 400 });
    }
    
    const packageName = args[1];
    if (!ALLOWED_NPM_PACKAGES.has(packageName)) {
      console.warn(`[MCP客户端] 尝试使用未许可的包: ${packageName}`);
      return NextResponse.json({ error: `验证失败: 包 "${packageName}" 不在白名单中` }, { status: 400 });
    }
    
    // 3. 检查会话复用
    const clientSessionId = sessionId || randomUUID();
    let serverInfo = activeMcpServers.get(clientSessionId);
    
    if (serverInfo) {
      console.log(`[MCP客户端] 复用会话 ${clientSessionId} 的服务器, PID: ${serverInfo.pid}, 端口: ${serverInfo.port}`);
      return NextResponse.json({ 
        sessionId: clientSessionId, 
        port: serverInfo.port,
        tools: serverInfo.tools
      });
    }
    
    // 4. 启动新服务器
    console.log(`[MCP客户端] 启动新服务器进程: ${command} ${args.join(' ')}`);
    
    // 创建临时目录用于通信
    const tempDir = join(tmpdir(), `mcp-client-${clientSessionId}`);
    const portFile = join(tempDir, 'port.txt');
    const toolsFile = join(tempDir, 'tools.json');
    
    // 确保设置了端口
    let hasPortArg = false;
    for (let i = 0; i < args.length - 1; i++) {
      if (args[i] === '--port' || args[i] === '-p') {
        hasPortArg = true;
        break;
      }
    }
    
    if (!hasPortArg) {
      // 动态分配一个端口 (8001-8999)
      const port = 8000 + Math.floor(Math.random() * 999) + 1;
      args.push('--port', port.toString());
    }
    
    // 启动 MCP 服务器
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      env: { ...process.env, NODE_ENV: 'production', MCP_PORT_FILE: portFile, MCP_TOOLS_FILE: toolsFile }
    });
    
    let outputBuffer = '';
    let port: number | null = null;
    let tools: string[] = [];
    
    // 监听输出
    child.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      outputBuffer += output;
      console.log(`[MCP服务器:${child.pid}] ${output.trim()}`);
      
      // 尝试从输出中提取端口
      const portMatch = output.match(/(?:port|PORT|listening|LISTENING|localhost:|running at.*:|:\/\/localhost:|listen.*:)\s*(\d{4,5})/i);
      if (portMatch && portMatch[1]) {
        port = parseInt(portMatch[1], 10);
        console.log(`[MCP客户端] 从输出中检测到端口: ${port}`);
      }
    });
    
    child.stderr.on('data', (data: Buffer) => {
      const output = data.toString();
      console.error(`[MCP服务器:${child.pid}] 错误: ${output.trim()}`);
    });
    
    // 等待服务器启动
    const startTime = Date.now();
    const timeout = 10000; // 10秒超时
    
    while (Date.now() - startTime < timeout) {
      // 尝试从输出中提取端口
      if (!port) {
        const portMatch = outputBuffer.match(/(?:port|PORT|listening|LISTENING|localhost:|running at.*:|:\/\/localhost:|listen.*:)\s*(\d{4,5})/i);
        if (portMatch && portMatch[1]) {
          port = parseInt(portMatch[1], 10);
          console.log(`[MCP客户端] 从累积输出中检测到端口: ${port}`);
        }
      }
      
      // 如果有端口，则尝试获取工具列表
      if (port) {
        try {
          const response = await fetch(`http://localhost:${port}/tools`);
          if (response.ok) {
            const toolData: McpToolsResponse = await response.json();
            tools = toolData.tools?.map(t => t.name).filter(Boolean) || [];
            console.log(`[MCP客户端] 成功获取工具:`, tools);
            break;
          }
        } catch (e) {
          // 忽略连接错误，继续等待
        }
      }
      
      // 等待一小段时间后重试
      await setTimeout(500);
    }
    
    // 如果超时，则终止进程并返回错误
    if (!port || tools.length === 0) {
      safeKill(child.pid);
      return NextResponse.json({ 
        error: '服务器启动超时或未能获取工具列表',
        output: outputBuffer
      }, { status: 500 });
    }
    
    // 记录活跃服务器
    activeMcpServers.set(clientSessionId, { pid: child.pid!, port, tools });
    
    // 添加进程退出处理，以清理资源
    child.on('exit', () => {
      console.log(`[MCP客户端] 服务器进程 ${child.pid} 已退出，清理会话 ${clientSessionId}`);
      activeMcpServers.delete(clientSessionId);
    });
    
    return NextResponse.json({ 
      sessionId: clientSessionId, 
      port,
      tools
    });
    
  } catch (error: any) {
    console.error('[MCP客户端] 处理请求出错:', error);
    return NextResponse.json({ error: `服务器错误: ${error.message}` }, { status: 500 });
  }
}

// 获取会话状态
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json({ 
      sessions: Array.from(activeMcpServers.entries()).map(([id, info]) => ({
        id,
        pid: info.pid,
        port: info.port,
        tools: info.tools
      }))
    });
  }
  
  const serverInfo = activeMcpServers.get(sessionId);
  if (!serverInfo) {
    return NextResponse.json({ error: '会话不存在' }, { status: 404 });
  }
  
  return NextResponse.json({ 
    sessionId,
    pid: serverInfo.pid,
    port: serverInfo.port,
    tools: serverInfo.tools
  });
}

// 关闭会话
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json({ error: '缺少会话ID' }, { status: 400 });
  }
  
  const serverInfo = activeMcpServers.get(sessionId);
  if (!serverInfo) {
    return NextResponse.json({ error: '会话不存在' }, { status: 404 });
  }
  
  safeKill(serverInfo.pid);
  activeMcpServers.delete(sessionId);
  
  return NextResponse.json({ message: '会话已关闭' });
} 