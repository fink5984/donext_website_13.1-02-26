const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    try {
        console.log('Checking campaign 111...\n');

        // Check donations
        const donations = await prisma.donation.findMany({
            where: {
                donor: { campaignId: 111 },
                deleted_at: null
            },
            select: {
                id: true,
                monthlyAmount: true,
                numberOfPayments: true
            },
            take: 20
        });
        console.log('Donations (first 20):');
        donations.forEach(d => {
            const total = (Number(d.monthlyAmount) || 0) * (Number(d.numberOfPayments) || 1);
            console.log(`  ID: ${d.id}, Monthly: ${d.monthlyAmount}, Payments: ${d.numberOfPayments}, Total: ${total}`);
        });
        console.log(`Total shown: ${donations.length}\n`);

        // Check ranks
        const ranks = await prisma.rank.findMany({
            where: { campaignId: 111 },
            select: { amount: true },
            orderBy: { amount: 'desc' }
        });
        console.log('Ranks:');
        ranks.forEach(r => {
            console.log(`  Amount: ${r.amount}`);
        });
        console.log(`Total ranks: ${ranks.length}\n`);

        // Count donations per rank (by total amount)
        const allDonations = await prisma.donation.findMany({
            where: {
                donor: { campaignId: 111 },
                deleted_at: null
            },
            select: {
                monthlyAmount: true,
                numberOfPayments: true
            }
        });
        
        for (const rank of ranks) {
            const count = allDonations.filter(d => {
                const total = (Number(d.monthlyAmount) || 0) * (Number(d.numberOfPayments) || 1);
                console.log(`  Comparing: ${total} === ${Number(rank.amount)} ? ${total === Number(rank.amount)}`);
                return total === Number(rank.amount);
            }).length;
            console.log(`Rank ${rank.amount}: ${count} donations (by total amount)\n`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
})();
