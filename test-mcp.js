/**
 * MCP客户端连接测试工具 - JavaScript版本
 */

// 由于这是JS文件，需要先编译TS文件
// 运行前请确保已将TypeScript文件编译为JavaScript
const { StreamableHttpClientTransport } = require('./lib/mcp/streamableHttp');
const { testPythonLikeClient } = require('./lib/mcp/python-like-client');

/**
 * 直接测试MCP连接
 * 发送初始化请求并获取工具列表
 */
async function testDirectMcpConnection(url) {
  console.log(`开始直接测试MCP连接: ${url}`);
  
  try {
    // 创建传输层
    const transport = new StreamableHttpClientTransport(url, {
      timeout: 60000, // 60秒超时
      headers: {
        'User-Agent': 'MCP-Test-Client/1.0'
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
  const SERVER_URL = 'https://crew-ai-mcp-b7cdf81f032f.herokuapp.com/mcp';
  
  console.log('=== 测试标准连接 ===');
  await testDirectMcpConnection(SERVER_URL);
  
  console.log('\n=== 测试Python风格连接 ===');
  await testPythonLikeClient(SERVER_URL);
}

// 执行测试
main().catch(console.error);

// 导出测试函数
module.exports = {
  testDirectMcpConnection,
  testPythonLikeClient
}; 