import { NextResponse } from 'next/server';
import { handlePrismaError } from '@/lib/prisma/utils';
import { parseRequestParams } from './utils';
import { 
    getDonorPersonIds, 
    fetchDonorsForExport, 
    fetchDonorsWithPagination,
    deleteDonorsWithDonations,
    createDonors
} from './services';
import { getCampaignId, getOperatorId } from '@/lib/auth';

export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);
        const operatorId = getOperatorId(request);
        const { searchParams } = new URL(request.url);
        const params = parseRequestParams(searchParams, campaignId);
        
        // אם המשתמש הוא מפעיל - הוסף את operatorId לפרמטרים לסינון
        if (operatorId) {
          params.operatorId = operatorId;
        }

        // מסלול מהיר: החזרת מזהי person בלבד
        if (params.idsOnly) {
            const personIds = await getDonorPersonIds(campaignId);
            return NextResponse.json(personIds);
        }

        // מסלול ייצוא: ללא פגינציה
        if (params.forExport) {
            const result = await fetchDonorsForExport(params);
            return NextResponse.json(result);
        }

        // מסלול רגיל: עם פגינציה
        const result = await fetchDonorsWithPagination(params);
        return NextResponse.json(result);

    } catch (error) {
        console.error('Error fetching donors:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { donorIds } = await request.json();
        if (!Array.isArray(donorIds) || donorIds.length === 0) {
            return NextResponse.json({ error: 'יש לספק מערך donorIds למחיקה' }, { status: 400 });
        }

        const deletedCount = await deleteDonorsWithDonations(donorIds);
        return NextResponse.json({ message: `${deletedCount} תורמים נמחקו בהצלחה` });
        
    } catch (error) {
        console.error('שגיאה במחיקת תורמים:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const data = await request.json();
        const { campaignId, personIds } = data;

        if (!campaignId || !Array.isArray(personIds) || personIds.length === 0) {
            return NextResponse.json({ error: 'יש לספק campaignId ומערך personIds' }, { status: 400 });
        }

        const { donors, createdCount } = await createDonors(data);

        return NextResponse.json({
            message: `${createdCount} תורמים נוצרו בהצלחה`,
            donors,
            count: createdCount
        });
        
    } catch (error) {
        console.error('שגיאה ביצירת תורמים:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

