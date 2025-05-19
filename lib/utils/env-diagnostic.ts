/**
 * 环境变量诊断工具
 * 用于检查和诊断环境变量配置
 */
import 'server-only';

/**
 * 检查OSS相关的环境变量配置
 * @returns 诊断结果
 */
export function checkOSSEnvironment(): { 
  success: boolean; 
  message: string;
  details: {
    OSS_REGION: { exists: boolean; value?: string };
    OSS_ACCESS_KEY_ID: { exists: boolean; value?: string };
    OSS_ACCESS_KEY_SECRET: { exists: boolean; valueLength?: number };
    OSS_BUCKET: { exists: boolean; value?: string };
  }
} {
  const region = process.env.OSS_REGION;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  const bucket = process.env.OSS_BUCKET;
  
  const details = {
    OSS_REGION: { exists: !!region, value: region || undefined },
    OSS_ACCESS_KEY_ID: { exists: !!accessKeyId, value: accessKeyId || undefined },
    OSS_ACCESS_KEY_SECRET: { 
      exists: !!accessKeySecret,
      valueLength: accessKeySecret ? accessKeySecret.length : 0
    },
    OSS_BUCKET: { exists: !!bucket, value: bucket || undefined }
  };
  
  const missingVars = [
    !region ? 'OSS_REGION' : null,
    !accessKeyId ? 'OSS_ACCESS_KEY_ID' : null,
    !accessKeySecret ? 'OSS_ACCESS_KEY_SECRET' : null,
    !bucket ? 'OSS_BUCKET' : null
  ].filter(Boolean);
  
  const success = missingVars.length === 0;
  
  return {
    success,
    message: success 
      ? 'OSS配置正常' 
      : `OSS配置缺失: 缺少 ${missingVars.join(', ')}`,
    details
  };
}

/**
 * 检查数据库相关的环境变量配置
 * @returns 诊断结果
 */
export function checkDatabaseEnvironment(): {
  success: boolean;
  message: string;
  details: {
    DATABASE_URL: { exists: boolean; valueStartsWith?: string };
    DIRECT_URL: { exists: boolean; valueStartsWith?: string };
  }
} {
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  
  // 安全地获取URL前缀，不显示完整连接字符串
  const getUrlPrefix = (url?: string) => {
    if (!url) return undefined;
    try {
      // 提取URL中的协议、用户名和主机部分
      const match = url.match(/^(postgres:\/\/[^:]+):/);
      return match ? `${match[1]}:***` : 'postgres://***';
    } catch (e) {
      return 'invalid-url-format';
    }
  };
  
  const details = {
    DATABASE_URL: { 
      exists: !!databaseUrl,
      valueStartsWith: getUrlPrefix(databaseUrl)
    },
    DIRECT_URL: { 
      exists: !!directUrl,
      valueStartsWith: getUrlPrefix(directUrl)
    }
  };
  
  const missingVars = [
    !databaseUrl ? 'DATABASE_URL' : null,
    !directUrl ? 'DIRECT_URL' : null
  ].filter(Boolean);
  
  const success = missingVars.length === 0;
  
  return {
    success,
    message: success 
      ? '数据库配置正常' 
      : `数据库配置缺失: 缺少 ${missingVars.join(', ')}`,
    details
  };
}

/**
 * 检查Redis相关的环境变量配置
 * @returns 诊断结果
 */
export function checkRedisEnvironment(): {
  success: boolean;
  message: string;
  details: {
    REDIS_URL: { exists: boolean; valueStartsWith?: string };
  }
} {
  const redisUrl = process.env.REDIS_URL;
  
  // 安全地获取URL前缀，不显示完整连接字符串
  const getUrlPrefix = (url?: string) => {
    if (!url) return undefined;
    try {
      // 尝试提取Redis URL的安全部分
      const urlParts = url.split('@');
      if (urlParts.length > 1) {
        return `redis://*****@${urlParts[1].split('/')[0]}`;
      } else {
        return 'redis://***';
      }
    } catch (e) {
      return 'invalid-url-format';
    }
  };
  
  const details = {
    REDIS_URL: { 
      exists: !!redisUrl,
      valueStartsWith: getUrlPrefix(redisUrl)
    }
  };
  
  const success = !!redisUrl;
  
  return {
    success,
    message: success 
      ? 'Redis配置正常' 
      : '缺少Redis配置(REDIS_URL)',
    details
  };
}

/**
 * 检查所有关键环境变量
 * @returns 环境诊断报告
 */
export function diagnosticReport() {
  return {
    oss: checkOSSEnvironment(),
    database: checkDatabaseEnvironment(),
    redis: checkRedisEnvironment(),
    timestamp: new Date().toISOString()
  };
} 