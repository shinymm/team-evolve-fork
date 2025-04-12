import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// 获取系统列表 (仅支持用户会话)
export async function GET(request: Request) {
  // --- 检查用户会话 ---
  try {
    const session = await getServerSession(authOptions);
    if (session && session.user) {
      console.log('[API Systems Auth] Authorized via User Session for user:', session.user.email);
    } else {
      // 如果没有会话，直接拒绝访问
      console.log('[API Systems Auth] Access Denied. No valid User Session found.');
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }
  } catch (sessionError) {
    console.error("[API Systems Auth] Error checking user session:", sessionError);
    return NextResponse.json({ error: '检查用户会话时出错' }, { status: 500 });
  }

  // --- 授权通过，继续处理请求 ---
  console.log(`[API Systems Auth] Access Granted via User Session. Fetching system list...`);
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