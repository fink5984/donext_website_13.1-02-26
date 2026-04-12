const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Check existing crowdfunding campaigns
    const campaigns = await prisma.$queryRawUnsafe(
        "SELECT c.id, c.name, c.campaign_type, pss.id as pss_id, pss.is_enabled FROM campaigns c LEFT JOIN public_screen_settings pss ON pss.campaign_id = c.id WHERE c.campaign_type = 'crowdfunding'"
    );
    console.log('Existing crowdfunding campaigns:', JSON.stringify(campaigns, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2));

    // Step 1: Enable for those that have settings but disabled
    const updated = await prisma.$executeRawUnsafe(
        "UPDATE public_screen_settings SET is_enabled = true, updated_at = NOW() WHERE campaign_id IN (SELECT id FROM campaigns WHERE campaign_type = 'crowdfunding') AND is_enabled = false"
    );
    console.log('Updated existing settings:', updated);

    // Step 2: Create settings for those without
    const inserted = await prisma.$executeRawUnsafe(
        "INSERT INTO public_screen_settings (campaign_id, is_enabled, created_at, updated_at) SELECT c.id, true, NOW(), NOW() FROM campaigns c LEFT JOIN public_screen_settings pss ON pss.campaign_id = c.id WHERE c.campaign_type = 'crowdfunding' AND pss.id IS NULL"
    );
    console.log('Created new settings:', inserted);

    // Verify
    const after = await prisma.$queryRawUnsafe(
        "SELECT c.id, c.name, c.campaign_type, pss.id as pss_id, pss.is_enabled FROM campaigns c LEFT JOIN public_screen_settings pss ON pss.campaign_id = c.id WHERE c.campaign_type = 'crowdfunding'"
    );
    console.log('After migration:', JSON.stringify(after, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
