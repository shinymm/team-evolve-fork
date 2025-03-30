"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const encryption_utils_1 = require("../lib/utils/encryption-utils");
const prisma = new client_1.PrismaClient();
async function createUser(email, password, role) {
    try {
        const encryptedPassword = await (0, encryption_utils_1.encrypt)(password);
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: encryptedPassword,
                role
            },
            create: {
                email,
                name: email.split('@')[0],
                password: encryptedPassword,
                role
            }
        });
        console.log(`✅ 用户创建成功: ${email}`);
        return user;
    }
    catch (error) {
        console.error(`❌ 创建用户失败 ${email}:`, error);
        throw error;
    }
}
async function main() {
    try {
        // 创建管理员用户
        await createUser('abigail830@163.com', '1122335533', 'ADMIN');
        // 创建普通用户
        await createUser('qian.ping@thoughtworks.com', 'teamevolve', 'USER');
        console.log('✨ 所有用户创建完成');
    }
    catch (error) {
        console.error('❌ 创建用户过程中发生错误:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
