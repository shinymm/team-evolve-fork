import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { timingSafeEqual } from 'crypto'; // 用于更安全的密钥比较

// 从环境变量读取期望的 API Key
const EXPECTED_API_KEY = process.env.MCP_SERVER_API_KEY;

if (!EXPECTED_API_KEY) {
  console.warn("警告: 环境变量 MCP_SERVER_API_KEY 未设置。API Key 认证将不可用。");
}

// 辅助函数：安全比较字符串 (防止时序攻击)
function safeCompare(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) {
    return false;
  }
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      const crypto = require('crypto');
      const randomBuf = Buffer.from(crypto.randomBytes(bufA.length));
      timingSafeEqual(Uint8Array.from(bufA), Uint8Array.from(randomBuf)); // 转换为 Uint8Array
      return false;
    }
    return timingSafeEqual(Uint8Array.from(bufA), Uint8Array.from(bufB)); // 转换为 Uint8Array
  } catch (error) {
    console.error("安全比较时出错:", error);
    return false;
  }
}

// 获取系统列表 (支持 API Key 或用户会话)
export async function GET(request: Request) { // 接收 request 参数以访问 headers
  let isAuthorized = false;
  let authMethod = 'none';

  // --- 1. 检查 API Key ---
  const authorizationHeader = request.headers.get('Authorization');
  const providedApiKey = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.substring(7)
    : null;

  if (EXPECTED_API_KEY && providedApiKey) {
      if (safeCompare(providedApiKey, EXPECTED_API_KEY)) {
          console.log('[API Systems Auth] Authorized via API Key');
          isAuthorized = true;
          authMethod = 'apiKey';
      } else {
          console.warn('[API Systems Auth] Invalid API Key provided');
      }
  }

  // --- 2. 如果 API Key 未授权，检查用户会话 ---
  if (!isAuthorized) {
    try {
      const session = await getServerSession(authOptions);
      if (session && session.user) {
         console.log('[API Systems Auth] Authorized via User Session for user:', session.user.email);
         isAuthorized = true;
         authMethod = 'session';
      }
    } catch (sessionError) {
         console.error("[API Systems Auth] Error checking user session:", sessionError);
    }
  }

  // --- 3. 最终授权判断 ---
  if (!isAuthorized) {
    console.log('[API Systems Auth] Access Denied. No valid API Key or User Session found.');
    return NextResponse.json({ error: '未授权访问' }, { status: 401 });
  }

  // --- 授权通过，继续处理请求 ---
  console.log(`[API Systems Auth] Access Granted via ${authMethod}. Fetching system list...`);
  try {
    // 移除或注释掉显式的 $connect, $disconnect，让 Prisma 自动管理
    // await prisma.$connect(); 

    const systems = await prisma.system.findMany({
      where: {
        status: 'active' 
      },
      select: { 
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true
      }
    });

    console.log(`[API Systems] Found ${systems.length} systems.`);

    return NextResponse.json(systems); 

  } catch (error) {
    console.error('[API Systems] 获取系统列表失败:', error);
    return NextResponse.json(
      {
        error: '获取系统列表失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  } 
  // finally {
  //   await prisma.$disconnect(); // 通常不需要手动断开
  // }
}

// POST 方法通常只允许用户会话创建
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }
    const json = await request.json()
    const { name, description } = json
    if (!name) return NextResponse.json({ error: '系统名称不能为空' }, { status: 400 })
    const system = await prisma.system.create({ data: { name, description, createdBy: session.user.email }})
    return NextResponse.json(system)
  } catch (error) {
    console.error('创建系统失败:', error)
    return NextResponse.json({ error: '创建系统失败' }, { status: 500 })
  }
} 