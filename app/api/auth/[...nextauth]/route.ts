import NextAuth, { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { decrypt } from '@/lib/utils/encryption-utils'
import { prisma } from '@/lib/db'

type UserRole = 'USER' | 'ADMIN'

// 扩展next-auth的类型
declare module "next-auth" {
  interface User {
    id: string
    role: UserRole
    email: string
    name: string
  }
  interface Session {
    user: {
      id: string
      role: UserRole
      email: string
      name: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string
    role: UserRole
    email: string
    name: string
  }
}

// const prisma = new PrismaClient()

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('请输入邮箱和密码')
        }

        console.log('尝试查找用户:', credentials.email)
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true
          }
        })
        console.log('数据库查询结果:', {
          found: !!user,
          role: user?.role
        })

        if (!user || !user.password) {
          throw new Error('用户不存在')
        }

        // 解密存储的密码并比较
        const decryptedPassword = await decrypt(user.password)
        if (credentials.password !== decryptedPassword) {
          throw new Error('密码错误')
        }

        const userInfo = {
          id: user.id,
          email: user.email,
          name: user.name || user.email.split('@')[0],
          role: user.role
        }
        console.log('返回用户信息:', userInfo)
        return userInfo
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24小时
  },
  callbacks: {
    async signIn({ user }) {
      console.log('登录回调 - 完整用户信息:', {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      })
      if (!user?.email) {
        return false
      }
      return true
    },
    async jwt({ token, user, trigger, session }) {
      // console.log('JWT回调 - 输入:', { 
      //   tokenBefore: { ...token },
      //   user,
      //   trigger,
      //   session
      // })
      
      if (user) {
        // 初始登录时设置token
        token.role = user.role
        token.email = user.email
        token.name = user.name
        token.sub = user.id
        // console.log('JWT回调 - 设置用户信息后:', { ...token })
      } else if (trigger === "update" && session) {
        // 处理会话更新
        Object.assign(token, session)
        // console.log('JWT回调 - 会话更新后:', { ...token })
      }
      return token
    },
    async session({ session, token }) {
      // console.log('Session回调 - 输入:', { 
      //   sessionBefore: { ...session },
      //   token: { ...token }
      // })
      
      // 确保session.user包含所有必要信息
      session.user = {
        id: token.sub,
        role: token.role as UserRole,
        email: token.email,
        name: token.name
      }

      // console.log('Session回调 - 更新后:', { ...session })
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  events: {
    async signIn({ user }) {
      // 预加载系统列表
      try {
        const systems = await prisma.system.findMany({
          where: {
            status: 'active'
          }
        })
        console.log('登录时预加载系统列表成功:', systems.length, '个系统')
      } catch (error) {
        console.error('登录时预加载系统列表失败:', error)
      }
    }
  }
}

const handler = NextAuth(authOptions)
export const auth = handler
export { handler as GET, handler as POST } 