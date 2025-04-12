import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { timingSafeEqual } from 'crypto'

// 定义UserRole类型
type UserRole = 'USER' | 'ADMIN'

/**
 * 安全地比较两个字符串，用于防止时序攻击。
 * @param a 第一个字符串
 * @param b 第二个字符串
 * @returns 如果字符串相等则返回 true，否则返回 false。
 */
export function safeCompare(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) {
    return false;
  }
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    // 长度不同时，进行伪比较以防止时序攻击
    if (bufA.length !== bufB.length) {
        // Note: Requiring crypto inside might be slightly less performant 
        // but avoids potential issues if used in environments where crypto isn't readily available initially.
        // Consider moving the require/import to the top level if performance is critical and availability is guaranteed.
        const crypto = require('crypto'); 
        const randomBytes = crypto.randomBytes(bufA.length);
        timingSafeEqual(Uint8Array.from(bufA), Uint8Array.from(randomBytes)); // 使用 Uint8Array
        return false;
    }
    // 确保使用 Uint8Array 进行比较
    return timingSafeEqual(Uint8Array.from(bufA), Uint8Array.from(bufB)); 
  } catch (error) {
    // 记录错误，但返回 false 以避免泄露信息
    console.error("[safeCompare] 安全比较时出错:", error);
    return false;
  }
}

export async function checkAuthenticated() {
  const session = await getServerSession(authOptions)
  return !!session
}

export async function checkRole(allowedRoles: UserRole[]) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.role) return false
  return allowedRoles.includes(session.user.role)
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

// 检查页面访问权限
export async function checkPageAccess(pagePermissions: {
  requiresAuth: boolean
  allowedRoles?: UserRole[]
}) {
  if (!pagePermissions.requiresAuth) {
    return true
  }

  const isAuthenticated = await checkAuthenticated()
  if (!isAuthenticated) {
    return false
  }

  if (!pagePermissions.allowedRoles) {
    return true
  }

  return await checkRole(pagePermissions.allowedRoles)
} 