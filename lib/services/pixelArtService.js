import { prisma } from '@/lib/prisma';
import { toBigIntOrNull } from '@/lib/utils/bigint';

/**
 * שירות שליחת תרומות ל-PixelArt (bsd1.app).
 *
 * ההגדרות נשמרות על הקמפיין תחת webhookSettings.pixelart:
 *   { enabled: boolean, eventId: string|number, apiKey: string }
 *
 * שים לב: ה-API של PixelArt מקבל סכומים באגורות — 100 = ‏1.00 ש"ח.
 * לכן monthly_amount נשלח כשקלים * 100.
 */

// שליפת הגדרות PixelArt מתוך webhookSettings של הקמפיין
export function getPixelArtSettings(webhookSettings) {
    const px = webhookSettings?.pixelart;
    if (!px || !px.enabled) return null;
    const eventId = px.eventId ? String(px.eventId).trim() : '';
    if (!eventId) return null;
    return {
        eventId,
        apiKey: px.apiKey ? String(px.apiKey).trim() : ''
    };
}

// קריאת HTTP בסיסית ל-PixelArt
async function postToPixelArt(eventId, apiKey, payload) {
    const query = apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : '';
    const url = `https://bsd1.app/api/e/${encodeURIComponent(eventId)}/donation${query}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('PixelArt API error response:', response.status, errorText);
        throw new Error(`PixelArt HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
}

/**
 * שולח תרומה בודדת ל-PixelArt אם הקמפיין מוגדר לכך.
 * בטוח לקריאה עבור כל תרומה — אם ההגדרה כבויה פשוט מדלג.
 *
 * @param {number} donationId
 * @returns {Promise<{success:boolean, skipped?:boolean, error?:string}>}
 */
export async function sendDonationToPixelArt(donationId) {
    try {
        const donation = await prisma.donation.findUnique({
            where: { id: donationId },
            include: {
                donor: {
                    include: {
                        person: {
                            include: {
                                city: { select: { name: true } },
                                street: { select: { name: true } }
                            }
                        },
                        campaign: {
                            select: { id: true, webhookSettings: true, donationType: true }
                        }
                    }
                }
            }
        });

        if (!donation?.donor?.campaign) {
            return { success: false, skipped: true };
        }

        const campaign = donation.donor.campaign;
        const settings = getPixelArtSettings(campaign.webhookSettings);
        if (!settings) {
            return { success: false, skipped: true };
        }

        const person = donation.donor.person;
        const monthly = Number(donation.monthlyAmount) || 0;
        const months = donation.numberOfPayments || 1;
        const total = monthly * months;

        // מציאת שם הדרגה התואמת (אם קיימת דרגה כזו בקמפיין).
        // בקמפיין חודשי הדרגה נמדדת לפי הסכום החודשי; בקמפיין גלובלי/פרויקט לפי הסכום הכולל.
        // זה תואם לאופן שבו התורם בוחר דרגה בטופס התרומה.
        const rankMatchAmount = campaign.donationType === 'monthly' ? monthly : total;
        let rankTitle = null;
        const ranks = await prisma.rank.findMany({
            where: { campaignId: campaign.id },
            select: { name: true, amount: true }
        });
        const matchedRank = ranks.find(r => r.amount != null && Number(r.amount) === rankMatchAmount);
        if (matchedRank) rankTitle = matchedRank.name;

        const address = person?.street?.name
            ? `${person.houseNumber || ''} ${person.street.name}`.trim()
            : null;

        const payload = {
            ...(person?.titleBefore && { title: person.titleBefore }),
            ...(person?.firstName && { first_name: person.firstName }),
            ...(person?.lastName && { last_name: person.lastName }),
            ...(person?.titleAfter && { suffix: person.titleAfter }),
            ...(person?.mainMobile && { phone: person.mainMobile }),
            ...(person?.email && { email: person.email }),
            ...(address && { address }),
            ...(person?.city?.name && { town: person.city.name }),
            donation: {
                // PixelArt מצפה לאגורות: 100 = ‏1.00 ש"ח
                monthly_amount: Math.round(monthly * 100),
                num_of_months: months,
                ...(rankTitle && { title: rankTitle }),
                ...(donation.dedication && { dedication: donation.dedication }),
            }
        };

        console.log(`📤 Sending donation ${donation.id} to PixelArt event ${settings.eventId}`);
        const result = await postToPixelArt(settings.eventId, settings.apiKey, payload);

        // שמירת מזהה התרומה החיצוני שהתקבל — רק אם אין כבר מזהה חיצוני
        // (כדי לא לדרוס מזהה עסקה של ספק תשלום כמו נדרים פלוס)
        if (result?.donation?.id && !donation.externalDonationId) {
            const externalId = toBigIntOrNull(result.donation.id);
            if (externalId != null) {
                await prisma.donation.update({
                    where: { id: donation.id },
                    data: { externalDonationId: externalId }
                });
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Error sending donation to PixelArt:', error);
        return { success: false, error: error.message || 'שגיאה בשליחה ל-PixelArt' };
    }
}
