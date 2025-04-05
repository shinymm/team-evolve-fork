import { NextResponse } from "next/server";
import { mcpClientService } from "@/server/services/mcp-client.service";
import { decrypt } from "@/lib/utils/encryption-utils";
import { getApiEndpointAndHeaders } from "@/lib/services/ai-service";
import { AIModelConfig } from "@/lib/services/ai-service";
import { aiModelConfigService } from "@/lib/services/ai-model-config-service";

// 流式响应编码器
const encoder = new TextEncoder();

interface ConversationRequest {
  sessionId?: string;
  userMessage: string;
  memberInfo?: {
    name: string;
    role: string;
    responsibilities: string;
    mcpConfigJson?: string;  // 添加MCP配置字段
  };
  previousToolState?: {  // 添加上一次工具状态
    name: string;
    state: any;
  }
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
 * 统一处理流式对话请求 - 支持实时推送工具调用和结果
 */
export async function POST(req: Request) {
  // 创建流式响应
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 解析请求参数
        const { sessionId, userMessage, memberInfo, previousToolState } = await req.json() as ConversationRequest;
        
        // 验证必要参数
        if (!userMessage) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '缺少必要参数: userMessage' })}\n\n`));
          controller.close();
          return;
        }
        
        console.log(`[流式对话] 使用全局缓存状态:`, {
          hasGlobalConfig: !!globalDefaultConfig,
          hasGlobalKey: !!globalDecryptedKey,
          keyLength: globalDecryptedKey?.length || 0
        });
        
        // 获取会话中的工具状态
        let toolState = previousToolState;
        if (sessionId && !toolState) {
          const sessionInfo = mcpClientService.getSessionInfo(sessionId);
          if (sessionInfo && sessionInfo.toolState) {
            toolState = sessionInfo.toolState;
            console.log(`[流式对话] 从会话中恢复工具状态:`, {
              toolName: toolState.name,
              hasState: !!toolState.state
            });
          }
        }
        
        // 确定使用哪种对话模式 - 根据成员是否有MCP配置判断，而不仅看sessionId
        const hasMcpConfig = !!memberInfo?.mcpConfigJson;
        const useMcpMode = hasMcpConfig;
        
        // 发送初始状态
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'status', 
          content: '连接成功',
          mode: useMcpMode ? 'MCP模式' : '普通对话模式'
        })}\n\n`));
        
        console.log(`[流式对话] 模式判断:`, {
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
              console.log(`[流式对话] 使用现有会话 ${effectiveSessionId} 的缓存配置`);
              
              systemPrompt = sessionInfo.systemPrompt || "";
              formattedTools = sessionInfo.formattedTools || [];
              apiConfig = sessionInfo.aiModelConfig;
              
              // 更新会话使用时间
              mcpClientService.setSessionInfo(effectiveSessionId, { lastUsed: Date.now() });
            } else {
              // 会话无效，将重置会话ID
              console.log(`[流式对话] 会话 ${effectiveSessionId} 无效，需要重新获取配置`);
              effectiveSessionId = undefined;
            }
          }
          
          // 步骤2: 如果没有有效会话或会话中没有完整配置，尝试创建新会话
          if (!effectiveSessionId && !apiConfig && memberInfo?.mcpConfigJson) {
            try {
              console.log('[流式对话] 尝试创建新会话...');
              
              // 解析MCP配置
              const config = JSON.parse(memberInfo.mcpConfigJson);
              if (config && config.mcpServers) {
                const serverName = Object.keys(config.mcpServers)[0];
                if (serverName) {
                  // 直接调用mcpClientService创建会话
                  console.log('[流式对话] 直接调用MCP会话创建...');
                  
                  // 直接调用mcpClientService创建会话
                  const { sessionId: newSessionId, tools } = await mcpClientService.connect(
                    config.mcpServers[serverName].command, 
                    config.mcpServers[serverName].args
                  );
                  
                  console.log('[流式对话] 已直接创建会话:', newSessionId);
                  effectiveSessionId = newSessionId;
                  
                  // 通知客户端会话已创建
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'status', 
                    content: '已创建会话连接'
                  })}\n\n`));
                  
                  // 如果有成员信息，设置会话的AI配置
                  if (memberInfo) {
                    // 仅在全局缓存不存在时获取默认配置
                    if (!globalDefaultConfig) {
                      console.log('[流式对话] 全局缓存未命中，从数据库获取默认配置');
                      globalDefaultConfig = await aiModelConfigService.getDefaultConfig();
                      
                      if (globalDefaultConfig) {
                        // 仅在全局缓存不存在时解密API密钥
                        if (!globalDecryptedKey) {
                          console.log('[流式对话] 解密API密钥并存入全局缓存');
                          globalDecryptedKey = await decrypt(globalDefaultConfig.apiKey);
                        }
                      }
                    } else {
                      console.log('[流式对话] 使用全局缓存的默认配置，跳过数据库查询');
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
                }
              }
            } catch (error) {
              console.error('[流式对话] 创建会话出错:', error);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'status', 
                content: '无法创建会话，将使用普通模式'
              })}\n\n`));
            }
          }
          
          // 步骤3: 如果仍然没有API配置，使用全局缓存或仅获取一次默认配置
          if (!apiConfig) {
            console.log('[流式对话] 无法从会话获取配置，检查全局缓存');
            
            try {
              // 优先使用全局缓存
              if (globalDefaultConfig && globalDecryptedKey) {
                console.log('[流式对话] 使用全局缓存的API配置');
                
                // 使用缓存的配置
                apiConfig = {
                  model: globalDefaultConfig.model,
                  baseURL: globalDefaultConfig.baseURL,
                  apiKey: globalDecryptedKey,
                  temperature: globalDefaultConfig.temperature || 0.7
                };
              } else {
                // 全局缓存未命中，只获取一次配置并更新缓存
                console.log('[流式对话] 全局缓存未命中，从数据库获取配置');
                
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
                  
                  console.log('[流式对话] 已加载并缓存默认AI配置:', {
                    model: apiConfig.model,
                    baseURL: apiConfig.baseURL,
                    hasApiKey: !!apiConfig.apiKey
                  });
                } else {
                  console.error('[流式对话] 未找到默认AI配置');
                  sendErrorEvent(controller, '系统未配置默认的AI模型，无法处理对话请求');
                  controller.close();
                  return;
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
              console.error('[流式对话] 加载默认配置失败:', error);
              sendErrorEvent(controller, '加载AI配置失败，请联系管理员');
              controller.close();
              return;
            }
          }
          
          // 步骤4: 确保有可用的工具列表
          if (!formattedTools.length && memberInfo?.mcpConfigJson) {
            try {
              console.log('[流式对话] 从MCP配置中获取工具列表');
              
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
                
                console.log(`[流式对话] 从配置中加载了 ${formattedTools.length} 个工具`);
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
                
                console.log('[流式对话] 使用预定义工具列表，因为配置中未指定工具');
              }
              
              // 如果有会话，缓存工具列表
              if (effectiveSessionId) {
                mcpClientService.setSessionFormattedTools(effectiveSessionId, formattedTools);
              }
            } catch (error) {
              console.error('[流式对话] 获取工具列表失败:', error);
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
              console.log('[流式对话] 普通模式使用全局缓存的API配置');
              
              // 使用缓存的配置
              apiConfig = {
                model: globalDefaultConfig.model,
                baseURL: globalDefaultConfig.baseURL,
                apiKey: globalDecryptedKey,
                temperature: globalDefaultConfig.temperature || 0.7
              };
            } else {
              // 全局缓存未命中，只获取一次配置并更新缓存
              console.log('[流式对话] 普通模式下全局缓存未命中，从数据库获取配置');
              
              // 获取默认AI模型配置 - 仅在全局缓存不存在时执行
              globalDefaultConfig = await aiModelConfigService.getDefaultConfig();
              if (!globalDefaultConfig) {
                sendErrorEvent(controller, '系统未配置默认的AI模型，无法处理对话请求');
                controller.close();
                return;
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
            console.error('[流式对话] 加载默认配置失败:', error);
            sendErrorEvent(controller, '加载AI配置失败，请联系管理员');
            controller.close();
            return;
          }
        }
        
        // 确保此时API配置存在
        if (!apiConfig) {
          sendErrorEvent(controller, '无法获取有效的AI配置');
          controller.close();
          return;
        }
        
        // 准备对话消息
        const messages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
        ];
        
        // 如果有sequentialthinking工具状态，加入上下文
        if (toolState && (toolState.name === 'sequentialthinking' || toolState.name === 'mcp_sequential_thinking_sequentialthinking') 
            && toolState.state && toolState.state.thought) {
          
          // 构建思考过程上下文
          const thoughtContext = `上次我们正在进行思考过程 ${toolState.state.thoughtNumber || '?'}/${toolState.state.totalThoughts || '?'}。
上次的思考是: "${toolState.state.thought}"
请继续这个思考过程，考虑我的回答: "${userMessage}"`;
          
          messages.push({ role: "user", content: thoughtContext });
        } else {
          // 正常用户消息
          messages.push({ role: "user", content: userMessage });
        }
        
        console.log("[流式对话] 发送消息:", {
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
          max_tokens: 1000,
          stream: true // 使用流式响应
        };
        
        // 如果是MCP模式且有工具列表，添加到请求中
        if (useMcpMode && formattedTools.length > 0) {
          console.log(`[流式对话] 使用 ${formattedTools.length} 个工具`);
          
          // 添加工具列表到请求
          requestBody.tools = formattedTools
            .filter(tool => tool && typeof tool === 'object' && tool.name) // 过滤掉无效工具
            .map(tool => ({
              type: "function",
              function: {
                name: tool.name,
                description: tool.description || `使用${tool.name}工具执行操作`,
                parameters: tool.input_schema || {}
              }
            }));
          requestBody.tool_choice = "auto"; // 允许模型自动选择是否使用工具
          
          console.log(`[流式对话] 工具列表示例:`, 
            formattedTools.slice(0, 1).map(t => t && t.name ? { 
              name: t.name, 
              desc: (t.description || '').substring(0, 30) 
            } : '无效工具')
          );
        }
        
        // 发送请求给大模型API
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          sendErrorEvent(controller, `API请求失败 (${response.status}): ${errorText}`);
          controller.close();
          return;
        }
        
        // 处理流式响应
        const reader = response.body?.getReader();
        if (!reader) {
          sendErrorEvent(controller, '无法读取模型响应流');
          controller.close();
          return;
        }
        
        let buffer = '';
        let accumContent = '';
        let toolCallDetected = false;
        let toolCallName = '';
        let toolCallArgs = {};
        let toolCallId = '';
        let rawArgsString = '';
        
        // 读取和处理流式响应
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // 解码当前块
          const chunk = new TextDecoder().decode(value);
          buffer += chunk;
          
          // 处理完整的事件
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.substring(6));
                
                // 提取内容增量
                if (data.choices && data.choices[0]) {
                  const delta = data.choices[0].delta || {};
                  
                  // 处理工具调用
                  if (delta.tool_calls && delta.tool_calls.length > 0) {
                    // 标记工具调用被检测到
                    toolCallDetected = true;
                    
                    // 累积工具名称
                    if (delta.tool_calls[0].function?.name) {
                      toolCallName += delta.tool_calls[0].function.name;
                    }
                    
                    // 记录工具调用ID
                    if (delta.tool_calls[0].id && !toolCallId) {
                      toolCallId = delta.tool_calls[0].id;
                    }
                    
                    // 累积工具参数 (作为字符串，稍后解析)
                    if (delta.tool_calls[0].function?.arguments) {
                      rawArgsString += delta.tool_calls[0].function.arguments;
                      
                      // 只在工具名称第一次出现时发送消息，或当工具名称变化时
                      if (toolCallName && !accumContent.includes(`🔧 正在使用工具: ${toolCallName}`)) {
                        // 发送工具调用开始通知，但不包含参数
                        const toolStartMessage = `🔧 正在使用工具: ${toolCallName}\n`;
                        sendContentEvent(controller, toolStartMessage);
                        accumContent = toolStartMessage;
                      }
                      
                      // 同时尝试解析参数对象 (仅用于工具调用，不影响显示)
                      try {
                        if (rawArgsString.includes('{') && rawArgsString.includes('}')) {
                          const match = rawArgsString.match(/\{[\s\S]*\}/);
                          if (match) {
                            toolCallArgs = JSON.parse(match[0]);
                          }
                        }
                      } catch (e) {
                        // 解析错误不影响流程
                      }
                    }
                  }
                  // 处理普通内容更新
                  else if (delta.content) {
                    // 如果之前检测到工具调用，先发送处理中消息
                    if (toolCallDetected && accumContent.includes('正在使用工具') && !accumContent.includes('处理中')) {
                      sendContentEvent(controller, '处理中...');
                      accumContent = '处理中...';
                    }
                    
                    // 发送内容增量
                    sendContentEvent(controller, delta.content);
                    
                    // 追加到累积内容
                    accumContent += delta.content;
                  }
                }
              } catch (error) {
                console.error('[流式对话] 解析事件出错:', error);
              }
            } else if (line.trim() === 'data: [DONE]') {
              console.log('[流式对话] 流结束');
            }
          }
        }
        
        // 如果检测到工具调用，执行它
        if (toolCallDetected && toolCallName && Object.keys(toolCallArgs).length > 0 && effectiveSessionId) {
          try {
            // 先发送一次最终的完整参数信息
            const finalParams = JSON.stringify(toolCallArgs, null, 2);
            sendContentEvent(controller, `参数: ${finalParams}`);
            
            sendStatusEvent(controller, '正在执行工具调用...');
            
            console.log(`[流式对话] 执行工具调用: ${toolCallName}`, toolCallArgs);
            
            // 调用工具
            const toolResult = await mcpClientService.callTool(effectiveSessionId, toolCallName, toolCallArgs);
            
            // 获取工具结果文本
            let resultText = '';
            try {
              // 通用结果处理逻辑，不依赖特定工具名称
              if (typeof toolResult === 'string') {
                // 字符串结果直接显示
                resultText = toolResult;
              } else if (toolResult === null || toolResult === undefined) {
                // 空结果处理
                resultText = '工具未返回结果';
              } else if (typeof toolResult === 'object') {
                // 智能检测常见的结果字段名称
                // 按优先级尝试获取内容字段
                const possibleContentFields = ['content', 'text', 'message', 'result', 'data', 'thought'];
                
                // 首先检查是否有常见的内容字段
                let foundContent = false;
                for (const field of possibleContentFields) {
                  if (toolResult[field] !== undefined) {
                    if (typeof toolResult[field] === 'string') {
                      resultText = toolResult[field];
                      foundContent = true;
                      break;
                    } else if (toolResult[field] && typeof toolResult[field] === 'object' && toolResult[field].content) {
                      resultText = toolResult[field].content;
                      foundContent = true;
                      break;
                    }
                  }
                }
                
                // 如果没有找到常见字段，但发现有意义的可能"进度"信息字段，添加到显示
                if (toolResult.thoughtNumber && toolResult.totalThoughts) {
                  resultText = `${resultText ? resultText : ''}${resultText ? '\n' : ''}(进度: ${toolResult.thoughtNumber}/${toolResult.totalThoughts})`;
                }
                
                // 如果仍未找到内容或需要完整显示，格式化整个对象
                if (!foundContent || Object.keys(toolResult).length > 1) {
                  resultText = JSON.stringify(toolResult, null, 2);
                }
              } else {
                // 兜底处理其他数据类型
                resultText = String(toolResult);
              }
              
              // 特殊处理sequentialthinking工具：在会话中保存状态
              if ((toolCallName === 'sequentialthinking' || toolCallName === 'mcp_sequential_thinking_sequentialthinking') 
                  && typeof toolResult === 'object' && toolResult.nextThoughtNeeded === true) {
                // 将工具状态保存到会话中
                mcpClientService.setSessionInfo(effectiveSessionId, {
                  toolState: {
                    name: toolCallName,
                    state: toolResult
                  }
                });
                
                // 提示用户这是多轮思考过程
                if (toolResult.thoughtNumber && toolResult.totalThoughts) {
                  sendStatusEvent(controller, `这是思考过程 ${toolResult.thoughtNumber}/${toolResult.totalThoughts}，请继续对话以完成思考`);
                }
              }
            } catch (e) {
              // 最终安全检查
              resultText = `工具执行成功，但结果格式无法处理: ${e instanceof Error ? e.message : '未知错误'}`;
            }
            
            // 确保结果是字符串后再使用substring
            resultText = String(resultText);
            
            // 发送执行结果通知 - 清晰显示结果并添加换行
            sendContentEvent(controller, `\n⚙️ 工具执行结果:\n${resultText.substring(0, 1000)}${resultText.length > 1000 ? '...' : ''}`);
            
            // 构建包含工具调用和结果的完整消息历史
            const updatedMessages = [
              ...messages,
              { 
                role: "assistant", 
                content: null,
                tool_calls: [{
                  id: toolCallId || `call_${Date.now()}`,
                  type: "function",
                  function: {
                    name: toolCallName,
                    arguments: JSON.stringify(toolCallArgs)
                  }
                }]
              },
              {
                role: "tool",
                tool_call_id: toolCallId || `call_${Date.now()}`,
                content: resultText
              }
            ];
            
            // 再次调用模型获取最终回复
            const finalResponse = await fetch(endpoint, {
              method: "POST",
              headers,
              body: JSON.stringify({
                model: apiConfig.model,
                messages: updatedMessages,
                temperature: apiConfig.temperature || 0.7,
                max_tokens: 1000,
                stream: false
              }),
            });
            
            if (!finalResponse.ok) {
              sendErrorEvent(controller, '获取工具调用后的回复失败');
            } else {
              const finalData = await finalResponse.json();
              
              // 获取最终回复内容
              if (finalData.choices && finalData.choices[0] && finalData.choices[0].message) {
                const finalContent = finalData.choices[0].message.content || '';
                sendContentEvent(controller, `\n\n${finalContent}`);
                
                // 如果有工具状态，通知客户端
                if (effectiveSessionId) {
                  const sessionInfo = mcpClientService.getSessionInfo(effectiveSessionId);
                  if (sessionInfo && sessionInfo.toolState) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                      type: 'tool_state', 
                      state: sessionInfo.toolState
                    })}\n\n`));
                  }
                }
              }
            }
          } catch (error) {
            console.error('[流式对话] 工具调用失败:', error);
            // 改进错误处理，确保在UI中显示详细错误
            const errorMessage = error instanceof Error 
              ? `工具调用失败: ${error.message}${error.cause ? `\n原因: ${JSON.stringify(error.cause)}` : ''}`
              : `工具调用失败: ${JSON.stringify(error)}`;
            
            // 发送错误信息到UI，添加换行以提高可读性
            sendContentEvent(controller, `\n❌ ${errorMessage}`);
            
            // 同时通过错误事件通知系统
            sendErrorEvent(controller, errorMessage);
          }
        }
        
        // 完成流
        controller.close();
      } catch (error) {
        console.error('[流式对话] 整体处理失败:', error);
        sendErrorEvent(controller, error instanceof Error ? error.message : '处理对话时发生未知错误');
        controller.close();
      }
    }
  });
  
  // 返回流式响应
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

// 辅助函数：发送错误事件
function sendErrorEvent(controller: ReadableStreamDefaultController, message: string) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
    type: 'error', 
    content: message 
  })}\n\n`));
}

// 辅助函数：发送状态事件
function sendStatusEvent(controller: ReadableStreamDefaultController, message: string) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
    type: 'status', 
    content: message 
  })}\n\n`));
}

// 辅助函数：发送内容更新事件
function sendContentEvent(controller: ReadableStreamDefaultController, content: string) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
    type: 'content', 
    content 
  })}\n\n`));
}