import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import OpenAI from 'openai'
import { decrypt } from '@/lib/utils/encryption-utils'
import { aiModelConfigService } from '@/lib/services/ai-model-config-service'

async function getDashScopeApiClient(): Promise<OpenAI> {
  console.log('尝试通过服务获取默认语言模型配置...');
  const modelConfig = await aiModelConfigService.getDefaultConfig();

  if (!modelConfig) {
    console.error('错误：通过服务未找到默认语言模型配置。');
    throw new Error('未配置默认语言模型API Key');
  }

  if (!modelConfig.apiKey) {
    console.error(`错误：默认语言模型配置 (ID: ${modelConfig.id}, Name: ${modelConfig.name}) 没有apiKey。`);
    throw new Error('默认语言模型配置缺少API Key');
  }
  
  console.log(`通过服务找到配置 (ID: ${modelConfig.id}, Name: ${modelConfig.name})，准备解密API Key...`);

  let decryptedApiKey = '';
  try {
    decryptedApiKey = await decrypt(modelConfig.apiKey);
  } catch (e) {
    console.error('错误：解密API Key失败:', e);
    throw new Error('解密API Key失败');
  }

  if (!decryptedApiKey) {
    console.error('错误：解密后的API Key为空。');
    throw new Error('解密后的API Key为空');
  }
  
  console.log('API Key解密成功。');

  const baseURL = modelConfig.baseURL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  console.log(`使用Base URL: ${baseURL}`);

  return new OpenAI({
    apiKey: decryptedApiKey,
    baseURL: baseURL,
  });
}

// DELETE /api/requirement-files/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const fileIdFromDb = params.id

  if (!fileIdFromDb) {
    return NextResponse.json({ error: '文件ID是必需的' }, { status: 400 })
  }

  let apiClientDetails: { apiKey: string; baseURL: string };
  try {
    const tempClient = await getDashScopeApiClient();
    if (!tempClient.apiKey || !tempClient.baseURL) {
        throw new Error('未能从API客户端获取apiKey或baseURL');
    }
    apiClientDetails = { apiKey: tempClient.apiKey, baseURL: tempClient.baseURL };
  } catch (error: any) {
    console.error('获取DashScope API客户端详情失败:', error);
    return NextResponse.json(
      { error: '初始化文件服务客户端详情失败', details: error.message || 'Unknown error' }, 
      { status: 500 }
    );
  }

  try {
    const fileRecord = await prisma.requirementFile.findUnique({
      where: { id: fileIdFromDb },
    })

    if (!fileRecord) {
      return NextResponse.json({ error: '文件记录未找到' }, { status: 404 })
    }

    if (fileRecord.qwenFileId) {
      console.log(`准备从阿里云删除文件，QwenFileId: ${fileRecord.qwenFileId}`);
      try {
        const fileIdToDeleteOnCloud = fileRecord.qwenFileId;
        
        const deleteUrl = `${apiClientDetails.baseURL}/files/${fileIdToDeleteOnCloud}`;
        console.log(`构造的删除URL: ${deleteUrl}`);

        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${apiClientDetails.apiKey}`,
          },
        });

        console.log(`阿里云文件删除API响应状态: ${response.status}`);

        if (!response.ok) {
          let errorDetailsText = `API responded with status ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetailsText += `: ${JSON.stringify(errorData)}`;
          } catch (e) {
            errorDetailsText += ` (unable to parse error response body)`;
          }
          console.error(`阿里云未能成功删除文件 ${fileIdToDeleteOnCloud}. ${errorDetailsText}`);
          return NextResponse.json(
            { error: '阿里云文件删除失败，数据库记录未删除', details: errorDetailsText },
            { status: 500 } 
          );
        }

        const deletionResult = await response.json(); 
        console.log('阿里云文件删除结果:', deletionResult);

        if (!deletionResult || !deletionResult.deleted) {
          console.error(`阿里云未能成功删除文件 ${fileIdToDeleteOnCloud} (API未返回deleted:true). Response: ${JSON.stringify(deletionResult)}`);
          return NextResponse.json(
            { error: '阿里云文件删除失败（API未确认删除），数据库记录未删除', details: deletionResult },
            { status: 500 }
          );
        }
        console.log(`阿里云文件 ${fileIdToDeleteOnCloud} 删除成功。`);
      } catch (aliError: any) {
        console.error(`调用阿里云API删除文件 ${fileRecord.qwenFileId} 失败 (catch block):`, aliError);
        return NextResponse.json(
          { error: '调用阿里云API删除文件时发生异常，数据库记录未删除', details: aliError.message || aliError.toString() },
          { status: 500 }
        );
      }
    } else {
      console.warn(`文件 ${fileIdFromDb} 在数据库中没有 qwenFileId，将仅尝试从数据库删除。`)
    }
    
    console.log(`准备从数据库删除记录 ID: ${fileIdFromDb}`)
    await prisma.requirementFile.delete({
      where: { id: fileIdFromDb },
    })
    console.log(`数据库记录 ${fileIdFromDb} 删除成功。`)

    return NextResponse.json({ message: '文件已成功删除', deletedFileId: fileRecord.qwenFileId || null })

  } catch (error: any) {
    console.error(`处理删除文件 ${fileIdFromDb} 的请求失败:`, error)
    if (error.code === 'P2025') { 
        return NextResponse.json({ error: '尝试删除时，数据库中未找到文件记录' }, { status: 404 })
    }
    return NextResponse.json({ error: '服务器内部错误导致文件删除失败', details: error.message || 'Unknown error' }, { status: 500 })
  }
}

// 可以在这里添加其他方法，例如 GET（获取单个文件信息）或 PUT（更新文件信息）
// 但根据需求，目前只需要 DELETE

// 可以在这里添加其他方法，例如 GET（获取单个文件信息）或 PUT（更新文件信息）
// 但根据需求，目前只需要 DELETE 