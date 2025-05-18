/**
 * localStorage图片元数据迁移脚本
 * 将localStorage中的图片元数据迁移到数据库
 * 
 * 使用方法：
 * 1. 复制此脚本内容
 * 2. 在特定系统页面上打开浏览器开发者工具
 * 3. 控制台中粘贴并执行此脚本
 * 4. 查看控制台输出确认迁移结果
 */

async function migrateLocalStorageImagesToDatabase() {
  // 步骤1: 从zustand存储中获取当前系统ID
  const systemStorage = localStorage.getItem('system-storage');
  if (!systemStorage) {
    console.error('未找到系统存储数据，请确保您已登录并选择了一个系统');
    return;
  }
  
  let systemData;
  try {
    systemData = JSON.parse(systemStorage);
    if (!systemData.state || !systemData.state.selectedSystemId) {
      console.error('未找到选中的系统ID，请先选择一个系统');
      return;
    }
  } catch (error) {
    console.error('解析系统存储数据失败:', error);
    return;
  }
  
  const systemId = systemData.state.selectedSystemId;
  console.log(`当前系统ID: ${systemId}`);
  
  // 步骤2: 从localStorage读取图片元数据
  const storedFiles = localStorage.getItem('uploaded-image-files');
  if (!storedFiles) {
    console.log('localStorage中没有找到图片元数据');
    return;
  }
  
  let uploadedFiles;
  try {
    uploadedFiles = JSON.parse(storedFiles);
    console.log(`从localStorage读取到 ${uploadedFiles.length} 个图片记录`);
  } catch (error) {
    console.error('解析localStorage数据失败:', error);
    return;
  }
  
  if (!uploadedFiles.length) {
    console.log('没有图片需要迁移');
    return;
  }
  
  // 步骤3: 逐个保存到数据库
  console.log('开始迁移图片元数据到数据库...');
  
  const results = {
    success: 0,
    failed: 0,
    details: []
  };
  
  for (const file of uploadedFiles) {
    try {
      // 准备迁移数据
      const imageData = {
        systemId,
        ossKey: file.id,
        name: file.name,
        url: file.url || `https://team-evolve.oss-ap-southeast-1.aliyuncs.com/${file.id}`,
        provider: file.provider || 'aliyun-oss',
        uploadTime: new Date(file.uploadTime),
        createdBy: 'migration_script'
      };
      
      // 可选：验证OSS中图片是否存在
      try {
        const response = await fetch(imageData.url, { method: 'HEAD' });
        if (!response.ok) {
          console.warn(`图片 ${file.id} 在OSS中不存在，跳过迁移`);
          results.failed++;
          results.details.push({ id: file.id, status: 'skipped', reason: 'OSS object not found' });
          continue;
        }
      } catch (verifyError) {
        console.warn(`无法验证图片 ${file.id} 是否存在:`, verifyError);
      }
      
      // 调用API保存到数据库
      const response = await fetch('/api/admin/migrate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(imageData)
      });
      
      if (response.ok) {
        results.success++;
        results.details.push({ id: file.id, status: 'success' });
        console.log(`迁移成功: ${file.name} (${file.id})`);
      } else {
        const errorData = await response.json();
        results.failed++;
        results.details.push({ id: file.id, status: 'failed', error: errorData.error });
        console.error(`迁移失败: ${file.name} (${file.id}) - ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      results.failed++;
      results.details.push({ id: file.id, status: 'error', error: error.message });
      console.error(`处理图片时出错: ${file.id}`, error);
    }
  }
  
  // 步骤4: 显示迁移结果
  console.log('========== 迁移完成 ==========');
  console.log(`总计: ${uploadedFiles.length} 个图片`);
  console.log(`成功: ${results.success} 个`);
  console.log(`失败: ${results.failed} 个`);
  
  if (results.success === uploadedFiles.length) {
    console.log('所有图片已成功迁移到数据库，现在可以安全地清除localStorage');
    console.log('要清除localStorage，请执行: localStorage.removeItem("uploaded-image-files")');
  } else {
    console.log('部分图片迁移失败，请查看详细信息');
    console.log('详细结果:', results.details);
  }
  
  return results;
}

// 执行迁移
migrateLocalStorageImagesToDatabase()
  .then(results => {
    console.log('迁移脚本执行完成');
  })
  .catch(error => {
    console.error('迁移脚本执行失败:', error);
  }); 