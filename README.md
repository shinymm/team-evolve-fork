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

## 常用API

#### 术语查询
```shell
# 不带格式化的版本
curl "http://localhost:3000/api/glossary/search?domain=%E8%BF%B7%E5%A2%83"

# 带格式化输出的版本（推荐，更易读）
curl "http://localhost:3000/api/glossary/search?domain=%E8%BF%B7%E5%A2%83" | jq
```