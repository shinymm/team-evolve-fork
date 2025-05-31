/**
 * 翻译文件拆分脚本
 * 
 * 此脚本将大型的翻译JSON文件拆分成多个小文件，按照命名空间组织
 * 用法: node scripts/split-translations.js
 */

const fs = require('fs');
const path = require('path');

// 配置
const LOCALES = ['en', 'zh'];
const SOURCE_DIR = path.join(__dirname, '..', 'messages');
const TARGET_DIR = path.join(__dirname, '..', 'messages');

// 确保目标目录存在
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 将JSON保存到文件
function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ 已创建文件: ${filePath}`);
}

// 处理每个语言的翻译文件
function processLocale(locale) {
  console.log(`\n开始处理 ${locale} 翻译文件...`);
  
  // 读取源文件
  const sourceFile = path.join(SOURCE_DIR, `${locale}.json`);
  if (!fs.existsSync(sourceFile)) {
    console.error(`❌ 源文件不存在: ${sourceFile}`);
    return;
  }
  
  const sourceData = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  
  // 创建目标目录
  const localeDir = path.join(TARGET_DIR, locale);
  ensureDirectoryExists(localeDir);
  
  // 用于跟踪已处理的命名空间
  const processedNamespaces = new Set();
  
  // 按命名空间分组
  const namespaces = {};
  
  // 按首个关键字(通常是页面名称)分组
  for (const [key, value] of Object.entries(sourceData)) {
    // 跳过已处理的命名空间
    if (processedNamespaces.has(key)) continue;
    
    // 创建新命名空间
    namespaces[key] = { [key]: value };
    processedNamespaces.add(key);
  }
  
  // 按照命名空间类型分组
  const groupedNamespaces = {};
  
  for (const [namespace, data] of Object.entries(namespaces)) {
    // 根据命名空间名称决定分组
    let group;
    
    if (namespace.includes('Page')) {
      // 页面类命名空间
      if (namespace.includes('Requirement')) {
        group = 'requirement';
      } else if (namespace.includes('Boundary')) {
        group = 'boundary';
      } else if (namespace.includes('Test')) {
        group = 'test';
      } else if (namespace.includes('User')) {
        group = 'user';
      } else if (namespace.includes('System')) {
        group = 'system';
      } else if (namespace.includes('API')) {
        group = 'api';
      } else if (namespace.includes('Glossary')) {
        group = 'glossary';
      } else if (namespace.includes('Book')) {
        group = 'book';
      } else {
        group = 'pages';
      }
    } else if (namespace === 'Layout' || namespace === 'Common' || namespace === 'Sidebar' || namespace === 'SiteHeader') {
      group = 'layout';
    } else if (namespace === 'Auth') {
      group = 'auth';
    } else {
      group = 'common';
    }
    
    if (!groupedNamespaces[group]) {
      groupedNamespaces[group] = {};
    }
    
    Object.assign(groupedNamespaces[group], data);
  }
  
  // 保存分组后的命名空间文件
  for (const [group, data] of Object.entries(groupedNamespaces)) {
    const targetFile = path.join(localeDir, `${group}.json`);
    saveJson(targetFile, data);
  }
  
  console.log(`✅ ${locale} 翻译文件已成功分割为 ${Object.keys(groupedNamespaces).length} 个命名空间文件`);
}

// 主函数
function main() {
  console.log('🚀 开始拆分翻译文件...');
  
  // 处理每个语言
  for (const locale of LOCALES) {
    processLocale(locale);
  }
  
  console.log('\n✨ 翻译文件拆分完成!');
  console.log('📝 提示: 请确保 i18n/request.ts 已更新，以支持命名空间文件的加载。');
}

// 执行主函数
main(); 