import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { Session } from 'next-auth'

// GET /api/settings/ai-team
export async function GET() {
  try {
    const session = await getServerSession(authOptions) as Session
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const members = await prisma.AiTeamMember.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error('Error fetching AI team members:', error)
    return new NextResponse(error instanceof Error ? error.message : 'Internal Error', { status: 500 })
  }
}

// POST /api/settings/ai-team
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions) as Session
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const { name, introduction, role, responsibilities, greeting, category } = body

    const member = await prisma.AiTeamMember.create({
      data: {
        name,
        introduction,
        role,
        responsibilities,
        greeting,
        category,
        createdBy: session.user.email
      }
    })

    return NextResponse.json(member)
  } catch (error) {
    console.error('Error creating AI team member:', error)
    return new NextResponse(error instanceof Error ? error.message : 'Internal Error', { status: 500 })
  }
}

// DELETE /api/settings/ai-team
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions) as Session
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return new NextResponse('Missing id', { status: 400 })
    }

    await prisma.AiTeamMember.delete({
      where: { id }
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting AI team member:', error)
    return new NextResponse(error instanceof Error ? error.message : 'Internal Error', { status: 500 })
  }
}

// PATCH /api/settings/ai-team
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions) as Session
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return new NextResponse('Missing id', { status: 400 })
    }

    const body = await req.json()
    const { name, introduction, role, responsibilities, greeting, category } = body

    if (!name || !introduction || !role || !responsibilities) {
      console.error('Missing required fields:', { name, introduction, role, responsibilities })
      return new NextResponse('Missing required fields', { status: 400 })
    }

    console.log('Updating member with data:', {
      id,
      name,
      introduction,
      role,
      responsibilities,
      greeting,
      category
    })

    const member = await prisma.AiTeamMember.update({
      where: { id },
      data: {
        name: name.trim(),
        introduction: introduction.trim(),
        role: role.trim(),
        responsibilities: responsibilities.trim(),
        greeting: greeting?.trim() || null,
        category: category?.trim() || null
      }
    })

    return NextResponse.json(member)
  } catch (error) {
    console.error('Error updating AI team member:', error)
    return new NextResponse(error instanceof Error ? error.message : 'Internal Error', { status: 500 })
  }
}