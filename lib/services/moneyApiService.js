import { prisma } from '@/lib/prisma';

/**
 * בדיקה אם קמפיין פעיל באינטגרציה עם Money
 * @param {number} campaignId - מזהה הקמפיין
 * @returns {Promise<Object|null>} - פרטי האינטגרציה או null
 */
export async function checkMoneyCampaign(campaignId) {
    try {
        const donationsApiCampaign = await prisma.donationsApiCampaign.findFirst({
            where: {
                donextCampaignId: parseInt(campaignId),
                active: true
            }
        });

        return donationsApiCampaign;
    } catch (error) {
        console.error('[Money API] Error checking campaign:', error);
        return null;
    }
}

/**
 * שליחת נתוני תרומה ל-Money API
 * @param {Object} campaignData - פרטי האינטגרציה מטבלת donations_api
 * @param {Object} donationData - נתוני התרומה
 * @returns {Promise<Object|null>} - תוצאת השליחה או null
 */
export async function sendToMoney(campaignData, donationData) {
    try {
        const payload = {
            campaign_id: campaignData.moneyCampaignId,
            donation_id: donationData.donationId,
            first_name: donationData.firstName,
            last_name: donationData.lastName,
            phone: donationData.phone,
            amount: donationData.amount,
            number_of_payments: donationData.numberOfPayments,
            has_payment_method: donationData.hasPaymentMethod,
            city_name: donationData.cityName
        };

        // אם יש donor_id קיים - שולחים אותו כדי לא ליצור כפילות
        if (donationData.existingMoneyDonorId) {
            payload.donor_id = donationData.existingMoneyDonorId;
        }

        console.log('[Money API] Sending donation:', payload);

        const response = await fetch('https://money-app.co.il/api/donext', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Money API] Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
        }

        const result = await response.json();
        console.log('[Money API] Success response:', result);
        return result;
    } catch (error) {
        console.error('[Money API] Error sending donation:', error);
        return null;
    }
}

/**
 * שליחת תרומה ל-Money ועדכון ה-moneyDonorId
 * פונקציה מאוחדת שבודקת אם הקמפיין פעיל ושולחת את התרומה
 * 
 * @param {Object} params - פרמטרים
 * @param {number} params.campaignId - מזהה הקמפיין
 * @param {number} params.donationId - מזהה התרומה
 * @param {string} params.firstName - שם פרטי
 * @param {string} params.lastName - שם משפחה
 * @param {string|number} params.phone - טלפון או מזהה התורם
 * @param {number} params.amount - סכום
 * @param {number} params.numberOfPayments - מספר תשלומים
 * @param {boolean} params.hasPaymentMethod - האם יש אמצעי תשלום
 * @param {string} params.cityName - שם העיר
 * @returns {Promise<{success: boolean, error?: string, moneyDonorId?: number}>}
 */
export async function sendDonationToMoney({
    campaignId,
    donationId,
    firstName,
    lastName,
    phone,
    amount,
    numberOfPayments,
    hasPaymentMethod,
    cityName
}) {
    try {
        // בדיקה אם הקמפיין פעיל באינטגרציה
        const moneyCampaign = await checkMoneyCampaign(campaignId);
        
        if (!moneyCampaign) {
            // הקמפיין לא מוגדר לאינטגרציה - זה לא שגיאה
            return { success: true, skipped: true };
        }

        // בדיקה אם יש moneyDonorId קיים לתורם הזה באותו קמפיין
        let existingMoneyDonorId = null;
        if (donationId) {
            try {
                // מחפשים את התרומה הנוכחית
                const currentDonation = await prisma.donation.findUnique({
                    where: { id: donationId },
                    include: { donor: { select: { personId: true, campaignId: true } } }
                });
                
                if (currentDonation?.donor?.personId) {
                    // מחפשים תרומה קודמת של אותו person באותו קמפיין שיש לה moneyDonorId
                    const existingDonation = await prisma.donation.findFirst({
                        where: {
                            moneyDonorId: { not: null },
                            donor: {
                                campaignId: currentDonation.donor.campaignId,
                                personId: currentDonation.donor.personId
                            }
                        },
                        select: { moneyDonorId: true }
                    });
                    
                    if (existingDonation?.moneyDonorId) {
                        existingMoneyDonorId = existingDonation.moneyDonorId;
                        console.log(`[Money API] Found existing moneyDonorId ${existingMoneyDonorId} for person ${currentDonation.donor.personId}`);
                    }
                }
            } catch (lookupError) {
                console.error('[Money API] Error looking up existing moneyDonorId:', lookupError);
            }
        }

        const donationData = {
            donationId,
            firstName: firstName || '',
            lastName: lastName || '',
            phone: phone?.toString() || '',
            amount: parseFloat(amount) || 0,
            numberOfPayments: numberOfPayments || 1,
            hasPaymentMethod: Boolean(hasPaymentMethod),
            cityName: cityName || null,
            existingMoneyDonorId
        };

        const result = await sendToMoney(moneyCampaign, donationData);
        
        if (!result) {
            return { success: false, error: 'שגיאה בשליחת הנתונים למערכת מוני' };
        }

        // עדכון ה-moneyDonorId אם התקבל
        if (result.donor_id && donationId) {
            try {
                await prisma.donation.update({
                    where: { id: donationId },
                    data: {
                        moneyDonorId: parseInt(result.donor_id)
                    }
                });
                console.log(`[Money API] Updated moneyDonorId to ${result.donor_id} for donation ${donationId}`);
            } catch (updateError) {
                console.error('[Money API] Error updating moneyDonorId:', updateError);
            }
        }

        return { 
            success: true, 
            moneyDonorId: result.donor_id ? parseInt(result.donor_id) : null 
        };

    } catch (error) {
        console.error('[Money API] Error in sendDonationToMoney:', error);
        return { success: false, error: error.message };
    }
}
