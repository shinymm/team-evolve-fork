/**
 * 清除图片存储脚本
 * 用于清除localStorage中的图片元数据和OSS中的图片文件
 * 
 * 警告：此脚本会删除图片数据，请谨慎使用
 * 
 * 使用方法：
 * 1. 复制此脚本内容
 * 2. 在系统页面上打开浏览器开发者工具
 * 3. 控制台中粘贴并执行此脚本
 * 4. 查看控制台输出确认清除结果
 */

async function clearImageStorage() {
  // 获取当前系统ID以便通知服务器清理数据库记录
  const systemStorage = localStorage.getItem('system-storage');
  let systemId = null;
  
  if (systemStorage) {
    try {
      const systemData = JSON.parse(systemStorage);
      if (systemData.state && systemData.state.selectedSystemId) {
        systemId = systemData.state.selectedSystemId;
        console.log(`当前系统ID: ${systemId}`);
      }
    } catch (error) {
      console.warn('解析系统存储数据失败, 但不影响清理操作:', error);
    }
  }

  // 步骤1: 检查是否有localStorage中的图片元数据
  const storedFiles = localStorage.getItem('uploaded-image-files');
  if (!storedFiles) {
    console.log('localStorage中没有找到图片元数据，无需清除');
    return { success: true, message: '无图片数据需要清除' };
  }
  
  // 步骤2: 解析图片元数据
  let uploadedFiles;
  try {
    uploadedFiles = JSON.parse(storedFiles);
    console.log(`从localStorage读取到 ${uploadedFiles.length} 个图片记录`);
  } catch (error) {
    console.error('解析localStorage数据失败:', error);
    return { success: false, error: '解析图片数据失败' };
  }
  
  if (!uploadedFiles.length) {
    console.log('没有图片需要清除');
    localStorage.removeItem('uploaded-image-files');
    return { success: true, message: '没有图片需要清除' };
  }
  
  // 步骤3: 确认操作
  console.log(`准备清除 ${uploadedFiles.length} 个图片记录...`);
  console.log('图片列表:');
  uploadedFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file.name} (${file.id})`);
  });
  
  const confirmClear = confirm(`确认删除这 ${uploadedFiles.length} 个图片吗？此操作不可逆!`);
  if (!confirmClear) {
    console.log('操作已取消');
    return { success: false, message: '操作已取消' };
  }
  
  // 步骤4: 逐个从OSS删除图片
  console.log('开始从OSS删除图片...');
  
  const results = {
    success: 0,
    failed: 0,
    details: []
  };
  
  for (const file of uploadedFiles) {
    try {
      // 构建删除API URL
      let deleteUrl = `/api/image?key=${encodeURIComponent(file.id)}`;
      
      // 如果有systemId，添加到URL中以便同时清理数据库记录
      if (systemId) {
        deleteUrl += `&systemId=${encodeURIComponent(systemId)}`;
      }
      
      // 调用API删除OSS中的图片
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        results.success++;
        results.details.push({ id: file.id, status: 'success' });
        console.log(`删除成功: ${file.name} (${file.id})`);
      } else {
        const errorData = await response.json();
        results.failed++;
        results.details.push({ id: file.id, status: 'failed', error: errorData.error });
        console.error(`删除失败: ${file.name} (${file.id}) - ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      results.failed++;
      results.details.push({ id: file.id, status: 'error', error: error.message });
      console.error(`处理图片时出错: ${file.id}`, error);
    }
  }
  
  // 步骤5: 清除localStorage
  localStorage.removeItem('uploaded-image-files');
  console.log('已清除localStorage中的图片元数据');
  
  // 步骤6: 显示清除结果
  console.log('========== 清除完成 ==========');
  console.log(`总计: ${uploadedFiles.length} 个图片`);
  console.log(`成功: ${results.success} 个`);
  console.log(`失败: ${results.failed} 个`);
  
  if (results.failed > 0) {
    console.log('部分图片删除失败，但localStorage已清空');
    console.log('详细结果:', results.details);
  }
  
  console.log('请刷新页面以应用更改');
  
  return {
    success: true,
    message: `成功清除 ${results.success} 个图片，失败 ${results.failed} 个`,
    details: results
  };
}

// 执行清除操作
clearImageStorage()
  .then(result => {
    console.log('清除脚本执行完成:', result.message);
  })
  .catch(error => {
    console.error('清除脚本执行失败:', error);
  }); 