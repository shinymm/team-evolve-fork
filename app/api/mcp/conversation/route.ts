import { NextResponse } from "next/server";
import { mcpClientService } from "@/server/services/mcp-client.service";
import { decrypt } from "@/lib/utils/encryption-utils";
import { getApiEndpointAndHeaders } from "@/lib/services/ai-service";
import { AIModelConfig } from "@/lib/services/ai-service";
import { aiModelConfigService } from "@/lib/services/ai-model-config-service";

interface ConversationRequest {
  sessionId?: string;
  userMessage: string;
  memberInfo?: {
    name: string;
    role: string;
    responsibilities: string;
    mcpConfigJson?: string;  // 添加MCP配置字段
  };
}

// 消息类型定义
interface ChatMessage {
  role: string;
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

// 工具调用响应类型
interface ToolCallResult {
  name?: string;
  content?: string;
  message?: {
    content: string;
  };
  response?: string;
  text?: string;
  tool_calls?: any[];
  toolCalls?: any[];
  [key: string]: any;
}

// 添加缓存机制，避免重复获取和解密
let globalDefaultConfig: any = null;
let globalDecryptedKey: string | null = null;

/**
 * 统一处理对话请求 - 支持MCP和普通对话两种模式
 * - 如果成员有MCP配置，无论是否有sessionId都使用MCP模式
 * - 只有成员没有MCP配置时才使用普通对话模式
 */
export async function POST(req: Request) {
  try {
    // 解析请求参数
    const { sessionId, userMessage, memberInfo } = await req.json() as ConversationRequest;
    
    // 验证必要参数
    if (!userMessage) {
      return NextResponse.json({ error: '缺少必要参数: userMessage' }, { status: 400 });
    }
    
    console.log(`[对话请求] 使用全局缓存状态:`, {
      hasGlobalConfig: !!globalDefaultConfig,
      hasGlobalKey: !!globalDecryptedKey,
      keyLength: globalDecryptedKey?.length || 0
    });
    
    // 确定使用哪种对话模式 - 根据成员是否有MCP配置判断，而不仅看sessionId
    const hasMcpConfig = !!memberInfo?.mcpConfigJson;
    const useMcpMode = hasMcpConfig;
    
    console.log(`[对话请求] 模式判断:`, {
      hasMcpConfig,
      hasSessionId: !!sessionId,
      mode: useMcpMode ? 'MCP模式' : '普通对话模式'
    });
    
    // 准备系统提示词、工具列表和API配置
    let systemPrompt = "";
    let formattedTools: any[] = [];
    let apiConfig: any = null;
    let effectiveSessionId = sessionId;
    
    // 处理配置获取、解密和会话创建的逻辑
    if (useMcpMode) {
      // ===== MCP模式 =====
      
      // 步骤1: 尝试从现有会话获取所有信息
      if (effectiveSessionId) {
        const sessionInfo = mcpClientService.getSessionInfo(effectiveSessionId);
        
        if (sessionInfo) {
          // 如果会话存在且有效，使用会话中的所有缓存信息
          console.log(`[对话请求] 使用现有会话 ${effectiveSessionId} 的缓存配置`);
          
          systemPrompt = sessionInfo.systemPrompt || "";
          formattedTools = sessionInfo.formattedTools || [];
          apiConfig = sessionInfo.aiModelConfig;
          
          // 更新会话使用时间
          mcpClientService.updateSessionInfo(effectiveSessionId, { lastUsed: Date.now() });
        } else {
          // 会话无效，将重置会话ID
          console.log(`[对话请求] 会话 ${effectiveSessionId} 无效，需要重新获取配置`);
          effectiveSessionId = undefined;
        }
      }
      
      // 步骤2: 如果没有有效会话或会话中没有完整配置，尝试创建新会话
      if (!effectiveSessionId && !apiConfig && memberInfo?.mcpConfigJson) {
        try {
          console.log('[对话请求] 尝试创建新会话...');
          
          // 解析MCP配置
          const config = JSON.parse(memberInfo.mcpConfigJson);
          if (config && config.mcpServers) {
            const serverName = Object.keys(config.mcpServers)[0];
            if (serverName) {
              // 在服务器端API路由中，必须使用绝对URL，而不是相对路径
              const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
              const host = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || 'localhost:3000';
              const baseUrl = `${protocol}://${host}`;
              
              // 创建MCP会话 - 会话创建API会自动加载和缓存所有必要配置
              try {
                // 在Next.js API路由中，直接调用服务器端代码而不使用fetch
                console.log('[对话请求] 直接调用MCP会话创建...');
                
                // 直接调用mcpClientService创建会话
                const { sessionId: newSessionId, tools } = await mcpClientService.connect(
                  config.mcpServers[serverName].command, 
                  config.mcpServers[serverName].args
                );
                
                console.log('[对话请求] 已直接创建会话:', newSessionId);
                effectiveSessionId = newSessionId;
                
                // 如果有成员信息，设置会话的AI配置
                if (memberInfo) {
                  // 仅在全局缓存不存在时获取默认配置
                  if (!globalDefaultConfig) {
                    console.log('[对话请求] 全局缓存未命中，从数据库获取默认配置');
                    globalDefaultConfig = await aiModelConfigService.getDefaultConfig();
                    
                    if (globalDefaultConfig) {
                      // 仅在全局缓存不存在时解密API密钥
                      if (!globalDecryptedKey) {
                        console.log('[对话请求] 解密API密钥并存入全局缓存');
                        globalDecryptedKey = await decrypt(globalDefaultConfig.apiKey);
                      }
                    }
                  } else {
                    console.log('[对话请求] 使用全局缓存的默认配置，跳过数据库查询');
                  }
                  
                  if (globalDefaultConfig && globalDecryptedKey) {
                    // 生成系统提示词
                    const newSystemPrompt = `你是一个名为${memberInfo.name}的AI团队成员。${memberInfo.role}。你的职责是${memberInfo.responsibilities}。请提供专业、有价值的回复。`;
                    
                    // 使用全局缓存设置会话配置
                    mcpClientService.setSessionAIConfig(
                      newSessionId,
                      {
                        model: globalDefaultConfig.model,
                        baseURL: globalDefaultConfig.baseURL,
                        apiKey: globalDecryptedKey,
                        temperature: globalDefaultConfig.temperature || 0.7
                      },
                      newSystemPrompt,
                      memberInfo
                    );
                    
                    // 更新本地变量
                    systemPrompt = newSystemPrompt;
                  }
                }
                
                // 获取新创建会话的完整信息
                const newSessionInfo = mcpClientService.getSessionInfo(newSessionId);
                if (newSessionInfo) {
                  // 使用会话信息
                  if (newSessionInfo.systemPrompt) {
                    systemPrompt = newSessionInfo.systemPrompt;
                  }
                  
                  if (newSessionInfo.formattedTools && newSessionInfo.formattedTools.length > 0) {
                    formattedTools = newSessionInfo.formattedTools;
                  } else if (newSessionInfo.tools && newSessionInfo.tools.length > 0) {
                    // 格式化工具列表
                    formattedTools = newSessionInfo.tools.map(tool => {
                      if (typeof tool === 'string') {
                        return {
                          name: tool,
                          description: `使用${tool}工具执行操作`
                        };
                      } else {
                        return {
                          name: tool.name,
                          description: tool.description || `使用${tool.name}工具执行操作`,
                          input_schema: tool.inputSchema || {}
                        };
                      }
                    });
                    
                    // 缓存格式化的工具列表
                    mcpClientService.setSessionFormattedTools(newSessionId, formattedTools);
                  }
                  
                  if (newSessionInfo.aiModelConfig) {
                    apiConfig = newSessionInfo.aiModelConfig;
                  }
                }
              } catch (createError) {
                console.error('[对话请求] 直接创建会话失败:', createError);
              }
            }
          }
        } catch (error) {
          console.error('[对话请求] 创建会话出错:', error);
        }
      }
      
      // 步骤3: 如果仍然没有API配置，使用全局缓存或仅获取一次默认配置
      if (!apiConfig) {
        console.log('[对话请求] 无法从会话获取配置，检查全局缓存');
        
        try {
          // 优先使用全局缓存
          if (globalDefaultConfig && globalDecryptedKey) {
            console.log('[对话请求] 使用全局缓存的API配置');
            
            // 使用缓存的配置
            apiConfig = {
              model: globalDefaultConfig.model,
              baseURL: globalDefaultConfig.baseURL,
              apiKey: globalDecryptedKey,
              temperature: globalDefaultConfig.temperature || 0.7
            };
          } else {
            // 全局缓存未命中，只获取一次配置并更新缓存
            console.log('[对话请求] 全局缓存未命中，从数据库获取配置');
            
            // 获取默认AI模型配置 - 仅在没有会话缓存和全局缓存时执行一次
            globalDefaultConfig = await aiModelConfigService.getDefaultConfig();
            if (globalDefaultConfig) {
              // 解密API密钥 - 仅在没有会话缓存和全局缓存时执行一次
              globalDecryptedKey = await decrypt(globalDefaultConfig.apiKey);
              
              // 创建API配置
              apiConfig = {
                model: globalDefaultConfig.model,
                baseURL: globalDefaultConfig.baseURL,
                apiKey: globalDecryptedKey,
                temperature: globalDefaultConfig.temperature || 0.7
              };
              
              console.log('[对话请求] 已加载并缓存默认AI配置:', {
                model: apiConfig.model,
                baseURL: apiConfig.baseURL,
                hasApiKey: !!apiConfig.apiKey
              });
            } else {
              console.error('[对话请求] 未找到默认AI配置');
              return NextResponse.json({ 
                content: "系统未配置默认的AI模型，无法处理对话请求。" 
              }, { status: 500 });
            }
          }
          
          // 如果有会话但没有缓存配置，更新会话
          if (effectiveSessionId) {
            mcpClientService.setSessionAIConfig(
              effectiveSessionId,
              apiConfig,
              systemPrompt || (memberInfo ? 
                `你是一个名为${memberInfo.name}的AI团队成员。${memberInfo.role}。你的职责是${memberInfo.responsibilities}。请提供专业、有价值的回复。` : 
                "你是一个专业的AI助手。回答用户问题时简洁清晰，提供有价值的信息。"
              ),
              memberInfo
            );
          }
        } catch (error) {
          console.error('[对话请求] 加载默认配置失败:', error);
          return NextResponse.json({ 
            error: '加载AI配置失败，请联系管理员' 
          }, { status: 500 });
        }
      }
      
      // 步骤4: 确保有可用的工具列表
      if (!formattedTools.length && memberInfo?.mcpConfigJson) {
        try {
          console.log('[对话请求] 从MCP配置中获取工具列表');
          
          // 解析MCP配置
          const config = JSON.parse(memberInfo.mcpConfigJson);
          
          // 从配置中提取工具
          if (config && config.tools && Array.isArray(config.tools)) {
            // 配置中直接定义的工具
            formattedTools = config.tools.map((tool: any) => {
              if (typeof tool === 'string') {
                return {
                  name: tool,
                  description: `使用${tool}工具执行操作`
                };
              } else {
                return {
                  name: tool.name,
                  description: tool.description || `使用${tool.name}工具执行操作`,
                  input_schema: tool.inputSchema || {}
                };
              }
            });
            
            console.log(`[对话请求] 从配置中加载了 ${formattedTools.length} 个工具`);
          } else {
            // 没有在配置中找到工具，加载预定义工具
            // 这里可以添加一些常用工具，确保即使没有配置也能使用基本功能
            formattedTools = [
              {
                name: "mcp_youtube_transcript_get_transcript",
                description: "从YouTube视频URL或ID中提取字幕",
                input_schema: {
                  type: "object",
                  properties: {
                    url: {
                      type: "string",
                      description: "YouTube视频URL或ID"
                    },
                    lang: {
                      type: "string",
                      description: "字幕语言代码（例如，'zh'，'en'）"
                    }
                  },
                  required: ["url"]
                }
              }
            ];
            
            console.log('[对话请求] 使用预定义工具列表，因为配置中未指定工具');
          }
          
          // 如果有会话，缓存工具列表
          if (effectiveSessionId) {
            mcpClientService.setSessionFormattedTools(effectiveSessionId, formattedTools);
          }
        } catch (error) {
          console.error('[对话请求] 获取工具列表失败:', error);
          // 使用默认工具集
          formattedTools = [];
        }
      }
      
      // 步骤5: 确保系统提示词存在
      if (!systemPrompt && memberInfo) {
        systemPrompt = `你是一个名为${memberInfo.name}的AI团队成员。${memberInfo.role}。你的职责是${memberInfo.responsibilities}。请提供专业、有价值的回复。`;
      } else if (!systemPrompt) {
        systemPrompt = "你是一个专业的AI助手。回答用户问题时简洁清晰，提供有价值的信息。";
      }
    } else {
      // ===== 普通对话模式 =====
      // 生成系统提示词
      systemPrompt = memberInfo ? 
        `你是一个名为${memberInfo.name}的AI团队成员。${memberInfo.role}。你的职责是${memberInfo.responsibilities}。请提供专业、有价值的回复。` : 
        "你是一个专业的AI助手。回答用户问题时简洁清晰，提供有价值的信息。";
      
      try {
        // 优先使用全局缓存
        if (globalDefaultConfig && globalDecryptedKey) {
          console.log('[对话请求] 普通模式使用全局缓存的API配置');
          
          // 使用缓存的配置
          apiConfig = {
            model: globalDefaultConfig.model,
            baseURL: globalDefaultConfig.baseURL,
            apiKey: globalDecryptedKey,
            temperature: globalDefaultConfig.temperature || 0.7
          };
        } else {
          // 全局缓存未命中，只获取一次配置并更新缓存
          console.log('[对话请求] 普通模式下全局缓存未命中，从数据库获取配置');
          
          // 获取默认AI模型配置 - 仅在全局缓存不存在时执行
          globalDefaultConfig = await aiModelConfigService.getDefaultConfig();
          if (!globalDefaultConfig) {
            return NextResponse.json({ 
              content: "系统未配置默认的AI模型，无法处理对话请求。" 
            }, { status: 500 });
          }
          
          // 解密API密钥 - 仅在全局缓存不存在时执行
          globalDecryptedKey = await decrypt(globalDefaultConfig.apiKey);
          
          // 创建API配置
          apiConfig = {
            model: globalDefaultConfig.model,
            baseURL: globalDefaultConfig.baseURL,
            apiKey: globalDecryptedKey,
            temperature: globalDefaultConfig.temperature || 0.7
          };
        }
      } catch (error) {
        console.error('[对话请求] 加载默认配置失败:', error);
        return NextResponse.json({ 
          error: '加载AI配置失败，请联系管理员' 
        }, { status: 500 });
      }
    }
    
    // 确保此时API配置存在
    if (!apiConfig) {
      return NextResponse.json({ 
        error: '无法获取有效的AI配置' 
      }, { status: 500 });
    }
    
    // 准备对话消息
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ];
    
    console.log("[对话请求] 发送消息:", {
      mode: useMcpMode ? 'MCP模式' : '普通对话模式',
      sessionId: effectiveSessionId || '无会话',
      systemPrompt: systemPrompt.substring(0, 50) + (systemPrompt.length > 50 ? '...' : ''),
      userMessage: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
      toolsCount: formattedTools.length
    });
    
    // 获取API端点和请求头
    const { endpoint, headers } = getApiEndpointAndHeaders({
      ...apiConfig,
      id: 'default',
      name: 'Default Model'
    } as AIModelConfig);
    
    // 准备API请求参数
    const requestBody: any = {
      model: apiConfig.model,
      messages: messages,
      temperature: apiConfig.temperature || 0.7,
      max_tokens: 1000
    };
    
    // 如果是MCP模式且有工具列表，添加到请求中
    if (useMcpMode && formattedTools.length > 0) {
      console.log(`[对话请求] 使用 ${formattedTools.length} 个工具`);
      
      // 不同的AI提供商可能使用不同的参数名称
      if (apiConfig.baseURL.includes('anthropic.com')) {
        // Anthropic API
        requestBody.tools = formattedTools;
      } else {
        // OpenAI 兼容API
        requestBody.tools = formattedTools.map(tool => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema || {}
          }
        }));
      }
    }
    
    // 发送请求给大模型API
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败 (${response.status}): ${errorText}`);
    }
    
    // 解析API响应
    const data = await response.json();
    console.log("[对话请求] 原始API响应:", JSON.stringify(data).substring(0, 200) + "...");
    
    // 提取响应内容和可能的工具调用
    let content = '';
    let toolCalls: any[] = [];
    
    // 解析不同API格式的响应
    if (data.choices && data.choices[0]) {
      // OpenAI 格式
      if (data.choices[0].message) {
        content = data.choices[0].message.content || '';
        
        // 处理工具调用 (仅MCP模式)
        if (useMcpMode && data.choices[0].message.tool_calls) {
          toolCalls = data.choices[0].message.tool_calls;
          
          // 执行工具调用
          for (const toolCall of toolCalls) {
            try {
              const toolName = toolCall.function?.name;
              let toolArgs = {};
              
              try {
                toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
              } catch (e) {
                console.error(`[对话请求] 解析工具参数失败:`, e);
                toolArgs = { raw: toolCall.function?.arguments };
              }
              
              console.log(`[对话请求] 执行工具调用: ${toolName}`, toolArgs);
              
              // 如果没有有效会话，尝试创建临时会话
              if (!effectiveSessionId && memberInfo?.mcpConfigJson) {
                try {
                  console.log('[对话请求] 尝试为工具调用创建即时会话...');
                  
                  // 解析MCP配置
                  const config = JSON.parse(memberInfo.mcpConfigJson);
                  if (config && config.mcpServers) {
                    const serverName = Object.keys(config.mcpServers)[0];
                    if (serverName) {
                      // 直接调用mcpClientService创建会话
                      const { sessionId: tempSessionId } = await mcpClientService.connect(
                        config.mcpServers[serverName].command, 
                        config.mcpServers[serverName].args
                      );
                      
                      console.log('[对话请求] 已创建即时工具调用会话:', tempSessionId);
                      effectiveSessionId = tempSessionId;
                    }
                  }
                } catch (createError) {
                  console.error('[对话请求] 创建即时工具调用会话失败:', createError);
                  throw new Error('无法创建工具调用会话');
                }
              }
              
              // 确保会话ID存在且为字符串
              if (effectiveSessionId) {
                // 调用MCP工具 - 确保会话ID存在
                const toolResult = await mcpClientService.callTool(effectiveSessionId, toolName, toolArgs);
                
                // 向模型报告工具执行结果
                messages.push({
                  role: "assistant",
                  content: null,
                  tool_calls: [toolCall]
                });
                
                messages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)
                });
                
                // 再次调用模型获取最终响应
                const followUpResponse = await fetch(endpoint, {
                  method: "POST",
                  headers,
                  body: JSON.stringify({
                    ...requestBody,
                    messages: messages
                  }),
                });
                
                if (!followUpResponse.ok) {
                  throw new Error(`后续API请求失败: ${followUpResponse.status}`);
                }
                
                const followUpData = await followUpResponse.json();
                
                if (followUpData.choices && followUpData.choices[0] && followUpData.choices[0].message) {
                  content = followUpData.choices[0].message.content || '';
                }
              } else {
                throw new Error('无法创建有效的会话ID，无法调用工具');
              }
            } catch (error) {
              const toolError = error as Error;
              console.error(`[对话请求] 工具调用执行失败:`, toolError);
              content += `\n\n工具调用失败: ${toolError.message || '未知错误'}`;
            }
          }
        } else if (useMcpMode && data.choices[0].message.tool_calls && !effectiveSessionId) {
          // 如果有工具调用但没有有效会话ID
          console.warn('[对话请求] 模型尝试调用工具，但没有有效的会话ID');
          content += '\n\n(此对话未连接到工具服务器，无法执行工具调用。)';
          toolCalls = data.choices[0].message.tool_calls; // 记录工具调用意图，但不执行
        }
      }
    } else if (data.content && Array.isArray(data.content)) {
      // Anthropic 格式
      for (const item of data.content) {
        if (item.type === 'text') {
          content = item.text || '';
        } else if (useMcpMode && item.type === 'tool_use' && effectiveSessionId) {
          // 处理Anthropic工具调用 (仅MCP模式且有有效会话ID)
          try {
            const toolName = item.name;
            const toolArgs = item.input || {};
            
            console.log(`[对话请求] 执行Anthropic工具调用: ${toolName}`, toolArgs);
            
            // 调用MCP工具
            const toolResult = await mcpClientService.callTool(effectiveSessionId, toolName, toolArgs);
            
            // 向模型报告工具执行结果
            messages.push({
              role: "assistant",
              content: `I'll use the ${toolName} tool.`
            });
            
            messages.push({
              role: "user",
              content: `Tool ${toolName} result: ${typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)}`
            });
            
            // 再次调用模型获取最终响应
            const followUpResponse = await fetch(endpoint, {
              method: "POST",
              headers,
              body: JSON.stringify({
                ...requestBody,
                messages: messages
              }),
            });
            
            if (!followUpResponse.ok) {
              throw new Error(`后续API请求失败: ${followUpResponse.status}`);
            }
            
            const followUpData = await followUpResponse.json();
            
            if (followUpData.content && Array.isArray(followUpData.content)) {
              const textContent = followUpData.content.find((c: any) => c.type === 'text');
              if (textContent) {
                content = textContent.text || '';
              }
            }
          } catch (error) {
            const toolError = error as Error;
            console.error(`[对话请求] Anthropic工具调用执行失败:`, toolError);
            content += `\n\n工具调用失败: ${toolError.message || '未知错误'}`;
          }
        } else if (useMcpMode && item.type === 'tool_use' && !effectiveSessionId) {
          // 如果有工具调用但没有有效会话ID
          console.warn('[对话请求] Anthropic模型尝试调用工具，但没有有效的会话ID');
          content += '\n\n(此对话未连接到工具服务器，无法执行工具调用。)';
        }
      }
    } else {
      // 未知格式
      content = "无法解析API响应格式，请联系系统管理员。";
    }
    
    // 确保总是有内容返回
    if (!content) {
      content = "AI助手未能生成有效回复，请重试。";
    }
    
    console.log("[对话请求] 最终内容:", content.substring(0, 100) + "...");
    
    // 返回结果
    return NextResponse.json({ 
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    });
  } catch (error) {
    // 处理错误
    console.error('[对话请求] 处理失败:', error);
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '处理对话时发生未知错误'
    }, { status: 500 });
  }
}

