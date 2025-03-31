const algorithm = { name: 'AES-GCM', length: 256 };
const keyUsages: KeyUsage[] = ['encrypt', 'decrypt'];

// 生成一个固定的加密密钥
async function getKey(): Promise<CryptoKey> {
  try {
    const encryptionKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('NEXT_PUBLIC_ENCRYPTION_KEY 环境变量未设置');
    }
    
    // 使用 SHA-256 生成固定长度的密钥材料
    const encoder = new TextEncoder();
    const keyData = encoder.encode(encryptionKey);
    
    console.log('🔑 [密钥] 生成密钥材料...', {
      keyLength: encryptionKey.length,
      keyPreview: encryptionKey.substring(0, 5) + '...'
    });
    
    const hash = await crypto.subtle.digest('SHA-256', keyData);
    
    console.log('🔑 [密钥] 导入密钥...');
    return await crypto.subtle.importKey(
      'raw',
      hash,
      algorithm,
      false,
      keyUsages
    );
  } catch (error) {
    console.error('🔴 [密钥] 生成密钥失败:', error);
    throw new Error('生成加密密钥失败');
  }
}

export async function encrypt(text: string): Promise<string> {
  try {
    if (!text) {
      console.log('🔑 [加密] 输入为空，返回空字符串');
      return '';
    }

    console.log('🔑 [加密] 开始加密过程...', {
      inputLength: text.length,
      inputPreview: text.substring(0, 10) + '...'
    });
    
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    console.log('🔑 [加密] 加密数据中...', {
      textLength: text.length,
      dataLength: data.length
    });
    
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: algorithm.name,
        iv
      },
      key,
      data
    );

    const encryptedArray = new Uint8Array(encryptedData);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv);
    combined.set(encryptedArray, iv.length);

    // 使用URL安全的base64编码
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(combined)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    console.log('🔑 [加密] 加密完成', {
      inputLength: text.length,
      outputLength: base64.length,
      outputPreview: base64.substring(0, 20) + '...'
    });
    
    return base64;
  } catch (error) {
    console.error('🔴 [加密] 加密失败:', error);
    throw error;
  }
}

export async function decrypt(encryptedText: string): Promise<string> {
  try {
    if (!encryptedText) {
      console.log('🔑 [解密] 输入为空，返回空字符串');
      return '';
    }

    console.log('🔑 [解密] 开始解密过程...', {
      inputLength: encryptedText.length,
      inputPreview: encryptedText.substring(0, 20) + '...'
    });

    // 将URL安全的base64转换回标准base64
    const standardBase64 = encryptedText
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encryptedText.length / 4) * 4, '=');

    console.log('🔑 [解密] 转换为标准base64格式...');
    const binaryString = atob(standardBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const encryptedData = bytes.slice(12);

    console.log('🔑 [解密] 获取解密密钥...');
    const key = await getKey();
    
    console.log('🔑 [解密] 解密数据中...');
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: algorithm.name,
        iv
      },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    const result = decoder.decode(decryptedData);
    
    console.log('🔑 [解密] 解密完成', {
      inputLength: encryptedText.length,
      outputLength: result.length,
      outputPreview: result.substring(0, 10) + '...'
    });
    
    return result;
  } catch (error) {
    console.error('🔴 [解密] 解密失败:', error);
    if (error instanceof Error) {
      console.error('🔴 [解密] 错误详情:', error.message);
      console.error('🔴 [解密] 错误堆栈:', error.stack);
    }
    return '';
  }
} 