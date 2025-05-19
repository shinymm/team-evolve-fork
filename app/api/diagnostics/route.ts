import { NextRequest, NextResponse } from 'next/server';
import { diagnosticReport } from '@/lib/utils/env-diagnostic';
import { getOSSClient } from '@/lib/utils/oss-utils';
import { prisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';

// 确保API路由配置是正确的
export const dynamic = 'force-dynamic'; // 确保路由不会被缓存
export const runtime = 'nodejs'; // 明确指定使用Node.js运行时

// 定义连接测试结果的类型
type ConnectionTestResult = {
  success: boolean;
  message: string;
  error: string | null;
};

/**
 * GET方法用于获取系统诊断信息
 */
export async function GET(request: NextRequest) {
  try {
    // 获取环境变量诊断报告
    const envReport = diagnosticReport();
    console.log('环境变量诊断报告', envReport);
    
    // 服务连接测试结果
    const connectionTests: Record<string, ConnectionTestResult> = {
      oss: { success: false, message: '', error: null },
      database: { success: false, message: '', error: null },
      redis: { success: false, message: '', error: null }
    };
    
    // 测试OSS连接
    try {
      console.log('测试OSS连接...');
      const ossClient = getOSSClient();
      
      // 尝试检查OSS客户端是否可用
      if (ossClient) {
        // 尝试检查存储桶是否存在
        await (ossClient as any).getBucketInfo();
        connectionTests.oss = { 
          success: true, 
          message: 'OSS连接成功', 
          error: null 
        };
      } else {
        throw new Error('无法获取OSS客户端');
      }
    } catch (error) {
      console.error('OSS连接失败:', error);
      connectionTests.oss = { 
        success: false, 
        message: '连接OSS失败', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
    
    // 测试数据库连接
    try {
      console.log('测试数据库连接...');
      // 执行简单查询
      const dbResult = await prisma.$queryRaw`SELECT 1 as result`;
      connectionTests.database = { 
        success: true, 
        message: '数据库连接成功', 
        error: null 
      };
    } catch (error) {
      console.error('数据库连接失败:', error);
      connectionTests.database = { 
        success: false, 
        message: '连接数据库失败', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
    
    // 测试Redis连接
    try {
      console.log('测试Redis连接...');
      const redis = getRedisClient();
      // 尝试设置一个临时键值来测试连接
      const testKey = `test:connection:${Date.now()}`;
      await redis.set(testKey, 'OK', 'EX', 5); // 设置5秒过期
      const pingResult = await redis.get(testKey);
      
      connectionTests.redis = { 
        success: pingResult === 'OK', 
        message: pingResult === 'OK' ? 'Redis连接成功' : 'Redis写入测试失败', 
        error: null 
      };
    } catch (error) {
      console.error('Redis连接失败:', error);
      connectionTests.redis = { 
        success: false, 
        message: '连接Redis失败', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
    
    // 返回诊断报告
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envReport,
      connections: connectionTests,
      server: {
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    });
  } catch (error) {
    console.error('生成诊断报告时出错:', error);
    return NextResponse.json(
      { error: `生成诊断报告失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
} 