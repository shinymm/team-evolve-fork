import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Session } from 'next-auth'

export const dynamic = 'force-dynamic'

// 验证 MCP 服务器配置
function isValidMcpServerConfig(config: any): boolean {
  if (!config || typeof config !== 'object') return false;
  
  // 检查 mcpServers 字段是否存在且为对象
  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    console.warn('MCP 配置缺少有效的 mcpServers 对象');
    return false;
  }
  
  // 验证每个服务器配置
  let hasValidServer = false;
  for (const [key, server] of Object.entries(config.mcpServers)) {
    if (!server || typeof server !== 'object') continue;
    
    // 检查是否为SSE配置
    if ('url' in server) {
      // SSE模式验证
      if (typeof (server as any).url !== 'string' || !(server as any).url.trim()) {
        console.warn(`MCP 服务器 "${key}" 配置缺少有效的 url 字段`);
        continue;
      }
      
      // headers是可选的，但如果存在必须是对象
      if ('headers' in server && (typeof (server as any).headers !== 'object' || (server as any).headers === null)) {
        console.warn(`MCP 服务器 "${key}" 配置的 headers 字段必须是对象`);
        continue;
      }
      
      hasValidServer = true;
      continue;
    }
    
    // 命令行模式验证
    if (!('command' in server) || typeof (server as any).command !== 'string' || (server as any).command.trim() === '') {
      console.warn(`MCP 服务器 "${key}" 配置缺少有效的 command 字段`);
      continue;
    }
    
    // 验证 args 是否为数组
    if (!Array.isArray((server as any).args)) {
      console.warn(`MCP 服务器 "${key}" 配置的 args 字段必须是数组`);
      continue;
    }
    
    // 验证 args 是否包含有效的内容
    if ((server as any).args.length < 1 || (server as any).args.some((arg: any) => typeof arg !== 'string')) {
      console.warn(`MCP 服务器 "${key}" 配置的 args 数组必须包含至少一个字符串元素`);
      continue;
    }
    
    hasValidServer = true;
  }
  
  return hasValidServer;
}

// GET /api/settings/ai-team
export async function GET() {
  try {
    const session = await getServerSession(authOptions) as Session
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const members = await prisma.aiTeamMember.findMany({
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
    const { name, introduction, role, responsibilities, greeting, category, mcpConfigJson } = body

    if (!name || !introduction || !role || !responsibilities) {
      return new NextResponse('Missing required fields', { status: 400 })
    }

    // 验证 mcpConfigJson 如果存在
    let validatedMcpConfigJson = null;
    if (mcpConfigJson) {
      try {
        // 如果是字符串，尝试解析为JSON
        const configObj = typeof mcpConfigJson === 'string' 
          ? JSON.parse(mcpConfigJson) 
          : mcpConfigJson;
        
        if (isValidMcpServerConfig(configObj)) {
          validatedMcpConfigJson = typeof mcpConfigJson === 'string' 
            ? mcpConfigJson 
            : JSON.stringify(configObj);
          console.log('验证 MCP 配置成功');
        } else {
          console.warn('提供的 MCP 配置无效，将设置为 null');
        }
      } catch (error) {
        console.warn('解析 MCP 配置 JSON 失败:', error);
      }
    }

    const member = await prisma.aiTeamMember.create({
      data: {
        name: name.trim(),
        introduction: introduction.trim(),
        role: role.trim(),
        responsibilities: responsibilities.trim(),
        greeting: greeting?.trim() || null,
        category: category?.trim() || null,
        mcpConfigJson: validatedMcpConfigJson,
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

    await prisma.aiTeamMember.delete({
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
    const { name, introduction, role, responsibilities, greeting, category, mcpConfigJson } = body

    if (!name || !introduction || !role || !responsibilities) {
      console.error('Missing required fields:', { name, introduction, role, responsibilities })
      return new NextResponse('Missing required fields', { status: 400 })
    }

    // 验证 mcpConfigJson 如果存在
    let validatedMcpConfigJson = null;
    if (mcpConfigJson) {
      try {
        // 如果是字符串，尝试解析为JSON
        const configObj = typeof mcpConfigJson === 'string' 
          ? JSON.parse(mcpConfigJson) 
          : mcpConfigJson;
        
        if (isValidMcpServerConfig(configObj)) {
          validatedMcpConfigJson = typeof mcpConfigJson === 'string' 
            ? mcpConfigJson 
            : JSON.stringify(configObj);
          console.log('验证 MCP 配置成功');
        } else {
          console.warn('提供的 MCP 配置无效，将设置为 null');
        }
      } catch (error) {
        console.warn('解析 MCP 配置 JSON 失败:', error);
      }
    }

    console.log('Updating member with data (including MCP config):', {
      id,
      name,
      introduction,
      role,
      responsibilities,
      greeting,
      category,
      mcpConfigJson: validatedMcpConfigJson ? '(valid JSON)' : null
    })

    const member = await prisma.aiTeamMember.update({
      where: { id },
      data: {
        name: name.trim(),
        introduction: introduction.trim(),
        role: role.trim(),
        responsibilities: responsibilities.trim(),
        greeting: greeting?.trim() || null,
        category: category?.trim() || null,
        mcpConfigJson: validatedMcpConfigJson,
      }
    })

    return NextResponse.json(member)
  } catch (error) {
    console.error('Error updating AI team member:', error)
    return new NextResponse(error instanceof Error ? error.message : 'Internal Error', { status: 500 })
  }
}