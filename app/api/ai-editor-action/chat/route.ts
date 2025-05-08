// File: app/api/ai-editor-action/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { aiModelConfigService } from '@/lib/services/ai-model-config-service';
import { decrypt } from '@/lib/utils/encryption-utils';
import {
    AIModelConfig,
    isGeminiModel,
    getApiEndpointAndHeaders,
} from '@/lib/services/ai-service';

export async function POST(req: NextRequest) {
    try {
        // AiActionExecutor sends the prompt generated from the template
        const { prompt } = await req.json();

        if (!prompt || typeof prompt !== 'string') {
            return NextResponse.json({ error: 'Invalid input: prompt is required' }, { status: 400 });
        }

        // 1. Get default AI config
        const config = await aiModelConfigService.getDefaultConfig();
        if (!config) {
            console.error('AI Editor Action API Error: Default AI config not found.');
            return NextResponse.json(
                { error: '未找到默认AI模型配置', details: 'Default AI config not found.' },
                { status: 404 }
            );
        }
        if (!config.model || !config.apiKey) {
             console.error('AI Editor Action API Error: Default AI config is missing model or apiKey.');
            return NextResponse.json(
                { error: '默认AI配置无效', details: 'Default AI config is missing model or apiKey.' },
                { status: 500 }
            );
        }

        // 2. Decrypt API key
        let decryptedApiKey: string;
        try {
            decryptedApiKey = await decrypt(config.apiKey);
        } catch (decryptionError) {
            console.error('AI Editor Action API Error: Failed to decrypt API key.', decryptionError);
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
        let aiResultText = '';

        console.log(`AI Editor Action request using model: ${finalConfig.model} (Is Gemini: ${isGemini})`);

        // 3. Call the appropriate AI Service
        if (isGemini) {
            try {
                const genAI = new GoogleGenerativeAI(finalConfig.apiKey);
                const model = genAI.getGenerativeModel({ model: finalConfig.model });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                aiResultText = response.text();
                console.log('Received result from Gemini.');
            } catch (geminiError) {
                console.error('Gemini API Error during AI editor action:', geminiError);
                throw new Error(`Gemini API request failed: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}`);
            }
        } else {
            // Standard OpenAI-compatible API
            try {
                const { endpoint, headers } = getApiEndpointAndHeaders(finalConfig);
                console.log(`Sending AI editor action request to standard endpoint: ${endpoint}`);
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        model: finalConfig.model,
                        // Assuming simple user prompt, adjust if using chat history
                        messages: [{ role: 'user', content: prompt }], 
                        temperature: finalConfig.temperature ?? 0.7, // Use configured or default temp
                        stream: false, // Set to false for OutputForm.TEXT
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Standard API Error during AI editor action (${response.status}): ${errorText}`);
                    throw new Error(`API request failed (${response.status}): ${errorText}`);
                }

                const data = await response.json();
                // Adjust based on actual API response structure
                aiResultText = data.choices?.[0]?.message?.content || ''; 
                console.log('Received result from Standard API.');
            } catch (standardError) {
                console.error('Standard API Error during AI editor action:', standardError);
                throw new Error(`Standard API request failed: ${standardError instanceof Error ? standardError.message : String(standardError)}`);
            }
        }

        // 4. Return response expected by AiActionExecutor for OutputForm.TEXT
        // It expects a JSON object with a 'result' key containing the text
        return NextResponse.json({ result: aiResultText });

    } catch (error) {
        console.error('Error in /api/ai-editor-action/chat:', error);
        let errorMessage = 'Internal Server Error';
        let errorDetails = 'An unexpected error occurred.';
        if (error instanceof Error) {
            errorMessage = 'Failed to execute AI editor action';
            errorDetails = error.message;
        }
        // Sanitize potentially sensitive details like API keys
        if (errorDetails.includes('API key') || errorDetails.includes('credential')) {
           errorDetails = 'AI service authentication or configuration error.';
        }
        // Return error in a structure AiActionExecutor might understand or log
        return NextResponse.json({ error: errorMessage, details: errorDetails }, { status: 500 });
    }
} 