import { NextRequest, NextResponse } from 'next/server';
import { POLISH_PROMPT } from '@/lib/prompts/polish';
import { GoogleGenerativeAI } from '@google/generative-ai';
// 1. 导入 aiModelConfigService 和其他必要的工具函数/类型
import { aiModelConfigService } from '@/lib/services/ai-model-config-service';
import { decrypt } from '@/lib/utils/encryption-utils';
import {
  AIModelConfig,
  isGeminiModel,
  getApiEndpointAndHeaders,
} from '@/lib/services/ai-service';

// --- 移除临时的 AI 模型获取方式 ---
// const getAIModel = () => { ... };
// --- 结束移除 ---

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Invalid input: text is required' }, { status: 400 });
    }

    // 2. 使用 aiModelConfigService 获取默认配置
    const config = await aiModelConfigService.getDefaultConfig();
    if (!config) {
      console.error('Polish API Error: Default AI config not found.');
      return NextResponse.json(
        { error: '未找到默认AI模型配置，请先在设置中配置模型', details: 'Default AI config not found.' },
        { status: 404 }
      );
    }

    // 检查 config 是否包含 model 字段
    if (!config.model) {
      console.error('Polish API Error: Default AI config is missing the required \'model\' field.', config);
      return NextResponse.json(
        { error: '默认AI配置无效', details: 'Default AI config is missing the required \'model\' field.' }, 
        { status: 500 } 
      );
    }

    // 3. 解密 API 密钥
    let decryptedApiKey: string;
    try {
        decryptedApiKey = await decrypt(config.apiKey);
    } catch (decryptionError) {
        console.error('Polish API Error: Failed to decrypt API key.', decryptionError);
        return NextResponse.json(
            { error: '无法使用存储的API密钥', details: 'Failed to decrypt API key.' }, 
            { status: 500 } 
        );
    }

    const finalConfig: AIModelConfig = {
        ...config,
        apiKey: decryptedApiKey,
    };

    const isGemini = isGeminiModel(finalConfig.model);
    const prompt = POLISH_PROMPT.replace('{text}', text);
    let polishedText = '';

    console.log(`Polish request using model: ${finalConfig.model} (Is Gemini: ${isGemini})`);

    // 4. 根据模型类型调用相应的 API
    if (isGemini) {
      try {
        const genAI = new GoogleGenerativeAI(finalConfig.apiKey);
        const model = genAI.getGenerativeModel({ model: finalConfig.model });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        polishedText = response.text();
        console.log('Received polished text from Gemini.');
      } catch (geminiError) {
        console.error('Gemini API Error during polish:', geminiError);
        throw new Error(`Gemini API request failed: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}`);
      }
    } else {
      // 处理标准 OpenAI 兼容 API
      try {
        const { endpoint, headers } = getApiEndpointAndHeaders(finalConfig);
        console.log(`Sending polish request to standard endpoint: ${endpoint}`);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            model: finalConfig.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: finalConfig.temperature || 0.7,
            stream: false,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Standard API Error during polish (${response.status}): ${errorText}`);
          throw new Error(`API request failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        polishedText = data.choices?.[0]?.message?.content || '';
        console.log('Received polished text from Standard API.');
      } catch (standardError) {
        console.error('Standard API Error during polish:', standardError);
        throw new Error(`Standard API request failed: ${standardError instanceof Error ? standardError.message : String(standardError)}`);
      }
    }

    return NextResponse.json({ polishedText });

  } catch (error) {
    console.error('Error in /api/ai/polish:', error);
    let errorMessage = 'Internal Server Error';
    let errorDetails = 'An unexpected error occurred.';
    if (error instanceof Error) {
      errorMessage = 'Failed to polish text';
      errorDetails = error.message;
    }
    if (errorDetails.includes('API key') || errorDetails.includes('credential')) {
      errorDetails = 'AI service authentication or configuration error.';
    }
    return NextResponse.json({ error: errorMessage, details: errorDetails }, { status: 500 });
  }
} 