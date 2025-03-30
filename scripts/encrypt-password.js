const algorithm = { name: 'AES-GCM', length: 256 };
const keyUsages = ['encrypt', 'decrypt'];

async function getKey() {
  try {
    const encryptionKey = "default-encryption-key-please-change-in-production";
    
    // 使用 SHA-256 生成固定长度的密钥材料
    const encoder = new TextEncoder();
    const keyData = encoder.encode(encryptionKey);
    
    const hash = await crypto.subtle.digest('SHA-256', keyData);
    
    return await crypto.subtle.importKey(
      'raw',
      hash,
      algorithm,
      false,
      keyUsages
    );
  } catch (error) {
    console.error('生成加密密钥失败:', error);
    throw error;
  }
}

async function encrypt(text) {
  try {
    if (!text) {
      return '';
    }

    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
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
    
    return base64;
  } catch (error) {
    console.error('加密失败:', error);
    throw error;
  }
}

async function main() {
  const passwords = ['1122335533', 'teamevolve'];
  for (const password of passwords) {
    const encrypted = await encrypt(password);
    console.log(`原始密码: ${password}`);
    console.log(`加密后: ${encrypted}`);
    console.log('---');
  }
}

main(); 