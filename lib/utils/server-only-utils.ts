/**
 * 此文件包含仅限服务器端使用的工具函数
 * 不要在客户端组件中直接导入此文件中的函数
 * 而是通过API路由间接使用这些功能
 */

// 'server-only' 包可以防止这些函数在客户端被导入
import 'server-only';

// 导出服务器端专用工具和函数
export * from '@/lib/utils/ai-config-redis';

// 添加明确的警告以防止错误使用
if (typeof window !== 'undefined') {
  console.error(
    '严重错误: server-only-utils 被导入到客户端代码中。' +
    '这可能导致构建失败或运行时错误。' +
    '请通过API路由使用这些功能。'
  );
} 