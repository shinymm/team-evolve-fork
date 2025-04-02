export const microserviceArchitecture = `
@startuml Microservice Architecture
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

AddRelTag("backup", $lineStyle = DashedLine())

Person(user, "用户")

System_Boundary(system, "系统边界") {
    Container(frontend, "前端应用", "Vue/React", "用户界面")
    Container(backend, "后端服务", "Node.js/Java", "业务逻辑处理")
    ContainerDb(db, "数据库", "MySQL/PostgreSQL", "数据存储")
}

System_Ext(external, "外部服务", "第三方API")
System_Ext(file, "外部文本服务", "第三方FTP")

Rel(user, frontend, "访问", "HTTPS")
Rel(frontend, backend, "API调用", "HTTPS")
Rel(backend, db, "读写数据", "SQL")
Rel(backend, external, "调用", "HTTPS")
Rel(file, backend, "定时获取文件", "", $tags="backup")

@enduml
`; 