// 处理openai响应
const handleResponse = async (response: any, sessionId?: string): Promise<any> => {
  // 如果响应是一个错误
  if (response instanceof Error) {
    return {
      content: `处理请求时出错: ${response.message}`
    };
  }
  
  // 处理openai的响应
  if (response.choices && response.choices.length > 0) {
    const message = response.choices[0].message;
    
    // 获取主要内容
    const content = message.content || '';
    
    // 处理工具调用
    if (message.tool_calls && message.tool_calls.length > 0) {
      // 提取工具调用信息
      const toolCalls = message.tool_calls.map((toolCall: any) => {
        try {
          return {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments,
            id: toolCall.id
          };
        } catch (e) {
          console.error('[对话请求] 无法解析工具调用:', e);
          return { error: '工具调用解析失败' };
        }
      });
      
      console.log('[对话请求] 原始API响应:', JSON.stringify(response).substring(0, 250) + '...');
      
      // 分离第一个工具调用来执行
      const firstToolCall = message.tool_calls[0];
      
      if (firstToolCall && firstToolCall.function && firstToolCall.function.name) {
        const toolName = firstToolCall.function.name;
        let toolArgs;
        
        try {
          toolArgs = JSON.parse(firstToolCall.function.arguments);
          console.log(`[对话请求] 执行工具调用: ${toolName}`, toolArgs);
          
          // 调用工具
          const toolResult = await executeTool(toolName, toolArgs, sessionId);
          
          if (toolResult) {
            // 有会话ID，使用MCP处理工具调用结果
            if (sessionId) {
              // 返回工具调用和结果
              return { 
                content: toolResult.content || toolResult.message?.content || toolResult.text || '工具执行完成，但未返回内容',
                toolCalls: toolCalls  // 同时返回工具调用信息到前端
              };
            } else {
              // 无会话ID，直接返回工具结果
              return { 
                content: toolResult.content || toolResult.message?.content || toolResult.text || '工具执行完成，但未返回内容',
                toolCalls: toolCalls  // 同时返回工具调用信息到前端
              };
            }
          } else {
            // 工具调用失败，返回错误信息
            return { 
              content: '工具调用失败，未返回结果',
              toolCalls: toolCalls  // 同时返回工具调用信息到前端
            };
          }
        } catch (error) {
          console.error(`[对话请求] 工具调用出错 (${toolName}):`, error);
          return { 
            content: `调用工具 ${toolName} 时出错: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
            toolCalls: toolCalls  // 同时返回工具调用信息到前端
          };
        }
      }
    }
    
    // 没有工具调用，直接返回内容
    return { content };
  }
  
  // 处理claude的响应
  if (response.content) {
    return { content: response.content };
  }
  
  // 其他情况
  return { content: '无法解析AI响应' };
};

/**
 * 执行工具调用
 * @param toolName 工具名称
 * @param toolArgs 工具参数
 * @param sessionId 会话ID，可选
 * @returns 工具执行结果
 */
const executeTool = async (toolName: string, toolArgs: any, sessionId?: string): Promise<any> => {
  if (!sessionId) {
    console.log(`[对话请求] 无会话ID，无法执行工具 ${toolName}`);
    return { content: `由于未连接到工具服务器，无法执行工具 ${toolName}` };
  }
  
  try {
    console.log(`[MCP] 会话 ${sessionId} 调用工具 ${toolName} 参数:`, toolArgs);
    
    // 使用MCP客户端调用工具
    const result = await mcpClientService.callTool(sessionId, toolName, toolArgs);
    return result;
  } catch (error) {
    console.error(`[MCP] 会话 ${sessionId} 调用工具 ${toolName} 失败:`, error);
    throw error;
  }
}; 