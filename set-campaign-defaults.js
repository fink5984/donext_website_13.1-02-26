const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    
    try {
        // First, add columns if they don't exist
        await prisma.$executeRawUnsafe("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(20) DEFAULT 'community'");
        console.log('Column campaign_type ensured');
        
        await prisma.$executeRawUnsafe("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS has_operators BOOLEAN DEFAULT false");
        console.log('Column has_operators ensured');
        
        await prisma.$executeRawUnsafe("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_event BOOLEAN DEFAULT false");
        console.log('Column is_event ensured');
        
        // Then update any NULL values
        const r1 = await prisma.$executeRawUnsafe("UPDATE campaigns SET campaign_type = 'community' WHERE campaign_type IS NULL");
        console.log('campaign_type updated:', r1, 'rows');
        
        const r2 = await prisma.$executeRawUnsafe("UPDATE campaigns SET has_operators = false WHERE has_operators IS NULL");
        console.log('has_operators updated:', r2, 'rows');
        
        const r3 = await prisma.$executeRawUnsafe("UPDATE campaigns SET is_event = false WHERE is_event IS NULL");
        console.log('is_event updated:', r3, 'rows');
        
        // Verify
        const campaigns = await prisma.$queryRawUnsafe("SELECT id, name, campaign_type, has_operators, is_event FROM campaigns");
        console.log('\nAll campaigns after update:');
        campaigns.forEach(c => {
            console.log(`  Campaign #${c.id} "${c.name}": type=${c.campaign_type}, operators=${c.has_operators}, event=${c.is_event}`);
        });
        
        console.log('\nDone!');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
