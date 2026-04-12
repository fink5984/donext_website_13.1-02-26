import { NextResponse } from 'next/server';
import { getCampaignId, getOperatorId } from '@/lib/auth';
import { handlePrismaError } from '@/lib/prisma/utils';
import {
    getFundraisers,
    createFundraiser,
    createFundraisersInBatch,
    updateFundraiserStatus,
    deleteFundraiser
} from './services';


export async function GET(request) {
    try {
        const campaignId = getCampaignId(request);
        const operatorIdFromToken = getOperatorId(request);
        const { searchParams } = new URL(request.url);

        const filters = {};
        const filtersFields = ['city', 'street', 'houseNumber', 'donorsCountRangeMin', 'donorsCountRangeMax', 'expectedRangeMin', 'expectedRangeMax', 'actualRangeMin', 'actualRangeMax', 'trafficScore', 'firstName', 'lastName', 'mobile', 'phone', 'email', 'search'];
        filtersFields.forEach(field => {
            const value = searchParams.get(field);
            if (value) {
                filters[field] = typeof value === 'string' ? value.trim() : value;
            }
        });

        const params = {
            campaignId,
            fundraiserId: searchParams.get('fundraiserId'),
            operatorId: searchParams.get('operatorId') || operatorIdFromToken,
            profile: searchParams.get('profile'),
            count: searchParams.get('count'),
            idsOnly: searchParams.get('idsOnly'),
            limit: searchParams.has('limit') ? parseInt(searchParams.get('limit'), 10) : null,
            offset: parseInt(searchParams.get('offset') || '0', 10),
            sortField: searchParams.get('sortField'),
            sortDirection: searchParams.get('sortDirection'),
            filters
        };

        const result = await getFundraisers(params);
        return NextResponse.json(result);

    } catch (error) {
        console.error('Error fetching fundraisers:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function PUT(req) {
    try {
        const { fundraiserId, statusUpdates } = await req.json();
        const result = await updateFundraiserStatus({ fundraiserId, statusUpdates });

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }
        return NextResponse.json(result, { status: result.status });

    } catch (error) {
        console.error('Error updating fundraiser status:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const data = await request.json();
        const campaignId = getCampaignId(request);

        // תמיכה ביצירה באצווה (מייבוא אקסל)
        if (data.personIds && Array.isArray(data.personIds)) {
            const result = await createFundraisersInBatch({
                personIds: data.personIds,
                campaignId,
                activeDonor: data.activeDonor
            });
            return NextResponse.json(result, { status: 201 });
        }

        // יצירה בודדת (קיים)
        const { personId, activeDonor } = data;
        const result = await createFundraiser({ personId, activeDonor, campaignId });

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }
        return NextResponse.json({ data: result.data }, { status: result.status });

    } catch (error) {
        console.error('Error creating fundraiser:', error);
        return NextResponse.json({ error: handlePrismaError(error) }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { fundraiserId, clearDonors } = await request.json();
        const result = await deleteFundraiser({ fundraiserId, clearDonors });
        
        if (result.error) {
            return NextResponse.json({ error: result.error, donors: result.donors }, { status: result.status });
        }
        return NextResponse.json(result, { status: result.status });

    } catch (error) {
        console.error('Error deleting fundraiser:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}