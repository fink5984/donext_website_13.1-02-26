require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
    try {
        const result = await prisma.$executeRawUnsafe(
            'ALTER TABLE "campaigns" ADD COLUMN "daily_tasks_email_enabled" BOOLEAN DEFAULT false'
        );
        console.log('✅ Migration successful:', result);
    } catch (e) {
        if (e.message.includes('already exists')) {
            console.log('⚠️ Column already exists, skipping.');
        } else {
            console.error('❌ Error:', e.message);
        }
    } finally {
        await prisma.$disconnect();
    }
}

migrate();
