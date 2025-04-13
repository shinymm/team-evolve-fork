import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { safeCompare } from '@/lib/utils/auth-utils'; // 导入 safeCompare 函数

// --- Start: API Key Authentication Logic (与 product-info 一致) ---

const EXPECTED_API_KEY = process.env.MCP_SERVER_API_KEY;

if (!EXPECTED_API_KEY) {
  console.warn("[MCP Systems API Interfaces] 警告: 环境变量 MCP_SERVER_API_KEY 未设置。此 API 将无法正常工作。");
}

async function authenticateRequest(request: Request): Promise<{ authorized: boolean; errorResponse?: NextResponse }> {
  const authorizationHeader = request.headers.get('Authorization');
  const providedApiKey = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.substring(7)
    : null;

  if (!EXPECTED_API_KEY) {
      console.error("[MCP Systems API Interfaces] 错误：MCP_SERVER_API_KEY 未配置，无法进行认证。");
      return {
        authorized: false,
        errorResponse: NextResponse.json({ error: '服务器内部错误，API Key 未配置' }, { status: 500 })
      };
  }

  if (!providedApiKey || !safeCompare(providedApiKey, EXPECTED_API_KEY)) {
    console.warn("[MCP Systems API Interfaces] Access Denied. Invalid or missing API Key.");
     return {
        authorized: false,
        errorResponse: NextResponse.json({ error: '未授权访问' }, { status: 401 })
      };
  }

  console.log("[MCP Systems API Interfaces] Access Granted via API Key.");
  return { authorized: true };
}

// --- End: API Key Authentication Logic ---

// GET API interfaces for a specific system by name
export async function GET(request: Request) {
  // 1. 认证请求
  const authResult = await authenticateRequest(request);
  if (!authResult.authorized) {
    return authResult.errorResponse;
  }

  // 2. 从查询参数获取系统名称
  const { searchParams } = new URL(request.url);
  const systemName = searchParams.get('name');

  if (!systemName) {
    return NextResponse.json({ error: '缺少 \'name\' 查询参数' }, { status: 400 });
  }

  console.log(`[MCP Systems API Interfaces] 获取系统的 API 接口: ${systemName}`);

  // 3. 查询数据库
  try {
    // 直接查询指定系统名称的API接口（忽略大小写）
    const apiInterfaces = await prisma.aPIInterface.findMany({
      where: {
        system: {
          name: {
            equals: systemName,
            mode: 'insensitive' // 忽略大小写
          }
        }
      },
      select: {
        name: true,
        description: true,
        type: true,
        endpoint: true,
        operation: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`[MCP Systems API Interfaces] 成功获取系统 '${systemName}' 的 API 接口列表，共 ${apiInterfaces.length} 个接口`);
    return NextResponse.json(apiInterfaces);

  } catch (error) {
    console.error(`[MCP Systems API Interfaces] 获取系统 '${systemName}' API 接口失败:`, error);
    return NextResponse.json(
      {
        error: '获取 API 接口失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
} 