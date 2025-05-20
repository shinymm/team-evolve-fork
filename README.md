# team-evolve


## 技术备忘

```shell
## 新环境迁移数据库
npx prisma migrate deploy
```

```sql
-- neon 需要安装ventor插件 https://neon.tech/docs/extensions/pgvector
CREATE EXTENSION vector;
```

## Vercel部署指南

项目可以在Vercel上部署，但有一些依赖项需要特别注意：

### 解决`vm2`和`coffee-script`依赖问题

部署时可能会遇到以下错误：
```
Module not found: Can't resolve 'coffee-script' in '/vercel/path0/node_modules/vm2/lib'
```

**解决方案**：

1. 确保`coffeescript`包已添加到`dependencies`（不是`devDependencies`）：
   ```json
   "dependencies": {
     // 其他依赖...
     "coffeescript": "^2.7.0"
   }
   ```

2. 或者，设置环境变量`DISABLE_OSS=true`来使用模拟OSS实现。

### 配置环境变量

在Vercel项目设置中添加以下环境变量：

- `DISABLE_OSS=true`（如果不需要OSS功能）
- 其他必需的环境变量...

## 常用API

#### 术语查询
```shell
# 不带格式化的版本
curl "http://localhost:3000/api/glossary/search?domain=%E8%BF%B7%E5%A2%83"

# 带格式化输出的版本（domain="迷境"，推荐，更易读）
curl "http://localhost:3000/api/glossary/search?domain=%E8%BF%B7%E5%A2%83" | jq
```
