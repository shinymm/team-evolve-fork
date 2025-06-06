import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TemplateInput {
  name: string;
  description: string;
  content: string;
  tags: string[];
  systemId: string;
}

export interface Template {
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

export class TemplateService {
  /**
   * 创建新模版
   */
  static async createTemplate(data: TemplateInput, userId: string = 'system'): Promise<Template> {
    const timestamp = Date.now().toString();
    
    return prisma.$transaction(async (tx) => {
      const template = await tx.template.create({
        data: {
          ...data,
          version: timestamp,
          createdBy: userId,
        },
      });
      
      return template as Template;
    });
  }

  /**
   * 获取所有模版(可选根据标签或名称过滤)
   */
  static async getTemplates(filters?: { 
    name?: string; 
    tags?: string[];
    systemId?: string;
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
    
    if (filters?.systemId) {
      where.systemId = filters.systemId;
    } else {
      console.warn('TemplateService: 警告 - 调用未提供systemId');
    }
    
    console.log('TemplateService查询条件:', where);
    
    return prisma.$transaction(async (tx) => {
      const templates = await tx.template.findMany({
        where: where as any,
        orderBy: {
          updatedAt: 'desc',
        },
      });
      
      console.log(`TemplateService: 查询返回${templates.length}条记录`);
      return templates as Template[];
    });
  }

  /**
   * 根据系统ID获取模版
   */
  static async getTemplatesBySystemId(systemId: string): Promise<Template[]> {
    return prisma.$transaction(async (tx) => {
      const templates = await tx.template.findMany({
        where: { systemId } as any,
        orderBy: {
          updatedAt: 'desc',
        },
      });
      
      return templates as Template[];
    });
  }

  /**
   * 根据ID获取模版
   */
  static async getTemplateById(id: string): Promise<Template | null> {
    return prisma.$transaction(async (tx) => {
      const template = await tx.template.findUnique({
        where: { id },
      });
      
      return template as Template | null;
    });
  }

  /**
   * 更新模版
   */
  static async updateTemplate(id: string, data: Partial<TemplateInput>): Promise<Template> {
    const timestamp = Date.now().toString();
    
    return prisma.$transaction(async (tx) => {
      const template = await tx.template.update({
        where: { id },
        data: {
          ...data,
          version: timestamp,
          updatedAt: new Date(),
        },
      });
      
      return template as Template;
    });
  }

  /**
   * 删除模版
   */
  static async deleteTemplate(id: string): Promise<Template> {
    return prisma.$transaction(async (tx) => {
      const template = await tx.template.delete({
        where: { id },
      });
      
      return template as Template;
    });
  }
} 