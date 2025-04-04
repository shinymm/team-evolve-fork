import { NextResponse } from 'next/server';

// 定义预期的 MCP /tools 响应结构 (根据 MCP 规范调整)
interface McpToolsResponse {
  tools: Array<{ name: string; description?: string; /* ... other fields */ }>;
  // 或者其他可能的结构
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 });
    }

    // 构造 /tools 端点 URL (这假设 MCP Server 在根路径或 /sse 路径旁提供 /tools)
    // 你可能需要根据 MCP 规范调整路径
    let toolsUrl = '';
    try {
       const serverBaseUrl = new URL(url);
       // 尝试常见的 tools 路径，可能需要更智能的探测或约定
       // 优先处理 /sse 结尾的情况
       if (serverBaseUrl.pathname.endsWith('/sse')) {
           toolsUrl = `${serverBaseUrl.origin}${serverBaseUrl.pathname.replace(/\/sse$/, '')}/tools`;
       }
       // 检查是否已经是 /tools 路径
       else if (serverBaseUrl.pathname.endsWith('/tools')) {
           toolsUrl = url;
       }
       // 否则，假设根路径下有 /tools
       else {
           // 处理根路径或非 /sse, 非 /tools 路径
           const basePath = serverBaseUrl.pathname.endsWith('/') ? serverBaseUrl.pathname : serverBaseUrl.pathname + '/';
           // 如果 base path 不是根目录，尝试在父级目录加 /tools
           let potentialPath = basePath.replace(/[^\/]+\/?$/, '') + 'tools';
           // 避免产生双斜杠 //tools
           if (potentialPath.startsWith('//')) {
               potentialPath = potentialPath.substring(1);
           }
           // 如果计算出的路径就是根路径下的 /tools，使用它
           if (potentialPath === '/tools') {
               toolsUrl = `${serverBaseUrl.origin}/tools`;
           } else {
               // 作为最终回退，尝试在当前路径（去掉文件名后）或根路径添加 /tools
               // This logic might need refinement based on actual MCP server patterns
               toolsUrl = `${serverBaseUrl.origin}${potentialPath}`; 
               // Fallback to root/tools if the above is complex or fails often
               // toolsUrl = `${serverBaseUrl.origin}/tools`; 
           }
       }

    } catch (e) {
         return NextResponse.json({ error: '无法解析服务器基础 URL' }, { status: 400 });
    }

    if (!toolsUrl) {
        return NextResponse.json({ error: '无法确定 /tools 端点 URL' }, { status: 400 });
    }

    console.log(`Attempting to fetch tools from: ${toolsUrl}`);

    // 设置超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 秒超时

    const response = await fetch(toolsUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
    });
    clearTimeout(timeoutId);


    if (!response.ok) {
      // 尝试从响应体获取错误信息
      let errorText = `HTTP error! status: ${response.status}`; 
      try {
         const errorBody = await response.text();
         errorText += `, Body: ${errorBody.substring(0, 100)}`; // Limit error body size
      } catch {}
      console.error(`Error fetching tools from ${toolsUrl}: ${errorText}`);
      throw new Error(`连接失败 (Status: ${response.status})`); // Return a more user-friendly message initially
    }

    const data: McpToolsResponse = await response.json();

    // 提取工具名称 (根据实际响应结构调整)
    const tools = data.tools?.map(tool => tool.name).filter(Boolean) || []; // Ensure names exist

    return NextResponse.json({ tools });

  } catch (error: any) {
    console.error('MCP connection test failed:', error);
    // 判断是否是超时错误
    if (error.name === 'AbortError') {
         return NextResponse.json({ error: '连接超时 (5秒)' }, { status: 504 }); // Gateway Timeout
    }
    // 返回更通用的错误给前端
    const errorMessage = error.message.startsWith('连接失败') ? error.message : '连接或解析工具列表时出错';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 