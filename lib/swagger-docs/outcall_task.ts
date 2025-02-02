export const outcallTaskApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "外呼任务下发接口",
    description: "用于从上游系统（如 M+ 系统）批量下发外呼名单，对接 OutCall 服务。",
    version: "1.0.0"
  },
  servers: [
    {
      url: "https://api.example.com",
      description: "QARE 系统 API 服务器"
    }
  ],
  paths: {
    "/api/v1/outcall/tasks": {
      post: {
        summary: "外呼任务下发接口",
        description: "从上游系统批量下发外呼名单，对接 OutCall 服务。",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  task_id: {
                    type: "string",
                    description: "任务ID，用于唯一标识本次外呼任务",
                    example: "task_12345"
                  },
                  script_id: {
                    type: "string",
                    description: "外呼剧本ID，指定使用的外呼剧本",
                    example: "script_001"
                  },
                  call_time: {
                    type: "string",
                    format: "date-time",
                    description: "外呼时间要求，格式为 ISO 8601",
                    example: "2023-10-01T09:00:00Z"
                  },
                  call_list: {
                    type: "array",
                    description: "外呼名单",
                    items: {
                      type: "object",
                      properties: {
                        phone_number: {
                          type: "string",
                          description: "电话号码",
                          example: "13800138000"
                        },
                        user_name:{
                          type: "string",
                          description: "用户姓名",
                          example: "张三"
                        },
                        user_id: {
                          type: "string",
                          description: "用户ID",
                          example: "user_001"
                        },
                        metadata: {
                          type: "object",
                          description: "附加元数据",
                          example: { "age": 30, "gender": "male" }
                        }
                      }
                    },
                    minItems: 1,
                    example: [
                      {
                        phone_number: "13800138000",
                        user_name: "张三",
                        user_id: "user_001",
                        metadata: { "age": 30, "gender": "male" }
                      },
                      {
                        phone_number: "13800138001",
                        user_name: "李四",
                        user_id: "user_002",
                        metadata: { "age": 25, "gender": "female" }
                      }
                    ],
                    required: [
                      "task_id",
                      "script_id",
                      "call_time",
                      "call_list"
                    ]
                  }
                },
                required: [
                  "task_id",
                  "script_id",
                  "call_time",
                  "call_list"
                ]
              }
            }
          }
        },
        responses: {
          '200': {
            description: "外呼任务下发成功",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    task_id: {
                      type: "string",
                      description: "任务ID",
                      example: "task_12345"
                    }
                  },
                  status: {
                    type: "string",
                    enum: ["success"],
                    description: "任务状态",
                    example: "success"
                  },
                  message: {
                    type: "string",
                    description: "成功信息",
                    example: "外呼任务下发成功"
                  },
                  required: [
                    "task_id",
                    "status",
                    "message"
                  ]
                }
              }
            }
          },
          "400": {
            description: "请求参数错误",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error_code: {
                      type: "string",
                      description: "错误码",
                      example: "4001"
                    },
                    error_message: {
                      type: "string",
                      description: "错误信息",
                      example: "无效的外呼剧本ID"
                    },
                    task_id: {
                      type: "string",
                      description: "任务ID",
                      example: "task_12345"
                    },
                    status: {
                      type: "string",
                      enum: ["error"],
                      description: "任务状态",
                      example: "error"
                    },
                  },
                  required: [
                    "error_code",
                    "error_message",
                    "task_id",
                    "status"
                  ]
                }
              }
            }
          },
          "500":{
            description: "服务器内部错误",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error_code: {
                      type: "string",
                      description: "错误码",
                      example: "5001"
                    },
                    error_message: {
                      type: "string",
                      description: "错误信息",
                      example: "内部服务错误"
                    },
                    task_id: {
                      type: "string",
                      description: "任务ID",
                      example: "task_12345"
                    },
                    status: {
                      type: "string",
                      enum: ["error"],
                      description: "任务状态",
                      example: "error"
                    }
                  },
                  required: [
                    "error_code",
                    "error_message",
                    "task_id",
                    "status"
                  ]
                } 
              }
            }
          }
        }
      }
    }
  },
  security: [
    {
      apiKey: []
    }
  ],
  components: {
    securitySchemes: {
      apiKey: {
        type: "apiKey",
        in: "header",
        name: "Authorization"
      }
    }
  }
} as const;

export type SwaggerSpec = typeof outcallTaskApiSpec; 