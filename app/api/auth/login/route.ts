import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { encrypt } from '@/lib/utils/encryption-utils';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: '请提供邮箱和密码' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 401 }
      );
    }

    const encryptedPassword = await encrypt(password);
    const isPasswordValid = user.password === encryptedPassword;

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '密码错误' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error('登录错误:', error);
    return NextResponse.json(
      { error: '登录过程中发生错误' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 