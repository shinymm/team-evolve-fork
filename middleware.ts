import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { requiresAuth, isRoleAllowed } from '@/config/permissions'
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// 不需要检查权限的路径
const publicPaths = [
  '/auth/signin',
  '/auth/error',
  // '/', // 首页现在会由 next-intl 处理 locale
  '/api/auth/login',
  '/api/auth/session'
]

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 首先处理国际化
  const intlResponse = intlMiddleware(request);
  if (intlResponse) return intlResponse;

  const path = request.nextUrl.pathname

  // 检查是否是公开路径 (去除 locale 前缀后检查)
  // 注意：next-intl 中间件可能会添加 locale 前缀，所以这里的 path 可能已经是 /en/some-path
  // 你可能需要调整 publicPaths 的逻辑，或者在 next-intl 之后，从 path 中移除 locale
  const pathWithoutLocale = path.replace(/^\/(en|zh)/, '') || '/'; 

  if (publicPaths.includes(pathWithoutLocale)) {
    return NextResponse.next()
  }

  // 检查是否是API路由 (这些通常不应该被 locale 处理)
  if (path.startsWith('/api/')) {
    return NextResponse.next()
  }

  // 获取用户token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  // 检查路径是否需要认证
  if (requiresAuth(pathWithoutLocale)) { // 使用移除 locale 后的路径
    // 如果需要认证但用户未登录
    if (!token) {
      const signInUrl = new URL(`/${routing.defaultLocale}/auth/signin`, request.url) // 添加默认 locale
      signInUrl.searchParams.set('callbackUrl', request.url)
      return NextResponse.redirect(signInUrl)
    }

    // 检查用户角色权限
    if (!isRoleAllowed(pathWithoutLocale, token.role as any)) { // 使用移除 locale 后的路径
      // 如果用户没有权限访问该页面，重定向到首页
      return NextResponse.redirect(new URL(`/${routing.defaultLocale}/`, request.url)) // 添加默认 locale
    }
  }

  return NextResponse.next()
}

// 配置需要运行中间件的路径
export const config = {
  matcher: [
    // 匹配所有路径除了:
    // - API 路由 (以 /api/ 开头)
    // - Next.js 内部路径 (以 /_next/ 或 /_vercel/ 开头)
    // - 包含点的文件 (例如 favicon.ico)
    '/((?!api|_next/static|_next/image|_next|_vercel|.*\\..*).*)',
    // 如果你有特定需要匹配带有点的路径，可以像文档中那样单独添加
    // 例如：'/([\\w-]+)?/users/(.+)'
  ],
} 