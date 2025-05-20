/**
 * 阿里云OSS操作工具类
 */
import 'server-only';
import OSS from 'ali-oss';
import { v4 as uuidv4 } from 'uuid';

// 模拟实现的存储，仅用于开发环境或环境变量未配置时
class MockOSSClient {
  private mockStorage: Map<string, Buffer> = new Map();
  private baseUrl: string = 'https://mock-oss-server.example.com/';

  constructor(private config: any) {
    console.log('创建模拟OSS客户端');
  }

  async put(key: string, buffer: Buffer, options?: any): Promise<any> {
    console.log(`[模拟OSS] 上传文件: ${key}, 大小: ${buffer.length} 字节`);
    this.mockStorage.set(key, buffer);
    return {
      name: key,
      url: this.baseUrl + key
    };
  }

  async get(key: string): Promise<any> {
    console.log(`[模拟OSS] 下载文件: ${key}`);
    const content = this.mockStorage.get(key);
    if (!content) {
      const error: any = new Error('文件不存在');
      error.code = 'NoSuchKey';
      throw error;
    }
    return { content };
  }

  async delete(key: string): Promise<any> {
    console.log(`[模拟OSS] 删除文件: ${key}`);
    if (!this.mockStorage.has(key)) {
      const error: any = new Error('文件不存在');
      error.code = 'NoSuchKey';
      throw error;
    }
    this.mockStorage.delete(key);
    return { success: true };
  }

  signatureUrl(key: string, options?: any): string {
    console.log(`[模拟OSS] 生成签名URL: ${key}`);
    return this.baseUrl + key + '?signature=mock-signature';
  }
}

/**
 * 获取OSS客户端实例
 * @returns OSS客户端实例
 */
