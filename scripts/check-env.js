// 环境变量检查脚本
require('dotenv').config();

// 检查环境变量
function checkEnvironment() {
  console.log('检查环境变量加载情况...');
  
  // 检查关键环境变量
  const variables = [
    'REDIS_URL',
    'DATABASE_URL',
    'NODE_ENV',
    'NEXT_PUBLIC_APP_URL'
  ];

  const results = {};
  
  variables.forEach(varName => {
    const value = process.env[varName];
    
    // 安全地显示值（隐藏敏感信息）
    let safeValue = '未设置';
    if (value) {
      if (varName.includes('URL') || varName.includes('KEY')) {
        // 对于URL和API密钥，只显示部分内容
        if (value.includes('@')) {
          // URL格式（如数据库或Redis URL）
          safeValue = value.replace(/\/\/(.+?):.+?@/, '//***:***@');
        } else {
          // API密钥格式
          safeValue = value.substring(0, 3) + '...' + value.substring(value.length - 3);
        }
      } else {
        safeValue = value;
      }
    }
    
    results[varName] = {
      set: !!value,
      value: safeValue
    };
  });
  
  console.log('环境变量状态:');
  console.table(results);
  
  // 检查.env文件加载
  console.log('\n.env文件状态:');
  const dotenvFile = require('fs').existsSync('.env');
  const dotenvLocalFile = require('fs').existsSync('.env.local');
  const dotenvDevFile = require('fs').existsSync('.env.development');
  const dotenvDevLocalFile = require('fs').existsSync('.env.development.local');
  
  console.table({
    '.env': dotenvFile,
    '.env.local': dotenvLocalFile,
    '.env.development': dotenvDevFile,
    '.env.development.local': dotenvDevLocalFile
  });
}

checkEnvironment(); 