import { NextRequest, NextResponse } from 'next/server';
import { UserAccessKeyService } from '@/lib/services/user-access-key-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 处理创建Jira任务的POST请求
export async function POST(req: NextRequest) {
  try {
    // 获取当前会话用户
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 解析请求体
    const { summary, labels, systemName } = await req.json();
    
    // 参数验证
    if (!summary) {
      return NextResponse.json({ error: '任务摘要不能为空' }, { status: 400 });
    }
    
    if (!systemName) {
      return NextResponse.json({ error: '系统名称不能为空' }, { status: 400 });
    }

    // 从环境变量获取JIRA管理员邮箱
    const jiraAdmin = process.env.JIRA_ADMIN;
    if (!jiraAdmin) {
      return NextResponse.json({ error: 'JIRA管理员配置缺失' }, { status: 500 });
    }
    
    // 从环境变量获取JIRA域名
    const jiraDomain = process.env.JIRA_DOMAIN;
    if (!jiraDomain) {
      return NextResponse.json({ error: 'JIRA域名配置缺失' }, { status: 500 });
    }

    // 获取JIRA API密钥
    const accessKeyRecord = await UserAccessKeyService.getUserAccessKey(
      session.user.id,
      'JIRA' as any // 使用PlatformType.JIRA
    );

    if (!accessKeyRecord) {
      return NextResponse.json({ error: '未找到JIRA访问密钥' }, { status: 404 });
    }

    // 构建Jira API请求
    const jiraApiUrl = `https://${jiraDomain}/rest/api/2/issue`;
    const jiraRequestBody = {
      fields: {
        project: { key: systemName },
        summary: summary,
        issuetype: { name: 'Task' },
        labels: labels || []
      }
    };

    // 调用Jira API创建任务
    const jiraResponse = await fetch(jiraApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${jiraAdmin}:${accessKeyRecord.accessKey}`).toString('base64')}`
      },
      body: JSON.stringify(jiraRequestBody)
    });

    if (!jiraResponse.ok) {
      const errorData = await jiraResponse.json();
      console.error('Jira API错误:', errorData);
      return NextResponse.json(
        { error: '创建Jira任务失败', details: errorData }, 
        { status: jiraResponse.status }
      );
    }

    // 返回成功结果
    const taskData = await jiraResponse.json();
    return NextResponse.json({ 
      message: '成功创建Jira任务', 
      taskId: taskData.id,
      key: taskData.key,
      self: taskData.self
    });

  } catch (error) {
    console.error('创建Jira任务异常:', error);
    return NextResponse.json(
      { error: '创建Jira任务时发生错误', details: (error as Error).message },
      { status: 500 }
    );
  }
} 