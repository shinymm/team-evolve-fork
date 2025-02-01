export const deploymentArchitecture = `
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Deployment.puml

title 部署架构

Node(lb, "负载均衡器", "nginx")
Node(app, "应用服务器", "Docker容器")
Node(db, "数据库服务器", "PostgreSQL")
Node(cache, "缓存服务器", "Redis")

Rel(lb, app, "转发请求")
Rel(app, db, "数据持久化")
Rel(app, cache, "缓存访问")
@enduml
`; 