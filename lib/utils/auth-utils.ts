import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// 定义UserRole类型
type UserRole = 'USER' | 'ADMIN'

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