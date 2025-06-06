import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from 'uuid';

const region = process.env.OSS_REGION!;
const accessKeyId = process.env.OSS_ACCESS_KEY_ID!;
const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET!;
const bucket = process.env.OSS_BUCKET!;
const endpoint = `https://${region.startsWith('oss-') ? region : `oss-${region}`}.aliyuncs.com`;

export class AliyunOSSService {
  private static instance: AliyunOSSService;
  private client: S3Client;

  private constructor() {
    this.client = new S3Client({
      region: region,
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: accessKeySecret,
      },
      forcePathStyle: true,
    });
  }

  public static getInstance(): AliyunOSSService {
    if (!AliyunOSSService.instance) {
      AliyunOSSService.instance = new AliyunOSSService();
    }
    return AliyunOSSService.instance;
  }

  public async createPresignedPutUrl(
    fileName: string,
    fileType: string,
    systemName: string
  ) {
    const prefix = 'images';
    const fileExt = fileName.includes('.') ? fileName.split('.').pop() : '';
    const storagePath = systemName ? `${prefix}/${systemName}` : prefix;
    const key = `${storagePath}/${uuidv4()}${fileExt ? `.${fileExt}` : ''}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: fileType,
      ACL: 'public-read',
    });

    try {
      const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });
      const accessUrl = `https://${bucket}.${region.startsWith('oss-') ? region : `oss-${region}`}.aliyuncs.com/${key}`;
      console.log(`[AliyunOssService] 成功生成预签名PUT URL. Key: ${key}`);
      return { uploadUrl, accessUrl, key };
    } catch (error) {
      console.error("[AliyunOssService] 生成预签名PUT URL失败:", error);
      throw new Error("无法创建文件上传URL，请稍后重试。");
    }
  }

  public async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      await this.client.send(command);
      console.log(`[AliyunOssService] 文件 ${key} 已成功删除。`);
    } catch (error) {
      console.error(`[AliyunOssService] 删除文件 ${key} 失败:`, error);
      throw new Error("文件删除失败，请稍后重试。");
    }
  }
} 