export function getOSSClient() {
  // 检查环境变量是否存在
  const region = process.env.OSS_REGION;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  const bucket = process.env.OSS_BUCKET;
  
  // 检查是否有DISABLE_OSS环境变量
  const disableOss = process.env.DISABLE_OSS === 'true';
  
  console.log(`OSS配置检查 - Region: ${region ? '已设置' : '未设置'}, AccessKeyId: ${accessKeyId ? '已设置' : '未设置'}, AccessKeySecret: ${accessKeySecret ? '已设置' : '未设置'}, Bucket: ${bucket ? '已设置' : '未设置'}, 禁用OSS: ${disableOss}`);

  // 如果禁用OSS或缺少环境变量，使用模拟实现
  if (disableOss || !region || !accessKeyId || !accessKeySecret || !bucket) {
    console.log('使用模拟OSS客户端');
    return new MockOSSClient({
      region: region || 'mock-region',
      accessKeyId: accessKeyId || 'mock-key',
      accessKeySecret: accessKeySecret || 'mock-secret',
      bucket: bucket || 'mock-bucket'
    });
  }

  try {
    // 创建OSS客户端
    const client = new OSS({
      region,
      accessKeyId,
      accessKeySecret,
      bucket,
      secure: true, // 使用HTTPS
      timeout: 120000, // 设置为120秒超时，解决上传超时问题
    });
    
    console.log(`OSS客户端创建成功 - Bucket: ${bucket}, Region: ${region}`);
    return client;
  } catch (error) {
    console.error('创建OSS客户端失败:', error);
    throw new Error(`创建OSS客户端失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// 定义一个接口来描述包含arrayBuffer方法的对象
interface HasArrayBuffer {
  arrayBuffer(): Promise<ArrayBuffer>;
  type?: string;
}

/**
 * 上传文件到OSS
 * @param file 文件对象（浏览器File对象、FormData中的文件对象、或Node.js Buffer）
 * @param fileName 文件名称
 * @param systemName 系统名称，用于在存储路径中分类
 * @param prefix 存储路径前缀，默认为'images'
 * @returns 上传结果，包含URL和OSS对象Key
 */
export async function uploadToOSS(
  file: any,
  fileName: string,
  systemName?: string,
  prefix = 'images'
): Promise<{ url: string; key: string }> {
  try {
    // 获取OSS客户端实例
    const client = getOSSClient();
    
    // 生成唯一文件名防止冲突
    const fileExt = fileName.includes('.') ? fileName.split('.').pop() : '';
    
    // 根据是否有系统名称决定存储路径
    const storagePath = systemName ? `${prefix}/${systemName}` : prefix;
    const key = `${storagePath}/${uuidv4()}${fileExt ? `.${fileExt}` : ''}`;
    
    let buffer: Buffer;
    let contentType: string | undefined;
    
    // 处理不同类型的文件输入
    if (Buffer.isBuffer(file)) {
      // 如果是Buffer类型
      buffer = file;
    } else if (typeof file === 'object' && file !== null) {
      // 检查是否有arrayBuffer方法（适用于FormData文件对象和File对象）
      if ('arrayBuffer' in file && typeof file.arrayBuffer === 'function') {
        // 将具有arrayBuffer方法的对象转换为Buffer
        buffer = Buffer.from(await (file as HasArrayBuffer).arrayBuffer());
        contentType = (file as HasArrayBuffer).type;
      } else {
        // 如果没有arrayBuffer方法，则尝试直接使用（假设是Buffer兼容对象）
        buffer = file;
      }
    } else {
      throw new Error('不支持的文件类型');
    }
    
    console.log(`准备上传文件到OSS，路径: ${key}`);
    
    // 上传到OSS
    const result = await client.put(key, buffer, {
      headers: contentType ? {
        'Content-Type': contentType
      } : undefined,
      timeout: 120000 // 单独设置此次请求的超时时间
    });
    
    console.log('文件上传成功:', result.name);
    
    // 返回公开访问URL和存储键
    return {
      url: result.url,
      key: key
    };
  } catch (error) {
    // 详细记录错误信息
    console.error('OSS上传详细错误:', error);
    
    let errorMessage = '文件上传失败';
    if (error instanceof Error) {
      errorMessage = `OSS上传失败: ${error.message}`;
      // 如果是超时错误，提供更明确的信息
      if (error.message.includes('timeout')) {
        errorMessage = `OSS上传超时，请检查网络连接或尝试上传较小的文件`;
      }
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * 从OSS下载文件
 * @param key OSS对象Key
 * @returns 文件内容的Buffer
 */
export async function downloadFromOSS(key: string): Promise<Buffer> {
  try {
    const client = getOSSClient();
    const result = await client.get(key);
    return result.content;
  } catch (error) {
    console.error('OSS下载错误:', error);
    throw new Error(`OSS下载失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 删除OSS中的文件
 * @param key OSS对象Key
 * @returns 删除结果
 */
export async function deleteFromOSS(key: string): Promise<boolean> {
  let attempts = 0;
  const maxAttempts = 3;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`【OSS删除】尝试 ${attempts}/${maxAttempts}: 正在获取OSS客户端...`);
      const client = getOSSClient();
      
      // 先检查文件是否存在
      try {
        console.log(`【OSS删除】检查文件是否存在: ${key}`);
        // 使用get方法检查文件是否存在，因为head可能不在类型定义中
        const exists = await client.get(key)
          .then(() => true)
          .catch((err: any) => {
            console.log(`【OSS删除】文件不存在检查结果: ${err && err.code === 'NoSuchKey' ? '文件不存在' : '检查时发生错误'}`);
            return false;
          });
        
        if (!exists) {
          console.log(`【OSS删除】文件不存在，视为删除成功: ${key}`);
          return true;
        }
      } catch (headError) {
        console.log(`【OSS删除】检查文件存在时出错: ${headError instanceof Error ? headError.message : '未知错误'}`);
        // 继续尝试删除
      }
      
      console.log(`【OSS删除】尝试 ${attempts}/${maxAttempts}: 开始删除文件 ${key}`);
      await client.delete(key);
      console.log(`【OSS删除】成功: 文件 ${key} 已删除`);
      return true;
    } catch (error) {
      // 详细记录错误信息
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '无堆栈信息';
      console.error(`【OSS删除】错误 (尝试 ${attempts}/${maxAttempts}):`, errorMsg);
      console.error(`【OSS删除】错误堆栈:`, errorStack);
      
      // 检查是否是因为文件不存在而失败
      if (errorMsg.includes('NoSuchKey') || errorMsg.includes('not exist')) {
        console.log(`【OSS删除】文件不存在，视为删除成功: ${key}`);
        return true; // 文件不存在也视为删除成功
      }
      
      // 判断是否还有重试机会
      if (attempts < maxAttempts) {
        const backoffTime = 1000 * attempts; // 指数退避：1秒，2秒，3秒...
        console.log(`【OSS删除】将在 ${backoffTime}ms 后重试删除...`);
        await delay(backoffTime);
      } else {
        console.error(`【OSS删除】失败: 达到最大重试次数(${maxAttempts})，无法删除文件 ${key}`);
        return false;
      }
    }
  }
  
  return false;
}

/**
 * 生成OSS对象的签名URL（用于临时访问私有文件）
 * @param key OSS对象Key
 * @param expireTime 过期时间(秒)，默认3600秒(1小时)
 * @returns 签名URL
 */
export async function getSignedUrl(key: string, expireTime = 3600): Promise<string> {
  const client = getOSSClient();
  return client.signatureUrl(key, { expires: expireTime });
} 