import { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/utils/encryption-utils";

// 定义平台类型枚举
enum PlatformType {
  TEAM_EVOLVE = "TEAM_EVOLVE",
  JIRA = "JIRA"
}

// 定义返回类型接口
interface UserAccessKeyWithDecrypted {
  id: string;
  userId: string;
  platform: PlatformType;
  encryptedAccessKey: string;
  accessKey: string; // 解密后的密钥
  username?: string; // 新增字段，存储Jira用户名
  createdAt: Date;
  updatedAt: Date;
}

// 临时类型断言 - 生产环境使用前需要重新生成Prisma客户端
type PrismaWithUserAccessKey = PrismaClient & {
  userAccessKey: any;
}

/**
 * 用户访问密钥服务
 * 用于管理用户在不同平台的访问密钥
 */
export class UserAccessKeyService {
  /**
   * 创建或更新用户在特定平台的访问密钥
   * @param userId 用户ID
   * @param platform 平台类型
   * @param accessKey 访问密钥（明文）
   * @param username 用户名（可选，主要用于Jira平台）
   * @returns 创建或更新的访问密钥记录
   */
  static async upsertUserAccessKey(
    userId: string, 
    platform: PlatformType, 
    accessKey: string,
    username?: string
  ): Promise<UserAccessKeyWithDecrypted> {
    try {
      // 加密访问密钥
      const encryptedAccessKey = await encrypt(accessKey);
      
      // 使用 upsert 进行创建或更新操作
      const prismaWithUserAccessKey = prisma as PrismaWithUserAccessKey;
      const result = await prismaWithUserAccessKey.userAccessKey.upsert({
        where: {
          userId_platform: {
            userId,
            platform,
          },
        },
        update: {
          encryptedAccessKey,
          username,
          updatedAt: new Date(),
        },
        create: {
          userId,
          platform,
          encryptedAccessKey,
          username,
        },
      });
      
      return {
        ...result,
        accessKey, // 返回明文密钥，避免客户端再次解密
      };
    } catch (error) {
      console.error(`创建/更新 ${platform} 平台的访问密钥失败:`, error);
      throw new Error(`无法为用户 ${userId} 创建/更新 ${platform} 平台的访问密钥`);
    }
  }

  /**
   * 获取用户在特定平台的访问密钥
   * @param userId 用户ID
   * @param platform 平台类型
   * @returns 访问密钥记录（含解密后的密钥）或 null
   */
  static async getUserAccessKey(
    userId: string, 
    platform: PlatformType
  ): Promise<UserAccessKeyWithDecrypted | null> {
    try {
      const prismaWithUserAccessKey = prisma as PrismaWithUserAccessKey;
      const accessKeyRecord = await prismaWithUserAccessKey.userAccessKey.findUnique({
        where: {
          userId_platform: {
            userId,
            platform,
          },
        },
      });
      
      if (!accessKeyRecord) {
        return null;
      }
      
      // 解密访问密钥
      const accessKey = await decrypt(accessKeyRecord.encryptedAccessKey);
      
      return {
        ...accessKeyRecord,
        accessKey, // 添加解密后的密钥
      };
    } catch (error) {
      console.error(`获取 ${platform} 平台的访问密钥失败:`, error);
      throw new Error(`无法获取用户 ${userId} 的 ${platform} 平台访问密钥`);
    }
  }

  /**
   * 获取用户所有平台的访问密钥
   * @param userId 用户ID
   * @returns 所有平台的访问密钥记录（含解密后的密钥）
   */
  static async getAllUserAccessKeys(userId: string): Promise<UserAccessKeyWithDecrypted[]> {
    try {
      const prismaWithUserAccessKey = prisma as PrismaWithUserAccessKey;
      const accessKeyRecords = await prismaWithUserAccessKey.userAccessKey.findMany({
        where: {
          userId,
        },
      });
      
      // 解密所有访问密钥
      const accessKeysWithDecrypted = await Promise.all(
        accessKeyRecords.map(async (record: any) => {
          const accessKey = await decrypt(record.encryptedAccessKey);
          return {
            ...record,
            accessKey,
          };
        })
      );
      
      return accessKeysWithDecrypted;
    } catch (error) {
      console.error(`获取用户所有平台访问密钥失败:`, error);
      throw new Error(`无法获取用户 ${userId} 的所有平台访问密钥`);
    }
  }

  /**
   * 删除用户在特定平台的访问密钥
   * @param userId 用户ID
   * @param platform 平台类型
   * @returns 被删除的访问密钥记录
   */
  static async deleteUserAccessKey(
    userId: string, 
    platform: PlatformType
  ) {
    try {
      const prismaWithUserAccessKey = prisma as PrismaWithUserAccessKey;
      return await prismaWithUserAccessKey.userAccessKey.delete({
        where: {
          userId_platform: {
            userId,
            platform,
          },
        },
      });
    } catch (error) {
      console.error(`删除 ${platform} 平台的访问密钥失败:`, error);
      throw new Error(`无法删除用户 ${userId} 的 ${platform} 平台访问密钥`);
    }
  }

  /**
   * 检查用户是否拥有特定平台的访问密钥
   * @param userId 用户ID
   * @param platform 平台类型
   * @returns 布尔值，表示用户是否拥有该平台的访问密钥
   */
  static async hasAccessKey(
    userId: string, 
    platform: PlatformType
  ): Promise<boolean> {
    try {
      const prismaWithUserAccessKey = prisma as PrismaWithUserAccessKey;
      const count = await prismaWithUserAccessKey.userAccessKey.count({
        where: {
          userId,
          platform,
        },
      });
      
      return count > 0;
    } catch (error) {
      console.error(`检查 ${platform} 平台的访问密钥失败:`, error);
      throw new Error(`无法检查用户 ${userId} 是否有 ${platform} 平台访问密钥`);
    }
  }
} 