import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { timingSafeEqual } from 'crypto';

// 从环境变量读取期望的 API Key
const EXPECTED_API_KEY = process.env.MCP_SERVER_API_KEY;

if (!EXPECTED_API_KEY) {
  console.warn("[MCP Systems API] 警告: 环境变量 MCP_SERVER_API_KEY 未设置。此 API 将无法正常工作。");
}

// 辅助函数：安全比较字符串 (防止时序攻击)
// 注意：这个函数需要 Buffer
function safeCompare(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) {
    return false;
  }
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        // 为了防止时序攻击，即使长度不同，也要执行相同时间的比较操作
        // 创建一个与 bufA 相同长度的随机 Buffer
        const crypto = require('crypto'); // 在需要时引入 crypto
        const randomBytes = crypto.randomBytes(bufA.length);
        timingSafeEqual(Uint8Array.from(bufA), Uint8Array.from(randomBytes));
        return false;
    }
    return timingSafeEqual(Uint8Array.from(bufA), Uint8Array.from(bufB));
  } catch (error) {
    console.error("[MCP Systems API] 安全比较时出错:", error);
    return false;
  }
}

// 获取系统列表 (仅限 API Key 认证, 仅返回 name 和 description)
export async function GET(request: Request) {
  // --- 检查 API Key ---
  const authorizationHeader = request.headers.get('Authorization');
  const providedApiKey = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.substring(7)
    : null;

  if (!EXPECTED_API_KEY) {
      console.error("[MCP Systems API] 错误：MCP_SERVER_API_KEY 未配置，无法进行认证。");
      return NextResponse.json({ error: '服务器内部错误，API Key 未配置' }, { status: 500 });
  }

  if (!providedApiKey || !safeCompare(providedApiKey, EXPECTED_API_KEY)) {
    console.warn("[MCP Systems API] Access Denied. Invalid or missing API Key.");
    return NextResponse.json({ error: '未授权访问' }, { status: 401 });
  }

  // --- 授权通过，继续处理请求 ---
  console.log("[MCP Systems API] Access Granted via API Key. Fetching system name and description...");
  try {
    const systems = await prisma.system.findMany({
      where: {
        status: 'active'
      },
      select: { // *** 只选择 name 和 description ***
        name: true,
        description: true,
      }
    });

    console.log(`[MCP Systems API] Found ${systems.length} systems.`);
    return NextResponse.json(systems);

  } catch (error) {
    console.error('[MCP Systems API] 获取系统列表失败:', error);
    return NextResponse.json(
      {
        error: '获取系统列表失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}