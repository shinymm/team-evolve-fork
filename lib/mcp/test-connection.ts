/**
 * MCP客户端连接测试工具 - 使用ES Module
 */

// 使用 import 导入
import { StreamableHttpClientTransport } from './streamableHttp';
import { testPythonLikeClient } from './python-like-client';

/**
 * 直接测试MCP连接
 * 发送初始化请求并获取工具列表
 * 
 * 注意：这是一个低级API测试，不使用服务端API，直接使用SDK连接
 */
async function testDirectMcpConnection(url: string) {
  console.log(`开始直接测试MCP连接: ${url}`);
  
  try {
    // 创建传输层
    const transport = new StreamableHttpClientTransport(url, {
      timeout: 60000, // 60秒超时
      headers: {
        'User-Agent': 'MCP-Test-Client/1.0',
        'Accept': 'application/json, text/event-stream'
      }
    });
    
    // 连接服务器
    console.log('连接服务器...');
    await transport.connect();
    
    // 获取工具列表
    console.log('获取工具列表...');
    const listToolsRequest = {
      jsonrpc: "2.0",
      method: "list_tools",
      params: {},
      id: "tools1"
    };
    
    await transport.send(listToolsRequest);
    const response = await transport.receive();
    
    console.log('接收到工具列表:', response);
    
    // 关闭连接
    await transport.close();
    console.log('连接测试成功');
    return true;
  } catch (error) {
    console.error('连接测试失败:', error);
    return false;
  }
}

/**
 * 测试入口函数
 */
async function main() {
  const SERVER_URL = 'http://localhost:8080/mcp';
  
  console.log('=== 测试标准连接 ===');
  await testDirectMcpConnection(SERVER_URL);
  
  console.log('\n=== 测试Python风格连接 ===');
  await testPythonLikeClient(SERVER_URL);
}

// 执行测试
main().catch(console.error);

// 导出测试函数
export {
  testDirectMcpConnection,
  testPythonLikeClient
}; 