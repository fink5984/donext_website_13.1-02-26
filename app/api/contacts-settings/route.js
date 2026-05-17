import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ברירת מחדל של עמודות לדף אנשי קשר
const DEFAULT_COLUMN_DEFINITIONS = [
    { id: 'city', type: 'builtin', visible: true, order: 0, width: '90px' },
    { id: 'address', type: 'builtin', visible: true, order: 1, width: '140px' },
    { id: 'mobile', type: 'builtin', visible: true, order: 2, width: '100px' },
    { id: 'email', type: 'builtin', visible: false, order: 3, width: '140px' },
    { id: 'phoneLandline', type: 'builtin', visible: false, order: 4, width: '100px' },
    { id: 'secondaryMobile', type: 'builtin', visible: false, order: 5, width: '100px' },
    { id: 'fatherName', type: 'builtin', visible: false, order: 6, width: '100px' },
    { id: 'motherName', type: 'builtin', visible: false, order: 7, width: '100px' },
    { id: 'wifeName', type: 'builtin', visible: false, order: 8, width: '100px' },
    { id: 'grandfatherName', type: 'builtin', visible: false, order: 9, width: '100px' },
    { id: 'birthDate', type: 'builtin', visible: false, order: 10, width: '100px' },
    { id: 'personalId', type: 'builtin', visible: false, order: 11, width: '100px' },
    { id: 'clientSystemId', type: 'builtin', visible: false, order: 12, width: '100px' },
    { id: 'titleBefore', type: 'builtin', visible: false, order: 13, width: '80px' },
    { id: 'titleAfter', type: 'builtin', visible: false, order: 14, width: '80px' },
    { id: 'aptNumber', type: 'builtin', visible: false, order: 15, width: '80px' },
    { id: 'zipCode', type: 'builtin', visible: false, order: 16, width: '80px' },
    { id: 'mailingAddress', type: 'builtin', visible: false, order: 17, width: '160px' },
    { id: 'synagogue', type: 'builtin', visible: false, order: 18, width: '110px' },
    { id: 'campaigns', type: 'builtin', visible: true, order: 19, width: '130px' },
    { id: 'totalDonations', type: 'builtin', visible: true, order: 20, width: '110px' },
    { id: 'actualDonation', type: 'builtin', visible: false, order: 21, width: '110px' },
    { id: 'expectedDonation', type: 'builtin', visible: false, order: 22, width: '100px' },
    { id: 'fundraiser', type: 'builtin', visible: false, order: 23, width: '120px' },
    { id: 'source', type: 'builtin', visible: false, order: 24, width: '110px' },
    { id: 'standingOrder', type: 'builtin', visible: false, order: 25, width: '65px' },
    { id: 'rating', type: 'builtin', visible: false, order: 26, width: '90px' },
    { id: 'tags', type: 'builtin', visible: false, order: 27, width: '120px' },
];

/**
 * GET /api/contacts-settings?clientId=
 * שליפת הגדרות עמודות אנשי קשר ללקוח
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = parseInt(searchParams.get('clientId'));

        if (!clientId) {
            return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
        }

        const settings = await prisma.contactsColumnSettings.findUnique({
            where: { clientId },
        });

        if (settings) {
            return NextResponse.json(settings);
        }

        // החזרת ברירת מחדל אם אין הגדרות שמורות
        return NextResponse.json({
            clientId,
            columnDefinitions: DEFAULT_COLUMN_DEFINITIONS,
            isDefault: true,
        });
    } catch (error) {
        console.error('Error fetching contacts settings:', error);
        return NextResponse.json({ error: 'Failed to fetch contacts settings' }, { status: 500 });
    }
}

/**
 * PUT /api/contacts-settings
 * עדכון/יצירה של הגדרות עמודות אנשי קשר
 */
export async function PUT(request) {
    try {
        const body = await request.json();
        const { clientId, columnDefinitions } = body;

        if (!clientId || !columnDefinitions) {
            return NextResponse.json(
                { error: 'clientId and columnDefinitions are required' },
                { status: 400 }
            );
        }

        // Validate structure
        if (!Array.isArray(columnDefinitions)) {
            return NextResponse.json(
                { error: 'columnDefinitions must be an array' },
                { status: 400 }
            );
        }

        const settings = await prisma.contactsColumnSettings.upsert({
            where: { clientId: parseInt(clientId) },
            update: { columnDefinitions },
            create: {
                clientId: parseInt(clientId),
                columnDefinitions,
            },
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error saving contacts settings:', error);
        return NextResponse.json({ error: 'Failed to save contacts settings' }, { status: 500 });
    }
}
