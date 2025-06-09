type UserRole = 'USER' | 'ADMIN'

interface Permission {
  requiresAuth: boolean;
  allowedRoles?: UserRole[];
}

export const pagePermissions: Record<string, Permission> = {

  // AI能力胶囊 - 基础功能，匿名可用
  "/ai-capability/book-evolution": { requiresAuth: false },
  "/ai-capability/book": { requiresAuth: false },
  "/ai-capability/test-cases": { requiresAuth: false },
  "/ai-capability/test-format": { requiresAuth: false },

  // AI能力胶囊 - 高级功能，需要登录
  "/ai-capability/scene-analysis": { requiresAuth: false },
  "/ai-capability/book-confirm": { requiresAuth: false },
  "/ai-capability/user-story": { requiresAuth: false },
  "/ai-capability/test-detail": { requiresAuth: false },
  "/ai-capability/log-analysis": { requiresAuth: false, allowedRoles: ["ADMIN"]  },
  "/ai-capability/prd-review": { requiresAuth: false, allowedRoles: ["ADMIN"]  },

  // 知识熔炉 - 全部需要登录
  "/knowledge/glossary": { requiresAuth: true, allowedRoles: ["USER", "ADMIN"] },
  "/knowledge/requirement-summaries": { requiresAuth: true, allowedRoles: ["USER", "ADMIN"] },
  "/knowledge/information-architecture": { requiresAuth: true, allowedRoles: ["USER", "ADMIN"] },
  "/knowledge/system-architecture": { requiresAuth: true, allowedRoles: ["USER", "ADMIN"] },
  "/knowledge/api-interfaces": { requiresAuth: true, allowedRoles: ["USER", "ADMIN"] },
  "/knowledge/boundary": { requiresAuth: true, allowedRoles: ["USER", "ADMIN"] },
  "/knowledge/requirement-templates": { requiresAuth: true, allowedRoles: ["USER", "ADMIN"] },

    // 特殊能力胶囊 - 全部需要登录   
    "/special-capability/prompt-debug": { requiresAuth: true, allowedRoles: ["ADMIN"] },

  // 灵犀阁
  "/inspire/req-analysis-skill": { requiresAuth: true, allowedRoles: ["USER", "ADMIN"] },
  "/special-capability/requirement-upload": { requiresAuth: true, allowedRoles: ["USER", "ADMIN"] },
  "/special-capability/image-processing": { requiresAuth: true, allowedRoles: ["USER", "ADMIN"] },

  // 设置页面 - 仅管理员可访问
  "/settings/ai-models": { requiresAuth: true, allowedRoles: ["ADMIN"] },
  "/settings/ai-team-members": { requiresAuth: true, allowedRoles: ["USER", "ADMIN"] },
  "/settings/ai-team-applications": { requiresAuth: false },
};

// 检查路径是否需要认证
export function requiresAuth(path: string): boolean {
  const permission = pagePermissions[path];
  return permission?.requiresAuth ?? false;
}

// 检查路径是否允许指定角色访问
export function isRoleAllowed(path: string, role?: UserRole): boolean {
  const permission = pagePermissions[path];
  if (!permission?.requiresAuth) return true;
  if (!permission?.allowedRoles) return true;
  if (!role) return false;
  return permission.allowedRoles.includes(role);
}

// 获取路径的权限配置
export function getPathPermission(path: string): Permission | undefined {
  return pagePermissions[path];
}
