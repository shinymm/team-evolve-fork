/**
 * 阿里云OSS操作工具类
 */
import 'server-only';
import OSS from 'ali-oss';
import { v4 as uuidv4 } from 'uuid';

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

  if (!region || !accessKeyId || !accessKeySecret || !bucket) {
    throw new Error('OSS配置缺失：请确保环境变量已正确设置');
  }

  // 创建OSS客户端
  return new OSS({
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
    secure: true, // 使用HTTPS
    timeout: 120000, // 设置为120秒超时，解决上传超时问题
  });
}

/**
 * 上传文件到OSS
 * @param file 文件对象（浏览器File对象或Node.js Buffer）
 * @param fileName 文件名称
 * @param systemName 系统名称，用于在存储路径中分类
 * @param prefix 存储路径前缀，默认为'images'
 * @returns 上传结果，包含URL和OSS对象Key
 */
export async function uploadToOSS(
  file: File | Buffer,
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
    if (file instanceof File) {
      buffer = Buffer.from(await file.arrayBuffer());
      contentType = file.type;
    } else {
      buffer = file;
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
  try {
    const client = getOSSClient();
    await client.delete(key);
    return true;
  } catch (error) {
    console.error('OSS删除错误:', error);
    return false;
  }
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