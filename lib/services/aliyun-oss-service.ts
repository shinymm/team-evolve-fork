import OSS from 'ali-oss';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const region = process.env.OSS_REGION!;
const accessKeyId = process.env.OSS_ACCESS_KEY_ID!;
const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET!;
const bucket = process.env.OSS_BUCKET!;
const endpoint = `https://${bucket}.${region.startsWith('oss-') ? region : `oss-${region}`}.aliyuncs.com`;

export class AliyunOSSService {
  private static instance: AliyunOSSService;
  private client: OSS;

  private constructor() {
    this.client = new OSS({
      region: region,
      accessKeyId: accessKeyId,
      accessKeySecret: accessKeySecret,
      bucket: bucket,
      secure: true
    });
  }

  public static getInstance(): AliyunOSSService {
    if (!AliyunOSSService.instance) {
      AliyunOSSService.instance = new AliyunOSSService();
    }
    return AliyunOSSService.instance;
  }

  /**
   * 手动生成预签名URL
   * 使用简单直接的方式处理签名，避免使用复杂的库
   */
  public async createPresignedPutUrl(
    fileName: string,
    fileType: string,
    systemName: string
  ) {
    try {
      const prefix = 'images';
      const fileExt = fileName.includes('.') ? fileName.split('.').pop() : '';
      const storagePath = systemName ? `${prefix}/${systemName}` : prefix;
      const key = `${storagePath}/${uuidv4()}${fileExt ? `.${fileExt}` : ''}`;
      
      // 创建签名直接传入OSS
      const expirationSeconds = 3600; // 1小时
      const expiration = Math.floor(Date.now() / 1000) + expirationSeconds;
      
      // 构建上传策略
      const policy = {
        expiration: new Date(expiration * 1000).toISOString(),
        conditions: [
          { bucket: bucket },
          ['eq', '$key', key],
          ['eq', '$Content-Type', fileType],
        ],
      };
      
      // 将策略转换为base64
      const policyBase64 = Buffer.from(JSON.stringify(policy)).toString('base64');
      
      // 使用OSS签名
      const signature = crypto
        .createHmac('sha1', accessKeySecret)
        .update(policyBase64)
        .digest('base64');
      
      // 构建表单上传URL参数
      const formData = {
        OSSAccessKeyId: accessKeyId,
        policy: policyBase64,
        signature: signature,
        key: key,
        success_action_status: '200',
        'Content-Type': fileType,
      };
      
      // 构建表单上传URL
      const uploadUrl = endpoint;
      
      // 构建最终可访问URL
      const accessUrl = `${endpoint}/${key}`;
      
      console.log(`[AliyunOssService] 成功生成阿里云OSS表单上传参数. Key: ${key}`);
      
      return { 
        uploadUrl, 
        accessUrl, 
        key,
        formData // 返回表单数据供前端使用
      };
    } catch (error) {
      console.error("[AliyunOssService] 生成上传参数失败:", error);
      throw new Error("无法创建文件上传URL，请稍后重试。");
    }
  }

  public async deleteFile(key: string): Promise<void> {
    try {
      await this.client.delete(key);
      console.log(`[AliyunOssService] 文件 ${key} 已成功删除。`);
    } catch (error) {
      console.error(`[AliyunOssService] 删除文件 ${key} 失败:`, error);
      throw new Error("文件删除失败，请稍后重试。");
    }
  }
} 