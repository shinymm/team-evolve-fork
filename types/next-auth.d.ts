import { User as PrismaUser } from '@prisma/client'
import NextAuth from 'next-auth'

type UserRole = 'USER' | 'ADMIN'

declare module 'next-auth' {
  interface User {
    id: string
    name: string
    email: string
    role: UserRole
  }

  interface Session {
    user: User
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
  }
} 