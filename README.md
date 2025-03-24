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