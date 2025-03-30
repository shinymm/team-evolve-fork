-- 添加管理员用户
INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'abigail830@163.com',
  'abigail830',
  'dHSF1FAAtxlifay2FASIE3IW2Up_NGtKmerkWdASxIh-T_yZ4bo',
  'ADMIN',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) 
DO UPDATE SET 
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  "updatedAt" = CURRENT_TIMESTAMP;

-- 添加普通用户
INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'qian.ping@thoughtworks.com',
  'qian.ping',
  'IUjFeVv_bBdLDRIfL5LF4kNoe2j1xrEyGhHDpY6na3zgd7b7zU8',
  'USER',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) 
DO UPDATE SET 
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  "updatedAt" = CURRENT_TIMESTAMP; 