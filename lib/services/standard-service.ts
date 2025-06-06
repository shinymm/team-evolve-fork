import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface StandardInput {
  name: string;
  description: string;
  content: string;
  tags: string[];
  systemId: string;
}

export interface Standard {
  id: string;
  systemId: string;
  name: string;
  description: string;
  content: string;
  tags: string[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export class StandardService {
  /**
   * 创建新规范
   */
  static async createStandard(data: StandardInput, userId: string = 'system'): Promise<Standard> {
    const timestamp = Date.now().toString();
    
    return prisma.$transaction(async (tx) => {
      const standard = await tx.standard.create({
        data: {
          ...data,
          version: timestamp,
          createdBy: userId,
        },
      });
      
      return standard as Standard;
    });
  }

  /**
   * 获取所有规范(可选根据标签或名称过滤)
   */
  static async getStandards(filters?: { 
    name?: string; 
    tags?: string[];
    systemId?: string;
  }): Promise<Standard[]> {
    const where: any = {};
    
    if (filters?.name) {
      where.name = {
        contains: filters.name,
        mode: 'insensitive',
      };
    }
    
    if (filters?.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags,
      };
    }
    
    if (filters?.systemId) {
      where.systemId = filters.systemId;
    } else {
      console.warn('StandardService: 警告 - 调用未提供systemId');
    }
    
    console.log('StandardService查询条件:', where);
    
    return prisma.$transaction(async (tx) => {
      const standards = await tx.standard.findMany({
        where: where as any,
        orderBy: {
          updatedAt: 'desc',
        },
      });
      
      console.log(`StandardService: 查询返回${standards.length}条记录`);
      return standards as Standard[];
    });
  }

  /**
   * 根据系统ID获取规范
   */
  static async getStandardsBySystemId(systemId: string): Promise<Standard[]> {
    return prisma.$transaction(async (tx) => {
      const standards = await tx.standard.findMany({
        where: { systemId } as any,
        orderBy: {
          updatedAt: 'desc',
        },
      });
      
      return standards as Standard[];
    });
  }

  /**
   * 根据ID获取规范
   */
  static async getStandardById(id: string): Promise<Standard | null> {
    return prisma.$transaction(async (tx) => {
      const standard = await tx.standard.findUnique({
        where: { id },
      });
      
      return standard as Standard | null;
    });
  }

  /**
   * 更新规范
   */
  static async updateStandard(id: string, data: Partial<StandardInput>): Promise<Standard> {
    const timestamp = Date.now().toString();
    
    return prisma.$transaction(async (tx) => {
      const standard = await tx.standard.update({
        where: { id },
        data: {
          ...data,
          version: timestamp,
          updatedAt: new Date(),
        },
      });
      
      return standard as Standard;
    });
  }

  /**
   * 删除规范
   */
  static async deleteStandard(id: string): Promise<Standard> {
    return prisma.$transaction(async (tx) => {
      const standard = await tx.standard.delete({
        where: { id },
      });
      
      return standard as Standard;
    });
  }
} 