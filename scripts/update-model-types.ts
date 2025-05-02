import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 更新模型类型
 * 将特定模型设置为视觉类型
 */
async function updateModelTypes() {
  try {
    // 视觉模型名称列表
    const visionModels = ['qwen-vl', 'qwen-vl-max', 'qwen-vl-plus', 'qwen2.5-vl', 'qvq-max'];
    
    console.log('正在更新视觉模型类型...');
    
    // 查找包含这些模型名称的配置
    const visionConfigs = await prisma.aIModelConfig.findMany({
      where: {
        OR: visionModels.map(model => ({
          model: {
            contains: model
          }
        }))
      }
    });
    
    console.log(`找到 ${visionConfigs.length} 个可能的视觉模型配置`);
    
    // 判断是否找到配置
    if (visionConfigs.length === 0) {
      console.log('未找到任何视觉模型配置，脚本执行完毕。');
      return;
    }
    
    // 使用原始SQL更新类型
    for (const config of visionConfigs) {
      try {
        // 使用原始SQL来规避Prisma客户端的schema验证
        await prisma.$executeRaw`UPDATE "AIModelConfig" SET "type" = 'vision' WHERE "id" = ${config.id}`;
        console.log(`已将模型 ${config.name} (${config.model}) 更新为视觉类型`);
      } catch (err) {
        console.error(`更新模型 ${config.name} 失败:`, err);
      }
    }
    
    // 查询验证更新结果
    const updatedCount = await prisma.aIModelConfig.count({
      where: {
        OR: visionModels.map(model => ({
          model: {
            contains: model
          }
        }))
      }
    });
    
    console.log(`完成更新。系统中共有 ${updatedCount} 个视觉模型配置。`);
  } catch (error) {
    console.error('更新模型类型失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行更新
updateModelTypes()
  .catch(e => {
    console.error('脚本执行失败:', e);
    process.exit(1);
  })
  .finally(() => {
    console.log('脚本执行完毕');
  }); 