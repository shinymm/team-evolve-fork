-- 调试 APIInterface 表中的 swaggerDoc 字段
-- 查询前 10 条记录的 swaggerDoc 字段，以检查格式问题

-- 显示记录总数
SELECT COUNT(*) FROM "APIInterface";

-- 显示有 swaggerDoc 的记录数
SELECT COUNT(*) FROM "APIInterface" WHERE "swaggerDoc" IS NOT NULL;

-- 显示前 10 条记录的 id, name 和 swaggerDoc 字段
SELECT id, name, "swaggerDoc"::text 
FROM "APIInterface" 
WHERE "swaggerDoc" IS NOT NULL
LIMIT 10;

-- 尝试更通用的更新语句，不使用模糊匹配
-- 这将会把内容是字符串、包含 "openapi:" 字符串但不是有效 JSON 的记录进行更新
DO $$
DECLARE
    valid_formatted_json TEXT := '{
  "openapi": "3.0.0",
  "info": {
    "title": "文本机器人对话接口",
    "description": "提供文本机器人的对话功能，支持流式返回和一次性返回两种模式。",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://api.example.com",
      "description": "QARE 系统 API 服务器"
    }
  ],
  "paths": {
    "/api/v1/chat": {
      "post": {
        "summary": "文本机器人对话接口",
        "description": "提供文本机器人的对话功能，支持流式返回和一次性返回两种模式。",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "robot_id": {
                    "type": "string",
                    "description": "机器人ID，用于区分不同机器人的问答逻辑",
                    "example": "robot_001"
                  },
                  "session_id": {
                    "type": "string",
                    "description": "会话ID，用于标识同一会话",
                    "example": "session_12345"
                  },
                  "user_input": {
                    "type": "string",
                    "description": "用户输入的文本",
                    "example": "你好，我想查询余额"
                  },
                  "mode": {
                    "type": "string",
                    "enum": [
                      "stream",
                      "complete"
                    ],
                    "description": "返回模式，stream（流式返回）或 complete（一次性返回）",
                    "example": "stream"
                  },
                  "question_type": {
                    "type": "string",
                    "enum": [
                      "command",
                      "script",
                      "faq"
                    ],
                    "description": "问答类型，command（命令接口）、script（剧本问答）、faq（FAQ问答）",
                    "example": "script"
                  },
                  "metadata": {
                    "type": "object",
                    "description": "附加元数据",
                    "properties": {
                      "timeout": {
                        "type": "integer",
                        "description": "超时时间（毫秒）",
                        "example": 5000
                      },
                      "interrupt": {
                        "type": "boolean",
                        "description": "是否允许中断",
                        "example": false
                      }
                    }
                  }
                },
                "required": [
                  "robot_id",
                  "session_id",
                  "user_input",
                  "mode",
                  "question_type"
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "成功响应",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "response": {
                      "type": "string",
                      "description": "完整回复内容",
                      "example": "请稍等，正在为您查询余额..."
                    },
                    "session_id": {
                      "type": "string",
                      "description": "会话ID",
                      "example": "session_12345"
                    },
                    "status": {
                      "type": "string",
                      "enum": [
                        "success",
                        "error"
                      ],
                      "description": "请求状态",
                      "example": "success"
                    },
                    "metadata": {
                      "type": "object",
                      "properties": {
                        "response_type": {
                          "type": "string",
                          "enum": [
                            "command",
                            "script",
                            "faq"
                          ],
                          "description": "响应类型",
                          "example": "script"
                        },
                        "timestamp": {
                          "type": "string",
                          "format": "date-time",
                          "description": "响应时间",
                          "example": "2023-10-01T12:00:00Z"
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "请求参数错误",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "error_code": {
                      "type": "string",
                      "description": "错误码",
                      "example": "4001"
                    },
                    "error_message": {
                      "type": "string",
                      "description": "错误信息",
                      "example": "无效的机器人ID"
                    },
                    "session_id": {
                      "type": "string",
                      "description": "会话ID",
                      "example": "session_12345"
                    },
                    "status": {
                      "type": "string",
                      "enum": [
                        "error"
                      ],
                      "description": "请求状态",
                      "example": "error"
                    }
                  },
                  "required": [
                    "error_code",
                    "error_message",
                    "status"
                  ]
                }
              }
            }
          },
          "500": {
            "description": "服务器内部错误",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "error_code": {
                      "type": "string",
                      "description": "错误码",
                      "example": "5001"
                    },
                    "error_message": {
                      "type": "string",
                      "description": "错误信息",
                      "example": "内部服务错误"
                    },
                    "session_id": {
                      "type": "string",
                      "description": "会话ID",
                      "example": "session_12345"
                    },
                    "status": {
                      "type": "string",
                      "enum": [
                        "error"
                      ],
                      "description": "请求状态",
                      "example": "error"
                    }
                  },
                  "required": [
                    "error_code",
                    "error_message",
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
  "security": [
    {
      "apiKey": []
    }
  ]
}';
    updated_count INTEGER;
BEGIN
    -- 尝试更新所有包含 "openapi:" 字符串的记录
    UPDATE "APIInterface"
    SET "swaggerDoc" = valid_formatted_json::jsonb
    WHERE "swaggerDoc"::text LIKE '%openapi:%';
    
    -- 获取更新记录数
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '已更新 % 条记录', updated_count;
END $$;

-- 再次查询，检查更新结果
SELECT id, name, "swaggerDoc"::text 
FROM "APIInterface" 
WHERE "swaggerDoc" IS NOT NULL
LIMIT 10; 