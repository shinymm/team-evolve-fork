-- This is an empty migration.

-- 尝试使用多种策略修复 APIInterface 表中 swaggerDoc 字段的 JSON 格式问题

-- 创建一个新函数，用于检测 swaggerDoc 是否是有效的 JSON
CREATE OR REPLACE FUNCTION is_valid_json(text) RETURNS boolean AS $$
BEGIN
    RETURN (SELECT json_typeof($1::json) IS NOT NULL);
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql;

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
    -- 策略 1: 更新包含 "openapi:" 字符串的记录（用于匹配非引号属性名格式）
    UPDATE "APIInterface"
    SET "swaggerDoc" = valid_formatted_json::jsonb
    WHERE "swaggerDoc"::text LIKE '%openapi:%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '策略 1 已更新 % 条记录', updated_count;
    
    -- 策略 2: 更新包含 "openapi" 字符串（不包含冒号）的记录（可能有其他格式）
    UPDATE "APIInterface"
    SET "swaggerDoc" = valid_formatted_json::jsonb
    WHERE "swaggerDoc"::text LIKE '%openapi%' 
    AND "swaggerDoc"::text NOT LIKE '%"openapi"%'
    AND "swaggerDoc"::text NOT LIKE '%openapi:%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '策略 2 已更新 % 条记录', updated_count;
    
    -- 策略 3: 更新包含 "3.0.0" 字符串的记录（版本号是一个非常具体的标识符）
    UPDATE "APIInterface"
    SET "swaggerDoc" = valid_formatted_json::jsonb
    WHERE "swaggerDoc"::text LIKE '%3.0.0%'
    AND ("swaggerDoc"::text NOT LIKE '%"3.0.0"%');
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '策略 3 已更新 % 条记录', updated_count;
    
    -- 策略 4: 更新包含文本机器人对话接口这一特定标题的记录
    UPDATE "APIInterface"
    SET "swaggerDoc" = valid_formatted_json::jsonb
    WHERE "swaggerDoc"::text LIKE '%文本机器人对话接口%'
    AND NOT is_valid_json("swaggerDoc"::text);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '策略 4 已更新 % 条记录', updated_count;
    
    -- 策略 5: 更新所有尝试转为 JSON 时会出错的记录（最激进的策略，可能会误更新）
    UPDATE "APIInterface"
    SET "swaggerDoc" = valid_formatted_json::jsonb
    WHERE NOT is_valid_json("swaggerDoc"::text)
    AND "swaggerDoc" IS NOT NULL
    AND (
        "swaggerDoc"::text LIKE '%paths%' OR
        "swaggerDoc"::text LIKE '%post%' OR
        "swaggerDoc"::text LIKE '%requestBody%'
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '策略 5 已更新 % 条记录', updated_count;
    
    -- 更新指定的记录
    -- 如果您知道特定记录的ID，可以直接更新
    -- 这里我们假设知道ID为1的记录需要更新
    -- UPDATE "APIInterface"
    -- SET "swaggerDoc" = valid_formatted_json::jsonb
    -- WHERE id = '1';
END $$;

-- 最后删除临时函数
DROP FUNCTION IF EXISTS is_valid_json(text);