import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TemplateInput {
  name: string;
  description: string;
  content: string;
  tags: string[];
}

export interface Template {
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

export class TemplateService {
  /**
   * 创建新模版
   */
  static async createTemplate(data: TemplateInput, userId: string = 'system'): Promise<Template> {
    const timestamp = Date.now().toString();
    
    return prisma.$transaction(async (tx) => {
      return tx.template.create({
        data: {
          ...data,
          version: timestamp,
          createdBy: userId,
        },
      });
    });
  }

  /**
   * 获取所有模版(可选根据标签或名称过滤)
   */
  static async getTemplates(filters?: { 
    name?: string; 
    tags?: string[];
  }): Promise<Template[]> {
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
      return tx.template.findMany({
        where,
        orderBy: {
          updatedAt: 'desc',
        },
      });
    });
  }

  /**
   * 根据ID获取模版
   */
  static async getTemplateById(id: string): Promise<Template | null> {
    return prisma.$transaction(async (tx) => {
      return tx.template.findUnique({
        where: { id },
      });
    });
  }

  /**
   * 更新模版
   */
  static async updateTemplate(id: string, data: Partial<TemplateInput>): Promise<Template> {
    const timestamp = Date.now().toString();
    
    return prisma.$transaction(async (tx) => {
      return tx.template.update({
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
   * 删除模版
   */
  static async deleteTemplate(id: string): Promise<Template> {
    return prisma.$transaction(async (tx) => {
      return tx.template.delete({
        where: { id },
      });
    });
  }
} 