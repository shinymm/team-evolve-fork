import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserAccessKeyService } from '@/lib/services/user-access-key-service';

// 处理查询Jira任务的GET请求
export async function GET(req: NextRequest) {
  try {
    // 获取当前会话用户
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    console.log('当前用户ID:', session.user.id);
    console.log('当前用户Email:', session.user.email);

    // 从URL获取查询参数
    const searchParams = req.nextUrl.searchParams;
    const systemName = searchParams.get('systemName');
    
    // 参数验证 - 为了保持接口兼容性，我们仍然需要systemName参数
    if (!systemName) {
      return NextResponse.json({ error: '系统名称不能为空' }, { status: 400 });
    }

    // 从环境变量获取JIRA管理员邮箱
    const jiraAdmin = process.env.JIRA_ADMIN;
    if (!jiraAdmin) {
      return NextResponse.json({ error: 'JIRA管理员配置缺失' }, { status: 500 });
    }
    console.log('JIRA管理员邮箱:', jiraAdmin);
    
    // 从环境变量获取JIRA域名
    const jiraDomain = process.env.JIRA_DOMAIN;
    if (!jiraDomain) {
      return NextResponse.json({ error: 'JIRA域名配置缺失' }, { status: 500 });
    }
    console.log('JIRA域名:', jiraDomain);
    
    // ====== 关键：从数据库获取Jira API Token ======
    let accessKeyData;
    try {
      accessKeyData = await UserAccessKeyService.getUserAccessKey(
        session.user.id,
        'JIRA' as any
      );
      if (!accessKeyData) {
        console.log('未找到JIRA访问密钥');
        return NextResponse.json({ error: '未找到JIRA访问密钥，请先在账户设置中配置' }, { status: 404 });
      }
      console.log('数据库加密token:', accessKeyData.encryptedAccessKey.substring(0, 10) + '...');
      console.log('解密后token:', accessKeyData.accessKey.substring(0, 15) + '...', '长度:', accessKeyData.accessKey.length);
    } catch (e) {
      console.error('获取或解密Jira token失败:', e);
      return NextResponse.json({ error: '获取或解密Jira token失败', details: (e as Error).message }, { status: 500 });
    }
    
    // ==========
    const jiraApiToken = accessKeyData.accessKey;
    
    // 获取Jira用户名，如果数据库中没有则使用环境变量中的JIRA_ADMIN
    const jiraUsername = accessKeyData.username || jiraAdmin;
    console.log('使用Jira用户名:', jiraUsername);
    
    // JQL
    const jql = `project=${systemName}`;
    const fields = 'key,summary,description,assignee,status.name,created,updated';
    
    // 构建URL参数
    const params = new URLSearchParams();
    params.append('jql', jql);
    params.append('fields', fields);
    
    // 构建Jira API请求URL
    const jiraApiUrl = `https://${jiraDomain}/rest/api/2/search`;
    
    console.log('Jira请求URL:', `${jiraApiUrl}?${params.toString()}`);
    console.log('JQL查询:', jql);
    console.log('授权信息:', `${jiraUsername}:***`);

    // 准备Authorization头
    const authHeader = `Basic ${Buffer.from(`${jiraUsername}:${jiraApiToken}`).toString('base64')}`;

    // 调用Jira API
    const jiraResponse = await fetch(`${jiraApiUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    });

    if (!jiraResponse.ok) {
      const errorText = await jiraResponse.text();
      console.error('Jira API返回状态码:', jiraResponse.status);
      console.error('Jira API错误原始响应:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: errorText };
      }
      
      console.error('Jira API错误:', errorData);
      return NextResponse.json(
        { error: '查询Jira任务失败', details: errorData }, 
        { status: jiraResponse.status }
      );
    }

    // 获取并处理Jira返回的数据
    const tasksData = await jiraResponse.json();
    console.log('Jira返回任务数量:', tasksData.issues?.length || 0);
    
    // 处理数据，只保留assignee中的displayName
    const processedData = {
      ...tasksData,
      issues: tasksData.issues.map((issue: any) => {
        // 创建新的issue对象
        const processedIssue = {
          ...issue,
          fields: {
            ...issue.fields,
            // 处理assignee字段
            assignee: issue.fields.assignee 
              ? { displayName: issue.fields.assignee.displayName } 
              : null
          }
        };
        return processedIssue;
      })
    };
    
    return NextResponse.json(processedData);

  } catch (error) {
    console.error('查询Jira任务异常:', error);
    return NextResponse.json(
      { error: '查询Jira任务时发生错误', details: (error as Error).message },
      { status: 500 }
    );
  }
} 