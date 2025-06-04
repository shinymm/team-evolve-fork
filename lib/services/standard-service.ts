import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface StandardInput {
  name: string;
  description: string;
  content: string;
  tags: string[];
}

export interface Standard {
  id: string;
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
      return tx.standard.create({
        data: {
          ...data,
          version: timestamp,
          createdBy: userId,
        },
      });
    });
  }

  /**
   * 获取所有规范(可选根据标签或名称过滤)
   */
  static async getStandards(filters?: { 
    name?: string; 
    tags?: string[];
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
    
    return prisma.$transaction(async (tx) => {
      return tx.standard.findMany({
        where,
        orderBy: {
          updatedAt: 'desc',
        },
      });
    });
  }

  /**
   * 根据ID获取规范
   */
  static async getStandardById(id: string): Promise<Standard | null> {
    return prisma.$transaction(async (tx) => {
      return tx.standard.findUnique({
        where: { id },
      });
    });
  }

  /**
   * 更新规范
   */
  static async updateStandard(id: string, data: Partial<StandardInput>): Promise<Standard> {
    const timestamp = Date.now().toString();
    
    return prisma.$transaction(async (tx) => {
      return tx.standard.update({
        where: { id },
        data: {
          ...data,
          version: timestamp,
          updatedAt: new Date(),
        },
      });
    });
  }

  /**
   * 删除规范
   */
  static async deleteStandard(id: string): Promise<Standard> {
    return prisma.$transaction(async (tx) => {
      return tx.standard.delete({
        where: { id },
      });
    });
  }
} 