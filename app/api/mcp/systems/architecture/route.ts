import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // 使用命名导入
// import { timingSafeEqual } from 'crypto'; // 不再需要直接导入
import { safeCompare } from '@/lib/utils/auth-utils'; // 导入 safeCompare

// 使用与 product-info 一致的环境变量和认证逻辑
const EXPECTED_API_KEY = process.env.MCP_SERVER_API_KEY;

if (!EXPECTED_API_KEY) {
  console.warn("[API /mcp/systems/architecture] 警告: 环境变量 MCP_SERVER_API_KEY 未设置。此 API 将无法正常工作。");
}

/**
 * @swagger
 * /api/mcp/systems/architecture:
 *   get:
 *     summary: 获取指定系统的架构信息
 *     description: 根据系统名称（忽略大小写）获取高阶架构、应用架构和部署架构信息。
 *     tags:
 *       - MCP Systems
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         description: 要查询的系统名称
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: [] 
 *     responses:
 *       200:
 *         description: 成功获取系统架构信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 highLevel:
 *                   type: string
 *                   description: 高阶架构描述
 *                 microservice:
 *                   type: string
 *                   description: 应用架构/微服务架构描述
 *                 deployment:
 *                   type: string
 *                   description: 部署架构描述
 *       400:
 *         description:缺少 'name' 查询参数
 *       401:
 *         description: 未授权，需要有效的 Bearer Token
 *       404:
 *         description: 未找到指定名称的系统或该系统没有架构信息
 *       500:
 *         description: 服务器内部错误
 * components:
 *  securitySchemes:
 *    bearerAuth:
 *      type: http
 *      scheme: bearer
 *      bearerFormat: Token # 或 JWT
 */
export async function GET(request: Request) {
  // 1. 验证授权令牌 (使用与 product-info 一致的逻辑)
  const authHeader = request.headers.get('Authorization');
  const providedApiKey = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null;

  if (!EXPECTED_API_KEY) {
      console.error("[API /mcp/systems/architecture] 错误：MCP_SERVER_API_KEY 未配置，无法进行认证。");
      return NextResponse.json({ error: '服务器内部错误，API Key 未配置' }, { status: 500 });
  }

  if (!providedApiKey || !safeCompare(providedApiKey, EXPECTED_API_KEY)) {
    console.warn("[API /mcp/systems/architecture] Access Denied. Invalid or missing API Key.");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  console.log("[API /mcp/systems/architecture] Access Granted via API Key.");

  // 2. 获取查询参数
  const { searchParams } = new URL(request.url);
  const systemName = searchParams.get('name');

  if (!systemName) {
    return NextResponse.json({ error: 'Missing \'name\' query parameter' }, { status: 400 });
  }

  console.log(`[API /mcp/systems/architecture] Received request for system: ${systemName}`);

  try {
    // 3. 查询数据库
    const system = await prisma.system.findFirst({
      where: {
        name: {
          equals: systemName,
          mode: 'insensitive', // 忽略大小写
        },
      },
      include: {
        architecture: true, // 包含关联的架构信息
      },
    });

    // 4. 处理查询结果: 如果系统不存在或系统没有架构信息，返回 200 OK 和空字段
    if (!system) {
        console.log(`[API /mcp/systems/architecture] System not found: ${systemName}. Returning empty architecture.`);
        return NextResponse.json({ highLevel: '', microservice: '', deployment: '' }, { status: 200 });
    }
    
    if (!system.architecture) {
        console.log(`[API /mcp/systems/architecture] Architecture info not found for system: ${systemName}. Returning empty architecture.`);
        return NextResponse.json({ highLevel: '', microservice: '', deployment: '' }, { status: 200 });
    }

    // 5. 如果系统和架构信息都存在，则正常返回
    console.log(`[API /mcp/systems/architecture] Found architecture for system: ${systemName}`);
    const { highLevel, microservice, deployment } = system.architecture;
    return NextResponse.json(
        { 
            highLevel: highLevel || '', // 保持 null 检查以防万一数据库字段为空
            microservice: microservice || '', 
            deployment: deployment || '' 
        }, 
        { status: 200 }
    );

  } catch (error) {
    console.error(`[API /mcp/systems/architecture] Error fetching architecture for ${systemName}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
