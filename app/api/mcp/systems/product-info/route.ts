import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { timingSafeEqual } from 'crypto';

// --- Start: API Key Authentication Logic (Copied from /api/mcp/systems/route.ts) ---

const EXPECTED_API_KEY = process.env.MCP_SERVER_API_KEY;

if (!EXPECTED_API_KEY) {
  console.warn("[MCP Systems ProductInfo API] 警告: 环境变量 MCP_SERVER_API_KEY 未设置。此 API 将无法正常工作。");
}

function safeCompare(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) {
    return false;
  }
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        const crypto = require('crypto');
        const randomBytes = crypto.randomBytes(bufA.length);
        timingSafeEqual(Uint8Array.from(bufA), Uint8Array.from(randomBytes));
        return false;
    }
    return timingSafeEqual(Uint8Array.from(bufA), Uint8Array.from(bufB));
  } catch (error) {
    console.error("[MCP Systems ProductInfo API] 安全比较时出错:", error);
    return false;
  }
}

async function authenticateRequest(request: Request): Promise<{ authorized: boolean; errorResponse?: NextResponse }> {
  const authorizationHeader = request.headers.get('Authorization');
  const providedApiKey = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.substring(7)
    : null;

  if (!EXPECTED_API_KEY) {
      console.error("[MCP Systems ProductInfo API] 错误：MCP_SERVER_API_KEY 未配置，无法进行认证。");
      return {
        authorized: false,
        errorResponse: NextResponse.json({ error: '服务器内部错误，API Key 未配置' }, { status: 500 })
      };
  }

  if (!providedApiKey || !safeCompare(providedApiKey, EXPECTED_API_KEY)) {
    console.warn("[MCP Systems ProductInfo API] Access Denied. Invalid or missing API Key.");
     return {
        authorized: false,
        errorResponse: NextResponse.json({ error: '未授权访问' }, { status: 401 })
      };
  }

  console.log("[MCP Systems ProductInfo API] Access Granted via API Key.");
  return { authorized: true };
}

// --- End: API Key Authentication Logic ---


// GET ProductInfo for a specific system by name
export async function GET(request: Request) {
  // 1. Authenticate
  const authResult = await authenticateRequest(request);
  if (!authResult.authorized) {
    return authResult.errorResponse;
  }

  // 2. Get system name from query parameters
  const { searchParams } = new URL(request.url);
  const systemName = searchParams.get('name');

  if (!systemName) {
    return NextResponse.json({ error: '缺少 \'name\' 查询参数' }, { status: 400 });
  }

  console.log(`[MCP Systems ProductInfo API] Fetching product info for system: ${systemName}`);

  // 3. Query the database
  try {
    const systemWithProductInfo = await prisma.system.findFirst({
      where: {
        name: {
          equals: systemName,
          mode: 'insensitive',
        },
        status: 'active'   // Optionally ensure the system is active
      },
      select: {
        id: true, // Select system id for context if needed
        name: true, // 同时返回匹配到的 name，方便确认
        productInfo: {
          select: {
            overview: true,
            userPersona: true,
            architecture: true
          }
        }
      }
    });

    if (!systemWithProductInfo) {
      console.log(`[MCP Systems ProductInfo API] System not found or inactive (case-insensitive): ${systemName}`);
      return NextResponse.json({ error: `系统 '${systemName}' 未找到或非活动状态` }, { status: 404 });
    }

    if (!systemWithProductInfo.productInfo) {
      console.log(`[MCP Systems ProductInfo API] ProductInfo not found for system: ${systemName} (Matched name: ${systemWithProductInfo.name})`);
       return NextResponse.json({ error: `系统 '${systemName}' (匹配为 ${systemWithProductInfo.name}) 未找到对应的产品信息` }, { status: 404 });
    }

    console.log(`[MCP Systems ProductInfo API] Successfully fetched product info for system: ${systemName}`);
    // Return only the productInfo part
    return NextResponse.json(systemWithProductInfo.productInfo);

  } catch (error) {
    console.error(`[MCP Systems ProductInfo API] 获取系统 '${systemName}' 产品信息失败:`, error);
    return NextResponse.json(
      {
        error: '获取产品信息失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}