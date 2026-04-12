/**
 * סקריפט לסנכרון תרומות היסטוריות ל-Money
 * מעבר על כל התרומות בקמפיינים שמחוברים ל-Money ושליחתן
 * 
 * הרצה: node sync-donations-to-money.js
 * הרצה יבשה (ללא שליחה): node sync-donations-to-money.js --dry-run
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const MONEY_API_URL = 'https://money-app.co.il/api/donext';

// שליחת תרומה ל-Money
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

    if (DRY_RUN) {
        console.log('  [DRY RUN] Would send:', JSON.stringify(payload));
        return { success: true, donor_id: 'DRY_RUN' };
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

async function syncDonations() {
    console.log('='.repeat(60));
    console.log(DRY_RUN ? '🔍 DRY RUN MODE - לא שולח באמת' : '🚀 LIVE MODE - שולח ל-Money');
    console.log('='.repeat(60));
    console.log('');

    // מציאת כל הקמפיינים המחוברים ל-Money
    const activeCampaigns = await prisma.donationsApiCampaign.findMany({
        where: { active: true }
    });

    console.log(`📋 נמצאו ${activeCampaigns.length} קמפיינים מחוברים ל-Money`);
    console.log('');

    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const campaign of activeCampaigns) {
        console.log(`\n📁 קמפיין DoNeXT: ${campaign.donextCampaignId} -> Money: ${campaign.moneyCampaignId}`);
        console.log('-'.repeat(50));

        // מציאת כל התרומות בקמפיין שאין להן moneyDonorId (לא נשלחו עדיין)
        const donations = await prisma.donation.findMany({
            where: {
                donor: {
                    campaignId: campaign.donextCampaignId
                },
                deleted_at: null,
                moneyDonorId: null  // רק תרומות שלא נשלחו עדיין
            },
            include: {
                donor: {
                    include: {
                        person: {
                            include: {
                                city: { select: { name: true } }
                            }
                        }
                    }
                }
            }
        });

        console.log(`  📊 נמצאו ${donations.length} תרומות שלא נשלחו עדיין`);

        for (const donation of donations) {
            const donationData = {
                donationId: donation.id,
                firstName: donation.donor?.person?.firstName,
                lastName: donation.donor?.person?.lastName,
                phone: donation.donor?.id?.toString(),
                amount: parseFloat(donation.monthlyAmount) || 0,
                numberOfPayments: donation.numberOfPayments || 1,
                hasPaymentMethod: donation.hasPaymentMethod || false,
                cityName: donation.donor?.person?.city?.name
            };

            console.log(`  → תרומה ${donation.id}: ${donationData.firstName} ${donationData.lastName} - ₪${donationData.amount} x ${donationData.numberOfPayments}`);

            const result = await sendToMoney(campaign.moneyCampaignId, donationData);

            if (result) {
                totalSent++;
                
                // עדכון ה-moneyDonorId
                if (!DRY_RUN && result.donor_id) {
                    await prisma.donation.update({
                        where: { id: donation.id },
                        data: { moneyDonorId: parseInt(result.donor_id) }
                    });
                    console.log(`    ✅ נשלח בהצלחה, moneyDonorId: ${result.donor_id}`);
                } else if (DRY_RUN) {
                    console.log(`    ✅ [DRY RUN] היה נשלח בהצלחה`);
                }
            } else {
                totalFailed++;
            }

            // השהייה קטנה בין בקשות
            if (!DRY_RUN) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }

    // בדיקת תרומות שכבר נשלחו (יש להן moneyDonorId)
    const alreadySent = await prisma.donation.count({
        where: {
            donor: {
                campaignId: { in: activeCampaigns.map(c => c.donextCampaignId) }
            },
            deleted_at: null,
            moneyDonorId: { not: null }
        }
    });

    console.log('\n');
    console.log('='.repeat(60));
    console.log('📈 סיכום:');
    console.log(`  ✅ נשלחו: ${totalSent}`);
    console.log(`  ⏭️ כבר היו במערכת (moneyDonorId קיים): ${alreadySent}`);
    console.log(`  ❌ נכשלו: ${totalFailed}`);
    console.log('='.repeat(60));
}

syncDonations()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
