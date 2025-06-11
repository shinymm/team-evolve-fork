'use client';

import { useSession } from 'next-auth/react';

export function AuthStatus() {
  const { data: session, status } = useSession();

  console.log('AuthStatus - Session:', session);
  console.log('AuthStatus - Status:', status);

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-lg font-bold mb-2">认证状态</h2>
      <div className="space-y-2">
        <p>状态: {status}</p>
        {status === 'loading' ? (
          <p>加载中...</p>
        ) : session?.user ? (
          <div>
            <p>已登录</p>
            <p>用户邮箱: {session.user.email}</p>
            <p>用户角色: {session.user.role}</p>
            <p>用户ID: {session.user.id}</p>
            <p>用户名: {session.user.name}</p>
          </div>
        ) : (
          <div>
            <p>未登录</p>
            <p>Session数据: {JSON.stringify(session, null, 2)}</p>
          </div>
        )}
      </div>
    </div>
  );
} 