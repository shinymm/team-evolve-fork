export const deploymentArchitecture = `
@startuml Deployment Architecture
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

AddElementTag("k8s", $bgColor="#4d4d4d", $fontColor="#ffffff")
AddElementTag("db", $bgColor="#00264a", $borderColor="#ffffff")

System_Boundary(production, "生产环境") {
    Container(lb, "负载均衡", "Nginx", "")
    
    Container(k8s, "Kubernetes 集群", "Docker", $tags="k8s") {
        Container(frontend, "前端应用", "Vue/React", "")
        Container(backend, "后端服务", "Node.js/Java", "")
    }
    
    ContainerDb(db, "数据库", "MySQL/PostgreSQL", $tags="db")
}

Rel(lb, k8s, "转发请求", "HTTPS")
Rel(frontend, backend, "API调用", "HTTPS")
Rel(backend, db, "读写数据", "SQL")

@enduml
`; 