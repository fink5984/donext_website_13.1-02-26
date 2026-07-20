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
        data,
        select: { id: true, fundraiserId: true, previousFundraiserId: true },
    });
}
