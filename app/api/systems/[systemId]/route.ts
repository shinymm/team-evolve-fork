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
      // 转换为 Uint8Array 再比较
      timingSafeEqual(Uint8Array.from(bufA), Uint8Array.from(randomBuf)); 
      return false; 
    }
    // 转换为 Uint8Array 再比较
    return timingSafeEqual(Uint8Array.from(bufA), Uint8Array.from(bufB));
  } catch (error) {
    console.error("安全比较时出错:", error);
    return false;
  }
}

// 获取单个系统 (支持 API Key 或用户会话)
export async function GET(
  request: Request,
  { params }: { params: { systemId: string } }
) {
  let isAuthorized = false;
  let authMethod = 'none';

  // --- 1. 检查 API Key ---
  const authorizationHeader = request.headers.get('Authorization');
  const providedApiKey = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.substring(7)
    : null;

  if (EXPECTED_API_KEY && providedApiKey) {
      // 使用更安全的比较方式
      if (safeCompare(providedApiKey, EXPECTED_API_KEY)) {
          console.log('[API Auth] Authorized via API Key');
          isAuthorized = true;
          authMethod = 'apiKey';
      } else {
          console.warn('[API Auth] Invalid API Key provided');
      }
  }

  // --- 2. 如果 API Key 未授权，检查用户会话 ---
  if (!isAuthorized) {
    try {
      const session = await getServerSession(authOptions);
      if (session && session.user) { 
         console.log('[API Auth] Authorized via User Session for user:', session.user.email);
         isAuthorized = true;
         authMethod = 'session';
      }
    } catch (sessionError) {
         console.error("[API Auth] Error checking user session:", sessionError);
    }
  }

  // --- 3. 最终授权判断 ---
  if (!isAuthorized) {
    console.log('[API Auth] Access Denied. No valid API Key or User Session found.');
    return NextResponse.json({ error: '未授权访问' }, { status: 401 });
  }

  // --- 授权通过，继续处理请求 ---
  console.log(`[API Auth] Access Granted via ${authMethod}`);
  try {
    const system = await prisma.system.findUnique({
      where: { id: params.systemId }
    });

    if (!system) {
      return NextResponse.json(
        { error: '系统不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json(system);
  } catch (error) {
    console.error('获取系统失败:', error);
    return NextResponse.json(
      { error: '获取系统失败' },
      { status: 500 }
    );
  }
}

// 更新系统
export async function PATCH(
  request: Request,
  { params }: { params: { systemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: '未授权访问' }, { status: 401 });
  }
  try {
    const json = await request.json()
    const { description } = json
    const existingSystem = await prisma.system.findUnique({ where: { id: params.systemId }})
    if (!existingSystem) return NextResponse.json({ error: '系统不存在' }, { status: 404 })
    const system = await prisma.system.update({ where: { id: params.systemId }, data: { description, updatedAt: new Date() }})
    return NextResponse.json(system)
  } catch (error) {
    console.error('更新系统失败:', error)
    return NextResponse.json({ error: '更新系统失败' }, { status: 500 })
  }
}

// 删除系统
export async function DELETE(
  request: Request,
  { params }: { params: { systemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: '未授权访问' }, { status: 401 });
  }
  try {
    const { systemId } = params
    await prisma.system.delete({ where: { id: systemId }})
    return NextResponse.json({ message: '系统删除成功' })
  } catch (error) {
    console.error('删除系统失败:', error)
    return NextResponse.json({ error: '删除系统失败' }, { status: 500 })
  }
} 