import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { requiresAuth, isRoleAllowed } from '@/config/permissions'

// 不需要检查权限的路径
const publicPaths = [
  '/auth/signin',
  '/auth/error',
  '/',
  '/api/auth/login',
  '/api/auth/session'
]

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // 检查是否是公开路径
  if (publicPaths.includes(path)) {
    return NextResponse.next()
  }

  // 检查是否是API路由
  if (path.startsWith('/api/')) {
    return NextResponse.next()
  }

  // 获取用户token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  // 检查路径是否需要认证
  if (requiresAuth(path)) {
    // 如果需要认证但用户未登录
    if (!token) {
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', request.url)
      return NextResponse.redirect(signInUrl)
    }

    // 检查用户角色权限
    if (!isRoleAllowed(path, token.role as any)) {
      // 如果用户没有权限访问该页面，重定向到首页
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

// 配置需要运行中间件的路径
export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (浏览器图标)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
} 