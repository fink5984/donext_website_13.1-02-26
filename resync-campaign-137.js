/**
 * סקריפט לאיפוס וסנכרון מחדש של כל התרומות של קמפיין 137 ל-Money
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MONEY_API_URL = 'https://money-app.co.il/api/donext';

async function sendToMoney(moneyCampaignId, donationData) {
    const payload = {
        campaign_id: moneyCampaignId,
        donation_id: donationData.donationId,
        first_name: donationData.firstName || '',
        last_name: donationData.lastName || '',
        phone: donationData.phone || '',
        amount: donationData.amount,
        number_of_payments: donationData.numberOfPayments || 1,
        has_payment_method: donationData.hasPaymentMethod || false,
        city_name: donationData.cityName || null
    };

    // אם יש donor_id קיים - שולחים אותו כדי לא ליצור כפילות
    if (donationData.existingMoneyDonorId) {
        payload.donor_id = donationData.existingMoneyDonorId;
    }

    try {
        const response = await fetch(MONEY_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`  ❌ Error sending donation ${donationData.donationId}:`, error.message);
        return null;
    }
}

async function resyncCampaign137() {
    console.log('='.repeat(60));
    console.log('🔄 איפוס וסנכרון מחדש - קמפיין 137 ל-Money');
    console.log('='.repeat(60));

    // שלב 1: איפוס כל ה-moneyDonorId
    console.log('\n📌 שלב 1: איפוס moneyDonorId...');
    const resetResult = await prisma.donation.updateMany({
        where: { donor: { campaignId: 137 } },
        data: { moneyDonorId: null }
    });
    console.log(`   ✅ אופסו ${resetResult.count} תרומות\n`);

    // שלב 2: מציאת המיפוי לקמפיין 137
    const campaign = await prisma.donationsApiCampaign.findFirst({
        where: { donextCampaignId: 137, active: true }
    });

    if (!campaign) {
        console.log('❌ קמפיין 137 לא מחובר ל-Money');
        return;
    }

    console.log(`📁 קמפיין DoNeXT: 137 -> Money: ${campaign.moneyCampaignId}`);

    // שלב 3: מציאת כל התרומות
    const donations = await prisma.donation.findMany({
        where: {
            donor: { campaignId: 137 },
            deleted_at: null
        },
        include: {
            donor: {
                select: {
                    id: true,
                    personId: true,
                    person: {
                        include: { city: { select: { name: true } } }
                    }
                }
            }
        },
        orderBy: { id: 'asc' } // סדר לפי תאריך יצירה
    });

    console.log(`📊 נמצאו ${donations.length} תרומות לשליחה\n`);

    let sent = 0, failed = 0;
    
    // מעקב אחר moneyDonorId לכל person
    const personToMoneyDonorId = new Map();

    for (const donation of donations) {
        const personId = donation.donor?.personId;
        
        // בדיקה אם כבר שלחנו תרומה מאותו person
        let existingMoneyDonorId = personId ? personToMoneyDonorId.get(personId) : null;

        const donationData = {
            donationId: donation.id,
            firstName: donation.donor?.person?.firstName,
            lastName: donation.donor?.person?.lastName,
            phone: donation.donor?.id?.toString(),
            amount: parseFloat(donation.monthlyAmount) || 0,
            numberOfPayments: donation.numberOfPayments || 1,
            hasPaymentMethod: donation.hasPaymentMethod || false,
            cityName: donation.donor?.person?.city?.name,
            existingMoneyDonorId
        };

        const donorIdInfo = existingMoneyDonorId ? ` [תורם קיים: ${existingMoneyDonorId}]` : ' [תורם חדש]';
        console.log(`  → תרומה ${donation.id}: ${donationData.firstName} ${donationData.lastName} - ₪${donationData.amount} x ${donationData.numberOfPayments}${donorIdInfo}`);

        const result = await sendToMoney(campaign.moneyCampaignId, donationData);

        if (result && result.donor_id) {
            const moneyDonorId = parseInt(result.donor_id);
            
            // עדכון ב-DB
            await prisma.donation.update({
                where: { id: donation.id },
                data: { moneyDonorId }
            });
            
            // שמירה במפה לתרומות הבאות של אותו person
            if (personId) {
                personToMoneyDonorId.set(personId, moneyDonorId);
            }
            
            console.log(`    ✅ נשלח, moneyDonorId: ${moneyDonorId}`);
            sent++;
        } else {
            failed++;
        }

        // השהייה קטנה
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📈 סיכום: ✅ ${sent} נשלחו | ❌ ${failed} נכשלו`);
    console.log(`👥 תורמים ייחודיים ב-Money: ${personToMoneyDonorId.size}`);
    console.log('='.repeat(60));
}

resyncCampaign137()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
