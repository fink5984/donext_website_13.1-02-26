import { prisma } from '@/lib/prisma';

/**
 * "כל הקהילה": פעולה ממשית (תרומה/הערה) של מתרים על תורם היא הטריגר היחיד
 * למעבר בעלות. אם לתורם כבר יש מתרים מוקצה שונה מהמבצע, ההקצאה נעקפת -
 * ה-fundraiserId הישן נשמר ב-previousFundraiserId כדי שהמתרים המוקצה המקורי
 * ימשיך לראות את התורם ב"רשימה שלי" שלו במצב "כבוי".
 * לא נוגע ב-trafficLightColor/expected - אלה לא רלוונטיים לתורם שנתפס מהקהילה.
 */
export async function transferDonorOwnership({ donorId, actingFundraiserId }, tx = prisma) {
    if (!donorId || !actingFundraiserId) return null;

    const donor = await tx.donor.findUnique({
        where: { id: Number(donorId) },
        select: { id: true, fundraiserId: true, previousFundraiserId: true },
    });
    if (!donor) return null;

    const actingId = Number(actingFundraiserId);
    if (donor.fundraiserId === actingId) return donor;

    const data = { fundraiserId: actingId };
    if (donor.fundraiserId != null && donor.previousFundraiserId == null) {
        data.previousFundraiserId = donor.fundraiserId;
    }

    return tx.donor.update({
        where: { id: donor.id },
        data: { ...data, inCommunityPool: false },
        select: { id: true, fundraiserId: true, previousFundraiserId: true },
    });
}

/**
 * מסמן שבוצעה פעולה ממשית (תרומה/הערה) על תורם - מוציא אותו סופית מ"כל הקהילה"
 * (ראו GET /api/donors/community). נקרא בכל יצירת תרומה/הערה, גם כשלא בוצע מעבר
 * בעלות (למשל תרומה רגילה על תורם שכבר שייך למתרים מ"הרשימה שלי").
 * ניתן להחזיר תורם ל"כל הקהילה" רק ע"י ביטול שיוך מפורש של מנהל (assign/route.js).
 */
export async function markDonorCaptured(donorId, tx = prisma) {
    if (!donorId) return null;
    return tx.donor.update({
        where: { id: Number(donorId) },
        data: { inCommunityPool: false },
        select: { id: true },
    }).catch(() => null);
}
